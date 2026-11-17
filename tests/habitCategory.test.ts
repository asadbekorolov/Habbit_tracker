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

test("Turli apostrofli nomlar ham to'g'ri aniqlanadi (O‘ziga, oʻrganish)", () => {
  assert.equal(getHabitDomain('O‘ziga qarash', ''), 'Ruhiyat');
  assert.equal(getHabitDomain('Til oʻrganish', ''), 'Rivojlanish');
  assert.equal(getHabitDomain('Oila bilan vaqt o‘tkazish', ''), 'Ruhiyat');
});

test('odat ikonkalari yo\'nalishga mos rang oladi', async () => {
  const { getHabitTone } = await import('../src/utils/habitCategory.ts');
  assert.equal(getHabitTone('Erta turish', ''), 'amber');
  assert.equal(getHabitTone("Dasturlash bilan shug'ullanish", ''), 'cyan');
  assert.equal(getHabitTone("Oila bilan vaqt o'tkazish", ''), 'rose');
  assert.equal(getHabitTone('Kundalik yozish', ''), 'violet');
  assert.equal(getHabitTone("O'ziga qarash", ''), 'violet');
  assert.equal(getHabitTone("Sport bilan shug'ullanish", ''), 'orange');
  assert.equal(getHabitTone('Kitob mutolaasi', ''), 'emerald');
  assert.equal(getHabitTone("Til o'rganish", ''), 'emerald');
});
