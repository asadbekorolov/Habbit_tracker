// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCompletionTimes, toTashkentClock, dayPartOf } from '../src/utils/habitTiming.ts';

// Toshkent = UTC+5: 02:30Z -> 07:30
const row = (log_date: string, at: string | null) => ({ log_date, at });

test("Toshkent soati va kun qismlari", () => {
  assert.deepEqual(toTashkentClock('2026-11-16T02:30:00Z'), { date: '2026-11-16', minute: 450 });
  assert.deepEqual(toTashkentClock('2026-11-16T20:10:00Z'), { date: '2026-11-17', minute: 70 });
  assert.equal(dayPartOf(7 * 60), 'morning');
  assert.equal(dayPartOf(13 * 60), 'afternoon');
  assert.equal(dayPartOf(23 * 60), 'evening');
  assert.equal(dayPartOf(2 * 60), 'evening');
});

test('eng faol oraliq, odatiy vaqt, eng barqaror kunlar', () => {
  const r = analyzeCompletionTimes([
    row('2026-11-16', '2026-11-16T02:20:00Z'), // Du 07:20
    row('2026-11-17', '2026-11-17T02:40:00Z'), // Se 07:40
    row('2026-11-18', '2026-11-18T02:30:00Z'), // Ch 07:30
    row('2026-11-23', '2026-11-23T03:10:00Z'), // Du 08:10
    row('2026-11-19', '2026-11-19T14:00:00Z'), // Pa 19:00
  ]);
  assert.equal(r.total, 5);
  assert.equal(r.timed, 5);
  assert.equal(r.peakWindow, '07:00 – 08:30');
  assert.equal(r.typicalTime, '07:40');
  assert.deepEqual(r.dayParts, { morning: 80, afternoon: 0, evening: 20 });
  assert.deepEqual(r.bestWeekdays, [1]);
});

test("kam ma'lumot — vaqt tahlili yo'q; ertasi kuni belgilangan yozuv vaqtga kirmaydi", () => {
  const r = analyzeCompletionTimes([
    row('2026-11-16', '2026-11-16T02:00:00Z'),
    row('2026-11-17', '2026-11-18T03:00:00Z'), // kechagi kun uchun ertalab belgilangan
    row('2026-11-18', null),
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.timed, 1);
  assert.equal(r.peakWindow, null);
  assert.equal(r.typicalTime, null);
  assert.equal(analyzeCompletionTimes([]).bestWeekdays.length, 0);
});
