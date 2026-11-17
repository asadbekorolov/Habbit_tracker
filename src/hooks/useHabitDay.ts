// Bir kunlik odat holati va amallari — Bosh sahifa, Kundalik va odat
// tafsilotlari oynasi uchun YAGONA manba.
//
// Holat to'g'ridan-to'g'ri React Query keshidan (['logs', uid, date]) olinadi:
// habitSyncQueue har bosishda keshni darhol yangilaydi (patchDayLog), server
// rad etsa — kesh serverdan qayta yuklanadi. Shuning uchun bu yerda alohida
// lokal holat va qo'lda "rollback" kerak emas.
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useHabitsQuery, useDayLogsQuery, useLogsRangeQuery, useFreezeInfoQuery } from './queries';
import { habitSyncQueue } from '../services/habitSyncQueue';
import { soundService } from '../services/soundService';
import { addDays, getTashkentToday, isTashkentDateOpen } from '../utils/date';
import { computeStreaks, isScheduledOn } from '../utils/streaks';
import { isMeasurable } from '../utils/habitMetrics';
import { useLang } from '../store/LangContext';
import type { Habit } from '../services/supabase';

export type HabitDayStatus = 'done' | 'fail' | 'none';

export interface HabitDayEntry {
  status: HabitDayStatus;
  value: number;
}

const EMPTY: HabitDayEntry = { status: 'none', value: 0 };

/**
 * Istalgan (ochiq) kun uchun belgini navbatga qo'yadi — kunlik kesh darhol
 * yangilanadi. Kun ochiqligini chaqiruvchi tekshiradi.
 */
export function markHabitOnDate(uid: string, habit: Habit, date: string, status: HabitDayStatus, value: number) {
  habitSyncQueue.enqueue({
    habitId: habit.id,
    userId: uid,
    completed: status === 'done',
    value: status === 'none' ? 0 : value,
    isDelete: status === 'none',
    isNegative: habit.type === 'negative',
    date,
  });
}

/** "Bajarildi" qiymati: o'lchanadigan odatda — maqsad, aks holda 1. */
export const doneValue = (habit: Habit) => (isMeasurable(habit) ? habit.target_value || 1 : 1);

export function useHabitDay(uid: string, date: string) {
  const { t } = useLang();
  const today = getTashkentToday();
  const habitsQ = useHabitsQuery(uid);
  const dayQ = useDayLogsQuery(uid, date);
  const historyQ = useLogsRangeQuery(uid, addDays(today, -30), today);
  const freezeQ = useFreezeInfoQuery(uid);

  const habits: Habit[] = habitsQ.data || [];
  const positive = useMemo(() => habits.filter((h) => h.type !== 'negative'), [habits]);
  const negative = useMemo(() => habits.filter((h) => h.type === 'negative'), [habits]);
  // Hafta kunlari (052): shu kunga rejalashtirilgan va rejalashtirilmagan ijobiy odatlar
  const scheduled = useMemo(() => positive.filter((h) => isScheduledOn(h.days_of_week, date)), [positive, date]);
  const unscheduled = useMemo(() => positive.filter((h) => !isScheduledOn(h.days_of_week, date)), [positive, date]);
  const schedules = useMemo(
    () => Object.fromEntries(habits.map((h) => [h.id, h.days_of_week])),
    [habits]
  );

  const entries = useMemo(() => {
    const map = new Map<string, HabitDayEntry>();
    for (const l of dayQ.data || []) {
      map.set(l.habit_id, {
        status: l.completed ? 'done' : 'fail',
        value: Number(l.value) || (l.completed ? 1 : 0),
      });
    }
    return map;
  }, [dayQ.data]);

  // Zanjir har doim bugungi kunga nisbatan (bugungi belgilar ham qo'shiladi).
  const todayDayQ = useDayLogsQuery(uid, today);
  const streaks = useMemo(() => {
    const doneToday = (todayDayQ.data || []).filter((l) => l.completed).map((l) => l.habit_id);
    return computeStreaks({
      history: historyQ.data || [],
      completedToday: doneToday,
      today,
      freezeDates: freezeQ.data?.dates,
      schedules,
    });
  }, [historyQ.data, todayDayQ.data, today, freezeQ.data?.dates, schedules]);

  const locked = !isTashkentDateOpen(date);
  const entryOf = (habitId: string) => entries.get(habitId) ?? EMPTY;

  function enqueue(habit: Habit, status: HabitDayStatus, value: number): boolean {
    if (locked) {
      toast.error(t('log_locked_error'));
      return false;
    }
    if (status === 'done' && entryOf(habit.id).status !== 'done') soundService.play('task_complete');
    markHabitOnDate(uid, habit, date, status, value);
    return true;
  }

  /** Bajarildi <-> belgilanmagan. O'lchanadigan odatda "bajarildi" = maqsad qiymati. */
  function toggleDone(habit: Habit) {
    const cur = entryOf(habit.id);
    if (cur.status === 'done') return enqueue(habit, 'none', 0);
    return enqueue(habit, 'done', doneValue(habit));
  }

  /** Bajarilmadi <-> belgilanmagan (salbiy odatda: "buzildi"). */
  function toggleFail(habit: Habit) {
    const cur = entryOf(habit.id);
    return enqueue(habit, cur.status === 'fail' ? 'none' : 'fail', 0);
  }

  /** O'lchanadigan odat qiymati: maqsadga yetsa — bajarildi; 0 — belgisiz. */
  function setValue(habit: Habit, value: number) {
    const v = Math.max(0, Math.round(value));
    if (v === 0) return enqueue(habit, 'none', 0);
    const target = habit.target_value || 1;
    return enqueue(habit, v >= target ? 'done' : 'fail', v);
  }

  return {
    habits,
    positive,
    negative,
    /** Shu kunga rejalashtirilgan ijobiy odatlar (intizom foizi shulardan) */
    scheduled,
    /** Shu kunga rejalashtirilmagan ijobiy odatlar */
    unscheduled,
    entryOf,
    streaks,
    locked,
    isLoading: habitsQ.isPending || dayQ.isPending,
    toggleDone,
    toggleFail,
    setValue,
  };
}
