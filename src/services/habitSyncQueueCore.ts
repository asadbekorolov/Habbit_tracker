// ─── Odat sinxronizatsiya navbati — YADRO ─────────────────────────────────
// Tashqi bog'liqliklarsiz (Capacitor, Supabase, toast yo'q) — hammasi
// konstruktor orqali beriladi, shuning uchun alohida unit-test qilinadi.
// Ilovadagi tayyor nusxa: habitSyncQueue.ts.
//
// Asosiy qoidalar:
//   * Kalit = user + odat + sana. Bitta kalit uchun navbatda faqat ENG SO'NGGI
//     holat turadi (status mutlaq: done / fail / neutral). Server RPC'si
//     (toggle_habit_atomic) idempotent — bir xil holatni ikki marta yuborish
//     zararsiz, shuning uchun tablar o'rtasida qulf kerak emas.
//   * Har bir bosish seq'ni oshiradi. Yuborilgan versiya tugagach element faqat
//     seq o'zgarmagan bo'lsa o'chiriladi — so'rov paytidagi yangi bosish
//     yo'qolmaydi, darhol qayta yuboriladi.
//   * Sana bosilgan paytda (Toshkent bo'yicha) qo'yiladi va saqlanadi.
//   * Xato turlari: vaqtinchalik (tarmoq/sessiya) -> navbatda qoladi va
//     kechikish bilan qayta uriniladi; doimiy (date_locked, banned, ...) ->
//     o'chiriladi, foydalanuvchiga xabar beriladi, "rejected" hodisasi.

export type QueueStatus = 'done' | 'fail' | 'neutral';

export interface HabitSyncSnapshot {
  doneIds?: Set<string>;
  failedIds?: Set<string>;
  negLoggedIds?: Set<string>;
  negKeptIds?: Set<string>;
  loggedIds?: Set<string>;
  completedIds?: Set<string>;
  logValues?: Record<string, number>;
  streaks?: Record<string, number>;
  value?: number;
  completed?: boolean;
}

/** enqueue() kirishi — mavjud chaqiruvlar bilan mos. */
export interface HabitQueueItem {
  habitId: string;
  userId: string;
  completed: boolean;
  value: number;
  date?: string;
  isDelete?: boolean;
  /** "Bajarilmadi" sababi (054) — holat yuborilgach alohida saqlanadi */
  reason?: string;
  /** Eski maydonlar — endi ishlatilmaydi (hammasini server hal qiladi). */
  prevCompleted?: boolean;
  isNegative?: boolean;
  snapshot?: HabitSyncSnapshot;
  onRollback?: (snapshot: HabitSyncSnapshot) => void;
  onSuccess?: () => void;
}

/** Saqlanadigan element (callback'larsiz). */
export interface StoredQueueItem {
  userId: string;
  habitId: string;
  date: string;
  status: QueueStatus;
  value: number;
  reason?: string;
  seq: number;
  attempts: number;
  nextAt: number;
}

export interface SendResult {
  coins?: number;
  score?: number;
  total_xp?: number;
  level?: number;
  reconciliation?: { revokedQuests?: { rewardCoins: number }[] };
}

export type ErrorKind = 'transient' | 'permanent';

export interface QueueDeps {
  send: (habitId: string, status: QueueStatus, value: number, date: string, reason?: string) => Promise<SendResult>;
  today: () => string;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  isOnline: () => boolean;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  notify: (kind: 'success' | 'warning' | 'error', message: string) => void;
  /** Ixtiyoriy tarjima (kalit, o'zbekcha zaxira matn). Berilmasa — zaxira matn. */
  translate?: (key: string, fallback: string) => string;
  emit: (event: 'habit-sync-rejected' | 'habit-sync-success', detail: unknown) => void;
  haptic?: () => void;
  /** Har bir bosishdan keyin (optimistik kesh yangilanishi uchun). */
  onEnqueue?: (item: StoredQueueItem) => void;
}

const DEBOUNCE_MS = 400;
const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000];
/** Noma'lum (tasniflanmagan) server xatosi shuncha urinishdan keyin doimiy hisoblanadi. */
const MAX_UNKNOWN_ATTEMPTS = 3;
const LEGACY_KEY = 'pending_habit_sync_queue';
export const storageKeyFor = (userId: string) => `habit_sync_queue_v2_${userId}`;

