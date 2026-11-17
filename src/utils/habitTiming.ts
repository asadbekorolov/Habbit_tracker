// "Ko'pincha soat nechada bajariladi?" — bitta odatning bajarilish vaqtlari
// tahlili. Vaqtlar Toshkent bo'yicha (UTC+5, yozgi vaqt yo'q). Sof modul.
import { isoWeekdayOf } from './date.ts';

const TASHKENT_OFFSET_MIN = 5 * 60;
export const MIN_TIMED = 3;

export interface CompletionRow {
  log_date: string;       // "YYYY-MM-DD"
  at: string | null;      // completed_at (ISO) — bo'lmasa null
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export interface TimingResult {
  /** Bajarilgan kunlar soni (vaqtsiz yozuvlar ham) */
  total: number;
  /** Vaqti ma'lum va o'sha kunning o'zida belgilangan yozuvlar */
  timed: number;
  /** Eng faol 90 daqiqalik oraliq, "HH:MM – HH:MM" (timed < MIN_TIMED bo'lsa null) */
  peakWindow: string | null;
  /** Mediana vaqt, "HH:MM" */
  typicalTime: string | null;
  /** Kun qismlari bo'yicha foiz (timed asosida) */
  dayParts: Record<DayPart, number>;
  /** Eng ko'p bajarilgan hafta kunlari (ISO 1..7), ko'pi bilan 2 ta */
  bestWeekdays: number[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** ISO vaqt -> Toshkent sanasi va kun daqiqasi */
export function toTashkentClock(iso: string): { date: string; minute: number } | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + TASHKENT_OFFSET_MIN * 60_000);
  return { date: d.toISOString().slice(0, 10), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function dayPartOf(minute: number): DayPart {
  if (minute >= 4 * 60 && minute < 12 * 60) return 'morning';
  if (minute >= 12 * 60 && minute < 18 * 60) return 'afternoon';
  return 'evening';
}

export function analyzeCompletionTimes(rows: readonly CompletionRow[]): TimingResult {
  const minutes: number[] = [];
  const weekdayCount = new Array(8).fill(0);
  const dates = new Set<string>();
  for (const r of rows) {
    if (dates.has(r.log_date)) continue;
    dates.add(r.log_date);
    weekdayCount[isoWeekdayOf(r.log_date)]++;
    if (!r.at) continue;
    const c = toTashkentClock(r.at);
    // Ertasi kuni ertalab belgilangan (kechagi kun uchun) yozuv — vaqt tahliliga kirmaydi
    if (c && c.date === r.log_date) minutes.push(c.minute);
  }

  const dayParts: Record<DayPart, number> = { morning: 0, afternoon: 0, evening: 0 };
  let peakWindow: string | null = null;
  let typicalTime: string | null = null;

  if (minutes.length >= MIN_TIMED) {
    for (const m of minutes) dayParts[dayPartOf(m)]++;
    for (const k of Object.keys(dayParts) as DayPart[]) dayParts[k] = Math.round((dayParts[k] / minutes.length) * 100);

    // 90 daqiqalik oyna, 30 daqiqa qadam bilan — eng ko'p bajarilgan oraliq
    let best = -1;
    let bestStart = 0;
    for (let start = 0; start < 1440; start += 30) {
      const n = minutes.filter((m) => {
        const rel = (m - start + 1440) % 1440;
        return rel < 90;
      }).length;
      if (n > best) { best = n; bestStart = start; }
    }
    peakWindow = `${hm(bestStart)} – ${hm(bestStart + 90)}`;

    const sorted = [...minutes].sort((a, b) => a - b);
    const mid = sorted[Math.floor((sorted.length - 1) / 2)];
    typicalTime = hm(Math.round(mid / 5) * 5);
  }

  const maxWd = Math.max(...weekdayCount.slice(1));
  const bestWeekdays = maxWd > 0
    ? [1, 2, 3, 4, 5, 6, 7].filter((d) => weekdayCount[d] === maxWd).slice(0, 2)
    : [];

  return { total: dates.size, timed: minutes.length, peakWindow, typicalTime, dayParts, bestWeekdays };
}
