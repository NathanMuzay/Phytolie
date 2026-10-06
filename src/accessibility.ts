export type AccessibilitySettings = {
  textScale: number;
  highContrast: boolean;
  simpleFont: boolean;
  spaciousText: boolean;
  reduceMotion: boolean;
};
export const ACCESSIBILITY_KEY = 'phytolie.accessibility.v1';
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5, 1.75, 2];
export const defaultAccessibility: AccessibilitySettings = {
  textScale: 1, highContrast: false, simpleFont: false, spaciousText: false, reduceMotion: false,
};
export function parseAccessibility(raw: string | null, defaults = defaultAccessibility): AccessibilitySettings {
  if (!raw) return { ...defaults };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults };
    return {
      textScale: TEXT_SCALES.includes(value.textScale) ? value.textScale : defaults.textScale,
      highContrast: typeof value.highContrast === 'boolean' ? value.highContrast : defaults.highContrast,
      simpleFont: typeof value.simpleFont === 'boolean' ? value.simpleFont : defaults.simpleFont,
      spaciousText: typeof value.spaciousText === 'boolean' ? value.spaciousText : defaults.spaciousText,
      reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : defaults.reduceMotion,
    };
  } catch { return { ...defaults }; }
}

export function readableTextMetrics(fontSize: number | undefined, lineHeight: number | undefined, width: number, desktop: boolean, settings: AccessibilitySettings) {
  const originalSize = fontSize ?? 14;
  const responsiveSize = width < 600 && originalSize >= 38 ? 32 : originalSize;
  const size = desktop ? Math.max(14, Math.round(responsiveSize * (responsiveSize >= 38 ? 1.08 : 1.2))) : responsiveSize;
  return {
    fontSize: Math.round(size * settings.textScale),
    ...(lineHeight != null || settings.spaciousText ? {
      lineHeight: Math.ceil(Math.max((lineHeight ?? 0) * responsiveSize / originalSize, size * 1.45) * settings.textScale * (settings.spaciousText ? 1.2 : 1)),
    } : {}),
  };
}
