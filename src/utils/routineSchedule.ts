// Kun tartibining bugungi holati — Toshkent vaqti bo'yicha. Sof funksiya
// (React'siz), shuning uchun node testlari bilan tekshiriladi.
import type { Routine } from '../services/supabase';

export type RoutineStatus = 'completed' | 'active' | 'upcoming';

export interface ScheduledRoutine {
  routine: Routine;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  status: RoutineStatus;
  done: number;
  total: number;
}

export interface RoutineSchedule {
  /** Bugun rejalashtirilgan faol tartiblar, boshlanish vaqti bo'yicha. */
  items: ScheduledRoutine[];
  /** Hozir davom etayotgan tartib (bo'lmasa — null). */
  current: ScheduledRoutine | null;
  /** Hozir hech narsa bo'lmasa — navbatdagisi. */
  next: ScheduledRoutine | null;
}

/** Tunni kesib o'tadigan oraliq (23:00–06:00) ham hisobga olinadi. */
function isWithin(now: string, start: string, end: string): boolean {
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/**
 * @param nowHM   Toshkent vaqti, "HH:MM" (getTashkentTimeHM())
 * @param weekday ISO hafta kuni, 1 = dushanba … 7 = yakshanba (getTashkentIsoWeekday())
 */
export function buildRoutineSchedule(routines: Routine[], nowHM: string, weekday: number): RoutineSchedule {
  const items: ScheduledRoutine[] = routines
    .filter((r) => r.is_active && (r.days_of_week || []).includes(weekday))
    .map((routine) => {
      const start = (routine.time_start || '').slice(0, 5);
      const end = (routine.time_end || '').slice(0, 5);
      const list = routine.items || [];
      const done = list.filter((it) => it.is_completed_today).length;
      const total = list.length;
      let status: RoutineStatus;
      if (isWithin(nowHM, start, end)) status = 'active';
      else if (start < end ? nowHM >= end : false) status = 'completed';
      else status = nowHM < start ? 'upcoming' : 'completed';
      // Bandlari hammasi belgilangan tartib — vaqtidan qat'i nazar bajarilgan
      if (total > 0 && done === total) status = 'completed';
      return { routine, start, end, status, done, total };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const current = items.find((i) => i.status === 'active') ?? null;
  const next = current ? null : items.find((i) => i.status === 'upcoming') ?? null;
  return { items, current, next };
}
