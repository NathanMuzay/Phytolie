import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { demoProxy } from '../scripts/demo-proxy.cjs';
import { configureApiHost, demoApiBase, getApiBase } from '../src/services/apiBase.ts';

test('Demo uses the Expo tunnel for the API and ignores stale local IP configuration', () => {
  const previous = { mode: process.env.EXPO_PUBLIC_API_VIA_EXPO, url: process.env.EXPO_PUBLIC_API_URL };
  try {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.42:8787/';
    delete process.env.EXPO_PUBLIC_API_VIA_EXPO;
    assert.equal(getApiBase(), 'http://192.168.1.42:8787');
    process.env.EXPO_PUBLIC_API_VIA_EXPO = '1';
    configureApiHost('demo-8081.exp.direct:80');
    assert.equal(getApiBase(), 'https://demo-8081.exp.direct/folia-api');
    assert.equal(demoApiBase('192.168.1.42:8081'), 'http://192.168.1.42:8081/folia-api');
    assert.equal(demoApiBase('https://preview.example.test'), 'https://preview.example.test/folia-api');
    configureApiHost(undefined);
    assert.equal(getApiBase(), undefined);
  } finally {
    configureApiHost(undefined);
    for (const [key, value] of [['EXPO_PUBLIC_API_VIA_EXPO', previous.mode], ['EXPO_PUBLIC_API_URL', previous.url]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; }
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

test('Demo proxy forwards authenticated requests and photos, preserves errors, and leaves Metro routes alone', async () => {
  const api = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    response.writeHead(request.url === '/garden' ? 401 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ url: request.url, method: request.method, authorization: request.headers.authorization, body: Buffer.concat(chunks).toString() }));
  });
  const apiPort = await listen(api);
  const gateway = createServer(demoProxy(apiPort, (_request, response) => response.end('metro')));
  const port = await listen(gateway);
  try {
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/index.ts.bundle`)).text(), 'metro');
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/folia-api-other`)).text(), 'metro');
    const rejected = await fetch(`http://127.0.0.1:${port}/folia-api/garden`);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get('cache-control'), 'no-store');
    const body = JSON.stringify({ image: 'a'.repeat(512 * 1024) });
    const result = await (await fetch(`http://127.0.0.1:${port}/folia-api/identify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session' }, body,
    })).json();
    assert.deepEqual(result, { url: '/identify', method: 'POST', authorization: 'Bearer test-session', body });
    await close(api);
    const unavailable = await fetch(`http://127.0.0.1:${port}/folia-api/health`);
    assert.equal(unavailable.status, 503);
    assert.match((await unavailable.json()).error, /npm run demo/);
  } finally { await close(gateway); if (api.listening) await close(api); }
});
