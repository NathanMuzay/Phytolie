export type Plant = {
  id: string; name: string; species: string; room: string; photo?: string;
  height: number; pot: number; soil: string; temperature: number;
  interval: number; lastWatered: string | null; createdAt: string;
  repotDate: string; caretaker: string; history: string[];
};
export type Garden = { plants: Plant[]; reminders: boolean };
export const STORAGE_KEY = 'folia.garden.v1';
export const DAY = 86400000;
export function addDays(date: Date, days: number): Date {
  const result = new Date(date); result.setDate(result.getDate() + days); return result;
}
export function dueDate(plant: Plant): Date {
  return plant.lastWatered ? addDays(new Date(plant.lastWatered), plant.interval) : new Date(plant.createdAt);
}
export function daysUntil(date: Date, now = new Date()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY);
}
export function waterPlant(plant: Plant, now = new Date()): Plant {
  return { ...plant, lastWatered: now.toISOString(), history: [now.toISOString(), ...plant.history].slice(0, 100) };
}
export function parseGarden(raw: string): Garden {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.plants) || typeof value.reminders !== 'boolean') throw new Error('Sauvegarde invalide');
  for (const p of value.plants) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.species !== 'string' || typeof p.room !== 'string' || typeof p.soil !== 'string' || typeof p.caretaker !== 'string' || !Number.isFinite(p.interval) || p.interval < 1 || p.interval > 90 || !Number.isFinite(p.height) || !Number.isFinite(p.pot) || !Number.isFinite(p.temperature) || !Number.isFinite(Date.parse(p.createdAt)) || !Number.isFinite(Date.parse(p.repotDate)) || (p.lastWatered !== null && !Number.isFinite(Date.parse(p.lastWatered))) || !Array.isArray(p.history) || p.history.some((d: unknown) => typeof d !== 'string' || !Number.isFinite(Date.parse(d)))) throw new Error('Fiche invalide');
  }
  return value;
}
export function reminderDates(plant: Plant, now = new Date()): Date[] {
  const first = dueDate(plant);
  if (first < now) first.setTime(now.getTime());
  first.setHours(9, 0, 0, 0);
  if (first <= now) first.setDate(first.getDate() + 1);
  return Array.from({ length: 30 }, (_, index) => addDays(first, index));
}
