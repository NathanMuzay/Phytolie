import { useMemo } from 'react';
import { Platform, useWindowDimensions, type TextStyle, type ViewStyle, type ImageStyle } from 'react-native';
import { useAccessibility } from '../accessibility/AccessibilityProvider';
import { readableTextMetrics } from '../accessibility/accessibility';

import { palette, contrastPalette } from './appearance';
export { palette } from './appearance';
export function useThemePalette() {
  const { settings } = useAccessibility();
  return settings.highContrast ? contrastPalette : palette;
}
export const fonts = {
  editorial: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }),
  annotation: Platform.select({ web: 'monospace', ios: 'Menlo', default: 'monospace' }),
};
export const botanicalPhoto = require('../../../assets/botanical/monstera.jpg');

export function useReadableStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(base: T): T {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 860;
  const { settings } = useAccessibility();
  return useMemo(() => Object.fromEntries(Object.entries(base).map(([key, original]) => {
    let style = { ...original } as TextStyle;
    if (settings.highContrast) {
      for (const property of Object.keys(style)) {
        const value = (style as Record<string, unknown>)[property];
        const colorKey = Object.keys(palette).find(name => palette[name as keyof typeof palette] === value) as keyof typeof palette | undefined;
        if (colorKey) (style as Record<string, unknown>)[property] = contrastPalette[colorKey];
      }
    }
    if (style.fontSize == null && (style.color != null || style.fontWeight != null || style.fontFamily != null)) style = { ...style, fontSize: 14 };
    if (style.fontSize != null) {
      Object.assign(style, readableTextMetrics(style.fontSize, style.lineHeight, width, desktop, settings));
    }
    if (settings.simpleFont && style.fontFamily) style = { ...style, fontFamily: Platform.select({ web: 'Arial, sans-serif', ios: 'System', default: 'sans-serif' }) };
    return [key, style];
  })) as T, [base, desktop, width, settings]);
}
