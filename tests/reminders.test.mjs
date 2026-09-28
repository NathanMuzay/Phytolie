import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderDates, isReminderTime, parseGarden, waterPlant, daysUntil } from '../src/model.ts';
import { defaultIrrigation } from '../src/irrigation.ts';
import { buildReminders, replaceReminders } from '../src/reminders.ts';
const plant = { id: 'a', name: 'Aloe', species: 'Aloe vera', room: 'Salon', height: 30, pot: 14, soil: 'Terreau', temperature: 20, interval: 7, lastWatered: null, createdAt: '2026-01-01T12:00:00Z', repotDate: '2027-01-01T12:00:00Z', caretaker: '', history: [] };
const now = new Date(2026, 8, 28, 10, 0);
function gateway(initial = [], failAt = -1, granted = true) {
  const stored = new Map(initial.map(n => [n.identifier, n]));
  let calls = 0;
  return { stored,
    list: async () => [...stored.values()],
    cancel: async id => { stored.delete(id); },
    granted: async () => granted,
    schedule: async reminder => {
      if (calls++ === failAt) throw new Error('Device failed');
      stored.set(reminder.identifier, { ...reminder, content: { data: { screen: 'tasks' } } });
      return reminder.identifier;
    },
  };
}
test('Time format validates midnight, end of day and persistence without changing legacy gardens', () => {
  for (const value of ['00:00', '09:00', '23:59']) {
    assert.equal(isReminderTime(value), true);
    assert.equal(parseGarden(JSON.stringify({ plants: [], reminders: false, reminderTime: value })).reminderTime, value);
  }
  for (const value of ['24:00', '09:60', '9:00', '', '12:30junk', 900]) {
    assert.equal(isReminderTime(value), false);
    assert.throws(() => parseGarden(JSON.stringify({ plants: [], reminders: true, reminderTime: value })));
  }
  assert.equal(parseGarden(JSON.stringify({ plants: [], reminders: false })).reminderTime, undefined);
});
test('Upcoming clock time is used today; elapsed or exact clock time starts tomorrow', () => {
  assert.equal(daysUntil(reminderDates(plant, now, '18:45')[0], now), 0);
  assert.equal(reminderDates(plant, now, '18:45')[0].getMinutes(), 45);
  assert.equal(daysUntil(reminderDates(plant, now, '10:00')[0], now), 1);
  assert.equal(daysUntil(reminderDates(plant, now, '00:00')[0], now), 1);
});
test('Grouping keeps daily follow-ups within 30 days, including plants with the same nickname', () => {
  const reminders = buildReminders([plant, { ...plant, id: 'b' }], now, '18:45');
  assert.equal(reminders.length, 30);
  assert.ok(reminders.every(r => r.plantIds.length === 2 && r.date > now));
  assert.equal(daysUntil(reminders.at(-1).date, now), 29);
  assert.equal(buildReminders([plant], now, '09:00').length, 29);
});
test('Watering confirmation stops overdue relaunches and restarts at the next due day', async () => {
  const api = gateway();
  await replaceReminders(api, [plant], true, '18:45', now);
  const updated = waterPlant(plant, now);
  await replaceReminders(api, [updated], true, '18:45', now);
  const reminders = [...api.stored.values()];
  assert.equal(daysUntil(reminders[0].date, now), 7);
  assert.ok(reminders.every(r => daysUntil(r.date, now) >= 7));
  assert.equal(updated.history.length, 1);
});
test('A moist-soil observation defers the first reminder without recording watering', () => {
  const observed = { ...plant, irrigation: { ...defaultIrrigation, automatic: false, moisture: 'moist', checkedAt: now.toISOString() } };
  const reminders = buildReminders([observed], now, '18:45');
  assert.equal(daysUntil(reminders[0].date, now), 1);
  assert.equal(observed.lastWatered, null);
  assert.equal(observed.history.length, 0);
});
test('Changing the hour replaces old reminders without duplicates; disabling clears only Folia reminders', async () => {
  const unrelated = { identifier: 'unrelated', content: { data: {} } };
  const api = gateway([unrelated, { identifier: 'legacy', content: { data: { screen: 'tasks' } } }]);
  await replaceReminders(api, [plant], true, '18:45', now);
  assert.equal(api.stored.has('legacy'), false);
  await replaceReminders(api, [plant], true, '20:15', now);
  assert.equal(api.stored.size, 31);
  assert.ok([...api.stored.values()].filter(r => r.date).every(r => r.date.getHours() === 20 && r.date.getMinutes() === 15));
  await replaceReminders(api, [plant], false, '20:15', now);
  assert.deepEqual([...api.stored.keys()], ['unrelated']);
});
test('Deleting a plant removes it from all grouped reminders', async () => {
  const api = gateway();
  await replaceReminders(api, [plant, { ...plant, id: 'b', name: 'Fern' }], true, '18:45', now);
  await replaceReminders(api, [plant], true, '18:45', now);
  assert.ok([...api.stored.values()].every(r => r.plantIds.join() === 'a'));
});
test('Permission revocation removes stale schedules and reports failure', async () => {
  const api = gateway([{ identifier: 'folia-care-old', content: { data: {} } }], -1, false);
  await assert.rejects(replaceReminders(api, [plant], true, '18:45', now), /non autorisées/);
  assert.equal(api.stored.size, 0);
});
test('Scheduling failure cleans up a partial new calendar', async () => {
  const api = gateway([], 2);
  await assert.rejects(replaceReminders(api, [plant], true, '18:45', now), /Device failed/);
  assert.equal(api.stored.size, 0);
});
test('Local time is restored after a spring DST gap, and fall transition has one reminder per day', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    const spring = reminderDates(plant, new Date(2026, 2, 28, 1), '02:30');
    assert.equal(spring[1].getHours(), 3); // 02:30 does not exist that day.
    assert.equal(spring[2].getHours(), 2);
    assert.ok(spring.every(d => d.getMinutes() === 30));
    const fall = reminderDates(plant, new Date(2026, 9, 24, 1), '02:30');
    assert.equal(new Set(fall.map(d => d.toDateString())).size, 30);
    assert.ok(fall.every(d => d.getHours() === 2 && d.getMinutes() === 30));
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
