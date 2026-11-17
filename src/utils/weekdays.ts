// Odat hafta kunlari (1 = Dushanba ... 7 = Yakshanba) — tanlash yordamchilari.
export const EVERY_DAY: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
export const WORK_DAYS: readonly number[] = [1, 2, 3, 4, 5];
export const WEEKEND: readonly number[] = [6, 7];

export type DaysPreset = 'every' | 'work' | 'weekend' | 'custom';

/** Tartiblangan, takrorsiz, 1..7 oralig'ida; bo'sh bo'lsa — har kuni. */
export function normalizeDays(days: readonly number[] | null | undefined): number[] {
  const set = [...new Set((days || []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
  return set.length ? set : [...EVERY_DAY];
}

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function detectPreset(days: readonly number[] | null | undefined): DaysPreset {
  const d = normalizeDays(days);
  if (same(d, EVERY_DAY)) return 'every';
  if (same(d, WORK_DAYS)) return 'work';
  if (same(d, WEEKEND)) return 'weekend';
  return 'custom';
}

/** Kunni yoqish/o'chirish — oxirgi kunni o'chirib bo'lmaydi (kamida 1 ta). */
export function toggleDay(days: readonly number[], day: number): number[] {
  const d = normalizeDays(days);
  if (d.includes(day)) return d.length === 1 ? d : d.filter((x) => x !== day);
  return normalizeDays([...d, day]);
}

/** Sana joylashgan haftaning dushanbasi ("YYYY-MM-DD"). */
export function weekStartOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const wd = new Date(t).getUTCDay(); // 0 = yakshanba
  const back = (wd + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

/** Dushanbadan boshlab 7 kun. */
export function weekDates(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => new Date(t + i * 86_400_000).toISOString().slice(0, 10));
}