const PERMANENT_MESSAGES: Record<string, string> = {
  date_locked: "Belgi saqlanmadi: bu kun yopilgan (ertasi kuni soat 09:00 gacha ochiq bo'ladi).",
  habit_not_found: "Belgi saqlanmadi: odat topilmadi yoki o'chirilgan.",
  banned: "Belgi saqlanmadi: akkauntingiz bloklangan.",
  invalid_status: "Belgi saqlanmadi: noto'g'ri holat.",
};

/** Xatoni turga ajratadi. HabitSyncError.code yoki xabar matni bo'yicha. */
export function classifyError(err: any, online: boolean): { kind: ErrorKind | 'unknown'; code: string } {
  const code: string = err?.code || '';
  const msg: string = String(err?.message || '').toLowerCase();
  for (const c of Object.keys(PERMANENT_MESSAGES)) {
    if (code === c || msg.includes(c)) return { kind: 'permanent', code: c };
  }
  if (code === 'network' || code === 'auth' || !online ||
      msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') ||
      msg.includes('jwt') || msg.includes('not_authenticated')) {
    return { kind: 'transient', code: code || 'network' };
  }
  return { kind: 'unknown', code: code || 'unknown' };
}

const keyOf = (userId: string, habitId: string, date: string) => `${userId}|${habitId}|${date}`;

/**
 * Serverdan kelgan kunlik loglar ustiga hali yuborilmagan belgilarni qo'yadi —
 * ilova qayta ochilganda (yoki oflaynda) foydalanuvchi bosgan holat yo'qolib
 * ko'rinmasligi uchun.
 */
export function applyPendingToLogs<T extends { habit_id: string; completed: boolean; value?: number | null }>(
  logs: T[],
  pending: Map<string, { status: QueueStatus; value: number }>
): T[] {
  if (pending.size === 0) return logs;
  const out: T[] = [];
  for (const log of logs) {
    const p = pending.get(log.habit_id);
    if (!p) out.push(log);
    else if (p.status !== 'neutral') out.push({ ...log, completed: p.status === 'done', value: p.value });
  }
  const present = new Set(logs.map((l) => l.habit_id));
  for (const [habitId, p] of pending) {
    if (p.status === 'neutral' || present.has(habitId)) continue;
    out.push({ habit_id: habitId, completed: p.status === 'done', value: p.value } as T);
  }
  return out;
}

export class HabitSyncQueueCore {
  private deps: QueueDeps;
  private userId: string | null = null;
  private items = new Map<string, StoredQueueItem>();
  private callbacks = new Map<string, Pick<HabitQueueItem, 'snapshot' | 'onRollback' | 'onSuccess'>>();
  private inflight = new Set<string>();
  private timers = new Map<string, unknown>();
  private seqCounter = 0;
  private listeners = new Set<() => void>();

  private tr(key: string, fallback: string): string {
    return this.deps.translate ? this.deps.translate(key, fallback) : fallback;
  }

  constructor(deps: QueueDeps) {
    this.deps = deps;
  }

  // ── Hayot sikli ────────────────────────────────────────────────────────
  /** Foydalanuvchi sessiyasi tayyor bo'lganda: saqlangan navbatni yuklab, darhol yuboradi. */
  start(userId: string) {
    if (this.userId !== userId) {
      this.stop();
      this.userId = userId;
      this.load();
    }
    this.flush();
  }

  /** Chiqishda: taymerlarni to'xtatadi (saqlangan navbat diskda qoladi). */
  stop() {
    for (const h of this.timers.values()) this.deps.clearTimer(h);
    this.timers.clear();
    this.items.clear();
    this.callbacks.clear();
    this.inflight.clear();
    this.userId = null;
    this.changed();
  }

  /** Muddati kelgan barcha elementlarni yuboradi (online/visibility/resume'da chaqiriladi). */
  flush() {
    if (!this.userId) return;
    for (const key of this.items.keys()) this.schedule(key, 0);
  }

