import test from 'node:test';
import assert from 'node:assert/strict';
import { rectangleFromDrag } from '../src/homeDrawing.ts';
import { validateHome, newHome } from '../src/home.ts';
test('Drawing in either direction produces the same valid room', () => {
  const bounds = { width: 20, height: 15 };
  const a = { x: 1.23, y: 2.34 }, b = { x: 6.78, y: 7.89 };
  const rect = rectangleFromDrag(a, b, bounds);
  assert.deepEqual(rect, rectangleFromDrag(b, a, bounds));
  assert.deepEqual(rect, { x: 1.2, y: 2.3, width: 5.6, height: 5.6 });
  validateHome({ ...newHome(), areas: [{ ...rect, id: 'room', name: 'Salon', kind: 'room', windows: [], shade: 'none' }] });
});
test('Dragging outside the canvas stays within its exact bounds', () => {
  const bounds = { width: 5.23, height: 3.17 };
  assert.deepEqual(rectangleFromDrag({ x: -4, y: -10 }, { x: 100, y: 40 }, bounds), { x: 0, y: 0, ...bounds });
  assert.deepEqual(rectangleFromDrag({ x: 100, y: 40 }, { x: -4, y: -10 }, bounds), { x: 0, y: 0, ...bounds });
});
test('A click cannot create a default room, and invalid dimensions cannot produce geometry', () => {
  assert.deepEqual(rectangleFromDrag({ x: 2, y: 2 }, { x: 2, y: 2 }, { width: 10, height: 8 }), { x: 2, y: 2, width: 0, height: 0 });
  assert.equal(rectangleFromDrag({ x: NaN, y: 0 }, { x: 1, y: 1 }, { width: 10, height: 8 }), null);
  assert.equal(rectangleFromDrag({ x: 0, y: 0 }, { x: 1, y: 1 }, { width: 0, height: 8 }), null);
});
