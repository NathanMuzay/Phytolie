import { daysUntil, dueDate, type Plant } from '../../shared/model.ts';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
export function filterCollection(plants: Plant[], query: string, room: string | null, onlyDue: boolean, now = new Date()) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return plants.filter(plant => (!room || plant.room === room)
    && (!onlyDue || daysUntil(dueDate(plant), now) <= 0)
    && terms.every(term => normalize(`${plant.name} ${plant.species} ${plant.room}`).includes(term)));
}
