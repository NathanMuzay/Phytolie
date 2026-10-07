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
test('Invitation bound to account email, single-use, hashed; guest sees only allowed plants and can confirm watering', async () => {
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
