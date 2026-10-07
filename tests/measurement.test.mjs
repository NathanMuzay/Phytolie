import test from 'node:test';
import assert from 'node:assert/strict';
import { measureDimensions, validLandmarks, imageFrame, pointFromTouch, pointFromClient, validMeasurement } from '../src/features/measurement/measurement.ts';
import { detectDimensions } from '../server/measurement.mjs';
import { parseGarden } from '../src/shared/model.ts';
const size = { width: 1000, height: 2000 };
const points = {
  referenceStart: { x: .1, y: .2 }, referenceEnd: { x: .1, y: .4 },
  plantTop: { x: .5, y: .1 }, soilLevel: { x: .5, y: .7 },
  plantLeft: { x: .2, y: .4 }, plantRight: { x: .8, y: .4 },
  potLeft: { x: .35, y: .7 }, potRight: { x: .65, y: .7 },
};
const input = { ...size, referenceCm: 20, referenceDescription: 'Règle verticale de 20 cm', image: 'data:image/png;base64,aGVsbG8=' };
const provider = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });
const output = data => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
test('Calibrates centimeters with non-square photos and preserves scale on resizing', () => {
  assert.deepEqual(measureDimensions(points, size, 20), { height: 60, width: 30, pot: 15 });
  assert.deepEqual(measureDimensions(points, { width: 500, height: 1000 }, 20), { height: 60, width: 30, pot: 15 });
  assert.deepEqual(measureDimensions(points, size, 40), { height: 120, width: 60, pot: 30 });
});
test('Reference length uses actual pixel distance on both axes', () => {
  const diagonal = { ...points, referenceStart: { x: 0, y: 0 }, referenceEnd: { x: .3, y: .2 } };
  assert.equal(measureDimensions(diagonal, size, 25).height, 60);
});
test('Rejects missing, inverted, nonfinite, out-of-bounds and tiny calibration data', () => {
  assert.equal(validLandmarks(null), false);
  assert.equal(validLandmarks({ ...points, potLeft: { x: NaN, y: .3 } }), false);
  for (const replacement of [{ referenceEnd: points.referenceStart }, { referenceEnd: { x: .1, y: .21 } }, { plantTop: { x: .5, y: .9 } }, { potRight: { x: -1, y: 0 } }, { plantRight: points.plantLeft }]) {
    assert.throws(() => measureDimensions({ ...points, ...replacement }, size, 20));
  }
  for (const length of [0, -1, Infinity, NaN, 201]) assert.throws(() => measureDimensions(points, size, length));
  assert.throws(() => measureDimensions(points, { width: 0, height: 2000 }, 20));
});
test('Maps touches through letterboxing, rejects taps in padding and works after rotation', () => {
  const frame = { width: 400, height: 400 };
  assert.deepEqual(imageFrame(size, frame), { left: 100, top: 0, width: 200, height: 400 });
  assert.deepEqual(pointFromTouch(200, 200, size, frame), { x: .5, y: .5 });
  assert.equal(pointFromTouch(99, 200, size, frame), null);
  assert.deepEqual(pointFromTouch(200, 200, { width: 2000, height: 1000 }, frame), { x: .5, y: .5 });
  assert.equal(pointFromTouch(200, 50, { width: 2000, height: 1000 }, frame), null);
  assert.equal(pointFromTouch(0, 0, size, { width: 0, height: 0 }), null);
});
test('Browser mouse clicks use the photo surface bounds after scroll and resize', () => {
  const bounds = { left: 120, top: 650, width: 400, height: 360 };
  assert.deepEqual(pointFromClient(320, 830, size, bounds), { x: .5, y: .5 });
  // Portrait photo has horizontal padding; this click must not place a point.
  assert.equal(pointFromClient(150, 830, size, bounds), null);
  const moved = { ...bounds, left: 40, top: 120, width: 600, height: 360 };
  assert.deepEqual(pointFromClient(340, 300, size, moved), { x: .5, y: .5 });
  assert.equal(pointFromClient(NaN, 830, size, bounds), null);
  assert.equal(pointFromClient(320, 830, size, { ...bounds, width: 0 }), null);
});
test('Eight browser clicks reconstruct all landmarks and permit manual dimensions without an API', () => {
  const bounds = { left: 80, top: 450, width: 500, height: 400 };
  const displayed = imageFrame(size, bounds);
  const placed = Object.fromEntries(Object.entries(points).map(([key, p]) => [key, pointFromClient(bounds.left+displayed.left+p.x*displayed.width, bounds.top+displayed.top+p.y*displayed.height, size, bounds)]));
  assert.deepEqual(placed, points);
  assert.deepEqual(measureDimensions(placed, size, 20), { height: 60, width: 30, pot: 15 });
});
test('Vision request keeps secret server-side, uses structured output and rejects bad input before calling provider', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.input[0].content[1].image_url, input.image);
    return new Response(JSON.stringify(output({ usable: true, points, reason: '' })));
  };
  assert.deepEqual((await detectDimensions(input, { apiKey: 'test-secret', fetchImpl })).points, points);
  for (const patch of [{ image: 'https://example.com/photo.png' }, { referenceCm: 0 }, { width: -1 }, { referenceDescription: '' }]) {
    await assert.rejects(detectDimensions({ ...input, ...patch }, { apiKey: 'test-secret', fetchImpl }), e => e.status === 400);
  }
  await assert.rejects(detectDimensions(input, { apiKey: '', fetchImpl }), e => e.status === 503);
  assert.equal(calls, 1);
});
test('Vision refusals, uncertain images, malformed landmarks, incomplete output, errors and timeouts are actionable', async () => {
  const cases = [
    [output({ usable: false, points: null, reason: 'Repère absent' }), 200, 422],
    [output({ usable: true, points: {}, reason: '' }), 200, 422],
    [output({ usable: true, points: { ...points, plantTop: points.soilLevel }, reason: '' }), 200, 422],
    [{ status: 'incomplete', output: [] }, 200, 502],
    [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, 200, 422],
    [{}, 429, 429], [{}, 401, 502],
  ];
  for (const [body, status, expected] of cases) await assert.rejects(detectDimensions(input, { apiKey: 'test', fetchImpl: provider(body, status) }), e => e.status === expected);
  await assert.rejects(detectDimensions(input, { apiKey: 'test', fetchImpl: async () => { throw new DOMException('Timeout', 'TimeoutError'); } }), e => e.status === 504);
  await assert.rejects(detectDimensions(input, { apiKey: 'test', fetchImpl: async () => new Response('broken') }), e => e.status === 502);
});
test('Measurement metadata round-trips with legacy gardens and rejects invalid persisted values', () => {
  const measurement = { height: 60, width: 30, pot: 15, method: 'vision', referenceCm: 20, measuredAt: '2026-09-30T12:00:00Z' };
  assert.equal(validMeasurement(measurement), true);
  const plant = { id: '1', name: 'Test', species: 'Monstera', room: 'Salon', soil: 'Terreau', caretaker: '', height: 60, width: 30, pot: 15, temperature: 20, interval: 7, lastWatered: null, createdAt: measurement.measuredAt, repotDate: '2027-09-30', history: [], measurement };
  const garden = { plants: [plant], reminders: false };
  assert.deepEqual(parseGarden(JSON.stringify(garden)), garden);
  for (const patch of [{ width: -1 }, { measurement: { ...measurement, referenceCm: 0 } }, { measurement: { ...measurement, method: 'unknown' } }]) {
    assert.throws(() => parseGarden(JSON.stringify({ ...garden, plants: [{ ...plant, ...patch }] })));
  }
});
