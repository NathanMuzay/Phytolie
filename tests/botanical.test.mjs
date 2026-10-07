import test from 'node:test';
import assert from 'node:assert/strict';
import { botanicalFor, botanicalLabel, preferredPhotoMode } from '../src/features/plants/botanical.ts';
import { parseGarden } from '../src/shared/model.ts';

test('Known species get a matching illustration; other species are explicitly decorative', () => {
  assert.equal(botanicalFor('Monstera deliciosa').key, 'monstera');
  assert.equal(botanicalFor('ALOE VERA').key, 'aloe');
  assert.equal(botanicalFor('Ficus elastica').key, 'ficus');
  assert.equal(botanicalFor('Fougère de Boston').key, 'fern');
  assert.equal(botanicalFor('Ficus lyrata').decorative, true);
  assert.equal(botanicalFor('Monstera adansonii').decorative, true);
  assert.equal(botanicalFor('Aloe arborescens').decorative, true);
  assert.equal(botanicalFor('Espèce à préciser').decorative, true);
});

test('Existing photos keep their display preference and missing photos fall back safely', () => {
  assert.equal(preferredPhotoMode({ photo: 'my-photo.jpg' }), 'personal');
  assert.equal(preferredPhotoMode({ photo: 'my-photo.jpg', photoMode: 'botanical' }), 'botanical');
  assert.equal(preferredPhotoMode({ photoMode: 'personal' }), 'botanical');
});

test('Visual preferences round-trip without discarding the original photo', () => {
  const plant = { id: '1', name: 'Aloe', species: 'Aloe vera', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-09-01T12:00:00Z', repotDate: '2027-09-01T12:00:00Z', caretaker: '', history: [], photo: 'data:image/png;base64,YWJj', photoMode: 'botanical', photoFit: 'contain' };
  plant.botanicalImage = { url: 'https://images.example.test/aloe.jpg', author: 'Author', license: 'CC BY' };
  const garden = { plants: [plant], reminders: false };
  assert.deepEqual(parseGarden(JSON.stringify(garden)), garden);
  for (const invalid of [{ photoMode: 'other' }, { photoFit: 'stretch' }, { botanicalImage: { url: 'file:///private', author: '', license: '' } }]) {
    assert.throws(() => parseGarden(JSON.stringify({ ...garden, plants: [{ ...plant, ...invalid }] })));
  }
});

test('Unknown species use their reference photo or the original, without claiming a fern match', () => {
  const plant = { species: 'Anthurium andraeanum', photo: 'my-photo.jpg' };
  assert.match(botanicalLabel(plant), /Photo personnelle/);
  assert.equal(botanicalLabel({ ...plant, botanicalImage: { url: 'https://images.example.test/anthurium.jpg', author: '', license: 'CC BY' } }), 'Anthurium andraeanum · photo de référence');
});
