import { validMeasurement, type Measurement } from './measurement.ts';
import { wateringPlan, type Irrigation } from './irrigation.ts';
import type { City } from './weather.ts';
export type Plant = {
  id: string; name: string; species: string; room: string; photo?: string;
  height: number; width?: number; measurement?: Measurement; pot: number; soil: string; temperature: number;
  interval: number; lastWatered: string | null; createdAt: string;
  repotDate: string; caretaker: string; history: string[];
  waterAmount?: number; wateringAdvice?: string;
  irrigation?: Irrigation;
  family?: string; description?: string;
  identificationConfidence?: number; identificationSource?: string;
};
export type Garden = { plants: Plant[]; reminders: boolean; reminderTime?: string; city?: City };
export const STORAGE_KEY = 'folia.garden.v1';
export const DAY = 86400000;
export function addDays(date: Date, days: number): Date {
  const result = new Date(date); result.setDate(result.getDate() + days); return result;
}
export function dueDate(plant: Plant): Date {
  return wateringPlan(plant).nextCheck;
}
export function daysUntil(date: Date, now = new Date()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY);
}
export function waterPlant(plant: Plant, now = new Date()): Plant {
  return { ...plant, irrigation: plant.irrigation ? { ...plant.irrigation, moisture: undefined, checkedAt: undefined } : undefined, lastWatered: now.toISOString(), history: [now.toISOString(), ...plant.history].slice(0, 100) };
}
export function parseGarden(raw: string): Garden {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.plants) || typeof value.reminders !== 'boolean') throw new Error('Sauvegarde invalide');
  if (value.reminderTime != null && !isReminderTime(value.reminderTime)) throw new Error('Heure de rappel invalide');
  for (const p of value.plants) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.species !== 'string' || typeof p.room !== 'string' || typeof p.soil !== 'string' || typeof p.caretaker !== 'string' || !Number.isFinite(p.interval) || p.interval < 1 || p.interval > 90 || !Number.isFinite(p.height) || !Number.isFinite(p.pot) || !Number.isFinite(p.temperature) || !Number.isFinite(Date.parse(p.createdAt)) || !Number.isFinite(Date.parse(p.repotDate)) || (p.lastWatered !== null && !Number.isFinite(Date.parse(p.lastWatered))) || !Array.isArray(p.history) || p.history.some((d: unknown) => typeof d !== 'string' || !Number.isFinite(Date.parse(d)))) throw new Error('Fiche invalide');
    if ((p.waterAmount != null && (!Number.isFinite(p.waterAmount) || p.waterAmount < 0 || p.waterAmount > 5000)) || (p.identificationConfidence != null && (!Number.isFinite(p.identificationConfidence) || p.identificationConfidence < 0 || p.identificationConfidence > 1))) throw new Error('Données d’identification invalides');
  }
  if (value.city && (!Number.isFinite(value.city.id) || typeof value.city.name !== 'string' || !Number.isFinite(value.city.latitude) || !Number.isFinite(value.city.longitude))) throw new Error('Ville invalide');
  for (const p of value.plants) {
    if (p.width != null && (!Number.isFinite(p.width) || p.width < 1 || p.width > 1000)) throw new Error('Largeur de plante invalide');
    if (p.measurement != null && !validMeasurement(p.measurement)) throw new Error('Mesure photo invalide');
    const c = p.irrigation;
    if (c && (typeof c.automatic !== 'boolean' || !Number.isFinite(c.depth) || c.depth <= 0 || c.depth > 100 || !['plastic', 'terracotta'].includes(c.material) || !['yes', 'no', 'unknown'].includes(c.drainage) || !['standard', 'draining', 'retentive', 'bark'].includes(c.substrate) || !['indoor', 'outdoor'].includes(c.location) || !['shade', 'indirect', 'sun'].includes(c.exposure) || !['growing', 'rest'].includes(c.season) || (c.moisture != null && !['dry', 'moist'].includes(c.moisture)) || (c.checkedAt != null && !Number.isFinite(Date.parse(c.checkedAt))))) throw new Error('Paramètres d’arrosage invalides');
  }
  return value;
}
export const DEFAULT_REMINDER_TIME = '09:00';
export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function reminderDates(plant: Plant, now = new Date(), time = DEFAULT_REMINDER_TIME): Date[] {
  if (!isReminderTime(time)) throw new Error('Heure de rappel invalide');
  const [hour, minute] = time.split(':').map(Number);
  const first = wateringPlan(plant, now).nextCheck;
  if (first < now) first.setTime(now.getTime());
  first.setHours(hour, minute, 0, 0);
  if (first <= now) first.setDate(first.getDate() + 1);
  // Reset the requested clock time each day, including after a DST gap.
  return Array.from({ length: 30 }, (_, index) => {
    const date = addDays(first, index); date.setHours(hour, minute, 0, 0); return date;
  });
}

export function sortPlantsByUrgency(plants: Plant[]): Plant[] {
  return [...plants].sort((a, b) => +dueDate(a) - +dueDate(b) || a.name.localeCompare(b.name, 'fr'));
}
