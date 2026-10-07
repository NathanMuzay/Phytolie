import { careDefaults } from './care.ts';

export type Irrigation = {
  automatic: boolean;
  depth: number;
  material: 'plastic' | 'terracotta';
  drainage: 'yes' | 'no' | 'unknown';
  substrate: 'standard' | 'draining' | 'retentive' | 'bark';
  location: 'indoor' | 'outdoor';
  exposure: 'shade' | 'indirect' | 'sun';
  season: 'growing' | 'rest';
  moisture?: 'dry' | 'moist';
  checkedAt?: string;
};
export type WateringInput = {
  species: string; pot: number; temperature: number; interval: number; waterAmount?: number;
  lastWatered: string | null; createdAt: string; irrigation?: Irrigation;
};
export const defaultIrrigation: Irrigation = {
  automatic: true, depth: 12, material: 'plastic', drainage: 'unknown', substrate: 'standard',
  location: 'indoor', exposure: 'indirect', season: 'growing',
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const plusDays = (date: Date, days: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };

// Product heuristics, not measured water requirements. The substrate check takes priority.
export function wateringPlan(plant: WateringInput, now = new Date()) {
  const c = plant.irrigation;
  let interval = plant.interval;
  let amount = plant.waterAmount ?? 0;
  const reasons: string[] = [];
  if (c?.automatic) {
    const base = careDefaults(plant.species).interval;
    const diameter = clamp(plant.pot, 1, 100);
    const depth = clamp(c.depth, 1, 100);
    const volume = Math.PI * (diameter / 2) ** 2 * depth * 0.75;
    const retention = { standard: 1, draining: 0.8, retentive: 1.3, bark: 0.7 }[c.substrate];
    const heat = clamp(1 + (plant.temperature - 20) * 0.035, 0.65, 1.5);
    const light = { shade: 0.85, indirect: 1, sun: 1.2 }[c.exposure];
    const evaporation = heat * light * (c.material === 'terracotta' ? 1.2 : 1) * (c.location === 'outdoor' ? 1.15 : 1);
    const rest = c.season === 'rest' ? 1.4 : 1;
    interval = clamp(Math.round(base * clamp(Math.sqrt(volume / 1400), 0.7, 1.5) * retention * rest / evaporation), 1, 60);
    amount = clamp(Math.round(volume * (base >= 14 ? 0.07 : 0.12) * clamp(retention, 0.8, 1.15) * clamp(heat, 0.85, 1.15) / 25) * 25, 25, 5000);
    reasons.push(`Espèce : base de ${base} jours. Pot : ${plant.pot} × ${c.depth} cm, volume utile estimé ${(volume / 1000).toFixed(1)} L.`,
      `Substrat ${c.substrate === 'retentive' ? 'rétenteur' : c.substrate === 'draining' ? 'drainant' : c.substrate === 'bark' ? 'écorces' : 'standard'} ; ${plant.temperature.toFixed(1)} °C ; ${c.material === 'terracotta' ? 'terre cuite' : 'plastique / émaillé'}.`,
      `${c.location === 'outdoor' ? 'Extérieur' : 'Intérieur'} ; exposition ${c.exposure === 'sun' ? 'ensoleillée' : c.exposure === 'shade' ? 'ombragée' : 'indirecte'} ; ${c.season === 'rest' ? 'repos végétatif' : 'croissance'}.`);
  } else reasons.push('Fréquence et dose manuelles conservées.');
  let nextCheck = plant.lastWatered ? plusDays(new Date(plant.lastWatered), interval) : new Date(plant.createdAt);
  let instruction = 'Vérifiez le terreau avant d’arroser. La dose reste indicative ; arrêtez si l’eau s’écoule et videz la soucoupe.';
  const checked = c?.checkedAt ? new Date(c.checkedAt) : null;
  const validObservation = checked && +checked <= +now && (!plant.lastWatered || +checked > Date.parse(plant.lastWatered));
  const fresh = validObservation && +now - +checked < 86400000;
  if (validObservation && c?.moisture === 'moist') {
    const recheck = plusDays(checked, 1);
    if (recheck > nextCheck) nextCheck = recheck;
    if (fresh) { amount = 0; instruction = 'Terreau encore humide : ne pas arroser. Vérifiez à nouveau demain.'; }
  }
  if (validObservation && c?.moisture === 'dry') {
    if (checked < nextCheck) nextCheck = checked;
    if (fresh) instruction = 'Terreau déclaré sec : vérifiez aussi en profondeur, puis arrosez progressivement si nécessaire.';
  }
  if (c && c.drainage !== 'yes') {
    amount = 0;
    instruction = c.drainage === 'no' ? 'Pot sans drainage : aucune dose automatique. Utilisez un pot percé avant d’arroser.' : 'Vérifiez les trous de drainage pour obtenir une dose indicative.';
  }
  if (plant.temperature <= 5 && c?.location === 'outdoor') {
    amount = 0; instruction = 'Température extérieure basse : protégez la plante du gel et vérifiez ses besoins avant tout arrosage.';
  }
  return { interval, amount, nextCheck, instruction, reasons };
}
