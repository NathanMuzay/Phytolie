import type { Plant } from '../../shared/model.ts';
import { defaultIrrigation } from './irrigation.ts';
import { catalogueSubstrate, validSubstrate, type SubstrateSelection } from './substrates.ts';
export const MAX_CARE_EVENTS = 500;
type BaseEvent = { id: string; occurredAt: string; recordedAt: string; note: string };
export type WateringEvent = BaseEvent & { kind: 'watering'; amountMl?: number; updatedAt?: string; cancelledAt?: string };
export type SubstrateEvent = BaseEvent & { kind: 'substrate'; substrate: SubstrateSelection; previousSubstrate: SubstrateSelection };
export type RepotEvent = BaseEvent & { kind: 'repotting'; pot: number; depth: number; previousPot: number; previousDepth: number; previousSubstrate: SubstrateSelection; substrate: SubstrateSelection; nextCheck: string };
export type CareEvent = WateringEvent | SubstrateEvent | RepotEvent;
const dateValid = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const dimension = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100;
export function validCareEvent(value: unknown): value is CareEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as CareEvent;
  if (typeof e.id !== 'string' || !e.id || e.id.length > 140 || !dateValid(e.occurredAt) || !dateValid(e.recordedAt) || typeof e.note !== 'string' || e.note.length > 1000) return false;
  if (e.kind === 'watering') return (e.amountMl == null || (Number.isFinite(e.amountMl) && e.amountMl > 0 && e.amountMl <= 20000)) && (e.updatedAt == null || dateValid(e.updatedAt)) && (e.cancelledAt == null || dateValid(e.cancelledAt));
  if (e.kind === 'substrate') return validSubstrate(e.substrate) && validSubstrate(e.previousSubstrate);
  return e.kind === 'repotting' && dimension(e.pot) && dimension(e.depth) && dimension(e.previousPot) && dimension(e.previousDepth) && validSubstrate(e.previousSubstrate) && validSubstrate(e.substrate) && dateValid(e.nextCheck) && Date.parse(e.nextCheck) > Date.parse(e.occurredAt);
}
export function careEvents(plant: Plant): CareEvent[] {
  if (plant.careEvents) return plant.careEvents;
  const dates = [...new Set([...(plant.lastWatered ? [plant.lastWatered] : []), ...plant.history])];
  return dates.map((date, index) => ({ id: `legacy-${index}-${date}`, kind: 'watering', occurredAt: date, recordedAt: plant.createdAt, note: '' }));
}
export function activeWaterings(plant: Plant): WateringEvent[] {
  return careEvents(plant).filter((e): e is WateringEvent => e.kind === 'watering' && !e.cancelledAt).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
function withEvents(plant: Plant, events: CareEvent[]): Plant {
  if (events.length > MAX_CARE_EVENTS) throw new Error(`Historique limité à ${MAX_CARE_EVENTS} événements : aucun événement supplémentaire n’a été enregistré.`);
  const next = { ...plant, careEvents: events };
  const waterings = activeWaterings(next);
  const lastWatered = waterings[0]?.occurredAt ?? null;
  const clearObservation = lastWatered && plant.irrigation?.checkedAt && Date.parse(lastWatered) >= Date.parse(plant.irrigation.checkedAt);
  return { ...next, lastWatered, history: waterings.map(e => e.occurredAt).slice(0, 100), irrigation: clearObservation ? { ...plant.irrigation!, moisture: undefined, checkedAt: undefined } : plant.irrigation };
}
function actualDate(value: string, now: Date) {
  if (!dateValid(value) || Date.parse(value) > +now) throw new Error('Choisissez une date de soin valide, passée ou actuelle.');
}
function eventId(now: Date) { return `${+now}-${Math.random().toString(36).slice(2, 12)}`; }
function active(plant: Plant) { if (plant.archivedAt) throw new Error('Restaurez la plante avant d’enregistrer un soin.'); }
export function recordWatering(plant: Plant, input: { occurredAt: string; amountMl?: number; note?: string }, now = new Date(), editId?: string): Plant {
  active(plant); actualDate(input.occurredAt, now);
  const events = careEvents(plant);
  const original = editId ? events.find(e => e.id === editId) : undefined;
  if (editId && (!original || original.kind !== 'watering' || original.cancelledAt)) throw new Error('Cet arrosage ne peut plus être modifié.');
  const day = new Date(input.occurredAt).toLocaleDateString('fr-CA');
  if (activeWaterings(plant).some(e => e.id !== editId && new Date(e.occurredAt).toLocaleDateString('fr-CA') === day)) throw new Error('Un arrosage existe déjà à cette date. Modifiez-le dans l’historique.');
  const event: WateringEvent = { id: editId ?? eventId(now), kind: 'watering', occurredAt: new Date(input.occurredAt).toISOString(), recordedAt: original?.recordedAt ?? now.toISOString(), note: input.note?.trim() ?? '', ...(input.amountMl == null ? {} : { amountMl: input.amountMl }), ...(editId ? { updatedAt: now.toISOString() } : {}) };
  if (!validCareEvent(event)) throw new Error('Quantité : strictement positive, jusqu’à 20 000 ml ; note : 1 000 caractères maximum.');
  return withEvents(plant, editId ? events.map(e => e.id === editId ? event : e) : [event, ...events]);
}
export function cancelWatering(plant: Plant, id: string, now = new Date()): Plant {
  active(plant);
  const events = careEvents(plant);
  if (!events.some(e => e.id === id && e.kind === 'watering' && !e.cancelledAt)) throw new Error('Arrosage introuvable ou déjà annulé.');
  return withEvents(plant, events.map(e => e.id === id && e.kind === 'watering' ? { ...e, cancelledAt: now.toISOString() } : e));
}
export function setArchived(plant: Plant, archived: boolean, now = new Date()): Plant {
  return { ...plant, archivedAt: archived ? plant.archivedAt ?? now.toISOString() : undefined };
}
export function currentSubstrate(plant: Plant): SubstrateSelection {
  return plant.substrateDetails ?? { ...catalogueSubstrate(plant.irrigation?.substrate ?? 'standard'), name: 'Substrat de l’ancienne fiche', composition: plant.soil || 'Composition non renseignée', origin: 'maison', source: 'Déclaration utilisateur' };
}
export function recordSubstrateChange(previous: Plant, next: Plant, now = new Date()): Plant {
  if (JSON.stringify(previous.substrateDetails) === JSON.stringify(next.substrateDetails) && previous.irrigation?.substrate === next.irrigation?.substrate) return next;
  const before = currentSubstrate(previous), after = currentSubstrate(next);
  if (JSON.stringify(before) === JSON.stringify(after)) return next;
  if (!validSubstrate(after)) throw new Error('Décrivez le substrat réellement utilisé.');
  active(previous);
  const event: SubstrateEvent = { id: eventId(now), kind: 'substrate', occurredAt: now.toISOString(), recordedAt: now.toISOString(), note: '', substrate: after, previousSubstrate: before };
  return withEvents({ ...next, irrigation: { ...(next.irrigation ?? { ...defaultIrrigation, automatic: false }), substrate: after.type } }, [event, ...careEvents(previous)]);
}
export function recordRepotting(plant: Plant, input: { occurredAt: string; pot: number; depth: number; substrate: SubstrateSelection; nextCheck: string; note?: string }, now = new Date()): Plant {
  active(plant); actualDate(input.occurredAt, now);
  if (!dimension(input.pot) || !dimension(input.depth) || !validSubstrate(input.substrate) || !dateValid(input.nextCheck) || Date.parse(input.nextCheck) <= Date.parse(input.occurredAt)) throw new Error('Vérifiez le pot (1 à 100 cm), le substrat et la prochaine date de contrôle.');
  const events = careEvents(plant);
  if (events.some(e => e.kind === 'repotting' && Date.parse(e.occurredAt) >= Date.parse(input.occurredAt))) throw new Error('Un rempotage plus récent ou à la même date est déjà enregistré.');
  const event: RepotEvent = { id: eventId(now), kind: 'repotting', occurredAt: new Date(input.occurredAt).toISOString(), recordedAt: now.toISOString(), note: input.note?.trim() ?? '', pot: input.pot, depth: input.depth, previousPot: plant.pot, previousDepth: plant.irrigation?.depth ?? 12, previousSubstrate: currentSubstrate(plant), substrate: input.substrate, nextCheck: new Date(input.nextCheck).toISOString() };
  if (!validCareEvent(event)) throw new Error('Note de rempotage limitée à 1 000 caractères.');
  return withEvents({ ...plant, pot: input.pot, measurement: undefined, soil: input.substrate.name, substrateDetails: input.substrate, repotDate: new Date(input.nextCheck).toISOString(), irrigation: { ...(plant.irrigation ?? { ...defaultIrrigation, automatic: false }), depth: input.depth, substrate: input.substrate.type } }, [event, ...events]);
}

export function localDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
export function parseCareDate(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isFinite(+value) || localDate(value) !== date || value.getHours() !== Number(time.slice(0, 2)) || value.getMinutes() !== Number(time.slice(3))) throw new Error('Indiquez une date valide (AAAA-MM-JJ) et une heure locale (HH:MM).');
  return value.toISOString();
}
