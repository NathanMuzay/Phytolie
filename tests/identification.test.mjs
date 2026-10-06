import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSuggestions } from '../src/identification.mjs';

const result = suggestions => ({ result: { is_plant: { binary: true }, classification: { suggestions } } });
test('Provider alternatives are ranked, capped, and retain their own species details', () => {
  const data = result(Array.from({ length: 7 }, (_, i) => ({ name: `Species ${i}`, probability: i / 10, details: { common_names: [`Plant ${i}`], taxonomy: { family: `Family ${i}` }, description: { value: `Description ${i}` } } })));
  const mapped = mapSuggestions(data);
  assert.equal(mapped.length, 5);
  assert.deepEqual(mapped.map(s => s.scientificName), ['Species 6', 'Species 5', 'Species 4', 'Species 3', 'Species 2']);
  assert.equal(mapped[1].family, 'Family 5');
  assert.equal(mapped[1].description, 'Description 5');
});
test('Missing details and numeric watering levels never turn into misleading advice', () => {
  const mapped = mapSuggestions(result([{ name: 'Aloe vera', probability: .99, details: { watering: { min: 1, max: 1 } } }, { name: 'Unknown' }, {}]));
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].wateringAdvice, '');
  assert.equal(mapped[1].commonName, 'Unknown');
  assert.equal(mapped[1].description, '');
  assert.equal(mapped[1].confidence, 0);
});
test('Non-plant images and absent classifications yield no suggestions', () => {
  assert.deepEqual(mapSuggestions({ result: { is_plant: { binary: false }, classification: { suggestions: [{ name: 'Aloe vera' }] } } }), []);
  assert.deepEqual(mapSuggestions({}), []);
});

test('Each species keeps its own reference image and attribution', () => {
  const data = result(['Anthurium andraeanum', 'Ficus lyrata'].map((name, index) => ({
    name, probability: .9 - index / 10, details: { image: { value: `https://images.example.test/species-${index}.jpg`, citation: `Author ${index}`, license_name: 'CC BY-SA 4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
  })));
  const mapped = mapSuggestions(data);
  assert.equal(mapped[0].botanicalImage.url, 'https://images.example.test/species-0.jpg');
  assert.equal(mapped[1].botanicalImage.author, 'Author 1');
  assert.equal(mapped[1].botanicalImage.license, 'CC BY-SA 4.0');
  for (const image of [{ value: 'javascript:alert(1)', license_name: 'CC BY' }, { value: 'https://images.example.test/photo.jpg' }]) {
    assert.equal(mapSuggestions(result([{ name: 'Unknown', details: { image } }]))[0].botanicalImage, undefined);
  }
});
