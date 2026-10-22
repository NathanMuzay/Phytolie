import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { dataCodec } from '../server/encryption.mjs';
import { securityConfig, requestIdentity, createSecurity } from '../server/security.mjs';
import { openAccounts, HttpError } from '../server/accounts.mjs';
import { openDelegations } from '../server/delegations.mjs';

const key = 'ab'.repeat(32), auditKey = 'cd'.repeat(32);
const production = { NODE_ENV: 'production', FOLIA_TRUSTED_PROXIES: '127.0.0.1', FOLIA_DATA_KEY: key, FOLIA_AUDIT_KEY: auditKey };
const input = { email: 'secure@example.test', password: 'First-password-123!' };

test('Production configuration rejects unsafe origins, proxy settings, keys and limits', () => {
  const config = securityConfig(production);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.allowRegistration, false);
  for (const patch of [{ API_HOST: '0.0.0.0' }, { FOLIA_TRUSTED_PROXIES: '' }, { FOLIA_TRUSTED_PROXIES: '*' }, { FOLIA_AUDIT_KEY: '' }, { FOLIA_AUDIT_KEY: key }, { FOLIA_ALLOWED_ORIGINS: '*' }, { FOLIA_ALLOWED_ORIGINS: 'https://app.example.test/' }, { FOLIA_ALLOWED_ORIGINS: 'http://app.example.test' }, { FOLIA_IDENTIFY_DAILY_LIMIT: '0' }, { FOLIA_ALLOW_REGISTRATION: 'yes' }, { NODE_ENV: 'prod' }]) assert.throws(() => securityConfig({ ...production, ...patch }));
});
test('Forged forwarding headers are ignored; trusted proxy requires a single valid IP and HTTPS', () => {
  const request = (peer, headers) => ({ socket: { remoteAddress: peer }, headers });
  const config = securityConfig(production);
  assert.throws(() => requestIdentity(request('203.0.113.1', { 'x-forwarded-proto': 'https', 'x-forwarded-for': '192.0.2.1' }), config), e => e.status === 403);
  assert.throws(() => requestIdentity(request('127.0.0.1', { 'x-forwarded-proto': 'http', 'x-forwarded-for': '192.0.2.1' }), config), e => e.status === 403);
  assert.throws(() => requestIdentity(request('127.0.0.1', { 'x-forwarded-proto': 'https', 'x-forwarded-for': '192.0.2.1, 127.0.0.1' }), config), e => e.status === 400);
  assert.equal(requestIdentity(request('::ffff:127.0.0.1', { 'x-forwarded-proto': 'https', 'x-forwarded-for': '192.0.2.1' }), config).ip, '192.0.2.1');
  assert.equal(requestIdentity(request('203.0.113.1', { 'x-forwarded-for': '192.0.2.1' }), securityConfig({})).ip, '203.0.113.1');
});
test('Quotas persist after reopening and across changing IPs; capacity and concurrency fail closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folia-limits-'));
  const path = join(dir, 'limits.sqlite'); let db = new DatabaseSync(path);
  const config = securityConfig({ FOLIA_AUDIT_KEY: auditKey });
  try {
    let security = createSecurity(db, config);
    security.consume('user', 'opaque-user', 1, 60000, 1000);
    db.close(); db = new DatabaseSync(path); security = createSecurity(db, config);
    assert.throws(() => security.consume('user', 'opaque-user', 1, 60000, 2000), e => e.status === 429 && e.retryAfter === 59);
    security.consume('user', 'opaque-user', 1, 60000, 61000);
    const release = security.acquire('provider', 1);
    assert.throws(() => security.acquire('provider', 1), e => e.status === 503);
    release(); release(); security.acquire('provider', 1)();
    db.exec(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<20000) INSERT INTO security_limits SELECT 'capacity-'||x,1,9999999999999 FROM n;`);
    assert.throws(() => security.consume('other', 'new', 1, 60000), e => e.status === 503);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});
test('AES-GCM detects changed ciphertext, wrong keys and swapped owners', () => {
  const codec = dataCodec(key);
  const encrypted = codec.encode('private garden', 'garden:a');
  assert.notEqual(encrypted, codec.encode('private garden', 'garden:a'));
  assert.equal(codec.decode(encrypted, 'garden:a'), 'private garden');
  assert.throws(() => codec.decode(encrypted, 'garden:b'));
  assert.throws(() => dataCodec(auditKey).decode(encrypted, 'garden:a'));
  assert.throws(() => dataCodec(undefined, { required: true }));
  const bytes = Buffer.from(encrypted.slice(7), 'base64'); bytes[bytes.length - 1] ^= 1;
  assert.throws(() => codec.decode('enc:v1:' + bytes.toString('base64'), 'garden:a'));
});
test('Session cap, wrong current password, password change and global logout invalidate sessions', async () => {
  const store = openAccounts(':memory:');
  try {
    const first = await store.register(input);
    let latest;
    for (let i = 0; i < 5; i++) latest = await store.login(input);
    assert.throws(() => store.authenticate(first.token), e => e.status === 401);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 5);
    await assert.rejects(store.changePassword(latest.token, { currentPassword: 'wrong', newPassword: 'Second-password-123!' }), e => e.status === 401);
    await store.changePassword(latest.token, { currentPassword: input.password, newPassword: 'Second-password-123!' });
    assert.throws(() => store.authenticate(latest.token), e => e.status === 401);
    await assert.rejects(store.login(input), e => e.status === 401);
    const changed = await store.login({ ...input, password: 'Second-password-123!' });
    store.logoutAll(changed.token);
    assert.throws(() => store.authenticate(changed.token), e => e.status === 401);
  } finally { store.close(); }
});
test('Existing gardens migrate offline; encrypted delegations and watering remain functional', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folia-encrypted-')), path = join(dir, 'db.sqlite');
  let store = openAccounts(path, { codec: dataCodec(undefined) });
  try {
    const owner = await store.register(input);
    const guest = await store.register({ ...input, email: 'guest@example.test' });
    const plant = { id: 'one', name: 'Sensitive plant', species: 'Aloe vera', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: '', history: [] };
    store.putGarden(owner.token, { revision: 0, garden: { plants: [plant], reminders: false } });
    let delegates = openDelegations(store, HttpError);
    const invitation = delegates.create(owner.token, { email: guest.user.email, startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: new Date(Date.now() + 60000).toISOString(), plantIds: ['one'], notes: 'Private instructions' });
    store.close();
    assert.throws(() => openAccounts(path, { codec: dataCodec(key), requireEncrypted: true }), /Migration/);
    store = openAccounts(path, { codec: dataCodec(key), migrate: true, requireEncrypted: true });
    delegates = openDelegations(store, HttpError, { migrate: true, requireEncrypted: true });
    assert.ok(store.db.prepare('SELECT data FROM gardens LIMIT 1').get().data.startsWith('enc:v1:'));
    assert.ok(store.db.prepare('SELECT notes FROM delegations').get().notes.startsWith('enc:v1:'));
    delegates.accept(guest.token, { invitation: invitation.invitation });
    assert.equal(delegates.garden(guest.token, invitation.delegation.id).delegation.notes, 'Private instructions');
    delegates.water(guest.token, invitation.delegation.id, { plantId: 'one' });
    assert.equal(store.getGarden(owner.token).garden.plants[0].history.length, 1);
    store.close();
    assert.throws(() => openAccounts(path, { codec: dataCodec(auditKey) }));
    store = openAccounts(path, { codec: dataCodec(key), requireEncrypted: true });
    assert.equal(store.getGarden(owner.token).garden.plants[0].name, 'Sensitive plant');
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    store.close();
    const nextKey = 'ef'.repeat(32);
    execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/security-rotate-key.mjs'], {
      env: { ...process.env, FOLIA_DB_PATH: path, FOLIA_DATA_KEY: key, FOLIA_NEW_DATA_KEY: nextKey }, stdio: 'pipe',
    });
    assert.throws(() => openAccounts(path, { codec: dataCodec(key) }));
    store = openAccounts(path, { codec: dataCodec(nextKey), requireEncrypted: true });
    const rotated = openDelegations(store, HttpError, { requireEncrypted: true });
    assert.equal(rotated.garden(guest.token, invitation.delegation.id).delegation.notes, 'Private instructions');
    assert.equal(store.getGarden(owner.token).garden.plants[0].name, 'Sensitive plant');
  } finally { try { store.close(); } catch {} await rm(dir, { recursive: true, force: true }); }
});
test('Encrypted backup roundtrip, tamper rejection and refusal to overwrite existing files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folia-backup-test-'));
  const path = join(dir, 'source.sqlite'), restored = join(dir, 'restored.sqlite'), archive = join(dir, 'backup.foliabak');
  const db = new DatabaseSync(path); db.exec("CREATE TABLE secret (value TEXT); INSERT INTO secret VALUES ('private email@example.test')"); db.close();
  const env = { ...process.env, FOLIA_BACKUP_KEY: key, FOLIA_DATA_KEY: '', FOLIA_DB_PATH: path };
  const run = (mode, file, extra = {}) => execFileSync(process.execPath, ['scripts/security-backup.mjs', mode, file], { env: { ...env, ...extra }, stdio: 'pipe' });
  try {
    run('backup', archive);
    assert.equal((await readFile(archive)).includes(Buffer.from('private email')), false);
    run('restore', archive, { FOLIA_DB_PATH: restored });
    const check = new DatabaseSync(restored); assert.equal(check.prepare('SELECT value FROM secret').get().value, 'private email@example.test'); check.close();
    assert.throws(() => run('backup', archive));
    assert.throws(() => run('restore', archive, { FOLIA_DB_PATH: restored }));
    assert.throws(() => run('restore', archive, { FOLIA_DB_PATH: join(dir, 'wrong.sqlite'), FOLIA_BACKUP_KEY: auditKey }));
    const corrupted = await readFile(archive); corrupted[30] ^= 1; await writeFile(archive, corrupted);
    assert.throws(() => run('restore', archive, { FOLIA_DB_PATH: join(dir, 'corrupt.sqlite') }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
