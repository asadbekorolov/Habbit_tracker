// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWidgetData, WIDGET_MAX_HABITS } from '../src/utils/widgetData.ts';

const labels = { days: 'kun', empty: "Bugun reja yo'q", stale: 'Ilovani oching' };

test("vidjet ma'lumoti: foiz, bajarilmaganlar oldinda, ko'pi bilan 4 ta", () => {
  const d = buildWidgetData({
    date: '2026-11-17', streak: 12.7, labels,
    habits: [
      { name: 'Erta turish', done: true }, { name: 'Sport', done: false }, { name: 'Kitob', done: true },
      { name: 'Til', done: false }, { name: 'Kundalik', done: true }, { name: 'Oila', done: false }, { name: 'Dastur', done: true },
    ],
  });
  assert.equal(d.done, 4);
  assert.equal(d.total, 7);
  assert.equal(d.pct, 57);
  assert.equal(d.streak, 12);
  assert.equal(d.habits.length, WIDGET_MAX_HABITS);
  assert.deepEqual(d.habits.slice(0, 3).map((h) => h.done), [false, false, false]);
  assert.equal(d.v, 1);
});

test("odat yo'q kun — 0%, bo'sh ro'yxat", () => {
  const d = buildWidgetData({ date: '2026-11-17', streak: 0, labels, habits: [] });
  assert.deepEqual([d.done, d.total, d.pct, d.habits.length], [0, 0, 0, 0]);
});
