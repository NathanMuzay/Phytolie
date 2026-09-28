import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('Real HTTP account lifecycle: registration, private collection, conflict, logout and CORS', { timeout: 20000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'folia-http-'));
  const child = spawn(process.execPath, ['--experimental-strip-types', 'server.mjs'], { env: { ...process.env, API_PORT: '0', FOLIA_DB_PATH: join(dir, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server start timeout')), 5000);
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)); });
      child.stdout.on('data', data => { const match = data.toString().match(/http:\/\/0\.0\.0\.0:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } });
    });
    const request = (path, method = 'GET', token, body) => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal((await request('/garden')).status, 401);
    const signup = await request('/auth/register', 'POST', undefined, { email: 'http@example.test', password: 'HTTP-test-password-123' });
    assert.equal(signup.status, 201);
    assert.equal(signup.headers.get('cache-control'), 'no-store');
    const session = await signup.json();
    const loaded = await (await request('/garden', 'GET', session.token)).json();
    assert.deepEqual(loaded, { garden: { plants: [], reminders: false }, revision: 0 });
    const update = { garden: { plants: [], reminders: false, reminderTime: '08:45' }, revision: 0 };
    assert.equal((await request('/garden', 'PUT', session.token, update)).status, 200);
    assert.equal((await request('/garden', 'PUT', session.token, update)).status, 409);
    const options = await request('/garden', 'OPTIONS');
    assert.match(options.headers.get('access-control-allow-headers'), /Authorization/);
    assert.match(options.headers.get('access-control-allow-methods'), /PUT/);
    assert.equal((await request('/auth/logout', 'POST', session.token)).status, 200);
    assert.equal((await request('/garden', 'GET', session.token)).status, 401);
    const login = await request('/auth/login', 'POST', undefined, { email: 'http@example.test', password: 'HTTP-test-password-123' });
    assert.equal(login.status, 200);
    const again = await login.json();
    assert.equal((await (await request('/garden', 'GET', again.token)).json()).garden.reminderTime, '08:45');
    let limited;
    for (let i = 0; i < 21; i++) limited = await request('/auth/login', 'POST', undefined, { email: 'invalid', password: 'short' });
    assert.equal(limited.status, 429);
  } finally { child.kill(); await once(child, 'exit'); await rm(dir, { recursive: true, force: true }); }
});
