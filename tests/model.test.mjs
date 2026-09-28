import test from 'node:test';
import assert from 'node:assert/strict';
import { dueDate, daysUntil, waterPlant, reminderDates, parseGarden } from '../src/model.ts';
import { careDefaults, estimateWaterAmount } from '../src/care.ts';

const plant = { id: '1', name: 'Fern', species: 'Unknown', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: '', history: [] };
test('A missing confirmation never moves the watering deadline', () => {
  assert.equal(+dueDate(plant), Date.parse(plant.createdAt));
  assert.ok(daysUntil(dueDate(plant), new Date('2026-09-10T12:00:00Z')) < 0);
});
test('Watering records history and advances the deadline', () => {
  const updated = waterPlant(plant, new Date('2026-09-10T12:00:00Z'));
  assert.equal(updated.history.length, 1);
  assert.equal(daysUntil(dueDate(updated), new Date('2026-09-10T12:00:00Z')), 7);
  assert.equal(plant.lastWatered, null);
});
test('Overdue reminders repeat daily at 9, always in the future', () => {
  const now = new Date(2026, 8, 10, 11);
  const dates = reminderDates(plant, now);
  assert.equal(dates.length, 30);
  assert.equal(dates[0].getHours(), 9);
  assert.equal(daysUntil(dates[0], now), 1);
  assert.equal(daysUntil(dates[1], dates[0]), 1);
  assert.ok(dates.every(date => date > now));
});
test('Future reminders do not precede the deadline', () => {
  const now = new Date(2026, 8, 10, 11);
  const updated = waterPlant(plant, now);
  assert.equal(daysUntil(reminderDates(updated, now)[0], now), 7);
});
test('Calendar day comparison ignores the hour', () => {
  assert.equal(daysUntil(new Date(2026, 8, 10, 23), new Date(2026, 8, 10, 1)), 0);
});
test('Stored garden round-trips, invalid records are rejected', () => {
  const garden = { plants: [plant], reminders: false };
  assert.deepEqual(parseGarden(JSON.stringify(garden)), garden);
  assert.throws(() => parseGarden('{'));
  assert.throws(() => parseGarden(JSON.stringify({ ...garden, plants: [{ ...plant, interval: 0 }] })));
  assert.throws(() => parseGarden(JSON.stringify({ ...garden, plants: [{ ...plant, history: ['oops'] }] })));
});
test('Care defaults distinguish dry and moisture-loving plants', () => {
  assert.equal(careDefaults('Echeveria elegans').interval, 14);
  assert.equal(careDefaults('Fougère de Boston').interval, 4);
  assert.equal(careDefaults('Monstera deliciosa').interval, 7);
});
test('Water estimate grows with the pot and is lower for succulents', () => {
  const small = estimateWaterAmount(12, 'Monstera deliciosa');
  const large = estimateWaterAmount(20, 'Monstera deliciosa');
  const succulent = estimateWaterAmount(20, 'Echeveria elegans');
  assert.ok(small > 0 && large > small);
  assert.ok(succulent < large);
  assert.equal(estimateWaterAmount(0), 0);
});
