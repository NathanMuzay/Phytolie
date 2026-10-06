import test from 'node:test';
import assert from 'node:assert/strict';
import { newHome, validateHome, validPosition, estimatePlacement, speciesLight } from '../src/home.ts';
import { gardenWithHome } from '../src/homeGarden.ts';
import { parseGarden } from '../src/model.ts';
const window = { id: 'w1', wall: 'bottom', offset: 3, width: 3, sill: 0, height: 3, filtered: false, obstruction: 'none' };
const room = { id: 'salon', name: 'Salon', kind: 'room', x: 0, y: 0, width: 6, height: 5, windows: [window], shade: 'none' };
const outdoor = { id: 'jardin', name: 'Jardin', kind: 'garden', x: 6, y: 0, width: 6, height: 5, windows: [], shade: 'none' };
const home = { version: 1, width: 12, height: 10, northAngle: 0, floor: 1, latitude: 48.85, month: 3, areas: [room, outdoor] };
const near = { areaId: 'salon', x: 3, y: 4.8, height: .5 };
const plant = { id: '1', name: 'Monstera', species: 'Monstera deliciosa', room: 'Ancienne pièce', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: '', history: [] };
const garden = { plants: [plant], reminders: false };
const changeWindow = patch => ({ ...home, areas: [{ ...room, windows: [{ ...window, ...patch }] }, outdoor] });
test('Plans, backgrounds and pins persist with legacy collection compatibility', () => {
  const saved = gardenWithHome(garden, { ...home, background: 'data:image/png;base64,YWJj' }, { '1': near });
  assert.deepEqual(parseGarden(JSON.stringify(saved)), JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(parseGarden(JSON.stringify(garden)), garden);
  validateHome(newHome());
});
test('Invalid geometry, overlapping rooms, bad windows and remote imports are rejected', () => {
  for (const bad of [
    { ...home, width: NaN }, { ...home, latitude: 91 }, { ...home, month: 13 }, { ...home, floor: .5 },
    { ...home, areas: [room, { ...outdoor, x: 5 }] }, { ...home, areas: [{ ...room, width: 13 }] },
    { ...home, areas: [room, { ...outdoor, id: room.id }] }, changeWindow({ offset: 0 }), changeWindow({ width: 7 }),
    { ...home, background: 'https://example.com/plan.png' }, { ...home, background: 'data:image/svg+xml;base64,YWJj' },
  ]) assert.throws(() => validateHome(bad));
});
test('Pins cannot point to nonexistent rooms or escape room boundaries', () => {
  assert.equal(validPosition(near, home), true);
  for (const invalid of [{ ...near, areaId: 'missing' }, { ...near, x: 8 }, { ...near, height: -1 }]) {
    assert.equal(validPosition(invalid, home), false);
    assert.throws(() => parseGarden(JSON.stringify({ ...garden, home, plants: [{ ...plant, position: invalid }] })));
  }
});
test('South glazing admits direct sun near the window; distant points can be indirect', () => {
  const close = estimatePlacement(home, near, plant.species);
  const distant = estimatePlacement(home, { ...near, y: 1 }, plant.species);
  assert.equal(close.exposure, 'sun');
  assert.ok(close.hours > 5);
  assert.equal(distant.exposure, 'indirect');
  assert.ok(distant.score > close.score);
});
test('Curtains, blocked views and partial obstacles affect the estimate', () => {
  const original = estimatePlacement(home, near, plant.species);
  assert.equal(estimatePlacement(changeWindow({ filtered: true }), near, plant.species).hours, 0);
  const blocked = estimatePlacement(changeWindow({ obstruction: 'blocked' }), near, plant.species);
  assert.equal(blocked.hours, 0); assert.equal(blocked.exposure, 'shade');
  const partial = estimatePlacement(changeWindow({ obstruction: 'partial' }), near, plant.species);
  assert.ok(partial.hours < original.hours && partial.hours > 0);
});
test('North orientation and hemisphere change solar admission', () => {
  assert.ok(estimatePlacement(home, near, 'Aloe vera').hours > estimatePlacement({ ...home, northAngle: 180 }, near, 'Aloe vera').hours);
  const southHemisphere = { ...home, latitude: -48.85 };
  assert.ok(estimatePlacement({ ...southHemisphere, northAngle: 180 }, near, 'Aloe vera').hours > estimatePlacement(southHemisphere, near, 'Aloe vera').hours);
});
test('Window aperture and foliage height affect direct rays', () => {
  assert.equal(estimatePlacement(changeWindow({ sill: 3, height: 1 }), near, 'Aloe vera').hours, 0);
  assert.ok(estimatePlacement(changeWindow({ width: .5 }), near, 'Aloe vera').hours < estimatePlacement(home, near, 'Aloe vera').hours);
});
test('Garden shading, seasonal sunlight and polar night are handled', () => {
  const p = { areaId: 'jardin', x: 8, y: 2, height: .5 };
  const summer = estimatePlacement({ ...home, month: 6 }, p, 'Aloe vera');
  const winter = estimatePlacement({ ...home, month: 12 }, p, 'Aloe vera');
  assert.ok(summer.hours > winter.hours);
  assert.equal(estimatePlacement({ ...home, latitude: 90, month: 12 }, p, 'Aloe vera').hours, 0);
  assert.equal(estimatePlacement({ ...home, areas: [room, { ...outdoor, shade: 'blocked' }] }, p, 'Aloe vera').exposure, 'shade');
});
test('Missing latitude, missing windows and unknown species do not invent a score', () => {
  const unknown = estimatePlacement(home, near, 'Espèce inconnue');
  assert.equal(unknown.score, null); assert.equal(speciesLight('Espèce inconnue'), null);
  assert.equal(estimatePlacement({ ...home, latitude: undefined }, near, plant.species).score, null);
  const noWindows = estimatePlacement({ ...home, areas: [{ ...room, windows: [] }] }, near, plant.species);
  assert.equal(noWindows.score, null); assert.equal(noWindows.hours, null);
  assert.ok(estimatePlacement(home, { ...near, preference: 'sun' }, 'Espèce inconnue').score > 0);
});
test('Placement fills environment and room without mutating or discarding watering history', () => {
  const original = { ...garden, plants: [{ ...plant, history: ['2026-09-02T12:00:00Z'] }] };
  const result = gardenWithHome(original, home, { '1': near });
  assert.equal(result.plants[0].room, 'Salon'); assert.equal(result.plants[0].irrigation.exposure, 'sun');
  assert.equal(original.plants[0].position, undefined);
  assert.deepEqual(result.plants[0].history, original.plants[0].history);
  const moved = gardenWithHome(result, home, { '1': { areaId: 'jardin', x: 8, y: 2, height: .5 } });
  assert.equal(moved.plants[0].irrigation.location, 'outdoor');
  assert.equal(gardenWithHome(result, home, {}).plants[0].position, undefined);
  assert.equal(gardenWithHome(result, { ...home, latitude: undefined }, { '1': near }).plants[0].irrigation.exposure, 'sun');
});

test('Local import transfers a missing home or removes pins from a different home', async () => {
  const { mergeLocalPlants } = await import('../src/accountApi.ts');
  const local = gardenWithHome(garden, home, { '1': near });
  const first = mergeLocalPlants({ plants: [], reminders: false }, local);
  assert.deepEqual(first.home, home); assert.deepEqual(first.plants[0].position, near);
  assert.doesNotThrow(() => parseGarden(JSON.stringify(first)));
  const other = { ...home, areas: [{ ...outdoor, id: 'other' }] };
  const second = mergeLocalPlants({ plants: [], reminders: false, home: other }, local);
  assert.deepEqual(second.home, other); assert.equal(second.plants[0].position, undefined);
  assert.doesNotThrow(() => parseGarden(JSON.stringify(second)));
  assert.deepEqual(local.plants[0].position, near);
});
