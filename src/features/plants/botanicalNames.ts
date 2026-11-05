export const normalizeBotanicalName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[’'‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
// Search aliases, not an exhaustive taxonomic catalogue. Never overwrite the
// species confirmed by the user or turn a genus into a claimed identification.
export const botanicalNames = [
  { scientific: 'Nephrolepis exaltata', aliases: ['fougère de Boston', 'Boston fern', 'sword fern'], source: 'https://ask.ifas.ufl.edu/publication/FP427' },
  { scientific: 'Dracaena trifasciata', aliases: ['Sansevieria trifasciata', 'langue de belle-mère', 'snake plant', 'mother-in-law’s tongue'], source: 'https://www.kew.org/plants/snake-plant' },
  { scientific: 'Monstera deliciosa', aliases: ['faux philodendron', 'swiss cheese plant'], source: 'https://www.rhs.org.uk/plants/swiss-cheese-plants/how-to-grow-swiss-cheese-plants' },
] as const;
export function botanicalSearchText(value: string): string {
  const normalized = normalizeBotanicalName(value);
  const matches = botanicalNames.filter(item => [item.scientific, ...item.aliases].some(alias => normalized.includes(normalizeBotanicalName(alias))));
  return normalizeBotanicalName([value, ...matches.flatMap(item => [item.scientific, ...item.aliases])].join(' '));
}
