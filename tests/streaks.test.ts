// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks } from '../src/utils/streaks.ts';

const T = '2026-11-14';
const log = (habit_id: string, log_date: string, completed = true) => ({ habit_id, log_date, completed });

test("bugun bajarilgan: bugundan orqaga sanaladi", () => {
  const r = computeStreaks({ history: [log('a', '2026-11-13'), log('a', '2026-11-12')], completedToday: ['a'], today: T });
  assert.equal(r.a, 3);
});

test("bugun hali bajarilmagan: kechadan sanaladi (zanjir uzilmagan)", () => {
  const r = computeStreaks({ history: [log('a', '2026-11-13'), log('a', '2026-11-12')], completedToday: [], today: T });
  assert.equal(r.a, 2);
});

test("bo'shliq zanjirni uzadi; bajarilmagan (completed=false) sanalmaydi", () => {
  const r = computeStreaks({
    history: [log('a', '2026-11-13'), log('a', '2026-11-11'), log('b', '2026-11-13', false)],
    completedToday: [], today: T,
  });
  assert.equal(r.a, 1);
  assert.equal(r.b, undefined, "zanjirsiz odat — 0 (kalit yo'q)");
});

test("muzlatilgan kun zanjirni ushlab turadi", () => {
  const r = computeStreaks({
    history: [log('a', '2026-11-13'), log('a', '2026-11-11')],
    completedToday: [], today: T, freezeDates: ['2026-11-12'],
  });
  assert.equal(r.a, 3);
});

test("oy chegarasidan o'tadi va maxDays bilan cheklanadi", () => {
  const history = Array.from({ length: 40 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 14 - i - 1));
    return log('a', d.toISOString().slice(0, 10));
  });
  assert.equal(computeStreaks({ history, completedToday: ['a'], today: T }).a, 31);
  assert.equal(computeStreaks({ history, completedToday: [], today: '2026-12-01', maxDays: 60 }).a, undefined);
});
