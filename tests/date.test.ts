// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTashkentToday,
  getTashkentHour,
  addDays,
  diffDays,
  isTashkentDateOpen,
  tashkentTodayAnchor,
  toDateStr,
} from '../src/utils/date.ts';

test('getTashkentToday: UTC 19:00 dan keyin Toshkentda ertangi kun', () => {
  assert.equal(getTashkentToday(new Date('2026-11-12T18:59:59Z')), '2026-11-12');
  assert.equal(getTashkentToday(new Date('2026-11-12T19:00:00Z')), '2026-11-13');
});

test('getTashkentHour', () => {
  assert.equal(getTashkentHour(new Date('2026-11-12T00:00:00Z')), 5);
  assert.equal(getTashkentHour(new Date('2026-11-12T20:30:00Z')), 1);
});

test('addDays: oy, yil va kabisa yili chegaralari', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-11-01', '2026-11-30'), 29);
});

test('isTashkentDateOpen: bugun ochiq, kecha 09:00 gacha, keyin yopiq', () => {
  // Toshkent: 13-noyabr 08:59 -> kecha (12) hali ochiq
  const before9 = new Date('2026-11-13T03:59:00Z');
  assert.equal(isTashkentDateOpen('2026-11-13', before9), true);
  assert.equal(isTashkentDateOpen('2026-11-12', before9), true);
  assert.equal(isTashkentDateOpen('2026-11-11', before9), false);
  // Toshkent: 13-noyabr 09:00 -> kecha yopiq
  const at9 = new Date('2026-11-13T04:00:00Z');
  assert.equal(isTashkentDateOpen('2026-11-12', at9), false);
  assert.equal(isTashkentDateOpen('2026-11-14', at9), false, 'kelajak yopiq');
});

test("tashkentTodayAnchor: qurilmadagi kalendar sanasi Toshkentdagi bugunga teng", () => {
  const now = new Date('2026-11-12T20:00:00Z'); // Toshkent: 13-noyabr 01:00
  const anchor = tashkentTodayAnchor(now);
  assert.equal(toDateStr(anchor), '2026-11-13');
  const d = new Date(anchor);
  d.setDate(d.getDate() - 1);
  assert.equal(toDateStr(d), '2026-11-12');
});

test('toDateStr() argumentsiz = Toshkent bugun', () => {
  assert.equal(toDateStr(), getTashkentToday());
});
