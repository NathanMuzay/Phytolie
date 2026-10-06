export type Page = 'home' | 'garden' | 'tasks' | 'settings' | 'preferences' | 'caretaker' | 'account' | 'new' | `plant/${string}` | `edit/${string}`;
const paths: Record<string, Page> = { '/parametres': 'preferences', '/ma-maison': 'home', '/': 'garden', '/a-faire': 'tasks', '/mon-espace': 'settings', '/personne-de-confiance': 'caretaker', '/compte': 'account', '/plantes/ajouter': 'new' };
export function pageFromHash(hash: string): Page {
  const path = hash.replace(/^#/, '') || '/';
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
