// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDockSlots, toggleDockSlot, DEFAULT_DOCK } from '../src/utils/dockConfig.ts';

test("saqlanmagan yoki buzilgan qiymat — standart (Kundalik, Guruhlar, Tahlil)", () => {
  assert.deepEqual(parseDockSlots(null), [...DEFAULT_DOCK]);
  assert.deepEqual(parseDockSlots('{buzuq'), [...DEFAULT_DOCK]);
  assert.deepEqual(parseDockSlots('"journal"'), [...DEFAULT_DOCK]);
});

test("noma'lum, takror va 3 tadan ortig'i tashlanadi; tartib barqaror", () => {
  assert.deepEqual(parseDockSlots('["health","dashboard","journal","health","leaderboard","groups"]'), ['journal', 'groups', 'health']);
  assert.deepEqual(parseDockSlots('[]'), []);
});

test('yoqish/o\'chirish: limit 3, Asosiy va Profil bu ro\'yxatda yo\'q', () => {
  const full = ['journal', 'groups', 'analytics'] as const;
  assert.deepEqual(toggleDockSlot(full, 'health'), [...full]);
  assert.deepEqual(toggleDockSlot(full, 'groups'), ['journal', 'analytics']);
  assert.deepEqual(toggleDockSlot(['analytics'], 'journal'), ['journal', 'analytics']);
});
