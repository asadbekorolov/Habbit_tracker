// Yagona kesh: React Query + localStorage persister.
// Boshqa hech qayerda (db.ts, offline.ts, sahifalar) ma'lumot keshi yo'q.

import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { removeOldestQuery } from '@tanstack/react-query-persist-client';
import type { Persister } from '@tanstack/react-query-persist-client';

/** Persist qilingan kesh shuncha vaqt saqlanadi (7 kun). */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Kesh tuzilmasi o'zgarsa oshiriladi — eski persist qilingan kesh tashlanadi. */
export const CACHE_BUSTER = 'idrok-cache-v1';

const PERSIST_KEY = 'idrok_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // gcTime >= maxAge bo'lishi shart, aks holda persist qilingan so'rov
      // tiklanganidan keyin darhol tozalanib ketadi.
      gcTime: CACHE_MAX_AGE,
      staleTime: 30_000,
      retry: 1,
      // Oflaynda ham bir marta urinadi; kesh bo'lsa u ko'rinib turadi.
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: true,
    },
  },
});

const hasStorage = typeof window !== 'undefined' && !!window.localStorage;

export const queryPersister: Persister | undefined = hasStorage
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: PERSIST_KEY,
      throttleTime: 1000,
      // localStorage to'lib qolsa — eng eski so'rovni tashlab, qayta urinadi.
      retry: removeOldestQuery,
    })
  : undefined;

// ─── KALITLAR (yagona manba) ────────────────────────────────────────────
// ['logs', uid] prefiksi kunlik, oraliq va umumiy loglarning hammasini qamraydi.
export const queryKeys = {
  habits: (uid: string) => ['habits', uid] as const,
  habitsMeta: (uid: string) => ['habits', uid, 'meta'] as const,
  logs: (uid: string) => ['logs', uid] as const,
  dayLogs: (uid: string, date: string) => ['logs', uid, date] as const,
  logsRanges: (uid: string) => ['logs', uid, 'range'] as const,
  logsRange: (uid: string, from: string, to: string) => ['logs', uid, 'range', from, to] as const,
  allTimeLogs: (uid: string) => ['logs', uid, 'alltime'] as const,
  health: (uid: string) => ['health', uid] as const,
  healthRange: (uid: string, from: string, to: string) => ['health', uid, from, to] as const,
  myGroups: (uid: string) => ['groups', uid] as const,
  leaderboardAll: () => ['leaderboard'] as const,
  leaderboard: (period: string) => ['leaderboard', period] as const,
  myRank: (uid: string, period: string) => ['leaderboard', period, 'me', uid] as const,
  routines: (uid: string) => ['routines', uid] as const,
  freezes: (uid: string) => ['freezes', uid] as const,
  monthNotes: (uid: string, year: number, month: number) => ['notes', uid, year, month] as const,
  referral: (uid: string) => ['referral', uid] as const,
};

// ─── ODAT BELGILARI → KESH ──────────────────────────────────────────────
type DayLogRow = { habit_id: string; completed: boolean; value?: number | null; [k: string]: unknown };
type MarkStatus = 'done' | 'fail' | 'neutral';

/** Kunlik loglar keshida bitta odat holatini o'rnatadi (optimistik yoki tasdiqlangan). */
export function patchDayLog(uid: string, date: string, habitId: string, status: MarkStatus, value: number) {
  queryClient.setQueryData<DayLogRow[]>(queryKeys.dayLogs(uid, date), (old) => {
    // Hali yuklanmagan bo'lsa — queryFn navbatdagi belgini o'zi qo'shadi.
    if (!old) return old;
    const idx = old.findIndex((l) => l.habit_id === habitId);
    if (status === 'neutral') return idx === -1 ? old : old.filter((_, i) => i !== idx);
    const row: DayLogRow = {
      ...(idx === -1 ? { habit_id: habitId, user_id: uid, log_date: date } : old[idx]),
      completed: status === 'done',
      value,
    };
    if (idx === -1) return [...old, row];
    const next = old.slice();
    next[idx] = row;
    return next;
  });
}

/** Navbat elementi serverda saqlandi: tasdiqlangan holatni yozib, bog'liq so'rovlarni yangilaymiz. */
export function onHabitSyncSuccess(d: { userId: string; habitId: string; date: string; status?: MarkStatus; value?: number }) {
  if (d.status) patchDayLog(d.userId, d.date, d.habitId, d.status, d.value ?? 0);
  queryClient.invalidateQueries({ queryKey: queryKeys.logs(d.userId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.leaderboardAll() });
}

/** Server belgini rad etdi (date_locked, habit_not_found, ...): haqiqiy holatni qayta yuklaymiz. */
export function onHabitSyncRejected(d: { userId: string; habitId: string; date: string; code?: string }) {
  // Navbat elementi allaqachon o'chirilgan — refetch faqat server holatini qaytaradi.
  queryClient.invalidateQueries({ queryKey: queryKeys.dayLogs(d.userId, d.date) });
  queryClient.invalidateQueries({ queryKey: queryKeys.logsRanges(d.userId) });
  if (d.code === 'habit_not_found') {
    queryClient.invalidateQueries({ queryKey: queryKeys.habits(d.userId) });
  }
}

/** Faqat muvaffaqiyatli va `meta.persist !== false` so'rovlar diskka yoziladi. */
export function shouldPersistQuery(query: { state: { status: string }; meta?: Record<string, unknown> }) {
  return query.state.status === 'success' && query.meta?.persist !== false;
}

/** Chiqishda: xotiradagi va diskdagi keshni tozalaydi (boshqa foydalanuvchiga ko'rinmasin). */
export async function clearQueryCache() {
  queryClient.clear();
  try { await queryPersister?.removeClient(); } catch { /* yo'q */ }
}

// Eski kesh qatlamlari (db.ts getCached/setCached va offline.ts) qoldiqlarini
// bir marta tozalaymiz — endi ular o'qilmaydi va joy egallab turibdi.
const LEGACY_PREFIXES = ['db_cache_', 'tr_habits_', 'tr_logs_', 'tr_streaks_'];
if (hasStorage) {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && LEGACY_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch { /* storage yopiq */ }
}
