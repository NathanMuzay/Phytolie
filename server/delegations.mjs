import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { caretakerPlant } from '../src/features/caretakers/sharedGarden.ts';
import { waterPlant } from '../src/shared/model.ts';
const digest = value => createHash('sha256').update(value).digest('hex');
export function openDelegations(accounts, HttpError, { migrate = false, requireEncrypted = process.env.NODE_ENV === 'production' } = {}) {
  const { db, authenticate } = accounts;
  db.exec(`CREATE TABLE IF NOT EXISTS delegations (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL,
    guest_id TEXT REFERENCES users(id), invitation_hash TEXT UNIQUE,
    invitation_expires INTEGER NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0, link_access INTEGER NOT NULL DEFAULT 0, plant_ids TEXT NOT NULL, notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS caretaker_actions (
    id TEXT PRIMARY KEY, delegation_id TEXT NOT NULL REFERENCES delegations(id),
    guest_id TEXT REFERENCES users(id), plant_id TEXT NOT NULL, watered_at TEXT NOT NULL);`);
  const { codec } = accounts;
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('PRAGMA table_info(delegations)').all().some(column => column.name === 'link_access')) {
      db.exec('ALTER TABLE delegations ADD COLUMN link_access INTEGER NOT NULL DEFAULT 0');
      // Unused legacy links become direct access links, retaining their original expiry.
      db.exec('UPDATE delegations SET link_access=1 WHERE invitation_hash IS NOT NULL AND guest_id IS NULL');
    }
    if (db.prepare('PRAGMA table_info(caretaker_actions)').all().find(column => column.name === 'guest_id')?.notnull) {
      db.exec(`ALTER TABLE caretaker_actions RENAME TO caretaker_actions_legacy;
        CREATE TABLE caretaker_actions (
          id TEXT PRIMARY KEY, delegation_id TEXT NOT NULL REFERENCES delegations(id),
          guest_id TEXT REFERENCES users(id), plant_id TEXT NOT NULL, watered_at TEXT NOT NULL);
        INSERT INTO caretaker_actions SELECT * FROM caretaker_actions_legacy;
        DROP TABLE caretaker_actions_legacy;`);
    }
    for (const row of db.prepare('SELECT id, notes FROM delegations').iterate()) {
      codec.decode(row.notes, `delegation:${row.id}`);
      if (!codec.encrypted(row.notes)) {
        if (migrate && codec.enabled) db.prepare('UPDATE delegations SET notes=? WHERE id=?').run(codec.encode(row.notes, `delegation:${row.id}`), row.id);
        else if (requireEncrypted) throw new Error('Migration des consignes nécessaire : npm run security:migrate.');
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const fail = (status, message) => { throw new HttpError(status, message); };
  function view(row) {
    const now = Date.now();
    let status = 'active';
    if (row.revoked) status = 'revoked';
    else if (row.ends <= now) status = 'expired';
    else if (!row.guest_id && row.invitation_expires <= now) status = 'invitation-expired';
    else if (!row.link_access && !row.guest_id) status = 'pending';
    else if (row.starts > now) status = 'scheduled';
    return { id: row.id, email: row.email, startsAt: new Date(row.starts).toISOString(), endsAt: new Date(row.ends).toISOString(),
      invitationExpiresAt: new Date(row.invitation_expires).toISOString(), plantIds: JSON.parse(row.plant_ids), notes: codec.decode(row.notes, `delegation:${row.id}`),
      accessMode: row.link_access ? 'link' : 'account', status };
  }
  function authorized(token, id) {
    const user = authenticate(token);
    const row = db.prepare('SELECT * FROM delegations WHERE id=? AND guest_id=?').get(id, user.id);
    const now = Date.now();
    if (!row || row.revoked || row.starts > now || row.ends <= now) fail(403, 'Accès absent, révoqué ou hors de la période autorisée.');
    return { row, user };
  }
  function authorizedLink(code) {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) fail(401, 'Lien d’accès invalide. Ouvrez le lien complet reçu.');
    const row = db.prepare('SELECT * FROM delegations WHERE invitation_hash=? AND link_access=1').get(digest(code));
    const now = Date.now();
    if (!row || row.revoked || row.invitation_expires <= now || row.ends <= now) fail(410, 'Ce lien est invalide, expiré ou révoqué. Demandez un nouveau lien au propriétaire.');
    if (row.starts > now) fail(403, `Cet accès commence le ${new Date(row.starts).toLocaleString('fr-FR')}. Réessayez à partir de cette date.`);
    return row;
  }
  function sharedGarden(row) {
    const stored = db.prepare('SELECT data FROM gardens WHERE user_id=?').get(row.owner_id);
    if (!stored) fail(410, 'Ce jardin n’est plus disponible.');
    const garden = accounts.readGarden(stored.data, row.owner_id);
    const ids = JSON.parse(row.plant_ids);
    const { id, startsAt, endsAt, notes, status } = view(row);
    return { owner: { email: db.prepare('SELECT email FROM users WHERE id=?').get(row.owner_id).email },
      delegation: { id, startsAt, endsAt, notes, status },
      plants: garden.plants.filter(plant => ids.includes(plant.id) && !plant.archivedAt).map(caretakerPlant) };
  }
  function confirmWatering(row, guestId, input) {
    if (typeof input?.plantId !== 'string' || !JSON.parse(row.plant_ids).includes(input.plantId)) fail(403, 'Cette plante ne fait pas partie des plantes confiées.');
    db.exec('BEGIN IMMEDIATE');
    try {
      const stored = db.prepare('SELECT data, revision FROM gardens WHERE user_id=?').get(row.owner_id);
      if (!stored) fail(410, 'Ce jardin n’est plus disponible.');
      const garden = accounts.readGarden(stored.data, row.owner_id);
      const plant = garden.plants.find(p => p.id === input.plantId);
      if (plant?.archivedAt) fail(409, 'Cette plante est archivée. Son propriétaire doit la restaurer avant un soin.');
      if (!plant) fail(404, 'La plante a été retirée de la collection.');
      const now = new Date();
      if (!plant.lastWatered || plant.lastWatered.slice(0, 10) !== now.toISOString().slice(0, 10)) {
        let updated;
        try { updated = waterPlant(plant, now); }
        catch (error) { fail(409, error.message); }
        garden.plants = garden.plants.map(p => p.id === plant.id ? updated : p);
        db.prepare('UPDATE gardens SET data=?, revision=revision+1 WHERE user_id=?').run(accounts.encodeGarden(garden, row.owner_id), row.owner_id);
        db.prepare('INSERT INTO caretaker_actions (id, delegation_id, guest_id, plant_id, watered_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), row.id, guestId, plant.id, now.toISOString());
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return sharedGarden(row);
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
      if (!Array.isArray(ids) || !ids.length || ids.length > 200 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !garden.plants.some(p => p.id === id && !p.archivedAt))) fail(400, 'Sélectionnez au moins une plante de votre collection.');
      if (typeof input.notes !== 'string' || input.notes.length > 2000) fail(400, 'Consignes limitées à 2 000 caractères.');
      if (db.prepare('SELECT COUNT(*) AS count FROM delegations WHERE owner_id=? AND revoked=0 AND ends>?').get(owner.id, Date.now()).count >= 50) fail(400, 'Révoquez une invitation avant d’en créer une nouvelle (50 maximum).');
      const invitation = randomBytes(32).toString('base64url');
      const id = randomUUID(), expires = ends;
      db.prepare('INSERT INTO delegations (id, owner_id, email, invitation_hash, invitation_expires, starts, ends, plant_ids, notes, link_access) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
        .run(id, owner.id, email, digest(invitation), expires, starts, ends, JSON.stringify(ids), codec.encode(input.notes.trim(), `delegation:${id}`));
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
      db.prepare('UPDATE delegations SET guest_id=?, invitation_hash=? WHERE id=?').run(user.id, row.link_access ? row.invitation_hash : null, row.id);
      return { delegation: view({ ...row, guest_id: user.id }) };
    },
    revoke(token, id) {
      const user = authenticate(token);
      const result = db.prepare('UPDATE delegations SET revoked=1, invitation_hash=NULL WHERE id=? AND owner_id=?').run(id, user.id);
      if (!result.changes) fail(404, 'Invitation introuvable.');
      return { ok: true };
    },
    garden(token, id) { return sharedGarden(authorized(token, id).row); },
    water(token, id, input) {
      const { row, user } = authorized(token, id);
      return confirmWatering(row, user.id, input);
    },
    gardenWithLink(code) { return sharedGarden(authorizedLink(code)); },
    waterWithLink(code, input) { return confirmWatering(authorizedLink(code), null, input); },
    activity(token) {
      const user = authenticate(token);
      return db.prepare(`SELECT a.plant_id AS plantId, a.watered_at AS wateredAt, d.email, (a.guest_id IS NULL) AS viaLink
        FROM caretaker_actions a JOIN delegations d ON d.id=a.delegation_id
        WHERE d.owner_id=? ORDER BY a.watered_at DESC LIMIT 100`).all(user.id);
    },
  };
}
