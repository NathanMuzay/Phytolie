import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Plant, reminderDates } from './model';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
export async function requestReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Entretien des plantes', importance: Notifications.AndroidImportance.DEFAULT });
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function syncReminders(plants: Plant[], enabled: boolean) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) throw new Error('Notifications non autorisées dans les réglages du téléphone.');
  // Group plants by day: at most 30 notifications, including daily overdue follow-ups.
  const grouped = new Map<number, string[]>();
  const now = new Date();
  const horizon = new Date(now); horizon.setDate(horizon.getDate() + 30); horizon.setHours(23, 59, 59, 999);
  for (const plant of plants) {
    for (const date of reminderDates(plant, now)) {
      if (date > horizon) continue;
      grouped.set(+date, [...(grouped.get(+date) ?? []), plant.name]);
    }
  }
  for (const [timestamp, names] of grouped) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Un petit moment pour vos plantes 🌿', body: `${names.join(', ')} : vérifiez le terreau. Confirmez uniquement les arrosages effectués.`, data: { screen: 'tasks' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(timestamp), channelId: 'care' },
    });
  }
}
