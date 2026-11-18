// Ishga tushirish: npm test   (Node 22.6+ — TypeScript turlarini o'zi olib tashlaydi)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HabitSyncQueueCore,
  applyPendingToLogs,
  storageKeyFor,
  type QueueDeps,
  type QueueStatus,
} from '../src/services/habitSyncQueueCore.ts';

const U = 'user-1';
const H = 'habit-1';

// ── Soxta muhit: boshqariladigan soat, taymerlar, storage va server ─────────
function makeEnv(opts: { online?: boolean; today?: string; storage?: Map<string, string> } = {}) {
  let clock = 1_000_000;
  let online = opts.online ?? true;
  let today = opts.today ?? '2026-11-12';
  const store = opts.storage ?? new Map<string, string>();
  const timers: { id: number; at: number; fn: () => void }[] = [];
  let nextId = 1;
  const sends: { habitId: string; status: QueueStatus; value: number; date: string; reason?: string }[] = [];
  const pendingReplies: { resolve: (v: any) => void; reject: (e: any) => void }[] = [];
  const notices: { kind: string; message: string }[] = [];
  const events: { event: string; detail: any }[] = [];
  let autoReply: ((call: { status: QueueStatus }) => Promise<any>) | null = async () => ({ coins: 10, score: 1, total_xp: 5, level: 1 });

  const deps: QueueDeps = {
    send: (habitId, status, value, date, reason) => {
      sends.push({ habitId, status, value, date, ...(reason ? { reason } : {}) });
      if (autoReply) return autoReply({ status });
      return new Promise((resolve, reject) => pendingReplies.push({ resolve, reject }));
    },
    today: () => today,
    storage: {
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
    },
    isOnline: () => online,
    now: () => clock,
    setTimer: (fn, ms) => { const id = nextId++; timers.push({ id, at: clock + ms, fn }); return id; },
    clearTimer: (h) => { const i = timers.findIndex((t) => t.id === h); if (i >= 0) timers.splice(i, 1); },
    notify: (kind, message) => notices.push({ kind, message }),
    emit: (event, detail) => events.push({ event, detail }),
  };

  // Vaqtni oldinga surib, muddati kelgan taymerlarni bajaradi (va promise'larni kutadi).
  async function advance(ms: number) {
    const target = clock + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > target) break;
      timers.shift();
      clock = t.at;
      t.fn();
      await flushMicrotasks();
    }
    clock = target;
    await flushMicrotasks();
  }

  return {
    deps, store, sends, notices, events, pendingReplies, advance,
    setOnline: (v: boolean) => { online = v; },
    setToday: (d: string) => { today = d; },
    manualReplies: () => { autoReply = null; },
    setAutoReply: (fn: (call: { status: QueueStatus }) => Promise<any>) => { autoReply = fn; },
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// ── Testlar ────────────────────────────────────────────────────────────────

test('debounce: tez-tez bosishlardan faqat oxirgi holat yuboriladi', async () => {
  const env = makeEnv();
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  q.enqueue({ userId: U, habitId: H, completed: false, value: 0, isDelete: true });
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  await env.advance(500);
  assert.deepEqual(env.sends.map((s) => s.status), ['done']);
  assert.equal(q.size(), 0);
});

test("poyga holati: so'rov paytidagi yangi bosish yo'qolmaydi", async () => {
  const env = makeEnv();
  env.manualReplies();
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  await env.advance(500);                 // 1-so'rov ketdi (javob kutilmoqda)
  assert.equal(env.sends.length, 1);
  q.enqueue({ userId: U, habitId: H, completed: false, value: 0, isDelete: true }); // so'rov paytida qayta bosildi
  env.pendingReplies.shift()!.resolve({ coins: 1 });
  await env.advance(0);
  assert.equal(q.size(), 1, "yangi versiya navbatda qolishi kerak");
  await env.advance(500);
  assert.deepEqual(env.sends.map((s) => s.status), ['done', 'neutral']);
  env.pendingReplies.shift()!.resolve({ coins: 0 });
  await env.advance(0);
  assert.equal(q.size(), 0);
});

test('sana bosilgan paytda qo\'yiladi (kechagi oflayn belgi bugunga tushmaydi)', async () => {
  const env = makeEnv({ online: false, today: '2026-11-12' });
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  await env.advance(1000);
  assert.equal(env.sends.length, 0, 'oflaynda yuborilmaydi');
  env.setToday('2026-11-13');
  env.setOnline(true);
  q.flush();
  await env.advance(0);
  assert.equal(env.sends[0].date, '2026-11-12');
});

test("ilova qayta ochilganda saqlangan navbat darhol yuboriladi", async () => {
  const storage = new Map<string, string>();
  const env1 = makeEnv({ online: false, storage });
  const q1 = new HabitSyncQueueCore(env1.deps);
  q1.start(U);
  q1.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  await env1.advance(1000);
  assert.ok(storage.has(storageKeyFor(U)), 'v2 kalit bilan saqlanadi');

  const env2 = makeEnv({ online: true, storage });   // "ilova qayta ochildi"
  const q2 = new HabitSyncQueueCore(env2.deps);
  q2.start(U);
  await env2.advance(0);
  assert.equal(env2.sends.length, 1);
  assert.equal(env2.sends[0].status, 'done');
  assert.equal(q2.size(), 0);
  assert.ok(!storage.has(storageKeyFor(U)), "yuborilgach saqlangan navbat tozalanadi");
});

test('eski formatdan bir martalik ko\'chirish (faqat shu foydalanuvchi)', async () => {
  const storage = new Map<string, string>();
  storage.set('pending_habit_sync_queue', JSON.stringify([
    { userId: U, habitId: 'h-a', completed: true, value: 1, date: '2026-11-12' },
    { userId: U, habitId: 'h-b', completed: false, value: 0, isDelete: true },
    { userId: 'other', habitId: 'h-x', completed: true, value: 1 },
  ]));
  const env = makeEnv({ storage, online: false });
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  assert.equal(q.size(), 2);
  const pending = q.getPendingFor(U, '2026-11-12');
  assert.equal(pending.get('h-a')?.status, 'done');
  assert.equal(pending.get('h-b')?.status, 'neutral');
  const legacy = JSON.parse(storage.get('pending_habit_sync_queue')!);
  assert.deepEqual(legacy.map((l: any) => l.userId), ['other'], "boshqa foydalanuvchi elementi tegilmaydi");
});

test("date_locked: o'chiriladi, xabar, rollback va rejected hodisasi", async () => {
  const env = makeEnv();
  env.setAutoReply(async () => { throw Object.assign(new Error('closed'), { code: 'date_locked' }); });
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  let rolledBack: any = null;
  q.enqueue({
    userId: U, habitId: H, completed: true, value: 1,
    snapshot: { completed: false },
    onRollback: (s) => { rolledBack = s; },
  });
  await env.advance(500);
  assert.equal(q.size(), 0);
  assert.deepEqual(rolledBack, { completed: false });
  assert.equal(env.notices.at(-1)?.kind, 'error');
  assert.match(env.notices.at(-1)!.message, /yopilgan/);
  const ev = env.events.find((e) => e.event === 'habit-sync-rejected');
  assert.equal(ev?.detail.code, 'date_locked');
  assert.equal(env.sends.length, 1, 'doimiy xatoda qayta urinilmaydi');
});

test('tarmoq xatosi: navbatda qoladi va kechikish bilan qayta uriniladi', async () => {
  const env = makeEnv();
  let calls = 0;
  env.setAutoReply(async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('Failed to fetch'), { code: 'network' });
    return { coins: 3 };
  });
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  await env.advance(500);
  assert.equal(q.size(), 1, 'birinchi urinish xato — navbatda');
  await env.advance(1000);
  assert.equal(calls, 1, 'backoff tugamaguncha kutadi');
  await env.advance(2000);
  assert.equal(calls, 2);
  assert.equal(q.size(), 0);
  assert.equal(env.notices.filter((n) => n.kind === 'error').length, 0);
});

