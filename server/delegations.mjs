import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { waterPlant } from '../src/model.ts';
const digest = value => createHash('sha256').update(value).digest('hex');
export function openDelegations(accounts, HttpError) {
  const { db, authenticate } = accounts;
  db.exec(`CREATE TABLE IF NOT EXISTS delegations (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL,
    guest_id TEXT REFERENCES users(id), invitation_hash TEXT UNIQUE,
    invitation_expires INTEGER NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0, plant_ids TEXT NOT NULL, notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS caretaker_actions (
    id TEXT PRIMARY KEY, delegation_id TEXT NOT NULL REFERENCES delegations(id),
    guest_id TEXT NOT NULL REFERENCES users(id), plant_id TEXT NOT NULL, watered_at TEXT NOT NULL);`);
  const fail = (status, message) => { throw new HttpError(status, message); };
  function view(row) {
    const now = Date.now();
    return { id: row.id, email: row.email, startsAt: new Date(row.starts).toISOString(), endsAt: new Date(row.ends).toISOString(),
      invitationExpiresAt: new Date(row.invitation_expires).toISOString(), plantIds: JSON.parse(row.plant_ids), notes: row.notes,
      status: row.revoked ? 'revoked' : row.ends <= now ? 'expired' : !row.guest_id ? row.invitation_expires <= now ? 'invitation-expired' : 'pending' : row.starts > now ? 'scheduled' : 'active' };
  }
  function authorized(token, id) {
    const user = authenticate(token);
    const row = db.prepare('SELECT * FROM delegations WHERE id=? AND guest_id=?').get(id, user.id);
    const now = Date.now();
    if (!row || row.revoked || row.starts > now || row.ends <= now) fail(403, 'Accès absent, révoqué ou hors de la période autorisée.');
    return { row, user };
  }
  return {
    create(token, input) {
      const owner = authenticate(token);
      const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
      const starts = typeof input?.startsAt === 'string' ? Date.parse(input.startsAt) : NaN;
      const ends = typeof input?.endsAt === 'string' ? Date.parse(input.endsAt) : NaN;
      const ids = input?.plantIds;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || email === owner.email) fail(400, 'Indiquez l’adresse e-mail de la personne invitée, différente de la vôtre.');
      if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts || ends <= Date.now() || ends - starts > 90 * 86400000) fail(400, 'Choisissez une période future de 90 jours maximum, avec une fin après le début.');
      const garden = accounts.getGarden(token).garden;
      if (!Array.isArray(ids) || !ids.length || ids.length > 200 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !garden.plants.some(p => p.id === id))) fail(400, 'Sélectionnez au moins une plante de votre collection.');
      if (typeof input.notes !== 'string' || input.notes.length > 2000) fail(400, 'Consignes limitées à 2 000 caractères.');
      if (db.prepare('SELECT COUNT(*) AS count FROM delegations WHERE owner_id=? AND revoked=0 AND ends>?').get(owner.id, Date.now()).count >= 50) fail(400, 'Révoquez une invitation avant d’en créer une nouvelle (50 maximum).');
      const invitation = randomBytes(32).toString('base64url');
      const id = randomUUID(), expires = Math.min(ends, Date.now() + 7 * 86400000);
      db.prepare('INSERT INTO delegations (id, owner_id, email, invitation_hash, invitation_expires, starts, ends, plant_ids, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, owner.id, email, digest(invitation), expires, starts, ends, JSON.stringify(ids), input.notes.trim());
      return { delegation: view(db.prepare('SELECT * FROM delegations WHERE id=?').get(id)), invitation };
    },
    list(token) {
      const user = authenticate(token);
      return { outgoing: db.prepare('SELECT * FROM delegations WHERE owner_id=? ORDER BY rowid DESC').all(user.id).map(view),
        incoming: db.prepare('SELECT * FROM delegations WHERE guest_id=? ORDER BY rowid DESC').all(user.id).map(view) };
    },
    accept(token, input) {
      const user = authenticate(token);
      if (typeof input?.invitation !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.invitation)) fail(400, 'Code d’invitation invalide.');
      const row = db.prepare('SELECT * FROM delegations WHERE invitation_hash=?').get(digest(input.invitation));
      if (!row || row.revoked || row.invitation_expires <= Date.now() || row.ends <= Date.now() || row.guest_id) fail(410, 'Invitation expirée, révoquée ou déjà utilisée.');
      if (row.email !== user.email) fail(403, 'Connectez-vous avec l’adresse e-mail à laquelle cette invitation est destinée.');
      db.prepare('UPDATE delegations SET guest_id=?, invitation_hash=NULL WHERE id=?').run(user.id, row.id);
      return { delegation: view({ ...row, guest_id: user.id }) };
    },
    revoke(token, id) {
      const user = authenticate(token);
      const result = db.prepare('UPDATE delegations SET revoked=1, invitation_hash=NULL WHERE id=? AND owner_id=?').run(id, user.id);
      if (!result.changes) fail(404, 'Invitation introuvable.');
      return { ok: true };
    },
    garden(token, id) {
      const { row } = authorized(token, id);
      const garden = JSON.parse(db.prepare('SELECT data FROM gardens WHERE user_id=?').get(row.owner_id).data);
      const ids = JSON.parse(row.plant_ids);
      // Exclude the owner's contact, house plan and account settings from the shared collection.
      return { delegation: view(row), plants: garden.plants.filter(p => ids.includes(p.id)).map(({ position, caretaker, ...plant }) => plant) };
    },
    water(token, id, input) {
      const { row, user } = authorized(token, id);
      if (typeof input?.plantId !== 'string' || !JSON.parse(row.plant_ids).includes(input.plantId)) fail(403, 'Cette plante ne fait pas partie des plantes confiées.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = db.prepare('SELECT data, revision FROM gardens WHERE user_id=?').get(row.owner_id);
        const garden = JSON.parse(stored.data);
        const plant = garden.plants.find(p => p.id === input.plantId);
        if (!plant) fail(404, 'La plante a été retirée de la collection.');
        const now = new Date();
        // Retrying a confirmation on the same calendar day must not duplicate watering history.
        if (!plant.lastWatered || plant.lastWatered.slice(0, 10) !== now.toISOString().slice(0, 10)) {
          garden.plants = garden.plants.map(p => p.id === plant.id ? waterPlant(p, now) : p);
          db.prepare('UPDATE gardens SET data=?, revision=revision+1 WHERE user_id=?').run(JSON.stringify(garden), row.owner_id);
          db.prepare('INSERT INTO caretaker_actions VALUES (?, ?, ?, ?, ?)').run(randomUUID(), row.id, user.id, plant.id, now.toISOString());
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return this.garden(token, id);
    },
    activity(token) {
      const user = authenticate(token);
      return db.prepare(`SELECT a.plant_id AS plantId, a.watered_at AS wateredAt, d.email
        FROM caretaker_actions a JOIN delegations d ON d.id=a.delegation_id
        WHERE d.owner_id=? ORDER BY a.watered_at DESC LIMIT 100`).all(user.id);
    },
  };
}
