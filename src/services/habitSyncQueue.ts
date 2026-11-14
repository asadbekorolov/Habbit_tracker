// Ilovadagi tayyor sinxronizatsiya navbati (yadro: habitSyncQueueCore.ts).
// Bu yerda faqat haqiqiy bog'liqliklar ulanadi: Supabase RPC, toast,
// haptika, localStorage va brauzer hodisalari.

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { setHabitStatus } from './db';
import { getTashkentToday, isTashkentDateOpen } from '../utils/date';
import { HabitSyncQueueCore } from './habitSyncQueueCore';
import { patchDayLog, onHabitSyncSuccess, onHabitSyncRejected } from './queryClient';

export type { HabitQueueItem, HabitSyncSnapshot, QueueStatus } from './habitSyncQueueCore';
export { applyPendingToLogs } from './habitSyncQueueCore';

const hasWindow = typeof window !== 'undefined';

export const habitSyncQueue = new HabitSyncQueueCore({
  send: (habitId, status, value, date) => setHabitStatus(habitId, status, value, date),
  today: () => getTashkentToday(),
  storage: hasWindow ? window.localStorage : null,
  isOnline: () => !hasWindow || window.navigator.onLine !== false,
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  notify: (kind, message) => {
    if (kind === 'error') toast.error(message);
    else if (kind === 'warning') toast.warning(message);
    else toast.success(message);
  },
  emit: (event, detail) => {
    // Avval React Query keshi (yagona manba), keyin boshqa tinglovchilar.
    try {
      if (event === 'habit-sync-success') onHabitSyncSuccess(detail as any);
      else onHabitSyncRejected(detail as any);
    } catch { /* kesh xatosi navbatni to'xtatmasin */ }
    if (hasWindow) window.dispatchEvent(new CustomEvent(event, { detail }));
  },
  // Har bosish darhol kunlik loglar keshiga yoziladi (optimistik).
  onEnqueue: (it) => patchDayLog(it.userId, it.date, it.habitId, it.status, it.value),
  haptic: () => {
    if (!Capacitor.isNativePlatform()) return;
    try { Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); } catch { /* yo'q */ }
  },
});

// Internet tiklanganda va ilova oldinga chiqqanda navbatni yuborish.
// (Mobil "resume" hodisasi useMobileLifecycle orqali ham chaqiriladi.)
if (hasWindow) {
  window.addEventListener('online', () => habitSyncQueue.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') habitSyncQueue.flush();
  });
}

// Eski oflayn oqim (offline.ts, 'tr_pending_<uid>') qoldirgan yuborilmagan
// belgilarni bir marta navbatga ko'chiramiz. Yopilgan kunlarniki tashlanadi —
// server baribir date_locked bilan rad etadi.
export function migrateLegacyPendingLogs(userId: string) {
  if (!hasWindow) return;
  const key = 'tr_pending_' + userId;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    window.localStorage.removeItem(key);
    const items = JSON.parse(raw) as { habitId: string; date: string; completed: boolean; value: number }[];
    for (const p of Array.isArray(items) ? items : []) {
      if (!p?.habitId || !p?.date || !isTashkentDateOpen(p.date)) continue;
      habitSyncQueue.enqueue({ habitId: p.habitId, userId, date: p.date, completed: !!p.completed, value: Number(p.value) || (p.completed ? 1 : 0) });
    }
  } catch { /* buzilgan yozuv — e'tiborsiz */ }
}
