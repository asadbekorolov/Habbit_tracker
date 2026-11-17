// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDays, detectPreset, toggleDay } from '../src/utils/weekdays.ts';
import { isoWeekdayOf } from '../src/utils/date.ts';

test('hafta kunlari: tartiblash, tayyor tanlovlar, kamida 1 kun', () => {
  assert.deepEqual(normalizeDays([5, 1, 1, 9, 3]), [1, 3, 5]);
  assert.deepEqual(normalizeDays([]), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(normalizeDays(undefined), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(detectPreset([1, 2, 3, 4, 5, 6, 7]), 'every');
  assert.equal(detectPreset([5, 4, 3, 2, 1]), 'work');
  assert.equal(detectPreset([7, 6]), 'weekend');
  assert.equal(detectPreset([1, 3]), 'custom');
  assert.deepEqual(toggleDay([1, 3], 3), [1]);
  assert.deepEqual(toggleDay([1], 1), [1], "oxirgi kunni o'chirib bo'lmaydi");
  assert.deepEqual(toggleDay([1], 7), [1, 7]);
});

test('ISO hafta kuni sanadan (vaqt zonasidan mustaqil)', () => {
  assert.equal(isoWeekdayOf('2026-11-16'), 1); // dushanba
  assert.equal(isoWeekdayOf('2026-11-22'), 7); // yakshanba
});
