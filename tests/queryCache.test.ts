// Ishga tushirish: npm test
// Yagona kesh (React Query) yordamchilari va sahifalab yuklash.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  queryClient,
  queryKeys,
  patchDayLog,
  onHabitSyncSuccess,
  onHabitSyncRejected,
  shouldPersistQuery,
} from '../src/services/queryClient.ts';
import { fetchAllPages } from '../src/utils/pagination.ts';
import { HabitSyncQueueCore, type QueueDeps } from '../src/services/habitSyncQueueCore.ts';

const U = 'u1';
const D = '2026-11-14';

beforeEach(() => queryClient.clear());

const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated === true;

// ── Sahifalab yuklash ───────────────────────────────────────────────────────

function fakeTable(total: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const rows = [];
    for (let i = from; i <= Math.min(to, total - 1); i++) rows.push({ i });
    return { data: rows, error: null };
  };
  return { calls, page };
}

test('fetchAllPages: 2500 qator — 3 ta bo\'lak, hech narsa kesilmaydi', async () => {
  const t = fakeTable(2500);
  const rows = await fetchAllPages(t.page);
  assert.equal(rows.length, 2500);
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.equal((rows[2499] as any).i, 2499);
});

test('fetchAllPages: aynan 1000 qator — bo\'sh sahifa bilan to\'xtaydi', async () => {
  const t = fakeTable(1000);
  const rows = await fetchAllPages(t.page);
  assert.equal(rows.length, 1000);
  assert.equal(t.calls.length, 2);
});

test('fetchAllPages: xato yuqoriga uzatiladi', async () => {
  await assert.rejects(
    fetchAllPages(async () => ({ data: null, error: new Error('boom') })),
    /boom/
  );
});

// ── Kalitlar ────────────────────────────────────────────────────────────────

test("queryKeys: ['logs', uid] kunlik va oraliq loglarni qamraydi, kunlik kalit oraliqni emas", () => {
  queryClient.setQueryData(queryKeys.dayLogs(U, D), []);
  queryClient.setQueryData(queryKeys.logsRange(U, '2026-11-01', D), []);
  queryClient.setQueryData(queryKeys.dayLogs('boshqa', D), []);

  queryClient.invalidateQueries({ queryKey: queryKeys.dayLogs(U, D) });
  assert.equal(invalidated(queryKeys.dayLogs(U, D)), true);
  assert.equal(invalidated(queryKeys.logsRange(U, '2026-11-01', D)), false);

  queryClient.invalidateQueries({ queryKey: queryKeys.logs(U) });
  assert.equal(invalidated(queryKeys.logsRange(U, '2026-11-01', D)), true);
  assert.equal(invalidated(queryKeys.dayLogs('boshqa', D)), false, 'boshqa foydalanuvchiga tegmaydi');
});

// ── Optimistik yangilash ────────────────────────────────────────────────────

test('patchDayLog: yuklanmagan kesh yaratilmaydi', () => {
  patchDayLog(U, D, 'h1', 'done', 1);
  assert.equal(queryClient.getQueryData(queryKeys.dayLogs(U, D)), undefined);
});

test("patchDayLog: done qo'shadi, fail yangilaydi, neutral o'chiradi", () => {
  queryClient.setQueryData(queryKeys.dayLogs(U, D), [
    { habit_id: 'h1', completed: false, value: 0, id: 'row-1', log_date: D },
  ]);

  patchDayLog(U, D, 'h2', 'done', 1);
  let rows = queryClient.getQueryData<any[]>(queryKeys.dayLogs(U, D))!;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { habit_id: 'h2', user_id: U, log_date: D, completed: true, value: 1 });

  patchDayLog(U, D, 'h1', 'done', 3);
  rows = queryClient.getQueryData<any[]>(queryKeys.dayLogs(U, D))!;
  assert.equal(rows[0].completed, true);
  assert.equal(rows[0].value, 3);
  assert.equal(rows[0].id, 'row-1', 'boshqa maydonlar saqlanadi');

  patchDayLog(U, D, 'h1', 'neutral', 0);
  rows = queryClient.getQueryData<any[]>(queryKeys.dayLogs(U, D))!;
  assert.deepEqual(rows.map((r) => r.habit_id), ['h2']);
});

