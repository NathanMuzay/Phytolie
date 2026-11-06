import test from 'node:test';
import assert from 'node:assert/strict';
import { openAccounts, HttpError } from '../server/accounts.mjs';
import { openDelegations } from '../server/delegations.mjs';
const plant = { id: 'one', name: 'Aloe', species: 'Aloe vera', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: 'private contact', history: [] };
async function setup() {
  const accounts = openAccounts(':memory:');
  const password = 'Test-password-123!';
  const owner = await accounts.register({ email: 'owner@example.test', password });
  const guest = await accounts.register({ email: 'guest@example.test', password });
  const outsider = await accounts.register({ email: 'other@example.test', password });
  accounts.putGarden(owner.token, { revision: 0, garden: { plants: [plant, { ...plant, id: 'two', name: 'Private' }], reminders: false, caretaker: { name: 'Private', email: '', phone: '123', notes: 'private' } } });
  const delegates = openDelegations(accounts, HttpError);
  const input = { email: guest.user.email, startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), plantIds: ['one'], notes: 'Vérifier le terreau.' };
  return { accounts, owner, guest, outsider, delegates, input };
}
test('Optional account association remains email-bound and single-use; guests see only allowed plants and can confirm watering', async () => {
  const { accounts, delegates, owner, guest, outsider, input } = await setup();
  try {
    const created = delegates.create(owner.token, input), id = created.delegation.id;
    assert.notEqual(accounts.db.prepare('SELECT invitation_hash FROM delegations').get().invitation_hash, created.invitation);
    assert.throws(() => delegates.accept(outsider.token, { invitation: created.invitation }), e => e.status === 403);
    assert.throws(() => delegates.garden(guest.token, id), e => e.status === 403);
    delegates.accept(guest.token, { invitation: created.invitation });
    assert.throws(() => delegates.accept(guest.token, { invitation: created.invitation }), e => e.status === 410);
    const shared = delegates.garden(guest.token, id);
    assert.equal(shared.plants.length, 1);
    assert.equal(shared.plants[0].id, 'one');
    assert.equal(shared.plants[0].caretaker, undefined);
    assert.equal(shared.caretaker, undefined);
    assert.equal(accounts.getGarden(guest.token).garden.plants.length, 0);
    assert.throws(() => delegates.water(guest.token, id, { plantId: 'two' }), e => e.status === 403);
    assert.throws(() => delegates.water(outsider.token, id, { plantId: 'one' }), e => e.status === 403);
    assert.throws(() => delegates.revoke(guest.token, id), e => e.status === 404);
    delegates.water(guest.token, id, { plantId: 'one', name: 'Hacked', lastWatered: '1900-01-01' });
    delegates.water(guest.token, id, { plantId: 'one' });
    const garden = accounts.getGarden(owner.token);
    assert.equal(garden.revision, 2);
    assert.equal(garden.garden.plants[0].history.length, 1);
    assert.equal(garden.garden.plants[0].name, 'Aloe');
    assert.equal(garden.garden.plants[1].lastWatered, null);
    assert.equal(delegates.activity(owner.token)[0].email, guest.user.email);
    assert.equal(delegates.activity(outsider.token).length, 0);
    assert.throws(() => accounts.putGarden(owner.token, { revision: 1, garden: garden.garden }), e => e.status === 409);
  } finally { accounts.close(); }
});
test('Revocation, expiry, future start and expired invitations enforced server-side on reads and writes', async () => {
  const { accounts, delegates, owner, guest, input } = await setup();
  try {
    const created = delegates.create(owner.token, input), id = created.delegation.id;
    delegates.accept(guest.token, { invitation: created.invitation });
    accounts.db.prepare('UPDATE delegations SET starts=? WHERE id=?').run(Date.now() + 60000, id);
    assert.throws(() => delegates.garden(guest.token, id), e => e.status === 403);
    assert.throws(() => delegates.water(guest.token, id, { plantId: 'one' }), e => e.status === 403);
    accounts.db.prepare('UPDATE delegations SET starts=0, ends=0 WHERE id=?').run(id);
    assert.throws(() => delegates.garden(guest.token, id), e => e.status === 403);
    assert.throws(() => delegates.water(guest.token, id, { plantId: 'one' }), e => e.status === 403);
    const revoked = delegates.create(owner.token, input);
    delegates.accept(guest.token, { invitation: revoked.invitation });
    delegates.revoke(owner.token, revoked.delegation.id);
    assert.throws(() => delegates.garden(guest.token, revoked.delegation.id), e => e.status === 403);
    assert.throws(() => delegates.water(guest.token, revoked.delegation.id, { plantId: 'one' }), e => e.status === 403);
    const expired = delegates.create(owner.token, input);
    accounts.db.prepare('UPDATE delegations SET invitation_expires=0 WHERE id=?').run(expired.delegation.id);
    assert.throws(() => delegates.accept(guest.token, { invitation: expired.invitation }), e => e.status === 410);
    const pending = delegates.create(owner.token, input);
    delegates.revoke(owner.token, pending.delegation.id);
    assert.throws(() => delegates.accept(guest.token, { invitation: pending.invitation }), e => e.status === 410);
    accounts.logout(guest.token);
    assert.throws(() => delegates.list(guest.token), e => e.status === 401);
  } finally { accounts.close(); }
});
test('Malformed invitations, removed plants and invalid periods cannot grant or change access', async () => {
  const { accounts, delegates, owner, guest, input } = await setup();
  try {
    for (const patch of [{ email: owner.user.email }, { plantIds: [] }, { plantIds: ['one', 'one'] }, { plantIds: ['unknown'] }, { startsAt: 'bad' }, { endsAt: input.startsAt }, { notes: 'x'.repeat(2001) }, { endsAt: new Date(Date.now() + 100 * 86400000).toISOString() }]) {
      assert.throws(() => delegates.create(owner.token, { ...input, ...patch }), e => e.status === 400);
    }
    assert.throws(() => delegates.create(undefined, input), e => e.status === 401);
    assert.throws(() => delegates.accept(guest.token, { invitation: 'bad' }), e => e.status === 400);
    const created = delegates.create(owner.token, input);
    delegates.accept(guest.token, { invitation: created.invitation });
    accounts.putGarden(owner.token, { revision: 1, garden: { plants: [], reminders: false } });
    assert.equal(delegates.garden(guest.token, created.delegation.id).plants.length, 0);
    assert.throws(() => delegates.water(guest.token, created.delegation.id, { plantId: 'one' }), e => e.status === 404);
    assert.equal(accounts.getGarden(owner.token).revision, 2);
  } finally { accounts.close(); }
});

