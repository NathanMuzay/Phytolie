import { estimatePlacement, validateHome, validPosition, type HomePlan, type PlantPosition } from './home.ts';
import { defaultIrrigation } from '../plants/irrigation.ts';
import { type Garden } from '../../shared/model.ts';
// Save geometry, pins and the corresponding watering environment together.
export function gardenWithHome(garden: Garden, home: HomePlan, positions: Record<string, PlantPosition | undefined>): Garden {
  validateHome(home);
  return { ...garden, home, plants: garden.plants.map(plant => {
    if (plant.archivedAt) return { ...plant, position: plant.position && validPosition(plant.position, home) ? plant.position : undefined };
    const position = positions[plant.id];
    if (position && !validPosition(position, home)) throw new Error('Un pin se trouve hors de sa zone.');
    const area = home.areas.find(a => a.id === position?.areaId);
    const estimate = position ? estimatePlacement(home, position, plant.species) : null;
    return { ...plant, position, room: area?.name ?? plant.room, irrigation: position && area ? {
      ...(plant.irrigation ?? { ...defaultIrrigation, automatic: false }),
      location: area.kind === 'garden' ? 'outdoor' : 'indoor',
      exposure: estimate?.hours != null ? estimate.exposure : plant.irrigation?.exposure ?? 'indirect',
    } : plant.irrigation };
  }) };
}
