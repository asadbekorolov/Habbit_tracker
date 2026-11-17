// Zanjir (streak) hisoblash — sof funksiya, sanalar "YYYY-MM-DD" (Toshkent).
// Bosh sahifa, Kundalik va odat tafsilotlari bir xil natija ko'rsatishi uchun yagona manba.
import { addDays, isoWeekdayOf } from './date.ts';

export interface StreakLog {
  habit_id: string;
  log_date: string;
  completed: boolean;
}

/** Hafta kunlari (1 = Dushanba ... 7 = Yakshanba); bo'sh/yo'q — har kuni. */
export type WeekSchedule = readonly number[] | null | undefined;

/** Shu kun odat uchun rejalashtirilganmi. */
export function isScheduledOn(schedule: WeekSchedule, date: string): boolean {
  if (!schedule || schedule.length === 0 || schedule.length >= 7) return true;
  return schedule.includes(isoWeekdayOf(date));
}

/**
 * Har bir odat uchun joriy zanjir.
 * - Bugun bajarilgan bo'lsa zanjir bugundan, aks holda kechadan sanaladi
 *   (bugun hali tugamagan — zanjir uzilmagan hisoblanadi).
 * - Muzlatilgan (streak freeze) kunlar zanjirni uzmaydi va sanaladi.
 * - Aqlli zanjir: odat faqat ma'lum kunlarga belgilangan bo'lsa (`schedules`),
 *   rejalashtirilmagan kunlar o'tkazib yuboriladi — zanjirni uzmaydi. Shunday
 *   kunda baribir bajarilgan bo'lsa, u ham sanaladi.
 * - `maxDays` — tarix oynasi (kalendar kunlarida).
 */
export function computeStreaks(params: {
  history: StreakLog[];
  completedToday: Iterable<string>;
  today: string;
  freezeDates?: Iterable<string>;
  maxDays?: number;
  schedules?: Readonly<Record<string, WeekSchedule>>;
}): Record<string, number> {
  const { history, completedToday, today, maxDays = 31, schedules = {} } = params;
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
    const schedule = schedules[id];
    let streak = 0;
    for (let i = days.has(today) ? 0 : 1; i < maxDays; i++) {
      const ds = addDays(today, -i);
      if (days.has(ds)) { streak++; continue; }
      if (!isScheduledOn(schedule, ds)) continue; // dam olish kuni — zanjir uzilmaydi
      if (freeze.has(ds)) { streak++; continue; }
      break;
    }
    if (streak > 0) out[id] = streak;
  }
  return out;
}
