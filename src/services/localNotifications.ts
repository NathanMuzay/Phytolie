// Import only local notification APIs. The package root also loads push token
// auto-registration, which throws during startup in Expo Go on Android (SDK 53+).
// Keep these SDK-specific imports here so upgrades can be checked in one place.
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
export type { NotificationResponse } from 'expo-notifications/build/Notifications.types';
export {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  clearLastNotificationResponseAsync,
} from 'expo-notifications/build/NotificationsEmitter';
