// "Sening Aksing" (AI raqamli egizak) uchun telemetriya — sof funksiyalar.
// Uzilgan zanjirlar va "bajarilmadi" sabablari AI'ga matn ko'rinishida beriladi.
import { addDays } from './date.ts';
import { isScheduledOn, type StreakLog, type WeekSchedule } from './streaks.ts';

export interface BrokenStreak {
  habitId: string;
  /** Uzilishdan oldingi zanjir uzunligi (rejalashtirilgan kunlar) */
  length: number;
  /** Zanjir uzilgan kun */
  date: string;
}

/**
 * [from, to] oralig'ida uzilgan zanjirlar (kamida `minRun` kunlik).
 * - Rejalashtirilmagan kun zanjirni uzmaydi; o'sha kuni bajarilsa — sanaladi.
 * - Muzlatilgan kun zanjirni uzmaydi.
 * - `to` odatda kecha: bugun hali tugamagan.
 */
export function findBrokenStreaks(params: {
  logs: readonly StreakLog[];
  habitIds: readonly string[];
  from: string;
  to: string;
  schedules?: Record<string, WeekSchedule>;
  freezeDates?: readonly string[];
  minRun?: number;
}): BrokenStreak[] {
  const { logs, habitIds, from, to, schedules = {}, freezeDates = [], minRun = 3 } = params;
  const done = new Set<string>();
  for (const l of logs) if (l.completed) done.add(`${l.habit_id}|${l.log_date}`);
  const frozen = new Set(freezeDates);
  const out: BrokenStreak[] = [];

  for (const id of habitIds) {
    let run = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (done.has(`${id}|${d}`)) { run++; continue; }
      if (frozen.has(d) || !isScheduledOn(schedules[id], d)) continue;
      if (run >= minRun) out.push({ habitId: id, length: run, date: d });
      run = 0;
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.length - a.length));
}

export interface FailReasonRow {
  habit_id: string;
  log_date: string;
  fail_reason: string | null;
}

/** AI uchun ixcham qatorlar: eng yangisi tepada, bo'sh sabablarsiz, `limit` ta. */
export function formatFailReasons(
  rows: readonly FailReasonRow[],
  nameOf: (habitId: string) => string | undefined,
  limit = 30,
): string[] {
  return rows
    .filter((r) => (r.fail_reason || '').trim().length > 0)
    .slice()
    .sort((a, b) => (a.log_date < b.log_date ? 1 : a.log_date > b.log_date ? -1 : 0))
    .slice(0, limit)
    .map((r) => {
      const reason = (r.fail_reason || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      return `${r.log_date} | ${nameOf(r.habit_id) ?? 'Odat'} | "${reason}"`;
    });
}

export function formatBrokenStreaks(
  list: readonly BrokenStreak[],
  nameOf: (habitId: string) => string | undefined,
  limit = 15,
): string[] {
  return list.slice(0, limit).map((b) => `${b.date} | ${nameOf(b.habitId) ?? 'Odat'} | ${b.length} kunlik zanjir uzildi`);
}
