import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCities, fetchWeather, outdoorTemperature } from '../src/weather.ts';
const city = { id: 1, name: 'Paris', latitude: 48.85, longitude: 2.35, country: 'France' };
test('City lookup preserves alternatives and escapes user input', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [city, { ...city, id: 2, country: 'USA' }] }));
  assert.equal((await searchCities('Paris &')).length, 2);
  assert.match(fetch.mock.calls[0].arguments[0], /name=Paris%20%26/);
});
test('Weather reads Celsius and rejects missing temperatures', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ current: { temperature_2m: 18.5 } }));
  const weather = await fetchWeather(city);
  assert.equal(weather.temperature, 18.5);
  assert.equal(outdoorTemperature(weather, city), 18.5);
  assert.equal(outdoorTemperature(weather, { ...city, id: 2 }), undefined);
  assert.equal(outdoorTemperature(weather, city, new Date(Date.parse(weather.fetchedAt) + 4 * 3600000)), undefined);
  mock.mock.mockImplementation(async () => Response.json({ current: {} }));
  await assert.rejects(fetchWeather(city), /invalide/);
});
test('Weather network failures and timeouts give a fallback message', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Abort')))));
  const result = assert.rejects(fetchWeather(city), /température saisie/);
  t.mock.timers.tick(8000);
  await result;
});
