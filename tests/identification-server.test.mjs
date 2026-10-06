import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { normalizeIdentificationImage, identifyImage, identificationFailure } from '../server/identification.mjs';
const fixture = format => sharp({ create: { width: 40, height: 60, channels: 4, background: { r: 30, g: 180, b: 20, alpha: .5 } } }).toFormat(format).toBuffer();
test('AVIF, WebP, PNG and JPEG are converted to actual JPEG bytes, including data URLs', async () => {
  for (const format of ['avif', 'webp', 'png', 'jpeg']) {
    const original = await fixture(format);
    const encoded = await normalizeIdentificationImage(`data:image/${format};base64,${original.toString('base64')}`);
    const metadata = await sharp(Buffer.from(encoded, 'base64')).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 40);
    assert.equal(metadata.height, 60);
    assert.equal(metadata.hasAlpha, false);
  }
});
test('Normalizes orientation, reduces large photos without stretching and strips metadata', async () => {
  const bytes = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#008800' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const metadata = await sharp(Buffer.from(await normalizeIdentificationImage(bytes.toString('base64')), 'base64')).metadata();
  assert.equal(metadata.width, 700);
  assert.equal(metadata.height, 1400);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
});
test('Malformed, oversized and non-raster inputs never reach the provider', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Unexpected network request'); };
  for (const image of [undefined, '', 'not base64!', Buffer.from('not an image').toString('base64'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>').toString('base64'), 'A'.repeat(12 * 1024 * 1024 + 1)]) {
    await assert.rejects(identifyImage(image, { apiKey: 'secret', fetchImpl }), e => e.status === 400);
  }
  const huge = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(normalizeIdentificationImage(huge.toString('base64')), e => e.status === 400);
  assert.equal(calls, 0);
});
test('Proxy sends converted AVIF as JPEG and preserves identification response', async () => {
  const input = (await fixture('avif')).toString('base64');
  const result = await identifyImage(input, { apiKey: 'secret', fetchImpl: async (url, options) => {
    assert.match(url, /api\.plant\.id\/v3\/identification/);
    assert.ok(new URL(url).searchParams.get('details').split(',').includes('image'));
    assert.equal(options.headers['Api-Key'], 'secret');
    const photo = JSON.parse(options.body).images[0];
    assert.equal((await sharp(Buffer.from(photo, 'base64')).metadata()).format, 'jpeg');
    return new Response(JSON.stringify({ result: { is_plant: { binary: true }, classification: { suggestions: [{ name: 'Anthurium andraeanum', probability: .9 }] } } }));
  } });
  assert.equal(result.scientificName, 'Anthurium andraeanum');
  assert.equal(result.suggestions.length, 1);
});
test('Upstream failures distinguish image errors, credentials, credit balance, throttling and outages without leaking bodies', async () => {
  for (const [status, expression] of [[400, /photo/], [401, /Clé/], [402, /Crédits/], [403, /Accès/], [429, /Limite/], [503, /temporairement/]]) {
    const result = identificationFailure(status, 'Invalid image data secret-api-key');
    assert.match(result.message, expression);
    assert.doesNotMatch(result.message, /secret-api-key/);
  }
  const image = (await fixture('png')).toString('base64');
  await assert.rejects(identifyImage(image, { apiKey: 'secret', fetchImpl: async () => new Response('Invalid image data secret-api-key', { status: 400 }) }), e => e.status === 422 && !e.message.includes('secret-api-key'));
  await assert.rejects(identifyImage(image, { apiKey: 'secret', fetchImpl: async () => { throw new DOMException('Timeout', 'TimeoutError'); } }), /trop de temps/);
  await assert.rejects(identifyImage(image, { apiKey: 'secret', fetchImpl: async () => new Response('broken') }), /réponse invalide/);
});
