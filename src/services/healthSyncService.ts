import { Health } from '@capgo/capacitor-health';
import { Capacitor } from '@capacitor/core';
import { upsertHealthLog, getHabits, toggleHabitLog, getTodayLogs, computeHabitProgress } from './db';
import { toDateStr } from '../utils/date';

export interface HealthSyncData {
  steps: number;
  sleepHours: number;
  sleepMinutes: number;
}

class HealthSyncService {
  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { available } = await Health.isAvailable();
      return available;
    } catch (e) {
      console.error('Health availability check failed:', e);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { readAuthorized } = await Health.requestAuthorization({
        read: ['steps', 'sleep'],
        write: [],
      });
      return readAuthorized.includes('steps') && readAuthorized.includes('sleep');
    } catch (e) {
      console.error('Health permission request failed:', e);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { readAuthorized } = await Health.checkAuthorization({
        read: ['steps', 'sleep'],
        write: [],
      });
      return readAuthorized.includes('steps') && readAuthorized.includes('sleep');
    } catch (e) {
      return false;
    }
  }

  async syncData(): Promise<HealthSyncData | null> {
    if (!Capacitor.isNativePlatform()) {
      // Mock data for web testing
      return { steps: 8432, sleepHours: 7, sleepMinutes: 30 };
    }

    try {
      const isAuthorized = await this.checkPermissions();
      if (!isAuthorized) return null;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Fetch Steps (Aggregated for today)
      const { samples: stepSamples } = await Health.queryAggregated({
        dataType: 'steps',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day',
        aggregation: 'sum',
      });

      const steps = stepSamples.length > 0 ? (stepSamples[0].value || 0) : 0;

      // Fetch Sleep (Last 24 hours samples)
      const { samples: sleepSamples } = await Health.readSamples({
        dataType: 'sleep',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      });

      let totalSleepMinutes = 0;
      sleepSamples.forEach(sample => {
        if (sample.sleepState === 'asleep' || sample.sleepState === 'deep' || sample.sleepState === 'light' || sample.sleepState === 'rem') {
            totalSleepMinutes += sample.value || 0;
        } else if (!sample.sleepState) {
            totalSleepMinutes += sample.value || 0;
        }
      });

      const sleepHours = Math.floor(totalSleepMinutes / 60);
      const sleepMinutes = Math.round(totalSleepMinutes % 60);

      return { steps, sleepHours, sleepMinutes };
    } catch (e) {
      console.error('Health sync failed:', e);
      return null;
    }
  }

  async autoSyncOnLaunch() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const isAuthorized = await this.checkPermissions();
      if (!isAuthorized) {
        // Only ask for permissions automatically once
        const hasAsked = localStorage.getItem('health_permissions_asked');
        if (!hasAsked) {
          await this.requestPermissions();
          localStorage.setItem('health_permissions_asked', 'true');
        }
        return;
      }
      // Authorized, sync silently
      await this.syncData();
    } catch (e) {
      console.warn('Auto sync on launch failed:', e);
    }
  }

  async syncAndSave(profileId: string) {
    try {
      const today = toDateStr();

      // 1. Check if user-entered manual data exists (Priority Rule)
      const manualKey = `health_metrics_user_${today}`;
      const savedManual = localStorage.getItem(manualKey);
      if (savedManual) {
        console.log("HealthSync: Manual data exists, skipping auto-sync to prevent overwrite.");
        return null;
      }

      const data = await this.syncData();
      if (!data) return null;

      const payload: any = {};
      if (data.steps > 0) payload.steps = data.steps;
      if (data.sleepHours > 0 || data.sleepMinutes > 0) payload.sleep_hours = data.sleepHours + data.sleepMinutes / 60;

      if (Object.keys(payload).length > 0) {
        await upsertHealthLog(profileId, today, payload);

        // Handle auto-fill habits
        const [habitsData, todayLogsData] = await Promise.all([
          getHabits(profileId),
          getTodayLogs(profileId)
        ]);

        const doneIds = new Set(todayLogsData?.filter(l => l.completed).map(l => l.habit_id));
        const matches = (habitsData || []).filter(h => h.type === "positive" && h.is_active);

        for (const habit of matches) {
            const nameLower = habit.name.toLowerCase();
            let metricVal: number | null = null;
            let goal: number | null = null;

            if (["qadam", "yurish", "walk", "steps"].some(kw => nameLower.includes(kw))) {
                metricVal = data.steps;
                goal = 10000; // Default goal
            } else if (["uyqu", "uxlash", "sleep"].some(kw => nameLower.includes(kw))) {
                metricVal = data.sleepHours + data.sleepMinutes / 60;
                goal = 8; // Default goal
            }

            if (metricVal !== null && goal !== null && metricVal >= goal && !doneIds.has(habit.id)) {
                await toggleHabitLog(habit.id, profileId, true, metricVal, false);
            }
        }
      }
      return data;
    } catch (e) {
      console.error('syncAndSave failed:', e);
      return null;
    }
  }

  async openSettings() {
    if (Capacitor.getPlatform() === 'android') {
      await Health.openHealthConnectSettings();
    }
  }
}

export const healthSyncService = new HealthSyncService();
