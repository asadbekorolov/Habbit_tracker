// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMeasurable, progressPct, valueStep, longestStreak, buildMonthCalendar, monthResult,
} from '../src/utils/habitMetrics.ts';

test("o'lchanadigan odat va progress", () => {
  assert.equal(isMeasurable({ target_value: 1, unit: '' }), false);
  assert.equal(isMeasurable({ target_value: 120, unit: 'daqiqa' }), true);
  assert.equal(isMeasurable({ target_value: 1, unit: 'bet' }), true);
  assert.equal(progressPct(45, 120), 38);
  assert.equal(progressPct(200, 120), 100);
  assert.equal(valueStep(120), 5);
  assert.equal(valueStep(8), 1);
});

test('rekord zanjir: muzlatilgan kun uzmaydi, lekin o\'zi zanjir emas', () => {
  assert.equal(longestStreak(['2026-11-01', '2026-11-02', '2026-11-04']), 2);
  assert.equal(longestStreak(['2026-11-01', '2026-11-02', '2026-11-04'], ['2026-11-03']), 4);
  assert.equal(longestStreak([], ['2026-11-03']), 0);
});

test('oy kalendari dushanbadan boshlanadi, holatlar to\'g\'ri', () => {
  // 2026-11-01 — yakshanba: oldida 6 ta bo'sh katak
  const cells = buildMonthCalendar(2026, 11, '2026-11-16',
    new Set(['2026-11-02']), new Set(['2026-11-03']), new Set(['2026-11-04']));
  assert.equal(cells.filter((c) => c === null).length, 6);
  const byDay = (d: number) => cells.find((c) => c?.day === d)!;
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(byDay(2).status, 'done');
  assert.equal(byDay(3).status, 'fail');
  assert.equal(byDay(4).status, 'freeze');
  assert.equal(byDay(5).status, 'empty');
  assert.equal(byDay(16).isToday, true);
  assert.equal(byDay(17).status, 'future');
});

test('oylik natija: yaratilgan kundan bugungacha, muzlatilgan kun hisobga olinmaydi', () => {
  const r = monthResult(2026, 11, '2026-11-10', '2026-11-05',
    new Set(['2026-11-05', '2026-11-06', '2026-11-08']), new Set(['2026-11-07']));
  // 5..10 = 6 kun, 7-muzlatilgan -> 5 ta; bajarilgan 3
  assert.deepEqual(r, { pct: 60, done: 3, eligible: 5 });
  assert.deepEqual(monthResult(2026, 10, '2026-11-10', null, new Set(), new Set()).eligible, 31);
});

test("hafta kunlari: rejalashtirilmagan kun — 'off', foiz va rekordga xalaqit bermaydi", () => {
  // Odat: Du, Ch, Ju. 2026-11-16 — dushanba
  const MWF = [1, 3, 5];
  const cells = buildMonthCalendar(2026, 11, '2026-11-20', new Set(['2026-11-16']), new Set(), new Set(), MWF);
  const byDay = (d: number) => cells.find((c) => c?.day === d)!;
  assert.equal(byDay(16).status, 'done');
  assert.equal(byDay(17).status, 'off');   // seshanba
  assert.equal(byDay(18).status, 'empty'); // chorshanba, bajarilmagan
  // 16..20: rejalashtirilgan kunlar 16, 18, 20 -> 1/3
  assert.deepEqual(monthResult(2026, 11, '2026-11-20', '2026-11-16', new Set(['2026-11-16']), new Set(), MWF), { pct: 33, done: 1, eligible: 3 });
  // Du 16, Ch 18, Ju 20 — oradagi kunlar uzmaydi
  assert.equal(longestStreak(['2026-11-16', '2026-11-18', '2026-11-20'], [], MWF), 3);
  assert.equal(longestStreak(['2026-11-16', '2026-11-18', '2026-11-20']), 1);
});
