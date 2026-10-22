import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openAccounts } from '../server/accounts.mjs';
import { dataCodec } from '../server/encryption.mjs';

const key = 'ab'.repeat(32), auditKey = 'cd'.repeat(32);

test('Production HTTP boundary: TLS, CORS, JSON, durable quotas, logs and session revocation', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folia-security-http-')), path = join(dir, 'data.sqlite');
  const accounts = openAccounts(path, { codec: dataCodec(key) });
  const session = await accounts.register({ email: 'private@example.test', password: 'Private-password-123!' });
  accounts.close();
  let child, base, logs = '';
  const start = async () => {
    child = spawn(process.execPath, ['--experimental-strip-types', 'server/index.mjs'], { env: {
      ...process.env, NODE_ENV: 'production', API_PORT: '0', API_HOST: '127.0.0.1', FOLIA_DB_PATH: path,
      FOLIA_DATA_KEY: key, FOLIA_AUDIT_KEY: auditKey, FOLIA_TRUSTED_PROXIES: '127.0.0.1',
      FOLIA_ALLOWED_ORIGINS: 'https://app.example.test', FOLIA_ALLOW_REGISTRATION: 'false',
      PLANT_ID_API_KEY: '', OPENAI_API_KEY: '',
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Start timeout: ' + errors)), 5000);
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${errors}`)); });
      child.stdout.on('data', chunk => {
        logs += chunk;
        const match = String(chunk).match(/http:\/\/127.0.0.1:(\d+)/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
    });
  };
  const stop = async () => { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } };
  const proxy = { 'X-Forwarded-For': '192.0.2.1', 'X-Forwarded-Proto': 'https' };
  const request = (url, { headers, ...options } = {}) => fetch(`${base}${url}`, { ...options, headers: { ...proxy, ...headers } });
  try {
    await start();
    assert.equal((await fetch(`${base}/garden`)).status, 400); // Missing trusted-proxy address.
    assert.equal((await request('/garden', { headers: { 'X-Forwarded-Proto': 'http' } })).status, 403);
    assert.equal((await request('/garden', { headers: { 'X-Forwarded-For': '192.0.2.1, 192.0.2.2' } })).status, 400);
    const rejected = await request('/garden', { headers: { Origin: 'https://evil.example.test', Authorization: `Bearer ${session.token}` } });
    assert.equal(rejected.status, 403); assert.equal(rejected.headers.get('access-control-allow-origin'), null);
    const allowed = await request('/garden', { headers: { Origin: 'https://app.example.test', Authorization: `Bearer ${session.token}` } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.test');
    assert.equal(allowed.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(allowed.headers.get('cache-control'), 'no-store');
    assert.ok(allowed.headers.get('x-request-id'));
    assert.equal((await request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const auth = { Authorization: `Bearer ${session.token}` };
    assert.equal((await request('/garden', { method: 'DELETE', headers: auth })).status, 405);
    assert.equal((await request('/garden', { method: 'PUT', headers: auth, body: '{}' })).status, 415);
    for (const body of ['{', 'null', '[]']) assert.equal((await request('/garden', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body })).status, 400);
    assert.equal((await request('/auth/password', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'a'.repeat(5000) }) })).status, 413);
    for (let i = 0; i < 10; i++) assert.equal((await request('/identify', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${i + 1}` }, body: '{}' })).status, 503);
    const limited = await request('/identify', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.99' }, body: '{}' });
    assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
    await stop(); await start();
    assert.equal((await request('/identify', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' })).status, 429);
    assert.equal((await request('/auth/logout-all', { method: 'POST', headers: auth })).status, 200);
    assert.equal((await request('/garden', { headers: auth })).status, 401);
    await request('/unknown?secret=private-password');
    await stop();
    for (const secret of [session.token, 'private@example.test', 'Private-password-123!', 'private-password', '192.0.2.99']) assert.equal(logs.includes(secret), false);
    assert.ok(logs.includes('"event":"http"'));
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
