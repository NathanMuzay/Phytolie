import test from 'node:test';
import assert from 'node:assert/strict';
import { wateringTolerance } from '../src/features/plants/tolerance.ts';
import { defaultIrrigation, wateringPlan } from '../src/features/plants/irrigation.ts';
import { reminderDates, waterPlant } from '../src/shared/model.ts';
const now = new Date('2026-09-21T12:00:00Z');
const plant = { species: 'Monstera deliciosa', pot: 14, temperature: 20, interval: 7, waterAmount: 175, lastWatered: '2026-09-20T12:00:00Z', createdAt: '2026-09-01T12:00:00Z', history: [], irrigation: { ...defaultIrrigation, drainage: 'yes' } };
test('Margin is bounded and transitions at exact due and deadline instants', () => {
  const result = wateringTolerance(plant, now);
  assert.equal(result.status, 'before_due');
  assert.ok(result.hours > 0 && result.hours <= 72);
  const due = wateringPlan(plant, now).nextCheck;
  assert.equal(+result.deadline, +due + result.hours * 3600000);
  assert.equal(wateringTolerance(plant, due).status, 'within_margin');
  assert.equal(wateringTolerance(plant, result.deadline).status, 'exceeded');
});
test('Heat, drainage, substrate, pot size and species affect the available margin', () => {
  const baseline = wateringTolerance(plant, now).hours;
  assert.ok(wateringTolerance({ ...plant, temperature: 30 }, now).hours < baseline);
  assert.equal(wateringTolerance({ ...plant, temperature: 35 }, now).hours, 0);
  assert.ok(wateringTolerance({ ...plant, species: 'Aloe vera' }, now).hours > baseline);
  assert.ok(wateringTolerance({ ...plant, species: 'Calathea' }, now).hours < baseline);
  assert.ok(wateringTolerance({ ...plant, pot: 25, irrigation: { ...plant.irrigation, depth: 25, substrate: 'retentive' } }, now).hours > baseline);
  assert.equal(wateringTolerance({ ...plant, irrigation: { ...plant.irrigation, drainage: 'no' } }, now).hours, null);
});
test('Missing history, unknown species, legacy/manual settings and cold do not invent tolerance', () => {
  for (const patch of [{ lastWatered: null }, { lastWatered: '2030-01-01' }, { species: 'Unknown' }, { irrigation: undefined }, { irrigation: { ...plant.irrigation, automatic: false } }, { temperature: 5 }, { pot: NaN }]) {
    assert.equal(wateringTolerance({ ...plant, ...patch }, now).status, 'unavailable');
  }
});
test('Recent dry and moist observations override estimates and expire after 24 hours', () => {
  const observed = { ...plant, irrigation: { ...plant.irrigation, checkedAt: now.toISOString(), moisture: 'dry' } };
  assert.equal(wateringTolerance(observed, now).status, 'check_now');
  assert.equal(wateringTolerance(observed, now).hours, 0);
  observed.irrigation.moisture = 'moist';
  assert.equal(wateringTolerance(observed, now).status, 'unavailable');
  assert.notEqual(wateringTolerance(observed, new Date(+now + 86400000)).status, 'unavailable');
  observed.irrigation.checkedAt = '2030-01-01';
  assert.equal(wateringTolerance(observed, now).status, 'before_due');
});
test('Margin never postpones normal reminders or changes the watering dose; watering resets the deadline', () => {
  const due = wateringPlan(plant, now).nextCheck;
  const snapshot = JSON.stringify(plant);
  const margin = wateringTolerance(plant, now);
  assert.ok(reminderDates(plant, due)[0] < margin.deadline);
  assert.equal(JSON.stringify(plant), snapshot);
  const watered = waterPlant(plant, margin.deadline);
  assert.ok(wateringTolerance(watered, margin.deadline).deadline > margin.deadline);
});
