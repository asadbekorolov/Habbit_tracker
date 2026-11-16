// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHabitCategory, getHabitDomain } from '../src/utils/habitCategory.ts';

test("Odatlar to'g'ri yo'nalishga tushadi", () => {
  const cases: [string, string][] = [
    ['Erta turish', "Sog'lik"],
    ["Sport bilan shug'ullanish", "Sog'lik"],
    ['Suv ichish', "Sog'lik"],
    ["Oila bilan vaqt o'tkazish", 'Ruhiyat'],
    ["O'ziga qarash", 'Ruhiyat'],
    ['Kundalik yozish', 'Ruhiyat'],
    ['Dasturlash bilan shug\'ullanish', 'Mehnat'],
    ['Til o\'rganish', 'Rivojlanish'],
    ['Kitob mutolaasi', 'Rivojlanish'],
  ];
  for (const [name, domain] of cases) assert.equal(getHabitDomain(name, ''), domain, name);
});

test('"kitob" ichidagi "it" endi dasturlash deb olinmaydi', () => {
  assert.equal(getHabitCategory('Kitob mutolaasi', ''), 'reading');
  assert.equal(getHabitCategory('IT kurs', ''), 'code');
  assert.equal(getHabitCategory("Sport bilan shug'ullanish", ''), 'workout');
});