// ── Server javoblari ────────────────────────────────────────────────────────

test("onHabitSyncSuccess: tasdiqlangan holat yoziladi, loglar va reyting yangilanadi, odatlar emas", () => {
  queryClient.setQueryData(queryKeys.dayLogs(U, D), []);
  queryClient.setQueryData(queryKeys.logsRange(U, '2026-10-15', D), []);
  queryClient.setQueryData(queryKeys.leaderboard('daily'), []);
  queryClient.setQueryData(queryKeys.habits(U), []);

  onHabitSyncSuccess({ userId: U, habitId: 'h1', date: D, status: 'done', value: 1 });

  const rows = queryClient.getQueryData<any[]>(queryKeys.dayLogs(U, D))!;
  assert.equal(rows[0].completed, true);
  assert.equal(invalidated(queryKeys.dayLogs(U, D)), true);
  assert.equal(invalidated(queryKeys.logsRange(U, '2026-10-15', D)), true);
  assert.equal(invalidated(queryKeys.leaderboard('daily')), true);
  assert.equal(invalidated(queryKeys.habits(U)), false);
});

test('onHabitSyncRejected (date_locked): shu kun va oraliqlar qayta yuklanadi, odatlar emas', () => {
  queryClient.setQueryData(queryKeys.dayLogs(U, D), [{ habit_id: 'h1', completed: true }]);
  queryClient.setQueryData(queryKeys.dayLogs(U, '2026-11-13'), []);
  queryClient.setQueryData(queryKeys.logsRange(U, '2026-10-15', D), []);
  queryClient.setQueryData(queryKeys.habits(U), []);

  onHabitSyncRejected({ userId: U, habitId: 'h1', date: D, code: 'date_locked' });

  assert.equal(invalidated(queryKeys.dayLogs(U, D)), true);
  assert.equal(invalidated(queryKeys.dayLogs(U, '2026-11-13')), false);
  assert.equal(invalidated(queryKeys.logsRange(U, '2026-10-15', D)), true);
  assert.equal(invalidated(queryKeys.habits(U)), false);
});

test('onHabitSyncRejected (habit_not_found): odatlar ro\'yxati ham yangilanadi', () => {
  queryClient.setQueryData(queryKeys.habits(U), []);
  onHabitSyncRejected({ userId: U, habitId: 'h1', date: D, code: 'habit_not_found' });
  assert.equal(invalidated(queryKeys.habits(U)), true);
});

test('shouldPersistQuery: faqat muvaffaqiyatli va persist=false bo\'lmaganlar', () => {
  assert.equal(shouldPersistQuery({ state: { status: 'success' } }), true);
  assert.equal(shouldPersistQuery({ state: { status: 'success' }, meta: { persist: false } }), false);
  assert.equal(shouldPersistQuery({ state: { status: 'error' } }), false);
});

// ── Navbat -> kesh ulanishi ─────────────────────────────────────────────────

test('navbat: har bosishda onEnqueue saqlangan element bilan chaqiriladi', () => {
  const seen: any[] = [];
  const deps: QueueDeps = {
    send: async () => ({}),
    today: () => D,
    storage: null,
    isOnline: () => false,
    now: () => 0,
    setTimer: () => 0,
    clearTimer: () => {},
    notify: () => {},
    emit: () => {},
    onEnqueue: (it) => seen.push(it),
  };
  const q = new HabitSyncQueueCore(deps);
  q.start(U);
  q.enqueue({ habitId: 'h1', userId: U, completed: true, value: 1 });
  q.enqueue({ habitId: 'h1', userId: U, completed: false, value: 0, isDelete: true });
  assert.equal(seen.length, 2);
  assert.deepEqual(
    seen.map((s) => [s.habitId, s.date, s.status, s.value]),
    [['h1', D, 'done', 1], ['h1', D, 'neutral', 0]]
  );
  q.stop();
});
