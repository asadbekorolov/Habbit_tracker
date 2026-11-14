import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Completely isolate push-notifications to prevent crashes when google-services.json is missing
// import { PushNotifications } from '@capacitor/push-notifications';

function hashRoutineDay(routineId: string, day: number): number {
  let hash = 0;
  const str = `${routineId}_day_${day}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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

  async cancelRoutineNotifications(routineId: string) {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const ids = [];
      for (let day = 1; day <= 7; day++) {
        ids.push({ id: hashRoutineDay(routineId, day) });
      }
      await LocalNotifications.cancel({ notifications: ids });
    } catch (err) {
      console.warn('Failed to cancel routine notifications:', err);
    }
  },

  async scheduleRoutineNotifications(routine: { id: string; title: string; time_start: string; time_end: string; days_of_week: number[]; is_active: boolean }) {
    if (!Capacitor.isNativePlatform()) return;

    // First cancel previous schedules for this routine
    await this.cancelRoutineNotifications(routine.id);

    if (!routine.is_active || !routine.days_of_week || routine.days_of_week.length === 0) return;

    try {
      const [hourStr, minuteStr] = routine.time_start.split(':');
      const hour = parseInt(hourStr, 10) || 0;
      const minute = parseInt(minuteStr, 10) || 0;

      const notifications = routine.days_of_week.map((day) => {
        // Map ISO weekday (1=Mon..7=Sun) to Capacitor weekday (1=Sun, 2=Mon..7=Sat)
        const capWeekday = day === 7 ? 1 : day + 1;
        return {
          id: hashRoutineDay(routine.id, day),
          title: `Kun Tartibi: ${routine.title}`,
          body: `Rejangiz boshlandi (${routine.time_start.slice(0, 5)} - ${routine.time_end.slice(0, 5)}). E'tibor bering va bajaring!`,
          schedule: {
            on: {
              weekday: capWeekday,
              hour,
              minute,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          channelId: 'habits',
          smallIcon: 'ic_stat_notification',
          iconColor: '#10B981',
          actionTypeId: '',
          extra: { routineId: routine.id },
        };
      });

      await LocalNotifications.schedule({ notifications });
    } catch (err) {
      console.error('Failed to schedule routine notifications:', err);
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
