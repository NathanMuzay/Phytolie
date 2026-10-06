import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { hashForPage, pageFromHash, type Page } from './navigation';
export function usePage() {
  const [page, setPage] = useState<Page>(() => Platform.OS === 'web' && typeof window !== 'undefined' ? pageFromHash(window.location.hash) : 'garden');
  const navigate = useCallback((next: Page) => {
    if (Platform.OS === 'web') window.location.hash = hashForPage(next);
    setPage(next);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const changed = () => setPage(pageFromHash(window.location.hash));
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"], [role="textbox"]')) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault(); navigate('garden');
      }
    };
    window.addEventListener('hashchange', changed);
    window.addEventListener('keydown', shortcut);
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('keydown', shortcut); };
  }, [navigate]);
  return { page, navigate };
}
