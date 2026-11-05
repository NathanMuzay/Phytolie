import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGarden, dueDate, reminderDates, daysUntil } from '../src/shared/model.ts';
import { careEvents, activeWaterings, recordWatering, cancelWatering, recordRepotting, recordSubstrateChange, setArchived } from '../src/features/plants/careRecords.ts';
import { catalogueSubstrate, substrateCatalogue, validSubstrate } from '../src/features/plants/substrates.ts';
import { defaultIrrigation, wateringPlan } from '../src/features/plants/irrigation.ts';
import { repottingAdvice } from '../src/features/plants/repotting.ts';
import { filterCollection } from '../src/features/plants/collection.ts';
import { careDefaults } from '../src/features/plants/care.ts';
import { buildReminders } from '../src/services/reminders.ts';
import { gardenWithHome } from '../src/features/home/homeGarden.ts';

const now = new Date('2026-11-05T16:00:00Z');
const plant = { id: 'one', name: 'Plante test', species: 'Monstera deliciosa', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, waterAmount: 150, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: '', history: [], photo: 'data:image/jpeg;base64,YWJj' };
const roundTrip = p => parseGarden(JSON.stringify({ plants: [p], reminders: false })).plants[0];
const add = (p, date, amountMl) => recordWatering(p, { occurredAt: `2026-11-${date}T12:00:00Z`, amountMl }, now);

