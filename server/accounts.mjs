import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync, existsSync, lstatSync, openSync, closeSync, constants } from 'node:fs';
import { dirname } from 'node:path';
import { parseGarden } from '../src/shared/model.ts';
import { HttpError } from './errors.mjs';
import { dataCodec } from './encryption.mjs';
export { HttpError } from './errors.mjs';
const derive = promisify(scrypt);
const digest = token => createHash('sha256').update(token).digest('hex');
export function openAccounts(path, { codec = dataCodec(), migrate = false, requireEncrypted = process.env.NODE_ENV === 'production' } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (path !== ':memory:') {
    if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())) throw new Error('Le fichier SQLite doit être un fichier régulier.');
    closeSync(openSync(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600));
  }
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS gardens (user_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);`);
  const readGarden = (data, id) => JSON.parse(codec.decode(data, `garden:${id}`));
  const encodeGarden = (garden, id) => codec.encode(JSON.stringify(garden), `garden:${id}`);
  try {
    db.exec('BEGIN IMMEDIATE');
    for (const row of db.prepare('SELECT user_id, data FROM gardens').iterate()) {
      readGarden(row.data, row.user_id); // Wrong or absent keys fail before serving requests.
      if (!codec.encrypted(row.data)) {
        if (migrate && codec.enabled) db.prepare('UPDATE gardens SET data=? WHERE user_id=?').run(codec.encode(row.data, `garden:${row.user_id}`), row.user_id);
        else if (requireEncrypted) throw new Error('Migration nécessaire : npm run security:migrate avant la production.');
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  function session(user) {
    const token = randomBytes(32).toString('base64url');
    const expires = Date.now() + 24 * 3600000;
    db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), user.id, expires);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND hash NOT IN (SELECT hash FROM sessions WHERE user_id=? ORDER BY rowid DESC LIMIT 5)').run(user.id, user.id);
    return { token, user: { id: user.id, email: user.email }, expiresAt: new Date(expires).toISOString() };
  }
  function credentials(input) {
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = input?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'Adresse e-mail valide et mot de passe de 12 à 128 caractères requis.');
    return { email, password };
  }
  function authenticate(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(401, 'Session expirée ou absente. Reconnectez-vous.');
    const user = db.prepare('SELECT users.id, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>?').get(digest(token), Date.now());
    if (!user) throw new HttpError(401, 'Session expirée ou absente. Reconnectez-vous.');
    return user;
  }
  return {
    db,
    codec,
    readGarden,
    encodeGarden,
    async register(input) {
      const { email, password } = credentials(input);
      const salt = randomBytes(16).toString('hex');
      const hash = (await derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })).toString('hex');
      const user = { id: randomUUID(), email };
      db.exec('BEGIN');
      try {
        if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new HttpError(409, 'Inscription impossible avec cette adresse. Essayez de vous connecter.');
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(user.id, email, salt, hash);
        db.prepare('INSERT INTO gardens(user_id, data) VALUES (?, ?)').run(user.id, encodeGarden({ plants: [], reminders: false }, user.id));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return session(user);
    },
    async login(input) {
      const { email, password } = credentials(input);
      const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      const computed = await derive(password, user?.salt ?? '00000000000000000000000000000000', 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
      if (!user || !timingSafeEqual(computed, Buffer.from(user.password_hash, 'hex'))) throw new HttpError(401, 'Adresse ou mot de passe incorrect.');
      if (db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash !== user.password_hash) throw new HttpError(401, 'Le compte a changé. Reconnectez-vous.');
      return session(user);
    },
    authenticate,
    logout(token) { db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token || '')); },
    logoutAll(token) {
      const user = authenticate(token);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      return { ok: true };
    },
    async changePassword(token, input) {
      const user = authenticate(token);
      const { password } = credentials({ email: user.email, password: input?.newPassword });
      if (typeof input?.currentPassword !== 'string' || input.currentPassword.length > 128) throw new HttpError(400, 'Mot de passe actuel requis.');
      const row = db.prepare('SELECT salt, password_hash FROM users WHERE id=?').get(user.id);
      const computed = await derive(input.currentPassword, row.salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
      if (!timingSafeEqual(computed, Buffer.from(row.password_hash, 'hex'))) throw new HttpError(401, 'Mot de passe actuel incorrect.');
      const salt = randomBytes(16).toString('hex');
      const hash = (await derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 })).toString('hex');
      // Recheck after expensive async work: logout or another password change wins.
      authenticate(token);
      db.exec('BEGIN IMMEDIATE');
      try {
        const changed = db.prepare('UPDATE users SET salt=?, password_hash=? WHERE id=? AND password_hash=?').run(salt, hash, user.id, row.password_hash);
        if (!changed.changes) throw new HttpError(409, 'Le compte a changé. Reconnectez-vous.');
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { ok: true };
    },
    getGarden(token) {
      const user = authenticate(token);
      const row = db.prepare('SELECT revision, data FROM gardens WHERE user_id=?').get(user.id);
      return { garden: readGarden(row.data, user.id), revision: row.revision };
    },
    putGarden(token, input) {
      const user = authenticate(token);
      if (!Number.isSafeInteger(input?.revision) || input.revision < 0) throw new HttpError(400, 'Version de collection invalide.');
      let garden;
      try { garden = parseGarden(JSON.stringify(input.garden)); }
      catch { throw new HttpError(400, 'Collection invalide.'); }
      if (garden.plants.length > 200 || new Set(garden.plants.map(p => p.id)).size !== garden.plants.length) throw new HttpError(400, 'Collection limitée à 200 plantes avec des identifiants uniques.');
      for (const plant of garden.plants) {
        if (plant.photo && (typeof plant.photo !== 'string' || !/^data:image\/(jpeg|png|webp|gif|heic|heif);base64,[A-Za-z0-9+/=]+$/.test(plant.photo))) throw new HttpError(400, 'Photo invalide. Importez une image depuis cet appareil.');
      }
      const data = JSON.stringify(garden);
      if (Buffer.byteLength(data) > 24 * 1024 * 1024) throw new HttpError(413, 'Collection trop volumineuse (24 Mo maximum, photos incluses).');
      const updated = db.prepare('UPDATE gardens SET data=?, revision=revision+1 WHERE user_id=? AND revision=?').run(codec.encode(data, `garden:${user.id}`), user.id, input.revision);
      if (!updated.changes) throw new HttpError(409, 'La collection a changé sur un autre appareil. Rechargez-la avant de réessayer.');
      return { revision: input.revision + 1 };
    },
    close() { db.close(); },
  };
}