  // ── Kirish ─────────────────────────────────────────────────────────────
  enqueue(item: HabitQueueItem) {
    this.deps.haptic?.();
    if (this.userId && item.userId !== this.userId) {
      // Boshqa foydalanuvchiga tegishli — e'tiborsiz (sessiya almashgan).
      return;
    }
    if (!this.userId) {
      this.userId = item.userId;
      this.load();
    }

    const date = item.date || this.deps.today();
    const status: QueueStatus = item.isDelete ? 'neutral' : item.completed ? 'done' : 'fail';
    const key = keyOf(item.userId, item.habitId, date);

    // Birinchi snapshot saqlanadi: rollback foydalanuvchi bosishidan OLDINGI holatga qaytaradi.
    const prevCb = this.callbacks.get(key);
    this.callbacks.set(key, {
      snapshot: prevCb?.snapshot ?? item.snapshot,
      onRollback: item.onRollback ?? prevCb?.onRollback,
      onSuccess: item.onSuccess ?? prevCb?.onSuccess,
    });

    this.items.set(key, {
      userId: item.userId,
      habitId: item.habitId,
      date,
      status,
      value: Number.isFinite(item.value) ? item.value : 1,
      ...(status === 'fail' && item.reason ? { reason: item.reason } : {}),
      seq: ++this.seqCounter,
      attempts: 0,
      nextAt: 0,
    });
    this.save();
    this.changed();
    const stored = this.items.get(key);
    if (stored) {
      try { this.deps.onEnqueue?.({ ...stored }); } catch { /* kesh xatosi navbatni to'xtatmasin */ }
    }
    this.schedule(key, DEBOUNCE_MS);
  }

  // ── O'qish (UI uchun) ──────────────────────────────────────────────────
  /** Shu sana uchun hali serverga yetmagan holatlar: habitId -> {status, value}. */
  getPendingFor(userId: string, date: string): Map<string, { status: QueueStatus; value: number }> {
    const out = new Map<string, { status: QueueStatus; value: number }>();
    for (const it of this.items.values()) {
      if (it.userId === userId && it.date === date) out.set(it.habitId, { status: it.status, value: it.value });
    }
    return out;
  }

