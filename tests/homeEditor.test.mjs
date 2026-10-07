import test from 'node:test';
import assert from 'node:assert/strict';
import { newHome, validateHome } from '../src/home.ts';
import { editOpening, editWall, editWindow, nearestWall, wallLength, pointOnWall, replaceArea, removeArea } from '../src/homeEditor.ts';
import { parseGarden } from '../src/model.ts';
import { rectangleFromDrag } from '../src/homeDrawing.ts';
const room = { id: 'room', name: 'Salon', kind: 'room', x: 1, y: 1, width: 5, height: 4, shade: 'none', windows: [] };
const wall = { id: 'wall', start: { x: 8, y: 1 }, end: { x: 8, y: 5 }, control: { x: 10, y: 3 }, thickness: .15 };
const door = { id: 'door', kind: 'door', areaId: 'room', side: 'bottom', offset: 2, width: .9, reversed: false, outward: false };
const home = { ...newHome(), areas: [room], walls: [wall], openings: [door] };

test('New structure persists in a garden; old plans still validate', () => {
  validateHome(home); validateHome({ ...newHome(), areas: [room] });
  const garden = { home, plants: [], reminders: false };
  assert.deepEqual(parseGarden(JSON.stringify(garden)), garden);
});
test('Curve length and tangent follow the drawn arc instead of the endpoint chord', () => {
  assert.ok(wallLength(wall) > 4);
  const middle = pointOnWall(wall, wallLength(wall)/2);
  assert.ok(Math.abs(middle.point.x-9) < .01);
  assert.ok(Math.abs(middle.point.y-3) < .01);
  const straight = { ...wall, control: undefined };
  assert.equal(wallLength(straight), 4);
  assert.deepEqual(pointOnWall(straight, 2).point, { x: 8, y: 3 });
});
test('Openings snap to room boundaries and curved walls with valid distances', () => {
  const a = nearestWall(home, { x: 3, y: 5.1 });
  assert.equal(a.areaId, 'room'); assert.equal(a.side, 'bottom'); assert.ok(Math.abs(a.offset-2) < .001);
  const b = nearestWall(home, { x: 9, y: 3 });
  assert.equal(b.wallId, 'wall'); assert.ok(b.offset > 2);
  assert.equal(nearestWall(home, { x: 17, y: 12 }), undefined);
});
test('Moving and resizing a zone keeps its plant relative location and settings', () => {
  const pin = { areaId: 'room', x: 3, y: 3, height: 1.2, preference: 'indirect' };
  const snapshot = { home, positions: { p: pin, unplaced: undefined } };
  const result = replaceArea(snapshot, { ...room, x: 2, y: 2, width: 10, height: 8 });
  assert.deepEqual(result.positions.p, { ...pin, x: 6, y: 6 });
  assert.equal(snapshot.positions.p.x, 3); assert.equal(snapshot.home.areas[0].x, 1);
});
test('Deleting a room removes its dependent doors and pins, preserving unrelated structures', () => {
  const result = removeArea({ home, positions: { p: { areaId: 'room', x: 3, y: 3, height: 1 } } }, 'room');
  assert.equal(result.positions.p, undefined); assert.equal(result.home.openings.length, 0); assert.equal(result.home.walls.length, 1);
  validateHome(result.home);
});
test('Invalid walls, dangling openings and oversized apertures cannot be saved', () => {
  for (const walls of [[{ ...wall, thickness: 0 }], [{ ...wall, start: { x: -1, y: 0 } }], [{ ...wall, control: { x: 200, y: 1 } }], [{ ...wall, end: wall.start }], [wall, wall]]) assert.throws(() => validateHome({ ...home, walls }));
  for (const openings of [[{ ...door, areaId: 'missing' }], [{ ...door, offset: 0 }], [{ ...door, width: 7 }], [{ ...door, reversed: 'yes' }], [door, door], [{ ...door, wallId: 'wall' }]]) assert.throws(() => validateHome({ ...home, openings }));
  validateHome({ ...home, openings: [{ id: 'free-window', kind: 'window', wallId: 'wall', offset: 2, width: 1.2, reversed: false, outward: false }] });
});
test('Fine geometry can disable the usual ten-centimetre snapping', () => {
  assert.deepEqual(rectangleFromDrag({ x: 1.23, y: 2.34 }, { x: 3.47, y: 4.58 }, home, .01), { x: 1.23, y: 2.34, width: 2.24, height: 2.24 });
  assert.equal(rectangleFromDrag({ x: 0, y: 0 }, { x: 1, y: 1 }, home, 0), null);
});


test('Editing a window width keeps its centre on the wall and updates glazing dimensions', () => {
  const window = { id: 'glazing', wall: 'top', offset: .6, width: 1.2, sill: .8, height: 1.4, filtered: false, obstruction: 'none' };
  const original = { home: { ...home, areas: [{ ...room, windows: [window] }] }, positions: {} };
  let updated = editWindow(original, 'room', 'glazing', { width: 2 });
  validateHome(updated.home);
  assert.equal(updated.home.areas[0].windows[0].width, 2);
  assert.equal(updated.home.areas[0].windows[0].offset, 1);
  updated = editWindow(updated, 'room', 'glazing', { offset: 3, sill: 1.1, height: 2 });
  validateHome(updated.home);
  assert.deepEqual(updated.home.areas[0].windows[0], { ...window, width: 2, offset: 3, sill: 1.1, height: 2 });
  assert.equal(original.home.areas[0].windows[0].width, 1.2);
  assert.throws(() => validateHome(editWindow(updated, 'room', 'glazing', { width: 8 }).home));
  assert.throws(() => validateHome(editWindow(updated, 'room', 'glazing', { offset: 0 }).home));
});

test('Widening a door at the wall edge relocates its centre instead of refusing the width', () => {
  const original = { home: { ...home, openings: [{ ...door, offset: .45 }] }, positions: {} };
  const updated = editOpening(original, 'door', { width: 1.4 });
  validateHome(updated.home);
  assert.equal(updated.home.openings[0].width, 1.4);
  assert.equal(updated.home.openings[0].offset, .7);
  assert.equal(editOpening(updated, 'door', { offset: 2 }).home.openings[0].offset, 2);
  assert.equal(original.home.openings[0].width, .9);
});

test('Wall coordinates, thickness and curvature update while attached apertures remain valid', () => {
  const straight = { ...wall, control: undefined };
  const original = { home: { ...home, walls: [straight], openings: [{ ...door, areaId: undefined, side: undefined, wallId: 'wall', offset: 3.5 }] }, positions: {} };
  const shorter = editWall(original, 'wall', { end: { x: 8, y: 3 }, thickness: .3 });
  validateHome(shorter.home);
  assert.deepEqual(shorter.home.walls[0].end, { x: 8, y: 3 });
  assert.equal(shorter.home.walls[0].thickness, .3);
  assert.equal(shorter.home.openings[0].offset, 1.55);
  const curved = editWall(shorter, 'wall', { control: { x: 10, y: 2 } });
  validateHome(curved.home);
  assert.ok(wallLength(curved.home.walls[0]) > 2);
  assert.notDeepEqual(pointOnWall(curved.home.walls[0], 1).point, pointOnWall(shorter.home.walls[0], 1).point);
  assert.equal(original.home.walls[0].thickness, .15);
});
