// Bitta odat bo'yicha hisob-kitoblar — React'siz sof modul (node testlari).
// Sanalar har doim "YYYY-MM-DD" (Toshkent kuni), vaqt zonasidan mustaqil.
import { addDays, diffDays } from './date.ts';
import { isScheduledOn, type WeekSchedule } from './streaks.ts';

/** Server mukofoti (_set_habit_status, 047): ijobiy +5 XP / +1 tanga, salbiy +15 XP / +10 tanga. */
export const HABIT_REWARD = {
  positive: { xp: 5, coins: 1 },
  negative: { xp: 15, coins: 10 },
} as const;

export interface MeasurableLike {
  target_value?: number | null;
  unit?: string | null;
}

/** Sonli/vaqtli (o'lchanadigan) odatmi: maqsad > 1 yoki birlik berilgan. */
export function isMeasurable(h: MeasurableLike): boolean {
  return (h.target_value || 1) > 1 || !!h.unit;
}

/** Maqsadga nisbatan foiz (0–100). */
export function progressPct(value: number, target: number): number {
  if (!target || target <= 0) return value > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

/** "+/-" tugmasi qadami: katta maqsadlarda 5 tadan. */
export function valueStep(target: number): number {
  return target >= 30 ? 5 : 1;
}

/**
 * Eng uzun ketma-ketlik. Muzlatilgan kunlar zanjirni uzmaydi; rejalashtirilmagan
 * kunlar (schedule) o'tkazib yuboriladi — aqlli zanjir bilan bir xil qoida.
 */
export function longestStreak(
  doneDates: Iterable<string>,
  freezeDates: Iterable<string> = [],
  schedule?: WeekSchedule,
): number {
  const done = new Set(doneDates);
  if (done.size === 0) return 0;
  const freeze = new Set(freezeDates);
  const sorted = [...done].sort();
  const last = sorted[sorted.length - 1];
  let best = 0;
  let cur = 0;
  for (let d = sorted[0]; d <= last; d = addDays(d, 1)) {
    if (done.has(d)) { cur++; if (cur > best) best = cur; continue; }
    if (!isScheduledOn(schedule, d)) continue;
    if (freeze.has(d)) { cur++; continue; }
    cur = 0;
  }
  return best;
}

export type DayStatus = 'done' | 'fail' | 'freeze' | 'empty' | 'off' | 'future';

export interface CalendarCell {
  date: string;
  day: number;
  status: DayStatus;
  isToday: boolean;
}

/**
 * Oy kalendari: dushanbadan boshlanadigan 7 ustunli panjara. Oy boshidan
 * oldingi bo'sh kataklar null.
 */
export function buildMonthCalendar(
  year: number,
  month: number, // 1–12
  today: string,
  done: ReadonlySet<string>,
  failed: ReadonlySet<string>,
  frozen: ReadonlySet<string>,
  schedule?: WeekSchedule,
): (CalendarCell | null)[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = yakshanba
  const lead = (weekday + 6) % 7; // dushanba = 0
  const cells: (CalendarCell | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < daysInMonth; i++) {
    const date = addDays(first, i);
    let status: DayStatus;
    if (date > today) status = 'future';
    else if (done.has(date)) status = 'done';
    else if (failed.has(date)) status = 'fail';
    else if (!isScheduledOn(schedule, date)) status = 'off';
    else if (frozen.has(date)) status = 'freeze';
    else status = 'empty';
    cells.push({ date, day: i + 1, status, isToday: date === today });
  }
  return cells;
}

/**
 * Oylik natija: bajarilgan kunlar / hisobga olinadigan kunlar (oy boshi yoki
 * odat yaratilgan kundan bugungacha; muzlatilgan kunlar hisobga olinmaydi).
 */
export function monthResult(
  year: number,
  month: number,
  today: string,
  createdDay: string | null,
  done: ReadonlySet<string>,
  frozen: ReadonlySet<string>,
  schedule?: WeekSchedule,
): { pct: number; done: number; eligible: number } {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = addDays(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`, -1);
  const start = createdDay && createdDay > first ? createdDay : first;
  const end = last < today ? last : today;
  let eligible = 0;
  let doneCount = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isScheduledOn(schedule, d)) continue; // rejalashtirilmagan kun hisobga olinmaydi
    if (done.has(d)) { doneCount++; eligible++; }
    else if (!frozen.has(d)) eligible++;
  }
  return { pct: eligible ? Math.round((doneCount / eligible) * 100) : 0, done: doneCount, eligible };
}
