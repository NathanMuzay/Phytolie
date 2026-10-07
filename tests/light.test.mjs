import test from 'node:test';
import assert from 'node:assert/strict';
import { validLightReading, medianLux, lightAdvice } from '../src/light.ts';
import { parseGarden } from '../src/model.ts';
import { openAccounts } from '../server/accounts.mjs';

const reading = { lux: 2500, measuredAt: '2026-10-07T12:00:00Z', method: 'sensor', room: 'Salon', artificialLight: false, curtainsClosed: false };
const plant = { id: 'light-plant', name: 'Monstera', species: 'Monstera deliciosa', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: reading.measuredAt, repotDate: '2027-10-07T12:00:00Z', caretaker: '', history: [], lightReading: reading };

test('Optional readings round-trip; legacy plants need no calibration', () => {
  const garden = { plants: [plant], reminders: false };
  assert.deepEqual(parseGarden(JSON.stringify(garden)), garden);
  assert.equal(parseGarden(JSON.stringify({ ...garden, plants: [{ ...plant, lightReading: undefined }] })).plants[0].lightReading, undefined);
  for (const invalid of [{ lux: -1 }, { lux: 200001 }, { lux: '2500' }, { measuredAt: 'invalid' }, { method: 'camera' }, { artificialLight: 0 }, { curtainsClosed: null }, { room: 'a'.repeat(101) }]) {
    assert.throws(() => parseGarden(JSON.stringify({ ...garden, plants: [{ ...plant, lightReading: { ...reading, ...invalid } }] })), /Relevé de lumière invalide/);
  }
  assert.equal(validLightReading(null), false);
  assert.equal(validLightReading({ ...reading, lux: 0 }), true);
});

test('Sensor aggregation tolerates spikes, invalid samples and a constant zero reading', () => {
  assert.equal(medianLux([2000, 2100, 200000, NaN, -1]), 2100);
  assert.equal(medianLux([2000, 2100]), 2050);
  assert.equal(medianLux([0]), 0);
  assert.equal(medianLux([]), undefined);
  assert.equal(medianLux([Infinity, -10]), undefined);
});

test('Spot advice stays conditional and does not assign direct or indirect exposure', () => {
  assert.match(lightAdvice({ ...reading, lux: 0 }), /à cet instant/);
  assert.match(lightAdvice(reading), /autre moment/);
  assert.match(lightAdvice({ ...reading, lux: 20000 }), /Si le soleil/);
});

test('Account saves preserve readings and support removing them', async () => {
  const store = openAccounts(':memory:');
  try {
    const session = await store.register({ email: 'light@example.test', password: 'Test-password-123!' });
    const garden = { plants: [plant], reminders: false };
    store.putGarden(session.token, { garden, revision: 0 });
    assert.deepEqual(store.getGarden(session.token).garden.plants[0].lightReading, reading);
    const removed = { ...garden, plants: [{ ...plant, lightReading: undefined }] };
    store.putGarden(session.token, { garden: removed, revision: 1 });
    assert.equal(store.getGarden(session.token).garden.plants[0].lightReading, undefined);
  } finally { store.close(); }
});
