// Avtomatik uyqu va ekran vaqti — sof yordamchilar (Toshkent vaqti, UTC+5, yozgi vaqt yo'q).

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** "YYYY-MM-DD" Toshkent kunining boshlanishi (epoch ms). */
export function tashkentDayStartMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - TASHKENT_OFFSET_MS;
}

/**
 * "O'tgan tun" oynasi: kechagi 18:00 dan bugungi 14:00 gacha (Toshkent),
 * hozirgi vaqtdan oshmaydi. Uyqu uyg'ongan kunga yoziladi.
 */
export function lastNightWindow(today: string, nowMs: number): { startMs: number; endMs: number } {
  const dayStart = tashkentDayStartMs(today);
  return { startMs: dayStart - 6 * 3_600_000, endMs: Math.min(nowMs, dayStart + 14 * 3_600_000) };
}

export interface SleepSampleLike {
  startDate: string;
  endDate: string;
  sleepState?: string;
}

const ASLEEP = new Set(['asleep', 'deep', 'light', 'rem']);

/**
 * Uxlangan daqiqalar: oynadagi "uxlash" bosqichlari kesishmalari birlashtiriladi
 * (sessiya + bosqichlar ikki marta sanalmasin). Bosqichi yo'q namuna — uyqu sessiyasi;
 * bosqichli namunalar bo'lsa, "awake"/"inBed" chiqarib tashlanadi.
 */
export function mergeSleepMinutes(samples: readonly SleepSampleLike[], window: { startMs: number; endMs: number }): number {
  const hasStages = samples.some((s) => s.sleepState && ASLEEP.has(s.sleepState));
  const intervals: [number, number][] = [];
  for (const s of samples) {
    const state = s.sleepState;
    const counts = hasStages ? !!state && ASLEEP.has(state) : !state || ASLEEP.has(state);
    if (!counts) continue;
    const a = Math.max(Date.parse(s.startDate), window.startMs);
    const b = Math.min(Date.parse(s.endDate), window.endMs);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) intervals.push([a, b]);
  }
  intervals.sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const iv of intervals) {
    if (!cur || iv[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [iv[0], iv[1]];
    } else if (iv[1] > cur[1]) {
      cur[1] = iv[1];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total / 60_000);
}

/** 370 -> "6s 10d" (uz) / "6ч 10м" (ru) / "6h 10m" (en). */
export function formatHoursMinutes(minutes: number, lang: 'uz' | 'ru' | 'en' = 'uz'): string {
  const m = Math.max(0, Math.round(minutes || 0));
  const [h, mm] = lang === 'ru' ? ['ч', 'м'] : lang === 'en' ? ['h', 'm'] : ['s', 'd'];
  return `${Math.floor(m / 60)}${h} ${m % 60}${mm}`;
}

/** Daqiqa -> health_logs uchun soat (2 xona aniqlik). */
export function minutesToHours(minutes: number): number {
  return Math.round((Math.max(0, minutes) / 60) * 100) / 100;
}