  size(): number {
    return this.items.size;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Ichki ──────────────────────────────────────────────────────────────
  private changed() {
    for (const l of this.listeners) {
      try { l(); } catch { /* listener xatosi navbatni to'xtatmasin */ }
    }
  }

  private schedule(key: string, delayMs: number) {
    const existing = this.timers.get(key);
    if (existing !== undefined) this.deps.clearTimer(existing);
    const it = this.items.get(key);
    if (!it) return;
    const wait = Math.max(delayMs, it.nextAt - this.deps.now());
    const handle = this.deps.setTimer(() => {
      this.timers.delete(key);
      void this.process(key);
    }, wait);
    this.timers.set(key, handle);
  }

  private async process(key: string) {
    const it = this.items.get(key);
    if (!it || !this.userId || it.userId !== this.userId) return;
    if (this.inflight.has(key)) return; // tugagach o'zi qayta rejalashtiradi
    if (!this.deps.isOnline()) return;  // 'online' hodisasida flush()

    const sentSeq = it.seq;
    this.inflight.add(key);
    let result: SendResult | null = null;
    let error: any = null;
    try {
      result = await this.deps.send(it.habitId, it.status, it.value, it.date, it.reason);
    } catch (e) {
      error = e;
    }
    this.inflight.delete(key);

    const current = this.items.get(key);
    // Sessiya almashgan yoki element tashqaridan o'chirilgan
    if (!current) return;
    const newerExists = current.seq !== sentSeq;

    if (!error) {
      if (newerExists) {
        // So'rov paytida yana bosilgan — yangi versiyani darhol yuboramiz.
        this.schedule(key, 0);
        return;
      }
      const cb = this.callbacks.get(key);
      this.items.delete(key);
      this.callbacks.delete(key);
      this.save();
      this.changed();

      const revoked = result?.reconciliation?.revokedQuests || [];
      if (revoked.length > 0) {
        const total = revoked.reduce((a, q) => a + (q.rewardCoins || 0), 0);
        this.deps.notify('warning', this.tr('sync_quest_revoked', 'Vazifa sharti buzildi: {n} tanga qaytarib olindi').replace('{n}', String(total)));
      }
      this.deps.emit('habit-sync-success', { userId: current.userId, habitId: current.habitId, date: current.date, status: current.status, value: current.value, result });
      cb?.onSuccess?.();
      return;
    }

    const { kind, code } = classifyError(error, this.deps.isOnline());
    const permanent = kind === 'permanent' || (kind === 'unknown' && current.attempts + 1 >= MAX_UNKNOWN_ATTEMPTS);

    if (permanent) {
      // date_locked: yangi bosish ham xuddi shu yopiq kunga — u ham rad bo'ladi.
      // Boshqa holatlarda yangi versiya bo'lsa, uni alohida sinab ko'ramiz.
      if (newerExists && code !== 'date_locked') {
        this.schedule(key, 0);
        return;
      }
      const cb = this.callbacks.get(key);
      this.items.delete(key);
      this.callbacks.delete(key);
      this.save();
      this.changed();
      this.deps.notify('error', PERMANENT_MESSAGES[code]
        ? this.tr(`sync_err_${code}`, PERMANENT_MESSAGES[code])
        : this.tr('sync_err_generic', 'Belgi saqlanmadi: {msg}').replace('{msg}', error?.message || this.tr('sync_server_error', 'server xatosi')));
      if (cb?.onRollback && cb.snapshot) {
        try { cb.onRollback(cb.snapshot); } catch { /* UI allaqachon yopilgan bo'lishi mumkin */ }
      }
      this.deps.emit('habit-sync-rejected', { userId: current.userId, habitId: current.habitId, date: current.date, code });
      return;
    }

    // Vaqtinchalik: kechikish bilan qayta urinish
    current.attempts += 1;
    current.nextAt = this.deps.now() + BACKOFF_MS[Math.min(current.attempts - 1, BACKOFF_MS.length - 1)];
    this.save();
    if (newerExists) {
      this.schedule(key, 0);
    } else if (this.deps.isOnline()) {
      this.schedule(key, 0); // nextAt hisobga olinadi
    }
  }

  // ── Saqlash ────────────────────────────────────────────────────────────
  private load() {
    const s = this.deps.storage;
    if (!s || !this.userId) return;
    this.items.clear();
    try {
      const raw = s.getItem(storageKeyFor(this.userId));
      const list: StoredQueueItem[] = raw ? JSON.parse(raw) : [];
      for (const it of list) {
        if (!it || it.userId !== this.userId || !it.habitId || !it.date || !it.status) continue;
        const key = keyOf(it.userId, it.habitId, it.date);
        this.items.set(key, { ...it, seq: ++this.seqCounter, nextAt: 0 });
      }
    } catch { /* buzilgan ma'lumot — e'tiborsiz */ }
    this.migrateLegacy();
    this.changed();
  }

  /** Eski "pending_habit_sync_queue" formatidan bir martalik ko'chirish. */
  private migrateLegacy() {
    const s = this.deps.storage;
    if (!s || !this.userId) return;
    let raw: string | null = null;
    try { raw = s.getItem(LEGACY_KEY); } catch { return; }
    if (!raw) return;
    let legacy: any[] = [];
    try { legacy = JSON.parse(raw) || []; } catch { legacy = []; }
    const rest: any[] = [];
    let moved = 0;
    for (const old of legacy) {
      if (!old || old.userId !== this.userId) { rest.push(old); continue; }
      // Eski elementlarda sana bo'lmasligi mumkin edi — bugungi deb olamiz.
      const date = old.date || this.deps.today();
      const key = keyOf(old.userId, old.habitId, date);
      if (this.items.has(key)) continue; // yangi format ustun
      this.items.set(key, {
        userId: old.userId,
        habitId: old.habitId,
        date,
        status: old.isDelete ? 'neutral' : old.completed ? 'done' : 'fail',
        value: Number.isFinite(old.value) ? old.value : 1,
        seq: ++this.seqCounter,
        attempts: 0,
        nextAt: 0,
      });
      moved++;
    }
    try {
      if (rest.filter(Boolean).length > 0) s.setItem(LEGACY_KEY, JSON.stringify(rest.filter(Boolean)));
      else s.removeItem(LEGACY_KEY);
    } catch { /* storage to'la */ }
    if (moved > 0) this.save();
  }

  private save() {
    const s = this.deps.storage;
    if (!s || !this.userId) return;
    try {
      const list = Array.from(this.items.values()).filter((i) => i.userId === this.userId);
      if (list.length === 0) s.removeItem(storageKeyFor(this.userId));
      else s.setItem(storageKeyFor(this.userId), JSON.stringify(list));
    } catch { /* storage to'la — navbat xotirada ishlashda davom etadi */ }
  }
}
