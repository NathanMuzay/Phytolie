import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Plant, DEFAULT_REMINDER_TIME } from './model';
import { replaceReminders } from './reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
export async function requestReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('care', { name: 'Entretien des plantes', importance: Notifications.AndroidImportance.DEFAULT });
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function syncReminders(plants: Plant[], enabled: boolean, time = DEFAULT_REMINDER_TIME): Promise<number> {
  if (Platform.OS === 'web') return 0;
  return replaceReminders({
    list: () => Notifications.getAllScheduledNotificationsAsync(),
    cancel: id => Notifications.cancelScheduledNotificationAsync(id),
    granted: async () => (await Notifications.getPermissionsAsync()).granted,
    schedule: reminder => Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: { title: 'Un petit moment pour vos plantes 🌿', body: `${reminder.names.join(', ')} : vérifiez le terreau. Confirmez uniquement les arrosages effectués.`, data: { screen: 'tasks', plantIds: reminder.plantIds } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: 'care' },
    }),
  }, plants, enabled, time);
}

export function onReminderOpened(openTasks: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  let active = true;
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || response?.notification.request.content.data?.screen !== 'tasks') return;
    openTasks();
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; subscription.remove(); };
}
