import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { palette } from './appearance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCESSIBILITY_KEY, defaultAccessibility, parseAccessibility, type AccessibilitySettings } from './accessibility';

const Context = createContext({
  settings: defaultAccessibility, ready: false, error: '',
  update: (_patch: Partial<AccessibilitySettings>) => {}, reset: () => {},
});
export const useAccessibility = () => useContext(Context);
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(defaultAccessibility);
  const current = useRef(settings);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void (async () => {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      try {
        const raw = await AsyncStorage.getItem(ACCESSIBILITY_KEY);
        if (active) { current.current = parseAccessibility(raw, { ...defaultAccessibility, reduceMotion }); setSettings(current.current); }
      } catch {
        if (active) setError('Lecture des préférences impossible. Vos changements pourront être enregistrés à nouveau.');
      } finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, []);
  function update(patch: Partial<AccessibilitySettings>) {
    if (!ready) return;
    const next = parseAccessibility(JSON.stringify({ ...current.current, ...patch }));
    current.current = next; setSettings(next); setError('');
    queue.current = queue.current.catch(() => {}).then(async () => {
      try { await AsyncStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(next)); setError(''); }
      catch { setError('Préférences appliquées, mais non enregistrées. Réessayez votre réglage.'); }
    });
  }
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const sheet = document.createElement('style');
    const highlight = settings.highContrast ? '#000000' : palette.forest;
    sheet.textContent = `
      @media (hover: hover) and (pointer: fine) {
        :is(button, a, [role="button"], [role="link"], [role="tab"], [role="switch"]):not([aria-disabled="true"]):not(:disabled):hover {
          cursor: pointer;
          outline: 2px solid ${highlight};
          outline-offset: 2px;
          box-shadow: inset 0 0 0 9999px ${settings.highContrast ? 'rgba(0, 0, 0, 0.08)' : `${palette.sage}40`};
        }
        :is(input, textarea):not([aria-disabled="true"]):not(:disabled):not([readonly]):hover {
          outline: 2px solid ${highlight};
          outline-offset: 2px;
        }
      }
      :focus-visible { outline: 3px solid ${highlight} !important; outline-offset: 3px; }
      ${settings.reduceMotion ? '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }' : ''}`;
    document.head.appendChild(sheet);
    return () => sheet.remove();
  }, [settings.highContrast, settings.reduceMotion]);
  return <Context.Provider value={{ settings, ready, error, update, reset: () => update(defaultAccessibility) }}>{children}</Context.Provider>;
}
