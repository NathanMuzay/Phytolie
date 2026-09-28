import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openAccounts } from '../server/accounts.mjs';
import { mergeLocalPlants } from '../src/accountApi.ts';
const credentials = { email: 'alice@example.test', password: 'Test-password-123!' };
const plant = { id: 'plant-1', name: 'Aloe', species: 'Aloe vera', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: '', history: [], photo: 'data:image/png;base64,YWJj' };
const garden = { plants: [plant], reminders: false, reminderTime: '18:30' };
test('Accounts persist across reopening; passwords and session tokens are not stored in plaintext', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folia-account-'));
  let store = openAccounts(join(dir, 'accounts.sqlite'));
  try {
    const session = await store.register(credentials);
    const row = store.db.prepare('SELECT * FROM users').get();
    assert.notEqual(row.password_hash, credentials.password);
    assert.equal(row.salt.length, 32);
    assert.notEqual(store.db.prepare('SELECT hash FROM sessions').get().hash, session.token);
    assert.equal(store.putGarden(session.token, { garden, revision: 0 }).revision, 1);
    store.close(); store = openAccounts(join(dir, 'accounts.sqlite'));
    const login = await store.login({ ...credentials, email: ' ALICE@EXAMPLE.TEST ' });
    assert.deepEqual(store.getGarden(login.token), { garden, revision: 1 });
    const edited = { ...garden, plants: [{ ...plant, name: 'Aloe modifié' }] };
    store.putGarden(login.token, { garden: edited, revision: 1 });
    assert.equal(store.getGarden(login.token).garden.plants[0].name, 'Aloe modifié');
    store.putGarden(login.token, { garden: { ...garden, plants: [] }, revision: 2 });
    assert.equal(store.getGarden(login.token).garden.plants.length, 0);
    await assert.rejects(store.login({ ...credentials, password: 'Wrong-password-123' }), error => error.status === 401);
    await assert.rejects(store.register(credentials), error => error.status === 409);
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});
test('Tenant isolation, version conflicts, revoked and expired sessions', async () => {
  const store = openAccounts(':memory:');
  try {
    const alice = await store.register(credentials);
    const bob = await store.register({ ...credentials, email: 'bob@example.test' });
    store.putGarden(alice.token, { garden, revision: 0, user_id: bob.user.id });
    assert.equal(store.getGarden(bob.token).garden.plants.length, 0);
    assert.throws(() => store.putGarden(alice.token, { garden: { plants: [], reminders: false }, revision: 0 }), error => error.status === 409);
    assert.equal(store.getGarden(alice.token).garden.plants.length, 1);
    store.logout(alice.token);
    assert.throws(() => store.getGarden(alice.token), error => error.status === 401);
    store.db.prepare('UPDATE sessions SET expires=0').run();
    assert.throws(() => store.getGarden(bob.token), error => error.status === 401);
  } finally { store.close(); }
});
test('Malformed collections and device-only photos are rejected without modifying stored data', async () => {
  const store = openAccounts(':memory:');
  try {
    const session = await store.register(credentials);
    for (const bad of [{}, { ...garden, plants: [plant, plant] }, { ...garden, plants: [{ ...plant, photo: 'file:///private/photo.jpg' }] }, { ...garden, reminderTime: '25:00' }]) {
      assert.throws(() => store.putGarden(session.token, { garden: bad, revision: 0 }), error => error.status === 400);
    }
    assert.equal(store.getGarden(session.token).revision, 0);
    await assert.rejects(store.register({ email: 'invalid', password: 'short' }), error => error.status === 400);
  } finally { store.close(); }
});
test('Local import is repeatable and preserves account plants, settings and local copy', () => {
  const local = { ...garden, plants: [plant, { ...plant, id: 'plant-2' }] };
  const account = { ...garden, plants: [{ ...plant, name: 'Renamed' }], reminderTime: '07:00' };
  const merged = mergeLocalPlants(account, local);
  assert.equal(merged.plants.length, 2);
  assert.equal(merged.plants[0].name, 'Renamed');
  assert.equal(merged.reminderTime, '07:00');
  assert.deepEqual(mergeLocalPlants(merged, local), merged);
  assert.equal(local.plants[0].name, 'Aloe');
});
