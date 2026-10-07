import { addDays, reminderDates, DEFAULT_REMINDER_TIME, isReminderTime, type Plant } from '../shared/model.ts';
export type Reminder = { identifier: string; date: Date; names: string[]; plantIds: string[] };
export type ScheduledReminder = { identifier: string; content: { data?: Record<string, unknown> } };
export type ReminderGateway = {
  list(): Promise<ScheduledReminder[]>;
  cancel(identifier: string): Promise<void>;
  granted(): Promise<boolean>;
  schedule(reminder: Reminder): Promise<string>;
};
export function buildReminders(plants: Plant[], now = new Date(), time = DEFAULT_REMINDER_TIME): Reminder[] {
  if (!isReminderTime(time)) throw new Error('Heure de rappel invalide');
  // Thirty calendar days, grouped into at most one notification per day.
  const horizon = addDays(now, 29); horizon.setHours(23, 59, 59, 999);
  const groups = new Map<number, Reminder>();
  for (const plant of plants) {
    for (const date of reminderDates(plant, now, time)) {
      if (date > horizon) continue;
      const reminder = groups.get(+date) ?? { identifier: `folia-care-${+date}`, date, names: [], plantIds: [] };
      reminder.names.push(plant.name); reminder.plantIds.push(plant.id); groups.set(+date, reminder);
    }
  }
  return [...groups.values()].sort((a, b) => +a.date - +b.date);
}
export async function replaceReminders(gateway: ReminderGateway, plants: Plant[], enabled: boolean, time = DEFAULT_REMINDER_TIME, now = new Date()): Promise<number> {
  const reminders = enabled ? buildReminders(plants, now, time) : [];
  const existing = await gateway.list();
  // Also migrate notifications created before stable Folia identifiers were introduced.
  for (const notification of existing) {
    if (notification.identifier.startsWith('folia-care-') || notification.content.data?.screen === 'tasks') await gateway.cancel(notification.identifier);
  }
  if (!enabled) return 0;
  if (!(await gateway.granted())) throw new Error('Notifications non autorisées. Activez-les dans les réglages du téléphone.');
  const created: string[] = [];
  try {
    for (const reminder of reminders) created.push(await gateway.schedule(reminder));
  } catch (error) {
    // Do not leave a partly programmed calendar claiming to cover every day.
    await Promise.allSettled(created.map(id => gateway.cancel(id)));
    throw error;
  }
  return created.length;
}
