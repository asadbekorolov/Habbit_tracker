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

// ── Aqlli zanjir: hafta kunlari ────────────────────────────────────────────
// 2026-11-16 — dushanba. Odat: Du(1), Ch(3), Ju(5).
import { isScheduledOn } from '../src/utils/streaks.ts';
const MWF = { a: [1, 3, 5] };

test('aqlli zanjir: oradagi rejalashtirilmagan kunlar (Se, Pa, Sh, Ya) zanjirni uzmaydi', () => {
  // Du 9, Ch 11, Ju 13, Du 16 (bugun)
  const r = computeStreaks({
    history: [log('a', '2026-11-09'), log('a', '2026-11-11'), log('a', '2026-11-13')],
    completedToday: ['a'], today: '2026-11-16', schedules: MWF,
  });
  assert.equal(r.a, 4);
  // Jadvalsiz bo'lsa — o'sha bo'shliqlar zanjirni uzardi
  const plain = computeStreaks({
    history: [log('a', '2026-11-09'), log('a', '2026-11-11'), log('a', '2026-11-13')],
    completedToday: ['a'], today: '2026-11-16',
  });
  assert.equal(plain.a, 1);
});

test("aqlli zanjir: rejalashtirilgan kun o'tkazib yuborilsa — uziladi", () => {
  // Ch 11 o'tkazib yuborilgan
  const r = computeStreaks({
    history: [log('a', '2026-11-09'), log('a', '2026-11-13')],
    completedToday: ['a'], today: '2026-11-16', schedules: MWF,
  });
  assert.equal(r.a, 2);
});

test("aqlli zanjir: bugun rejada yo'q bo'lsa ham zanjir saqlanadi; dam kunidagi bajarilish sanaladi", () => {
  // Bugun — seshanba 17 (rejada yo'q). Du 16, Ju 13 bajarilgan, Ya 15 (dam kuni) ham bajarilgan
  const r = computeStreaks({
    history: [log('a', '2026-11-13'), log('a', '2026-11-15'), log('a', '2026-11-16')],
    completedToday: [], today: '2026-11-17', schedules: MWF,
  });
  assert.equal(r.a, 3);
  assert.equal(isScheduledOn([1, 3, 5], '2026-11-17'), false);
  assert.equal(isScheduledOn([1, 3, 5], '2026-11-18'), true);
  assert.equal(isScheduledOn(undefined, '2026-11-17'), true);
});
