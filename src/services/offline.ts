export interface PendingLog {
  habitId: string;
  userId: string;
  date: string;
  completed: boolean;
  value: number;
  prevCompleted: boolean;
  isNegative: boolean;
  ts: number;
}

export function cacheHabits(userId: string, habits: any[]): void {
  try { localStorage.setItem(`tr_habits_${userId}`, JSON.stringify(habits)); } catch {}
}

export function getCachedHabits(userId: string): any[] | null {
  try {
    const raw = localStorage.getItem(`tr_habits_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function cacheLogs(userId: string, date: string, logs: any[]): void {
  try { localStorage.setItem(`tr_logs_${userId}_${date}`, JSON.stringify(logs)); } catch {}
}

export function getCachedLogs(userId: string, date: string): any[] | null {
  try {
    const raw = localStorage.getItem(`tr_logs_${userId}_${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function cacheStreaks(userId: string, streaks: Record<string, number>): void {
  try { localStorage.setItem(`tr_streaks_${userId}`, JSON.stringify(streaks)); } catch {}
}

export function getCachedStreaks(userId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`tr_streaks_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function addPendingLog(userId: string, log: Omit<PendingLog, 'ts'>): void {
  try {
    const key = `tr_pending_${userId}`;
    const pending: PendingLog[] = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = pending.filter(p => !(p.habitId === log.habitId && p.date === log.date));
    filtered.push({ ...log, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {}
}

export function getPendingLogs(userId: string): PendingLog[] {
  try { return JSON.parse(localStorage.getItem(`tr_pending_${userId}`) || '[]'); } catch { return []; }
}

export function clearPendingLogs(userId: string): void {
  try { localStorage.removeItem(`tr_pending_${userId}`); } catch {}
}

// Faqat muvaffaqiyatli sinxronlangan yozuvlarni olib tashlab, muvaffaqiyatsiz
// bo'lganlarini keyingi urinish uchun saqlab qoladi — aks holda tarmoq
// vaqtincha uzilib, bitta yozuv sinxronlanmasa, u butunlay yo'qolib ketardi.
export function savePendingLogs(userId: string, logs: PendingLog[]): void {
  try {
    const key = `tr_pending_${userId}`;
    if (logs.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(logs));
  } catch {}
}
