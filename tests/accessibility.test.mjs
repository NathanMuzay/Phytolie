import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAccessibility, parseAccessibility, TEXT_SCALES, readableTextMetrics } from '../src/shared/accessibility/accessibility.ts';
import { palette, contrastPalette } from '../src/shared/ui/appearance.ts';

test('Preferences survive storage roundtrip, including 200% text and disabled OS animations', () => {
  const chosen = { textScale: 2, highContrast: true, simpleFont: true, spaciousText: true, reduceMotion: false };
  assert.deepEqual(parseAccessibility(JSON.stringify(chosen), { ...defaultAccessibility, reduceMotion: true }), chosen);
  for (const textScale of TEXT_SCALES) assert.equal(parseAccessibility(JSON.stringify({ textScale })).textScale, textScale);
});
test('Missing, corrupt and unsupported stored values fall back without accepting truthy strings', () => {
  const defaults = { ...defaultAccessibility, reduceMotion: true };
  for (const raw of [null, '', '{', 'null', '[]', '42']) assert.deepEqual(parseAccessibility(raw, defaults), defaults);
  assert.deepEqual(parseAccessibility(JSON.stringify({ textScale: 999, highContrast: 'true', simpleFont: 1, spaciousText: null, reduceMotion: 'false' }), defaults), defaults);
  assert.deepEqual(parseAccessibility('{"textScale":1.5,"highContrast":true}', defaults), { ...defaults, textScale: 1.5, highContrast: true });
});
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
test('Both palettes keep text and button labels legible on every surface', () => {
  for (const colors of [palette, contrastPalette]) {
    for (const text of ['ink', 'muted', 'olive', 'terracotta']) {
      for (const background of ['paper', 'surface', 'sage']) {
        assert.ok(ratio(colors[text], colors[background]) >= 4.5, `${text} on ${background}: ${ratio(colors[text], colors[background])}`);
      }
    }
    assert.ok(ratio(colors.surface, colors.olive) >= 4.5);
  }
  for (const colors of [palette, contrastPalette]) assert.ok(ratio(colors.onTerracotta, colors.terracotta) >= 4.5);
});

test('Text zoom and spacing keep implicit font sizes finite and scale desktop body text', () => {
  const large = { ...defaultAccessibility, textScale: 2, spaciousText: true };
  const implicit = readableTextMetrics(undefined, 21, 1440, true, large);
  assert.equal(implicit.fontSize, 34);
  assert.ok(Number.isFinite(implicit.lineHeight));
  assert.ok(implicit.lineHeight >= implicit.fontSize * 1.45);
  const standard = readableTextMetrics(16, 24, 1440, true, defaultAccessibility);
  const doubled = readableTextMetrics(16, 24, 1440, true, { ...defaultAccessibility, textScale: 2 });
  assert.equal(doubled.fontSize, standard.fontSize * 2);
  assert.equal(readableTextMetrics(44, 49, 390, false, large).fontSize, 64);
  assert.ok(readableTextMetrics(16, 24, 390, false, large).lineHeight > readableTextMetrics(16, 24, 390, false, { ...large, spaciousText: false }).lineHeight);
});
