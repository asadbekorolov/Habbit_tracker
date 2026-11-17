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
