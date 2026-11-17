// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayElapsed, habitDots } from '../src/utils/lifeDots.ts';

test("kun jarayoni Toshkent vaqti bo'yicha", () => {
  // 07:30Z = Toshkentda 12:30
  assert.deepEqual(dayElapsed(new Date('2026-11-16T07:30:00Z')), { hoursPassed: 12, currentHour: 12, pct: 52 });
  // 19:00Z = Toshkentda 00:00 (yangi kun)
  assert.deepEqual(dayElapsed(new Date('2026-11-16T19:00:00Z')), { hoursPassed: 0, currentHour: 0, pct: 0 });
  assert.equal(dayElapsed(new Date('2026-11-16T18:59:00Z')).pct, 99);
});

test('odat nuqtalari: bajarilganlar oldinda, chegaradan chiqmaydi', () => {
  assert.deepEqual(habitDots(2, 4), [true, true, false, false]);
  assert.deepEqual(habitDots(9, 2), [true, true]);
  assert.deepEqual(habitDots(0, 0), []);
});
