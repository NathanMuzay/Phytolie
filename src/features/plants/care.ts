import { botanicalSearchText } from './botanicalNames.ts';
export type CareDefaults = { interval: number; soil: string; toleranceFraction: number | null };

export function careDefaults(name: string): CareDefaults {
  const value = botanicalSearchText(name);
  if (/cactus|succulent|aloe|agave|crassula|echeveria|haworthia|sansevieria|dracaena trifasciata/.test(value)) {
    return { toleranceFraction: 0.3, interval: 14, soil: 'Substrat très drainant pour cactus et succulentes' };
  }
  if (/foug[eè]re|fern|calathea|calath[eé]a|maranta|papyrus|fittonia/.test(value)) {
    return { toleranceFraction: 0.1, interval: 4, soil: 'Terreau riche et drainant, gardé légèrement humide' };
  }
  if (/orchid|orchid[eé]e|phalaenopsis/.test(value)) {
    return { toleranceFraction: 0.15, interval: 7, soil: "Écorces aérées pour orchidées" };
  }
  if (/monstera|philodendron|pothos|epipremnum|ficus|spathiphyllum|pilea/.test(value)) {
    return { toleranceFraction: 0.2, interval: 7, soil: 'Terreau pour plantes vertes, aéré et drainant' };
  }
  return { toleranceFraction: null, interval: 7, soil: 'Terreau universel drainant — à confirmer selon l’espèce' };
}

export function estimateWaterAmount(potDiameterCm: number, name = ''): number {
  if (!Number.isFinite(potDiameterCm) || potDiameterCm <= 0) return 0;
  const succulentFactor = /cactus|succulent|aloe|agave|crassula|echeveria|haworthia|sansevieria/.test(botanicalSearchText(name)) ? 0.55 : 1;
  const estimate = Math.PI * Math.pow(potDiameterCm / 2, 2) * 1.2 * succulentFactor;
  return Math.min(1500, Math.max(25, Math.round(estimate / 25) * 25));
}
