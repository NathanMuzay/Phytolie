import { useMemo } from 'react';
import { Platform, useWindowDimensions, type TextStyle, type ViewStyle, type ImageStyle } from 'react-native';

// Botanical palette shared by the collection, account and photo tools.
export const palette = {
  paper: '#F7F3E8', surface: '#FFFCF5', olive: '#666744',
  ink: '#343C2B', muted: '#73745D', line: '#D8D4BF',
  sage: '#E9E9D8', forest: '#344636', terracotta: '#A75E43',
};
export const fonts = {
  editorial: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }),
  annotation: Platform.select({ web: 'monospace', ios: 'Menlo', default: 'monospace' }),
};
export const botanicalPhoto = require('../assets/botanical/monstera.jpg');

// Enlarge desktop text without changing the mobile layout. Recompute on resize.
export function useReadableStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(base: T): T {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 860;
  return useMemo(() => {
    if (!desktop) return base;
    return Object.fromEntries(Object.entries(base).map(([key, original]) => {
      const style = { ...original } as TextStyle;
      if (style.fontSize == null && (style.color != null || style.fontWeight != null || style.fontFamily != null)) style.fontSize = 14;
      if (style.fontSize != null) style.fontSize = Math.max(14, Math.round(style.fontSize * (style.fontSize >= 38 ? 1.08 : 1.2)));
      if (style.lineHeight != null) style.lineHeight = Math.round(style.lineHeight * 1.2);
      return [key, style];
    })) as T;
  }, [base, desktop]);
}
