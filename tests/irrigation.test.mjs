import test from 'node:test';
import assert from 'node:assert/strict';
import { wateringPlan, defaultIrrigation } from '../src/features/plants/irrigation.ts';
import { waterPlant, dueDate, daysUntil, reminderDates, parseGarden } from '../src/shared/model.ts';
const now = new Date('2026-09-28T12:00:00Z');
const plant = { id: 'test', name: 'Test', species: 'Monstera deliciosa', room: 'Salon', soil: 'Terreau', caretaker: '', height: 30, pot: 14, temperature: 20, interval: 7, waterAmount: 175, lastWatered: '2026-09-20T12:00:00Z', createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', history: [], irrigation: { ...defaultIrrigation, drainage: 'yes' } };
const plan = (props = {}, config = {}) => wateringPlan({ ...plant, ...props, irrigation: { ...plant.irrigation, ...config } }, now);
test('Species, pot diameter and depth affect volume and checking interval', () => {
  assert.ok(plan({ species: 'Aloe vera' }).interval > plan().interval);
  assert.ok(plan({ species: 'Aloe vera' }).amount < plan().amount);
  assert.ok(plan({ pot: 25 }, { depth: 25 }).amount > plan().amount);
  assert.ok(plan({}, { depth: 20 }).amount > plan().amount);
  assert.ok(plan({ pot: 25 }, { depth: 25 }).interval > plan().interval);
});
test('Substrate, warmth, material, exposure and rest adjust the schedule', () => {
  assert.ok(plan({}, { substrate: 'retentive' }).interval > plan({}, { substrate: 'draining' }).interval);
  assert.notEqual(plan({}, { substrate: 'retentive' }).amount, plan({}, { substrate: 'draining' }).amount);
  assert.ok(plan({ temperature: 30 }).interval < plan({ temperature: 15 }).interval);
  assert.ok(plan({}, { material: 'terracotta' }).interval < plan().interval);
  assert.ok(plan({}, { exposure: 'sun', location: 'outdoor' }).interval < plan().interval);
  assert.ok(plan({}, { season: 'rest' }).interval > plan().interval);
});
test('Last watering anchors the next check; missing history requests immediate checking', () => {
  const result = plan();
  const expected = new Date(plant.lastWatered); expected.setDate(expected.getDate() + result.interval);
  assert.equal(+result.nextCheck, +expected);
  assert.equal(+plan({ lastWatered: null }).nextCheck, Date.parse(plant.createdAt));
});
test('Moist soil suppresses dose for one day, defers checks and does not fake watering', () => {
  const observed = { ...plant, irrigation: { ...plant.irrigation, moisture: 'moist', checkedAt: now.toISOString() } };
  const result = wateringPlan(observed, now);
  assert.equal(result.amount, 0);
  assert.equal(+result.nextCheck, +now + 86400000);
  assert.equal(observed.lastWatered, plant.lastWatered);
  assert.ok(wateringPlan(observed, new Date(+now + 2 * 86400000)).amount > 0);
  const watered = waterPlant(observed, new Date(+now + 1000));
  assert.equal(watered.irrigation.moisture, undefined);
  assert.equal(watered.history.length, 1);
  assert.ok(daysUntil(reminderDates(watered, now)[0], dueDate(watered)) >= 0);
});
test('Dry observations advance checking without recording an irrigation', () => {
  const result = plan({ lastWatered: '2026-09-27T12:00:00Z' }, { moisture: 'dry', checkedAt: now.toISOString() });
  assert.equal(+result.nextCheck, +now);
});
test('Unknown drainage, no drainage and outdoor freezing conditions suppress automatic dose', () => {
  assert.equal(plan({}, { drainage: 'unknown' }).amount, 0);
  assert.equal(plan({}, { drainage: 'no' }).amount, 0);
  assert.equal(plan({ temperature: 0 }, { location: 'outdoor' }).amount, 0);
});
test('Legacy data retains manual schedules and new settings persist with validation', () => {
  const legacy = { ...plant, irrigation: undefined, interval: 11, waterAmount: 300 };
  assert.equal(wateringPlan(legacy, now).interval, 11);
  assert.equal(wateringPlan(legacy, now).amount, 300);
  assert.equal(parseGarden(JSON.stringify({ plants: [plant], reminders: false })).plants[0].irrigation.depth, 12);
  assert.throws(() => parseGarden(JSON.stringify({ plants: [{ ...plant, irrigation: { ...plant.irrigation, depth: -1 } }], reminders: false })));
});
