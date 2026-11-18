// Avtomatik uyqu (Health Connect) va ekran vaqti (IdrokScreenTimePlugin, UsageStatsManager).
// Ilova ochilganda / fondan qaytganda / fonga o'tganda health_logs ga yoziladi;
// kecha uchun ekran vaqti bir marta yakuniy qiymat bilan yopiladi ("kun oxiri").
import { Capacitor, registerPlugin } from '@capacitor/core';
import { upsertHealthLog } from './db';
import { healthSyncService } from './healthSyncService';
import { addDays, getTashkentToday } from '../utils/date';
import { minutesToHours, tashkentDayStartMs } from '../utils/autoMetrics';

interface ScreenTimeResult { granted: boolean; minutes: number }
interface IdrokScreenTimePlugin {
  getTodayScreenTime(options?: { startMs?: number }): Promise<ScreenTimeResult>;
  getScreenTime(options: { startMs: number; endMs: number }): Promise<ScreenTimeResult>;
  isGranted(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
}

const ScreenTime = registerPlugin<IdrokScreenTimePlugin>('IdrokScreenTime');

export interface AutoMetrics {
  /** Android ilovasi (vebda — yo'q) */
  supported: boolean;
  screenGranted: boolean;
  screenMinutes: number | null;
  sleepGranted: boolean;
  sleepMinutes: number | null;
}

const EMPTY: AutoMetrics = { supported: false, screenGranted: false, screenMinutes: null, sleepGranted: false, sleepMinutes: null };

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** Bugungi qiymatlar (yozmasdan). */
export async function readAutoMetrics(): Promise<AutoMetrics> {
  if (!isAndroid()) return EMPTY;
  const today = getTashkentToday();
  const [screen, sleepGranted] = await Promise.all([
    ScreenTime.getTodayScreenTime({ startMs: tashkentDayStartMs(today) }).catch(() => ({ granted: false, minutes: 0 })),
    healthSyncService.checkSleepPermission(),
  ]);
  const sleepMinutes = sleepGranted ? await healthSyncService.readLastNightSleepMinutes() : null;
  return {
    supported: true,
    screenGranted: screen.granted,
    screenMinutes: screen.granted ? screen.minutes : null,
    sleepGranted,
    sleepMinutes,
  };
}

const finalKey = (uid: string, date: string) => `screen_final_${uid}_${date}`;

/** O'qiydi va bazaga yozadi. Xatolar yutiladi — UI baribir qiymatni ko'rsatadi. */
export async function syncAutoMetrics(userId: string): Promise<AutoMetrics> {
  const m = await readAutoMetrics();
  if (!m.supported) return m;
  const today = getTashkentToday();

  const fields: { screen_time_hours?: number; sleep_hours?: number } = {};
  if (m.screenMinutes !== null) fields.screen_time_hours = minutesToHours(m.screenMinutes);
  if (m.sleepMinutes) fields.sleep_hours = minutesToHours(m.sleepMinutes);
  if (Object.keys(fields).length) await upsertHealthLog(userId, today, fields).catch(() => {});

  // Kecha — kun oxiridagi yakuniy ekran vaqti (bir marta)
  if (m.screenGranted) {
    const yesterday = addDays(today, -1);
    let done = false;
    try { done = localStorage.getItem(finalKey(userId, yesterday)) === '1'; } catch { /* yo'q */ }
    if (!done) {
      try {
        const r = await ScreenTime.getScreenTime({ startMs: tashkentDayStartMs(yesterday), endMs: tashkentDayStartMs(today) });
        if (r.granted) {
          await upsertHealthLog(userId, yesterday, { screen_time_hours: minutesToHours(r.minutes) });
          try { localStorage.setItem(finalKey(userId, yesterday), '1'); } catch { /* yo'q */ }
        }
      } catch { /* keyingi ochilishda qayta urinadi */ }
    }
  }
  return m;
}

/** "Foydalanish ma'lumotlariga ruxsat" sozlamasini ochadi. */
export async function requestScreenTimePermission(): Promise<void> {
  if (!isAndroid()) return;
  await ScreenTime.requestPermission().catch(() => {});
}

/** Health Connect uyqu ruxsati so'rovi. */
export async function requestSleepPermission(): Promise<boolean> {
  if (!isAndroid()) return false;
  return healthSyncService.requestPermissions();
}