test('Dated watering stores optional actual amount and derives the next deadline without mutating the plant', () => {
  const next = add(plant, '03', 240);
  assert.equal(activeWaterings(next)[0].amountMl, 240);
  assert.equal(next.lastWatered, '2026-11-03T12:00:00.000Z');
  assert.equal(daysUntil(dueDate(next), new Date(next.lastWatered)), 7);
  assert.equal(next.waterAmount, 150); // actual amount never replaces the estimated dose
  assert.equal(plant.lastWatered, null);
  assert.equal(roundTrip(next).careEvents[0].amountMl, 240);
  assert.equal(activeWaterings(add(plant, '03'))[0].amountMl, undefined);
});
test('Retroactive input and correction sort by occurrence; cancelling latest restores the previous anchor', () => {
  let next = add(add(plant, '04', 200), '01', 100);
  assert.deepEqual(next.history.map(date => date.slice(8, 10)), ['04', '01']);
  const latest = activeWaterings(next)[0];
  next = recordWatering(next, { occurredAt: '2026-10-30T12:00:00Z', amountMl: 180, note: 'Date rectifiée' }, now, latest.id);
  assert.equal(next.lastWatered.slice(0, 10), '2026-11-01');
  assert.equal(next.careEvents.find(e => e.id === latest.id).updatedAt, now.toISOString());
  assert.equal(activeWaterings(next).length, 2);
  next = cancelWatering(next, activeWaterings(next)[0].id, now);
  assert.equal(next.lastWatered.slice(0, 10), '2026-10-30');
  assert.equal(next.careEvents.filter(e => e.cancelledAt).length, 1);
  next = cancelWatering(next, latest.id, now);
  assert.equal(next.lastWatered, null);
  assert.deepEqual(next.history, []);
  assert.equal(+dueDate(next), +new Date(plant.createdAt));
  assert.ok(reminderDates(next, now).every(date => date > now));
  assert.equal(roundTrip(next).careEvents.length, 2);
});
test('Future, invalid, negative, nonfinite, duplicate and cancelled edits fail without modifying history', () => {
  const next = add(plant, '04');
  const before = JSON.stringify(next);
  for (const input of [{ occurredAt: 'invalid' }, { occurredAt: '2099-01-01' }, { occurredAt: '2026-11-03', amountMl: 0 }, { occurredAt: '2026-11-03', amountMl: -1 }, { occurredAt: '2026-11-03', amountMl: NaN }, { occurredAt: '2026-11-03', amountMl: 20001 }, { occurredAt: '2026-11-03', note: 'x'.repeat(1001) }, { occurredAt: next.lastWatered }]) assert.throws(() => recordWatering(next, input, now));
  assert.throws(() => recordWatering(next, { occurredAt: '2026-11-03' }, now, 'missing'));
  const cancelled = cancelWatering(next, activeWaterings(next)[0].id, now);
  assert.throws(() => recordWatering(cancelled, { occurredAt: '2026-11-03' }, now, cancelled.careEvents[0].id));
  assert.throws(() => cancelWatering(cancelled, cancelled.careEvents[0].id, now));
  assert.equal(JSON.stringify(next), before);
});
test('Legacy dates and orphan lastWatered are retained once; migration stays lazy and round-trips', () => {
  const legacy = { ...plant, lastWatered: '2026-11-04T12:00:00Z', history: ['2026-11-02T12:00:00Z', '2026-11-02T12:00:00Z'] };
  assert.deepEqual(roundTrip(legacy), legacy);
  assert.equal(careEvents(legacy).length, 2);
  const next = add(legacy, '01');
  assert.equal(next.history.length, 3);
  assert.equal(activeWaterings(next)[0].occurredAt, legacy.lastWatered);
  assert.equal(roundTrip(next).careEvents.length, 3);
});
test('Backdated watering preserves a newer moisture observation; current watering clears it', () => {
  const observed = { ...plant, irrigation: { ...defaultIrrigation, checkedAt: '2026-11-04T15:00:00Z', moisture: 'moist' } };
  assert.equal(add(observed, '01').irrigation.moisture, 'moist');
  assert.equal(add(observed, '05').irrigation.moisture, undefined);
});
test('Archive preserves photos and full care data, excludes collection/rappels, restore reactivates them', () => {
  const watered = add(plant, '01', 123);
  const archived = setArchived(watered, true, now);
  assert.equal(archived.photo, watered.photo);
  assert.deepEqual(archived.careEvents, watered.careEvents);
  assert.deepEqual(filterCollection([archived], '', null, false, now), []);
  assert.equal(filterCollection([archived], '', null, false, now, true).length, 1);
  assert.deepEqual(reminderDates(archived, now), []);
  assert.deepEqual(buildReminders([archived], now), []);
  assert.throws(() => add(archived, '03'), /Restaurez/);
  assert.throws(() => cancelWatering(archived, activeWaterings(archived)[0].id), /Restaurez/);
  const restored = setArchived(roundTrip(archived), false);
  assert.deepEqual(restored.careEvents, watered.careEvents);
  assert.ok(reminderDates(restored, now).length > 0);
  assert.equal(filterCollection([restored], '', null, false, now).length, 1);
});
test('Changing home geometry preserves archived plants and clears only positions made invalid', () => {
  const home = { version: 1, width: 12, height: 10, northAngle: 0, floor: 0, month: 6, areas: [{ id: 'room', name: 'Pièce', kind: 'room', x: 0, y: 0, width: 4, height: 3, windows: [], shade: 'none' }] };
  const archived = setArchived({ ...plant, position: { areaId: 'room', x: 1, y: 1, height: 1 } }, true, now);
  const garden = { plants: [archived], reminders: false, home };
  const retained = gardenWithHome(garden, home, {}).plants[0];
  assert.deepEqual(retained.position, archived.position);
  const removed = gardenWithHome(garden, { ...home, areas: [] }, {}).plants[0];
  assert.equal(removed.position, undefined);
  assert.equal(removed.photo, archived.photo);
  assert.equal(removed.archivedAt, archived.archivedAt);
});
test('Catalogue and manual unknown-code mixes persist composition, properties and provenance', () => {
  for (const type of Object.keys(substrateCatalogue)) {
    const selection = catalogueSubstrate(type);
    assert.equal(validSubstrate(selection), true);
    assert.ok(substrateCatalogue[type].properties);
    assert.match(selection.source, /^https:\/\//);
  }
  const custom = { type: 'draining', name: 'Mon mélange', composition: 'Coco et perlite', origin: 'code-inconnu', productCode: '3760000000000', source: 'Déclaration utilisateur' };
  assert.equal(validSubstrate(custom), true);
  assert.equal(validSubstrate({ ...custom, composition: '' }), false);
  const next = recordSubstrateChange(plant, { ...plant, substrateDetails: custom, irrigation: { ...defaultIrrigation, substrate: 'draining', drainage: 'yes' } }, now);
  assert.deepEqual(roundTrip(next).substrateDetails, custom);
  assert.equal(next.careEvents[0].previousSubstrate.composition, plant.soil);
  assert.equal(next.careEvents[0].substrate.productCode, custom.productCode);
});
test('Changing the real substrate adjusts irrigation without resetting last watering or losing history', () => {
  const before = add({ ...plant, irrigation: { ...defaultIrrigation, drainage: 'yes' }, substrateDetails: catalogueSubstrate('standard') }, '01');
  const changed = recordSubstrateChange(before, { ...before, substrateDetails: catalogueSubstrate('retentive') }, now);
  assert.equal(changed.irrigation.substrate, 'retentive');
  assert.ok(wateringPlan(changed, now).interval > wateringPlan(before, now).interval);
  assert.notEqual(wateringPlan(changed, now).amount, wateringPlan(before, now).amount);
  assert.equal(changed.lastWatered, before.lastWatered);
  assert.deepEqual(changed.history, before.history);
  assert.equal(recordSubstrateChange(changed, changed, now).careEvents.length, changed.careEvents.length);
  assert.equal(recordSubstrateChange(plant, { ...plant, soil: 'Une simple note' }, now).careEvents, undefined);
  assert.throws(() => recordSubstrateChange(setArchived(before, true), { ...before, substrateDetails: catalogueSubstrate('bark') }, now), /Restaurez/);
  assert.equal(roundTrip(changed).careEvents.length, 2);
});
test('Repotting stores actual date and new geometry/substrate, invalidates photo dimensions and recalculates care', () => {
  const before = add({ ...plant, irrigation: { ...defaultIrrigation, drainage: 'yes' }, measurement: { stale: true } }, '01', 240);
  const input = { occurredAt: '2026-11-04T12:00:00Z', pot: 22, depth: 20, substrate: catalogueSubstrate('draining'), nextCheck: '2027-05-01T12:00:00Z', note: 'Motte inspectée' };
  const next = recordRepotting(before, input, now);
  assert.equal(next.careEvents[0].kind, 'repotting');
  assert.equal(next.careEvents[0].occurredAt, '2026-11-04T12:00:00.000Z');
  assert.equal(next.pot, 22); assert.equal(next.irrigation.depth, 20);
  assert.equal(next.substrateDetails.type, 'draining');
  assert.equal(next.repotDate, '2027-05-01T12:00:00.000Z');
  assert.equal(next.measurement, undefined);
  assert.equal(next.lastWatered, before.lastWatered); // no fake watering
  assert.notEqual(wateringPlan(next, now).amount, wateringPlan(before, now).amount);
  assert.equal(roundTrip(next).careEvents.length, 2);
  assert.throws(() => recordRepotting(next, input, now), /plus récent/);
  for (const patch of [{ pot: 0 }, { depth: 101 }, { nextCheck: input.occurredAt }, { substrate: {} }, { occurredAt: '2099-01-01' }]) assert.throws(() => recordRepotting(before, { ...input, ...patch }, now));
  assert.throws(() => recordRepotting(setArchived(before, true), input, now), /Restaurez/);
});
test('Care journal validation rejects bad fields, duplicate IDs and inconsistent derived dates', () => {
  const next = add(plant, '03', 100);
  const event = next.careEvents[0];
  for (const changed of [{ ...next, archivedAt: 'bad' }, { ...next, lastWatered: null }, { ...next, history: [] }, { ...next, careEvents: [event, event] }, { ...next, careEvents: [{ ...event, amountMl: -1 }] }, { ...next, careEvents: [{ ...event, kind: 'oops' }] }, { ...next, substrateDetails: catalogueSubstrate('bark') }]) assert.throws(() => roundTrip(changed));
  const full = { ...next, careEvents: Array.from({ length: 500 }, (_, i) => ({ ...event, id: `event-${i}`, cancelledAt: now.toISOString() })), history: [], lastWatered: null };
  assert.equal(roundTrip(full).careEvents.length, 500);
  assert.throws(() => add(full, '02'), /500/);
  assert.equal(full.careEvents.length, 500);
});
test('Repot rules consider roots, pot, substrate, species and observed growth without inventing urgency', () => {
  const unknown = repottingAdvice(plant, { roots: 'unknown', soil: 'unknown', growth: 'unknown' }, now);
  assert.equal(unknown.title, 'Observer avant de rempoter');
  assert.ok(unknown.reasons.some(reason => reason.includes(plant.species)));
  assert.ok(unknown.reasons.some(reason => reason.includes('14 cm')));
  assert.ok(unknown.reasons.some(reason => reason.includes('Racines non observées')));
  const crowded = repottingAdvice(plant, { roots: 'crowded', soil: 'compacted', growth: 'rest' }, now);
  assert.match(crowded.title, /envisager/);
  assert.ok(crowded.reasons.some(reason => reason.includes('même pot')));
  assert.ok(crowded.reasons.some(reason => reason.includes('repos')));
});
test('Botanical search resolves scientific synonyms and common names in either direction without changing species', () => {
  const fern = { ...plant, species: 'Nephrolepis exaltata' };
  const snake = { ...plant, species: 'Dracaena trifasciata' };
  assert.equal(filterCollection([fern], 'fougère de Boston', null, false).length, 1);
  assert.equal(filterCollection([snake], 'Sansevieria trifasciata', null, false).length, 1);
  assert.equal(filterCollection([{ ...snake, species: 'langue de belle-mère' }], 'Dracaena trifasciata', null, false).length, 1);
  assert.equal(careDefaults('Nephrolepis exaltata').interval, careDefaults('Fougère de Boston').interval);
  assert.equal(careDefaults('Dracaena trifasciata').interval, careDefaults('Sansevieria trifasciata').interval);
  assert.equal(filterCollection([snake], "mother-in-law's tongue", null, false).length, 1);
  assert.equal(filterCollection([snake], 'langue de belle mere', null, false).length, 1);
  assert.equal(snake.species, 'Dracaena trifasciata');
});

test('Local care dates reject impossible dates and times, including DST gaps', async () => {
  const { parseCareDate } = await import('../src/features/plants/careRecords.ts');
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    assert.equal(parseCareDate('2026-11-04', '12:30'), '2026-11-04T11:30:00.000Z');
    for (const [date, time] of [['2026-02-30', '12:00'], ['2026-11-04', '24:00'], ['2026-11-04', '12:99'], ['2026-11-04', '2:00'], ['2026-03-29', '02:30']]) assert.throws(() => parseCareDate(date, time));
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