test('Archiving pauses existing guest access and new invitations; restoration keeps data and valid grants', async () => {
  const { accounts, delegates, owner, guest, input } = await setup();
  try {
    const invitation = delegates.create(owner.token, input);
    const id = invitation.delegation.id;
    delegates.accept(guest.token, { invitation: invitation.invitation });
    const before = accounts.getGarden(owner.token);
    const archived = { ...before.garden, plants: before.garden.plants.map(p => p.id === 'one' ? { ...p, archivedAt: new Date().toISOString() } : p) };
    accounts.putGarden(owner.token, { revision: before.revision, garden: archived });
    assert.deepEqual(delegates.garden(guest.token, id).plants, []);
    assert.throws(() => delegates.create(owner.token, input), e => e.status === 400);
    assert.throws(() => delegates.water(guest.token, id, { plantId: 'one' }), e => e.status === 409);
    assert.equal(accounts.getGarden(owner.token).revision, before.revision + 1);
    const restore = accounts.getGarden(owner.token);
    accounts.putGarden(owner.token, { revision: restore.revision, garden: { ...restore.garden, plants: restore.garden.plants.map(p => ({ ...p, archivedAt: undefined })) } });
    assert.equal(delegates.garden(guest.token, id).plants.length, 1);
    delegates.water(guest.token, id, { plantId: 'one' });
    assert.equal(accounts.getGarden(owner.token).garden.plants[0].careEvents[0].kind, 'watering');
  } finally { accounts.close(); }
});

