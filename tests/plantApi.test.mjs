import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyPlant } from '../src/plantApi.ts';

test('Scan checks server availability before uploading and preserves identification', async t => {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8787/';
  t.after(() => { if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previous; });
  const calls = [];
  const plant = { commonName: 'Aloès', scientificName: 'Aloe vera', family: 'Asphodelaceae', confidence: .98, wateringAdvice: '' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.endsWith('/health') ? { status: 'ok' } : plant);
  });
  assert.deepEqual(await identifyPlant('data:image/jpeg;base64,YWJj'), plant);
  assert.deepEqual(calls.map(c => c.url), ['http://localhost:8787/health', 'http://localhost:8787/identify']);
  assert.deepEqual(JSON.parse(calls[1].options.body), { image: 'YWJj' });
});

test('Unreachable server stops scan before photo upload with actionable error', async t => {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8787';
  t.after(() => { if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previous; });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(identifyPlant('YWJj'), /Serveur Folia inaccessible.*npm run api/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('Unreachable server is aborted after five seconds', async t => {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8787';
  t.after(() => { if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previous; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const result = assert.rejects(identifyPlant('YWJj'), /injoignable après 5 secondes/);
  t.mock.timers.tick(5000);
  await result;
});
