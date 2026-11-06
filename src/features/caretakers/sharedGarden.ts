import type { Plant } from '../../shared/model.ts';
// Explicitly exclude private notes, care journals, measurements and house positions.
const fields = ['id', 'name', 'species', 'room', 'photo', 'photoMode', 'photoFit', 'botanicalImage', 'pot', 'temperature', 'interval', 'waterAmount', 'irrigation', 'lastWatered', 'createdAt', 'wateringAdvice'] as const;
export type SharedPlant = Pick<Plant, typeof fields[number]>;
export function caretakerPlant(plant: Plant): SharedPlant {
  return Object.fromEntries(fields.filter(key => plant[key] !== undefined).map(key => [key, plant[key]])) as SharedPlant;
}
