// Markaziy React Query hook'lari. Sahifalar ma'lumotni faqat shu yerdan oladi;
// kalitlar src/services/queryClient.ts dagi `queryKeys` da.

import { useQuery, queryOptions, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import {
  getHabits,
  getHabitsMeta,
  getLogsForDate,
  getLogsBetween,
  getAllTimeLogs,
  getHealthLogsBetween,
  getMyGroups,
  getLeaderboard,
  getUserRank,
  getMonthNotes,
  getStreakFreezes,
  getMonthlyFreezeCount,
  getExtraFreezeCount,
  type CompactLog,
  type HabitMeta,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../services/db';
import { habitSyncQueue, applyPendingToLogs } from '../services/habitSyncQueue';
import { queryKeys } from '../services/queryClient';
import { sortByOrder, setHabitOrder } from '../utils/habitOrder';
import type { Habit } from '../services/supabase';

export { queryKeys };

const enabledFor = (uid?: string | null) => !!uid && uid !== 'user-1';

// ─── Query options (hook'siz joylarda ham: queryClient.fetchQuery(...)) ───

export const habitsQuery = (uid: string) =>
  queryOptions<Habit[]>({
    queryKey: queryKeys.habits(uid),
    queryFn: () => getHabits(uid) as Promise<Habit[]>,
  });

export const habitsMetaQuery = (uid: string) =>
  queryOptions<HabitMeta[]>({
    queryKey: queryKeys.habitsMeta(uid),
    queryFn: () => getHabitsMeta(uid),
    staleTime: 5 * 60_000,
  });

/** Bir kunlik loglar + hali serverga yetmagan (navbatdagi) belgilar. */
export const dayLogsQuery = (uid: string, date: string) =>
  queryOptions<any[]>({
    queryKey: queryKeys.dayLogs(uid, date),
    queryFn: async () =>
      applyPendingToLogs((await getLogsForDate(uid, date)) || [], habitSyncQueue.getPendingFor(uid, date)),
  });

/** Katta oraliqlar (yil va undan ko'p) diskka yozilmaydi — localStorage'ni to'ldirmasin. */
const PERSIST_RANGE_MAX_DAYS = 120;

export const logsRangeQuery = (uid: string, from: string, to: string) =>
  queryOptions<CompactLog[]>({
    queryKey: queryKeys.logsRange(uid, from, to),
    queryFn: () => getLogsBetween(uid, from, to),
    meta: { persist: daysBetween(from, to) <= PERSIST_RANGE_MAX_DAYS },
  });

export const allTimeLogsQuery = (uid: string) =>
  queryOptions<any[]>({
    queryKey: queryKeys.allTimeLogs(uid),
    queryFn: () => getAllTimeLogs(uid),
    staleTime: 5 * 60_000,
    meta: { persist: false },
  });

export const healthRangeQuery = (uid: string, from: string, to: string) =>
  queryOptions<any[]>({
    queryKey: queryKeys.healthRange(uid, from, to),
    queryFn: () => getHealthLogsBetween(uid, from, to),
    meta: { persist: daysBetween(from, to) <= PERSIST_RANGE_MAX_DAYS },
  });

/** Foydalanuvchi a'zo bo'lgan guruhlar (groups qatorlari). */
export const myGroupsQuery = (uid: string) =>
  queryOptions<any[]>({
    queryKey: queryKeys.myGroups(uid),
    queryFn: async () => ((await getMyGroups(uid)) || []).map((m: any) => m.groups).filter(Boolean),
  });

export const leaderboardQuery = (period: LeaderboardPeriod) =>
  queryOptions<LeaderboardEntry[]>({
    queryKey: queryKeys.leaderboard(period),
    queryFn: () => getLeaderboard(period),
    staleTime: 60_000,
  });

export const myRankQuery = (uid: string, period: LeaderboardPeriod) =>
  queryOptions<number>({
    queryKey: queryKeys.myRank(uid, period),
    queryFn: () => getUserRank(uid, period),
    staleTime: 60_000,
  });

export const monthNotesQuery = (uid: string, year: number, month: number) =>
  queryOptions<any[]>({
    queryKey: queryKeys.monthNotes(uid, year, month),
    queryFn: async () => (await getMonthNotes(uid, year, month)) || [],
  });

/** Muzlatilgan kunlar (zanjirni uzmaydi) va oylik/qo'shimcha muzlatish soni. */
export const freezeInfoQuery = (uid: string) =>
  queryOptions<{ dates: string[]; monthly: number; extra: number }>({
    queryKey: queryKeys.freezes(uid),
    queryFn: async () => {
      const [dates, monthly, extra] = await Promise.all([
        getStreakFreezes(uid),
        getMonthlyFreezeCount(uid),
        getExtraFreezeCount(uid),
      ]);
      return { dates: dates as string[], monthly, extra };
    },
  });

// ─── Hook'lar ────────────────────────────────────────────────────────────

export function useFreezeInfoQuery(uid?: string | null) {
  return useQuery({ ...freezeInfoQuery(uid || ''), enabled: enabledFor(uid) });
}

/** Faol odatlar, foydalanuvchi tanlagan tartibda. */
export function useHabitsQuery(uid?: string | null) {
  return useQuery({
    ...habitsQuery(uid || ''),
    enabled: enabledFor(uid),
    select: (data) => sortByOrder(data, uid || ''),
  });
}

/** Barcha odatlar (o'chirilganlari ham): id -> {name, emoji, type}. */
export function useHabitsMetaQuery(uid?: string | null) {
  return useQuery({ ...habitsMetaQuery(uid || ''), enabled: enabledFor(uid) });
}

export function useDayLogsQuery(uid: string | null | undefined, date: string) {
  return useQuery({ ...dayLogsQuery(uid || '', date), enabled: enabledFor(uid) });
}

type RangeOpts = { enabled?: boolean; /** Oraliq o'zgarganda eski ma'lumot ko'rinib tursin (yuklovchi miltillamasin). */ keepPrevious?: boolean };

export function useLogsRangeQuery(uid: string | null | undefined, from: string, to: string, opts?: RangeOpts) {
  return useQuery({
    ...logsRangeQuery(uid || '', from, to),
    enabled: enabledFor(uid) && (opts?.enabled ?? true) && from <= to,
    placeholderData: opts?.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useAllTimeLogsQuery(uid?: string | null) {
  return useQuery({ ...allTimeLogsQuery(uid || ''), enabled: enabledFor(uid) });
}

export function useHealthRangeQuery(uid: string | null | undefined, from: string, to: string, opts?: RangeOpts) {
  return useQuery({
    ...healthRangeQuery(uid || '', from, to),
    enabled: enabledFor(uid) && (opts?.enabled ?? true) && from <= to,
    placeholderData: opts?.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useMyGroupsQuery(uid?: string | null) {
  return useQuery({ ...myGroupsQuery(uid || ''), enabled: enabledFor(uid) });
}

export function useLeaderboardQuery(period: LeaderboardPeriod) {
  return useQuery(leaderboardQuery(period));
}

export function useMyRankQuery(uid: string | null | undefined, period: LeaderboardPeriod) {
  return useQuery({ ...myRankQuery(uid || '', period), enabled: enabledFor(uid) });
}

export function useMonthNotesQuery(uid: string | null | undefined, year: number, month: number) {
  return useQuery({ ...monthNotesQuery(uid || '', year, month), enabled: enabledFor(uid) });
}

// ─── Odat mutatsiyalaridan keyin keshni yangilash ───────────────────────
// Har biri avval keshni darhol o'zgartiradi (setQueryData), keyin serverdan
// qayta tekshiradi (invalidateQueries).

export const habitCache = {
  added(qc: QueryClient, uid: string, habit: Habit | null | undefined) {
    if (habit?.id) {
      qc.setQueryData<Habit[]>(queryKeys.habits(uid), (old) =>
        old ? [...old.filter((h) => h.id !== habit.id), habit] : old
      );
    }
    qc.invalidateQueries({ queryKey: queryKeys.habits(uid) });
  },
  updated(qc: QueryClient, uid: string, habit: Partial<Habit> & { id: string }) {
    qc.setQueryData<Habit[]>(queryKeys.habits(uid), (old) =>
      old?.map((h) => (h.id === habit.id ? { ...h, ...habit } : h))
    );
    qc.invalidateQueries({ queryKey: queryKeys.habits(uid) });
  },
  removed(qc: QueryClient, uid: string, habitId: string) {
    qc.setQueryData<Habit[]>(queryKeys.habits(uid), (old) => old?.filter((h) => h.id !== habitId));
    qc.invalidateQueries({ queryKey: queryKeys.habits(uid) });
    qc.invalidateQueries({ queryKey: queryKeys.logs(uid) });
  },
  /** Tartib localStorage'da; keshni yangi massiv bilan almashtirib, obunachilarni qayta chizdiramiz. */
  reordered(qc: QueryClient, uid: string, orderedIds: string[]) {
    setHabitOrder(uid, orderedIds);
    qc.setQueryData<Habit[]>(queryKeys.habits(uid), (old) => (old ? sortByOrder(old, uid) : old));
  },
};

// ─── Yordamchi ───────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000) + 1;
}