test('Direct links are reusable without an account, hashed at rest, and expose only selected care data', async () => {
  const { accounts, delegates, owner, guest, input } = await setup();
  try {
    const before = accounts.getGarden(owner.token);
    accounts.putGarden(owner.token, { revision: before.revision, garden: { ...before.garden, plants: before.garden.plants.map(p => ({ ...p, description: 'private description', family: 'private family', history: ['2026-09-01T12:00:00Z'] })) } });
    const created = delegates.create(owner.token, { ...input, endsAt: new Date(Date.now() + 30 * 86400000).toISOString() });
    const usersBefore = accounts.db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    assert.equal(created.delegation.accessMode, 'link');
    assert.equal(created.delegation.status, 'active');
    assert.equal(created.delegation.invitationExpiresAt, created.delegation.endsAt);
    assert.notEqual(accounts.db.prepare('SELECT invitation_hash FROM delegations').get().invitation_hash, created.invitation);
    const shared = delegates.gardenWithLink(created.invitation);
    assert.equal(shared.owner.email, owner.user.email);
    assert.equal(shared.plants.length, 1);
    assert.equal(shared.plants[0].id, 'one');
    for (const field of ['position', 'caretaker', 'careEvents', 'history', 'lightReading', 'measurement', 'description', 'family', 'substrateDetails']) assert.equal(Object.hasOwn(shared.plants[0], field), false, field);
    assert.equal(shared.delegation.email, undefined);
    assert.equal(shared.delegation.notes, input.notes);
    assert.deepEqual(delegates.gardenWithLink(created.invitation), shared);
    assert.equal(accounts.db.prepare('SELECT COUNT(*) AS count FROM users').get().count, usersBefore);
    assert.throws(() => accounts.authenticate(created.invitation), e => e.status === 401);
    assert.throws(() => delegates.revoke(created.invitation, created.delegation.id), e => e.status === 401);
    // Old clients may still associate an invitation with an account; the direct link remains usable.
    delegates.accept(guest.token, { invitation: created.invitation });
    assert.equal(delegates.gardenWithLink(created.invitation).plants.length, 1);
  } finally { accounts.close(); }
});
test('Anonymous watering updates only the invited plant, records a link action and stays idempotent', async () => {
  const { accounts, delegates, owner, input } = await setup();
  try {
    const created = delegates.create(owner.token, input);
    assert.throws(() => delegates.waterWithLink(created.invitation, { plantId: 'two' }), e => e.status === 403);
    assert.throws(() => delegates.waterWithLink(created.invitation, {}), e => e.status === 403);
    delegates.waterWithLink(created.invitation, { plantId: 'one', name: 'Hacked', occurredAt: '1900-01-01', amountMl: 999 });
    delegates.waterWithLink(created.invitation, { plantId: 'one' });
    const saved = accounts.getGarden(owner.token);
    assert.equal(saved.revision, 2);
    assert.equal(saved.garden.plants[0].history.length, 1);
    assert.equal(saved.garden.plants[0].name, 'Aloe');
    assert.equal(saved.garden.plants[0].careEvents[0].amountMl, undefined);
    assert.equal(saved.garden.plants[1].lastWatered, null);
    assert.equal(accounts.db.prepare('SELECT guest_id FROM caretaker_actions').get().guest_id, null);
    assert.equal(delegates.activity(owner.token)[0].viaLink, 1);
    assert.equal(delegates.activity(owner.token)[0].email, input.email);
    assert.equal(delegates.activity(owner.token).length, 1);
    assert.throws(() => accounts.putGarden(owner.token, { revision: 1, garden: saved.garden }), e => e.status === 409);
  } finally { accounts.close(); }
});
test('Direct read and write enforce dates, original link expiry, revocation, removal and archiving', async () => {
  const { accounts, delegates, owner, input } = await setup();
  try {
    for (const code of [undefined, '', 'bad', 'a'.repeat(44)]) assert.throws(() => delegates.gardenWithLink(code), e => e.status === 401);
    assert.throws(() => delegates.gardenWithLink('a'.repeat(43)), e => e.status === 410);
    const created = delegates.create(owner.token, input), id = created.delegation.id, code = created.invitation;
    const rejectsBoth = status => {
      assert.throws(() => delegates.gardenWithLink(code), e => e.status === status);
      assert.throws(() => delegates.waterWithLink(code, { plantId: 'one' }), e => e.status === status);
    };
    accounts.db.prepare('UPDATE delegations SET starts=? WHERE id=?').run(Date.now() + 60000, id); rejectsBoth(403);
    accounts.db.prepare('UPDATE delegations SET starts=0, ends=0 WHERE id=?').run(id); rejectsBoth(410);
    accounts.db.prepare('UPDATE delegations SET ends=?, invitation_expires=0 WHERE id=?').run(Date.now() + 60000, id); rejectsBoth(410);
    accounts.db.prepare('UPDATE delegations SET invitation_expires=? WHERE id=?').run(Date.now() + 60000, id);
    const before = accounts.getGarden(owner.token);
    accounts.putGarden(owner.token, { revision: before.revision, garden: { ...before.garden, plants: before.garden.plants.map(p => ({ ...p, archivedAt: new Date().toISOString() })) } });
    assert.equal(delegates.gardenWithLink(code).plants.length, 0);
    assert.throws(() => delegates.waterWithLink(code, { plantId: 'one' }), e => e.status === 409);
    const archived = accounts.getGarden(owner.token);
    accounts.putGarden(owner.token, { revision: archived.revision, garden: { ...archived.garden, plants: [] } });
    assert.throws(() => delegates.waterWithLink(code, { plantId: 'one' }), e => e.status === 404);
    delegates.revoke(owner.token, id); rejectsBoth(410);
    assert.equal(accounts.db.prepare('SELECT COUNT(*) AS count FROM caretaker_actions').get().count, 0);
  } finally { accounts.close(); }
});
test('Legacy schema migrates without losing account access or action history; unused links retain their expiry', async () => {
  const { createHash } = await import('node:crypto');
  const accounts = openAccounts(':memory:');
  try {
    const password = 'Legacy-password-123!';
    const owner = await accounts.register({ email: 'legacy-owner@example.test', password });
    const guest = await accounts.register({ email: 'legacy-guest@example.test', password });
    accounts.putGarden(owner.token, { revision: 0, garden: { plants: [plant], reminders: false } });
    accounts.db.exec(`CREATE TABLE delegations (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL, guest_id TEXT REFERENCES users(id), invitation_hash TEXT UNIQUE,
      invitation_expires INTEGER NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, plant_ids TEXT NOT NULL, notes TEXT NOT NULL);
      CREATE TABLE caretaker_actions (id TEXT PRIMARY KEY, delegation_id TEXT NOT NULL REFERENCES delegations(id), guest_id TEXT NOT NULL REFERENCES users(id), plant_id TEXT NOT NULL, watered_at TEXT NOT NULL);`);
    const code = '_'.repeat(43), expiry = Date.now() + 3 * 86400000;
    const insert = accounts.db.prepare('INSERT INTO delegations VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)');
    insert.run('unused', owner.user.id, guest.user.email, null, createHash('sha256').update(code).digest('hex'), expiry, 0, Date.now() + 14 * 86400000, '["one"]', 'Anciennes consignes');
    insert.run('accepted', owner.user.id, guest.user.email, guest.user.id, null, expiry, 0, Date.now() + 14 * 86400000, '["one"]', 'Ancien accès');
    accounts.db.prepare('INSERT INTO caretaker_actions VALUES (?, ?, ?, ?, ?)').run('old-action', 'accepted', guest.user.id, 'one', '2026-09-01T12:00:00Z');
    let delegates = openDelegations(accounts, HttpError);
    assert.equal(delegates.gardenWithLink(code).delegation.notes, 'Anciennes consignes');
    assert.equal(accounts.db.prepare('SELECT invitation_expires FROM delegations WHERE id=?').get('unused').invitation_expires, expiry);
    assert.equal(delegates.garden(guest.token, 'accepted').plants.length, 1);
    assert.equal(delegates.activity(owner.token)[0].viaLink, 0);
    assert.equal(accounts.db.prepare('PRAGMA table_info(caretaker_actions)').all().find(column => column.name === 'guest_id').notnull, 0);
    delegates.waterWithLink(code, { plantId: 'one' });
    delegates = openDelegations(accounts, HttpError); // repeat startup must not repeat or damage the migration
    assert.equal(delegates.activity(owner.token).length, 2);
    assert.deepEqual(accounts.db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(delegates.garden(guest.token, 'accepted').plants[0].lastWatered, accounts.getGarden(owner.token).garden.plants[0].lastWatered);
  } finally { accounts.close(); }
});
