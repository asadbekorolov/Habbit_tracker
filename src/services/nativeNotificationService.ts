import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Completely isolate push-notifications to prevent crashes when google-services.json is missing
// import { PushNotifications } from '@capacitor/push-notifications';

export const nativeNotificationService = {
  async init() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Create Notification Channel for Android
      await LocalNotifications.createChannel({
        id: 'habits',
        name: 'Habit Reminders',
        description: 'Daily habit reminders and streak warnings',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'social',
        name: 'Social Notifications',
        description: 'Friend requests and group updates',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    } catch (err) {
      console.error('Failed to initialize notification channels:', err);
    }
  },

  async scheduleLocal(title: string, body: string, id: number, scheduleAt?: Date, channelId: string = 'habits') {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: scheduleAt ? { at: scheduleAt } : undefined,
            channelId,
            smallIcon: 'ic_stat_notification',
            iconColor: '#10B981',
            actionTypeId: '',
            extra: null,
          },
        ],
      });
    } catch (err) {
      console.error('Failed to schedule local notification:', err);
    }
  },

  async requestPermissions() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const status = await LocalNotifications.requestPermissions();
      if (status.display !== 'granted') {
        console.warn('User denied local notification permissions');
      }
    } catch (err) {
      console.error('Failed to request local notification permissions:', err);
    }

    /*
    // Push notifications are disabled until Firebase is configured
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const pushStatus = await PushNotifications.requestPermissions();
      if (pushStatus.receive === 'granted') {
        // Only register if you have google-services.json
        // await PushNotifications.register();
      }
    } catch (err) {
      console.warn('Push notifications plugin not available or failed:', err);
    }
    */
  },
};
