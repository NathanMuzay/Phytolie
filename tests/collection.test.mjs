import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCollection } from '../src/features/plants/collection.ts';

const now = new Date('2026-11-02T12:00:00');
const base = { height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, createdAt: '2026-10-01T12:00:00', repotDate: '2027-10-01T12:00:00', caretaker: '', history: [] };
const plants = [
  { ...base, id: '1', name: 'Fougère de Léa', species: 'Nephrolepis exaltata', room: 'Entrée', lastWatered: null },
  { ...base, id: '2', name: 'Monstera', species: 'Monstera deliciosa', room: 'Salon', lastWatered: '2026-10-30T12:00:00' },
  { ...base, id: '3', name: 'Aloe', species: 'Aloe vera', room: 'Salon', lastWatered: '2026-10-26T12:00:00' },
];
test('Search ignores accents and case, and matches every word across name, species and room', () => {
  assert.deepEqual(filterCollection(plants, '  FOUGERE   entree ', null, false, now).map(p => p.id), ['1']);
  assert.deepEqual(filterCollection(plants, 'deliciosa salon', null, false, now).map(p => p.id), ['2']);
  assert.deepEqual(filterCollection(plants, 'aloe entree', null, false, now), []);
});
test('Room and due filters combine without changing collection order or contents', () => {
  const before = structuredClone(plants);
  assert.deepEqual(filterCollection(plants, '', 'Salon', true, now).map(p => p.id), ['3']);
  assert.deepEqual(filterCollection(plants, '  ', null, false, now), plants);
  assert.deepEqual(filterCollection(plants, '', null, true, now).map(p => p.id), ['1', '3']);
  assert.deepEqual(plants, before);
});