test("noma'lum server xatosi 3 urinishdan keyin doimiy hisoblanadi", async () => {
  const env = makeEnv();
  env.setAutoReply(async () => { throw new Error('boom'); });
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1 });
  await env.advance(500 + 2000 + 5000 + 100);
  assert.equal(env.sends.length, 3);
  assert.equal(q.size(), 0);
  assert.ok(env.events.some((e) => e.event === 'habit-sync-rejected'));
});

test('muvaffaqiyat: server natijasi habit-sync-success hodisasida keladi', async () => {
  const env = makeEnv();
  env.setAutoReply(async () => ({ coins: 42, score: 7, total_xp: 300, level: 2, reconciliation: { revokedQuests: [{ rewardCoins: 5 }] } }));
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: false, value: 0, isDelete: true });
  await env.advance(500);
  const ev = env.events.find((e) => e.event === 'habit-sync-success');
  assert.equal(ev?.detail.result.coins, 42);
  assert.equal(ev?.detail.result.level, 2);
  assert.ok(env.notices.some((n) => n.kind === 'warning' && /5 tanga/.test(n.message)));
});

test('boshqa foydalanuvchi elementi (sessiya almashgan) yuborilmaydi', async () => {
  const env = makeEnv();
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: 'someone-else', habitId: H, completed: true, value: 1 });
  await env.advance(1000);
  assert.equal(env.sends.length, 0);
});

test('applyPendingToLogs: navbatdagi holatlar server loglari ustiga qo\'yiladi', () => {
  const logs = [
    { habit_id: 'a', completed: false, value: 0 },
    { habit_id: 'b', completed: true, value: 1 },
  ];
  const pending = new Map<string, { status: QueueStatus; value: number }>([
    ['a', { status: 'done', value: 1 }],
    ['b', { status: 'neutral', value: 1 }],
    ['c', { status: 'fail', value: 0 }],
  ]);
  const out = applyPendingToLogs(logs, pending);
  assert.deepEqual(
    out.map((l) => [l.habit_id, l.completed]).sort(),
    [['a', true], ['c', false]],
  );
});

test("'bajarilmadi' sababi holat bilan birga yuboriladi; boshqa holatda tashlanadi", async () => {
  const env = makeEnv();
  const q = new HabitSyncQueueCore(env.deps);
  q.start(U);
  q.enqueue({ userId: U, habitId: H, completed: false, value: 0, reason: 'Kech uxladim' });
  await env.advance(500);
  assert.equal(env.sends[0].status, 'fail');
  assert.equal(env.sends[0].reason, 'Kech uxladim');
  // Keyin bajarildi — sabab yuborilmaydi
  q.enqueue({ userId: U, habitId: H, completed: true, value: 1, reason: 'eski' });
  await env.advance(500);
  assert.equal(env.sends[1].status, 'done');
  assert.equal(env.sends[1].reason, undefined);
});
