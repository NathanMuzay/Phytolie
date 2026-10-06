export type PhotoMode = 'personal' | 'botanical';
export type PhotoFit = 'contain' | 'cover';
export type BotanicalKey = 'monstera' | 'aloe' | 'ficus' | 'fern';
export type BotanicalImage = { url: string; author: string; license: string; licenseUrl?: string };

export function validBotanicalImage(image: unknown): image is BotanicalImage {
  if (!image || typeof image !== 'object') return false;
  const value = image as BotanicalImage;
  return typeof value.url === 'string' && /^https:\/\/[^\s]+$/.test(value.url)
    && typeof value.author === 'string' && typeof value.license === 'string'
    && (value.licenseUrl === undefined || /^https:\/\/[^\s]+$/.test(value.licenseUrl));
}

export function botanicalFor(species: string): { key: BotanicalKey; label: string; decorative: boolean } {
  const name = species.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/^(monstera deliciosa|monstera)$/.test(name.trim())) return { key: 'monstera', label: 'Monstera deliciosa · visuel d’illustration', decorative: false };
  if (/^(aloe vera|aloe|aloes)$/.test(name.trim())) return { key: 'aloe', label: 'Aloe vera · visuel d’illustration', decorative: false };
  if (/\bficus elastica\b|\bcaoutchouc\b/.test(name)) return { key: 'ficus', label: 'Ficus elastica · visuel d’illustration', decorative: false };
  if (/^(nephrolepis exaltata|fougere de boston|fougere|fern)$/.test(name.trim())) return { key: 'fern', label: 'Fougère de Boston · visuel d’illustration', decorative: false };
  return { key: 'fern', label: 'Composition botanique · visuel décoratif', decorative: true };
}

export function botanicalLabel(plant: { species: string; botanicalImage?: BotanicalImage; photo?: string }): string {
  const local = botanicalFor(plant.species);
  return !local.decorative ? local.label : validBotanicalImage(plant.botanicalImage)
    ? `${plant.species} · photo de référence` : plant.photo
    ? 'Photo personnelle · visuel de l’espèce indisponible' : local.label;
}

export function preferredPhotoMode(plant: { photo?: string; photoMode?: PhotoMode }): PhotoMode {
  return plant.photoMode === 'personal' && plant.photo ? 'personal' : plant.photoMode === 'botanical' ? 'botanical' : plant.photo ? 'personal' : 'botanical';
}
