import { botanicalSearchText, normalizeBotanicalName } from './botanicalNames.ts';
import { daysUntil, dueDate, type Plant } from '../../shared/model.ts';

const normalize = normalizeBotanicalName;
export function filterCollection(plants: Plant[], query: string, room: string | null, onlyDue: boolean, now = new Date(), archived = false) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return plants.filter(plant => !!plant.archivedAt === archived && (!room || plant.room === room)
    && (!onlyDue || daysUntil(dueDate(plant), now) <= 0)
    && terms.every(term => normalize(`${plant.name} ${botanicalSearchText(plant.species)} ${botanicalSearchText(plant.name)} ${plant.room}`).includes(term)));
}
