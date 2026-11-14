// Zanjir (streak) hisoblash — sof funksiya, sanalar "YYYY-MM-DD" (Toshkent).
// HabitsLog va Dashboard bir xil natija ko'rsatishi uchun yagona manba.
import { addDays } from './date.ts';

export interface StreakLog {
  habit_id: string;
  log_date: string;
  completed: boolean;
}

/**
 * Har bir odat uchun ketma-ket bajarilgan kunlar soni.
 * - Bugun bajarilgan bo'lsa zanjir bugundan, aks holda kechadan sanaladi
 *   (bugun hali tugamagan — zanjir uzilmagan hisoblanadi).
 * - Muzlatilgan (streak freeze) kunlar zanjirni uzmaydi va sanaladi.
 * - `maxDays` — tarix oynasi (so'nggi 30 kun yuklanadi).
 */
export function computeStreaks(params: {
  history: StreakLog[];
  completedToday: Iterable<string>;
  today: string;
  freezeDates?: Iterable<string>;
  maxDays?: number;
}): Record<string, number> {
  const { history, completedToday, today, maxDays = 31 } = params;
  const freeze = new Set(params.freezeDates ?? []);
  const byHabit = new Map<string, Set<string>>();
  const add = (id: string, d: string) => {
    let s = byHabit.get(id);
    if (!s) byHabit.set(id, (s = new Set()));
    s.add(d);
  };
  for (const l of history) if (l.completed) add(l.habit_id, l.log_date);
  for (const id of completedToday) add(id, today);

  const out: Record<string, number> = {};
  for (const [id, days] of byHabit) {
    let streak = 0;
    for (let i = days.has(today) ? 0 : 1; i < maxDays; i++) {
      const ds = addDays(today, -i);
      if (days.has(ds) || freeze.has(ds)) streak++;
      else break;
    }
    if (streak > 0) out[id] = streak;
  }
  return out;
}
