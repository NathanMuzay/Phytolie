import type { Plant } from '../../shared/model.ts';
import { careDefaults } from './care.ts';
import { currentSubstrate } from './careRecords.ts';
export const repottingSource = 'https://www.rhs.org.uk/container-gardening/how-to-repot-a-plant';
export type RepotObservations = { roots: 'unknown' | 'comfortable' | 'crowded'; soil: 'unknown' | 'healthy' | 'compacted'; growth: 'unknown' | 'growing' | 'rest' };
export const defaultRepotObservations: RepotObservations = { roots: 'unknown', soil: 'unknown', growth: 'unknown' };
export function repottingAdvice(plant: Plant, observation: RepotObservations, now = new Date()) {
  const reasons = [`${plant.species} : ${careDefaults(plant.species).soil}.`, `Pot actuel : ${plant.pot} cm de diamètre, ${plant.irrigation?.depth ?? 12} cm de profondeur utile. Sa taille seule ne décrit pas les racines.`, `Substrat déclaré : ${currentSubstrate(plant).name}.`];
  const inspect = observation.roots === 'crowded' || observation.soil === 'compacted';
  reasons.push(observation.roots === 'crowded' ? 'Racines serrées, tournant autour de la motte ou sortant du pot : examinez le besoin de place.' : observation.roots === 'comfortable' ? 'Vous ne signalez pas de racines à l’étroit.' : 'Racines non observées : vérifiez la motte avant de choisir un nouveau pot.');
  reasons.push(observation.soil === 'compacted' ? 'Substrat tassé ou drainage dégradé : envisagez son renouvellement, éventuellement dans le même pot.' : observation.soil === 'healthy' ? 'Vous indiquez un substrat encore aéré et drainant.' : 'État du substrat non observé : vérifiez tassement et évacuation de l’eau.');
  if (plant.irrigation?.drainage !== 'yes') reasons.push('Vérifiez les trous de drainage du contenant.');
  reasons.push(observation.growth === 'rest' ? 'La plante est au repos : privilégiez la reprise de croissance, sauf problème nécessitant une intervention.' : observation.growth === 'growing' ? 'La croissance active est généralement une période adaptée au rempotage.' : 'Confirmez le cycle de croissance ; le mois ne suffit pas à le déterminer.');
  return { title: inspect ? 'Un rempotage est à envisager après inspection' : +new Date(plant.repotDate) <= +now ? 'C’est le moment de contrôler la motte' : 'Observer avant de rempoter', reasons, source: repottingSource };
}
