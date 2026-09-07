import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const notificationService = {
  async initNotifications(): Promise<boolean> {
    const granted = await this.requestNotificationPermission();
    if (granted) {
      await this.createNotificationChannel();
    }
    return granted;
  },

  async createNotificationChannel() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.createChannel({
        id: 'habit-reminders',
        name: 'Odatlar Eslatmasi',
        description: 'Kunlik odatlar va motivatsiya eslatmalari',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: undefined,
      });
    } catch (err) {
      console.error('Failed to create notification channel:', err);
    }
  },

  async requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      }
      return true;
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      return false;
    }
  },

  getStableId(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  },

  async scheduleDailyReminder(targetHour = 21, targetMinute = 0) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // 1. Cancel existing instance with same IDs to prevent duplicate accumulation
      await LocalNotifications.cancel({
        notifications: [{ id: 101 }, { id: 999999 }, { id: 1001 }]
      });

      const now = new Date();
      const scheduledDate = new Date();
      scheduledDate.setHours(targetHour, targetMinute, 0, 0);

      // If target time has already passed today, schedule for tomorrow
      if (scheduledDate <= now) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      // 2. Context-aware title & body based on scheduled target time
      let title = "Kun yakuni va sarhisob";
      let body = "Bugungi odatlaringizni belgilashni unutmadingizmi? Seriyangizni saqlab qoling! 🔥";

      if (targetHour >= 7 && targetHour < 12) {
        // Morning
        title = "Yangi kun, yangi imkoniyat!";
        body = "Bugungi odatlaringizni ko'zdan kechiring va kunni samarali boshlang! 🚀";
      } else if (targetHour >= 12 && targetHour < 18) {
        // Afternoon
        title = "Kunlik intizom davom etmoqda";
        body = "Kun yarmiga yetdi. Rejalashtirilgan odatlaringizni unutmang! ⚡";
      } else {
        // Evening / Night (18:00 - 06:59)
        title = "Kun yakuni va sarhisob";
        body = "Bugungi odatlaringizni belgilashni unutmadingizmi? Seriyangizni saqlab qoling! 🔥";
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 101,
            title,
            body,
            schedule: {
              at: scheduledDate,
              repeats: true,
              every: 'day',
              allowWhileIdle: true,
            },
            channelId: 'habit-reminders',
            smallIcon: 'ic_stat_notification',
            iconColor: '#10B981',
          },
        ],
      });
    } catch (err) {
      console.error('Failed to schedule daily reminder:', err);
    }
  },

  async scheduleDailySummaryReminder(hour: number, minute: number) {
    return this.scheduleDailyReminder(hour, minute);
  },

  async cancelDailyReminder() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: 101 }, { id: 999999 }, { id: 1001 }]
      });
    } catch (err) {
      console.error('Failed to cancel daily reminder:', err);
    }
  },

  async scheduleHabitReminder(habitId: string, habitTitle: string, timeStr: string) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const [hour, minute] = timeStr.split(':').map(Number);
      const id = this.getStableId(habitId);

      const now = new Date();
      const targetDate = new Date();
      targetDate.setHours(hour, minute, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (targetDate <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      await LocalNotifications.cancel({ notifications: [{ id }] });

      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Odat vaqti keldi",
            body: `"${habitTitle}" odatini bajarish vaqti bo'ldi. Seriyangizni saqlab qoling`,
            id,
            schedule: {
              at: targetDate,
              repeats: true,
              every: 'day',
              allowWhileIdle: true,
            },
            channelId: 'habit-reminders',
            smallIcon: 'ic_stat_notification',
            iconColor: '#10B981',
            actionTypeId: 'HABIT_REMINDER',
          },
        ],
      });
    } catch (err) {
      console.error('Failed to schedule habit reminder:', err);
    }
  },

  async cancelHabitReminder(habitId: string) {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const id = this.getStableId(habitId);
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (err) {
      console.error('Failed to cancel habit reminder:', err);
    }
  },

  async sendTestNotificationNow() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Sinov bildirishnomasi",
            body: "Eslatmalar tizimi muvaffaqiyatli ishlamoqda",
            id: Math.floor(Math.random() * 100000),
            schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
            channelId: 'habit-reminders',
            smallIcon: 'ic_stat_notification',
            iconColor: '#10B981',
          },
        ],
      });
    } catch (err) {
      console.error('Failed to send test notification:', err);
    }
  }
};
