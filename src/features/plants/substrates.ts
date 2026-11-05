export type SubstrateType = 'standard' | 'draining' | 'retentive' | 'bark';
export type SubstrateSelection = { type: SubstrateType; name: string; composition: string; origin: 'catalogue' | 'maison' | 'code-inconnu'; source: string; productCode?: string };
const general = 'https://www.rhs.org.uk/science/gardening-in-a-changing-world/peat-use-in-gardens/peat-alternatives';
export const substrateCatalogue: Record<SubstrateType, { name: string; composition: string; properties: string; source: string }> = {
  standard: { name: 'Terreau aéré polyvalent', composition: 'Matières organiques compostées, fibres végétales ou coco, avec des éléments d’aération selon le produit.', properties: 'Rétention intermédiaire déclarée. Lire la composition et les consignes du fabricant.', source: general },
  draining: { name: 'Mélange très drainant', composition: 'Base organique associée à des éléments minéraux comme sable grossier, gravier ou perlite. Proportions à vérifier sur le produit.', properties: 'Écoulement facilité ; profil indicatif pour plantes demandant un substrat drainant.', source: 'https://www.rhs.org.uk/plants/sansevieria' },
  retentive: { name: 'Mélange rétenteur', composition: 'Matières à capacité de rétention, par exemple fibres de coco, compost et éventuellement vermiculite, selon le mélange réel.', properties: 'Rétention plus élevée déclarée ; maintenir une bonne aération et du drainage.', source: 'https://homegarden.cahnr.uconn.edu/factsheets/potting-media/' },
  bark: { name: 'Substrat à base d’écorces', composition: 'Écorces calibrées, éventuellement associées à d’autres constituants selon le produit.', properties: 'Structure grossière et aérée. Vérifier les besoins de l’espèce : toutes les orchidées n’ont pas le même substrat.', source: 'https://homegarden.cahnr.uconn.edu/factsheets/potting-media/' },
};
export function catalogueSubstrate(type: SubstrateType): SubstrateSelection {
  const item = substrateCatalogue[type];
  return { type, name: item.name, composition: item.composition, origin: 'catalogue', source: item.source };
}
export function validSubstrate(value: unknown): value is SubstrateSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as SubstrateSelection;
  return Object.hasOwn(substrateCatalogue, s.type) && ['catalogue', 'maison', 'code-inconnu'].includes(s.origin)
    && typeof s.name === 'string' && !!s.name.trim() && s.name.length <= 100
    && typeof s.composition === 'string' && !!s.composition.trim() && s.composition.length <= 500
    && typeof s.source === 'string' && (s.origin === 'catalogue' ? s.source === substrateCatalogue[s.type].source : s.source === 'Déclaration utilisateur')
    && (s.productCode == null || (typeof s.productCode === 'string' && s.productCode.length <= 64));
}
