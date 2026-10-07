import { careDefaults } from './care.ts';
import { wateringPlan, type WateringInput } from './irrigation.ts';

export type WateringTolerance = {
  status: 'unavailable' | 'before_due' | 'within_margin' | 'exceeded' | 'check_now';
  hours: number | null;
  deadline: Date | null;
  message: string;
};
const HOUR = 3600000;
const unavailable = (message: string): WateringTolerance => ({ status: 'unavailable', hours: null, deadline: null, message });

// A conservative planning heuristic, never a biological survival prediction.
// The normal reminders still start at nextCheck, irrespective of this margin.
export function wateringTolerance(plant: WateringInput, now = new Date()): WateringTolerance {
  const c = plant.irrigation;
  if (!plant.lastWatered || !Number.isFinite(Date.parse(plant.lastWatered)) || Date.parse(plant.lastWatered) > +now) {
    return unavailable('Renseignez un dernier arrosage connu pour estimer une marge de retard.');
  }
  if (!c?.automatic) return unavailable('Activez le calcul automatique et renseignez les conditions de la plante pour estimer la marge.');
  if (c.drainage !== 'yes') return unavailable('Vérifiez le drainage du pot avant d’estimer une marge.');
  if (!Number.isFinite(plant.temperature) || !Number.isFinite(+now) || !Number.isFinite(plant.pot) || plant.pot <= 0 || !Number.isFinite(c.depth) || c.depth <= 0) {
    return unavailable('Corrigez la température et les dimensions du pot pour estimer une marge.');
  }
  if (plant.temperature <= 5) return unavailable('Température trop basse : contrôlez la plante, aucune marge estimée.');
  const plan = wateringPlan(plant, now);
  const checked = c.checkedAt ? Date.parse(c.checkedAt) : NaN;
  const fresh = checked > Date.parse(plant.lastWatered) && checked <= +now && +now - checked < 24 * HOUR;
  if (fresh && c.moisture === 'moist') return unavailable('Terreau encore humide : vérifiez à nouveau demain. Cette observation ne permet pas de prévoir une tolérance à la sécheresse.');
  if (fresh && c.moisture === 'dry') return { status: 'check_now', hours: 0, deadline: plan.nextCheck, message: 'Terreau déclaré sec : aucune marge supplémentaire. Vérifiez en profondeur dès maintenant.' };
  const fraction = careDefaults(plant.species).toleranceFraction;
  if (fraction == null) return unavailable('Espèce sans profil de tolérance : aucune marge fiable à proposer. Gardez l’échéance de vérification.');
  // The interval already incorporates pot, substrate, temperature, light and season.
  // Round down to full hours and cap at 72 hours; extreme heat grants no buffer.
  const hours = plant.temperature >= 35 ? 0 : Math.min(72, Math.max(0, Math.floor(plan.interval * 24 * fraction)));
  const deadline = new Date(+plan.nextCheck + hours * HOUR);
  if (!Number.isFinite(+deadline)) return unavailable('Les dates d’entretien doivent être corrigées.');
  if (+now < +plan.nextCheck) return { status: 'before_due', hours, deadline, message: hours ? `Marge indicative après l’échéance : ${hours} h. Vérifiez le terreau à la date prévue.` : 'Aucune marge supplémentaire estimée : contrôlez le terreau à la date prévue.' };
  if (+now >= +deadline) return { status: 'exceeded', hours, deadline, message: 'Marge indicative atteinte ou dépassée : vérifiez la plante et son terreau dès maintenant, sans augmenter la dose.' };
  const remaining = Math.max(1, Math.ceil((+deadline - +now) / HOUR));
  return { status: 'within_margin', hours, deadline, message: `Vérification en retard. Environ ${remaining} h avant la limite indicative ; contrôlez le terreau dès que possible.` };
}
