// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tashkentDayStartMs, lastNightWindow, mergeSleepMinutes, formatHoursMinutes, minutesToHours } from '../src/utils/autoMetrics.ts';

test('Toshkent kun boshi — UTC 19:00 (oldingi kun)', () => {
  assert.equal(new Date(tashkentDayStartMs('2026-11-18')).toISOString(), '2026-11-17T19:00:00.000Z');
});

test("o'tgan tun oynasi: kecha 18:00 — bugun 14:00, hozirdan oshmaydi", () => {
  const w = lastNightWindow('2026-11-18', Date.parse('2026-11-18T10:00:00Z')); // Toshkentda 15:00
  assert.equal(new Date(w.startMs).toISOString(), '2026-11-17T13:00:00.000Z');
  assert.equal(new Date(w.endMs).toISOString(), '2026-11-18T09:00:00.000Z');
  const early = lastNightWindow('2026-11-18', Date.parse('2026-11-18T02:00:00Z')); // 07:00
  assert.equal(early.endMs, Date.parse('2026-11-18T02:00:00Z'));
});

test('uyqu: sessiya + bosqichlar ikki marta sanalmaydi, uyg\'oqlik chiqariladi', () => {
  const w = { startMs: Date.parse('2026-11-17T13:00:00Z'), endMs: Date.parse('2026-11-18T09:00:00Z') };
  const samples = [
    { startDate: '2026-11-17T18:00:00Z', endDate: '2026-11-18T01:00:00Z' }, // sessiya (bosqichsiz)
    { startDate: '2026-11-17T18:00:00Z', endDate: '2026-11-17T21:00:00Z', sleepState: 'light' },
    { startDate: '2026-11-17T21:00:00Z', endDate: '2026-11-17T21:20:00Z', sleepState: 'awake' },
    { startDate: '2026-11-17T21:20:00Z', endDate: '2026-11-18T00:30:00Z', sleepState: 'deep' },
    { startDate: '2026-11-17T23:00:00Z', endDate: '2026-11-18T01:00:00Z', sleepState: 'rem' },
  ];
  // 3s + (21:20 -> 01:00 = 3s 40d) = 6s 40d
  assert.equal(mergeSleepMinutes(samples, w), 400);
  // Faqat sessiya — 7 soat
  assert.equal(mergeSleepMinutes([samples[0]], w), 420);
  // Oynadan tashqari qism kesiladi
  assert.equal(mergeSleepMinutes([{ startDate: '2026-11-17T11:00:00Z', endDate: '2026-11-17T14:00:00Z' }], w), 60);
});

test('format: "6s 10d" (font-mono kartada)', () => {
  assert.equal(formatHoursMinutes(370), '6s 10d');
  assert.equal(formatHoursMinutes(285), '4s 45d');
  assert.equal(formatHoursMinutes(285, 'ru'), '4ч 45м');
  assert.equal(formatHoursMinutes(59, 'en'), '0h 59m');
  assert.equal(minutesToHours(285), 4.75);
});
