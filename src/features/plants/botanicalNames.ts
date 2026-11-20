export const normalizeBotanicalName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[’'‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
// Search aliases, not an exhaustive taxonomic catalogue. Never overwrite the
// species confirmed by the user or turn a genus into a claimed identification.
export const botanicalNames = [
  { scientific: 'Nephrolepis exaltata', aliases: ['fougère de Boston', 'Boston fern', 'sword fern'], source: 'https://ask.ifas.ufl.edu/publication/FP427' },
  { scientific: 'Dracaena trifasciata', aliases: ['Sansevieria trifasciata', 'langue de belle-mère', 'snake plant', 'mother-in-law’s tongue'], source: 'https://www.kew.org/plants/snake-plant' },
  { scientific: 'Monstera deliciosa', aliases: ['faux philodendron', 'swiss cheese plant'], source: 'https://www.rhs.org.uk/plants/swiss-cheese-plants/how-to-grow-swiss-cheese-plants' },
  { scientific: 'Aloe vera', aliases: ['aloès', 'aloé vera'] },
  { scientific: 'Ficus elastica', aliases: ['caoutchouc', 'rubber plant'] },
  { scientific: 'Epipremnum aureum', aliases: ['pothos', 'lierre du diable'] },
  { scientific: 'Chlorophytum comosum', aliases: ['plante araignée', 'phalangère'] },
  { scientific: 'Zamioculcas zamiifolia', aliases: ['plante ZZ'] },
  { scientific: 'Pilea peperomioides', aliases: ['plante à monnaie chinoise'] },
  { scientific: 'Spathiphyllum wallisii', aliases: ['fleur de lune', 'lis de la paix'] },
  { scientific: 'Philodendron hederaceum', aliases: ['philodendron grimpant'] },
] as const;
export function searchBotanicalSpecies(query: string) {
  const normalized = normalizeBotanicalName(query);
  if (normalized.length < 2) return [];
  const terms = normalized.split(' ');
  return botanicalNames.filter(item => {
    const scientific = normalizeBotanicalName(item.scientific);
    const searchable = normalizeBotanicalName([item.scientific, ...item.aliases].join(' '));
    return scientific !== normalized && terms.every(term => searchable.includes(term));
  }).slice(0, 5);
}
export function botanicalSearchText(value: string): string {
  const normalized = normalizeBotanicalName(value);
  const matches = botanicalNames.filter(item => [item.scientific, ...item.aliases].some(alias => normalized.includes(normalizeBotanicalName(alias))));
  return normalizeBotanicalName([value, ...matches.flatMap(item => [item.scientific, ...item.aliases])].join(' '));
}
