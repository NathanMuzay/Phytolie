export type Page = 'home' | 'garden' | 'tasks' | 'settings' | 'preferences' | 'privacy' | 'caretaker' | 'account' | 'new' | `plant/${string}` | `edit/${string}`;
export const mainPages = [
  { id: 'garden', label: 'Mes plantes', description: 'Votre collection' },
  { id: 'tasks', label: 'À faire', description: 'Les soins du jour' },
  { id: 'home', label: 'Ma maison', description: 'Plan et emplacements' },
  { id: 'caretaker', label: 'Personne de confiance', description: 'Partager les soins' },
  { id: 'settings', label: 'Mon espace', description: 'Rappels et météo' },
  { id: 'preferences', label: 'Paramètres', description: 'Accessibilité et compte' },
  { id: 'privacy', label: 'Confidentialité', description: 'Données personnelles et RGPD' },
] as const;
const paths: Record<string, Page> = { '/confidentialite': 'privacy', '/parametres': 'preferences', '/ma-maison': 'home', '/': 'garden', '/a-faire': 'tasks', '/mon-espace': 'settings', '/personne-de-confiance': 'caretaker', '/compte': 'account', '/plantes/ajouter': 'new' };
export function pageFromHash(hash: string): Page {
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  if (paths[path]) return paths[path];
  const match = /^\/plantes\/([^/]+)(\/modifier)?$/.exec(path);
  if (!match) return 'garden';
  try { return `${match[2] ? 'edit' : 'plant'}/${decodeURIComponent(match[1])}`; } catch { return 'garden'; }
}
export function hashForPage(page: Page): string {
  const path = Object.keys(paths).find(path => paths[path] === page);
  if (path) return `#${path}`;
  const id = encodeURIComponent(page.slice(page.indexOf('/') + 1));
  return `#/plantes/${id}${page.startsWith('edit/') ? '/modifier' : ''}`;
}

export function invitationFromHash(hash: string): string {
  const match = /[?&]invitation=([A-Za-z0-9_-]{43})(?:&|$)/.exec(hash);
  return match?.[1] ?? '';
}
