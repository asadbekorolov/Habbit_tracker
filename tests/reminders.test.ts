// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listHabitReminders } from '../src/utils/reminders.ts';

test("qurilmadagi odat eslatmalari ro'yxati (noto'g'ri vaqt va boshqa kalitlar o'tkazib yuboriladi)", () => {
  const data: Record<string, string> = {
    reminder_b: '07:30', reminder_a: '21:00', reminder_bad: '25:99', lang: 'uz', notif_u1: '{}',
  };
  const keys = Object.keys(data);
  const storage = { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => data[k] ?? null };
  assert.deepEqual(listHabitReminders(storage), [{ habitId: 'a', time: '21:00' }, { habitId: 'b', time: '07:30' }]);
});
