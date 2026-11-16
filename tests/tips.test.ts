// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTip, loadDismissedTips, saveDismissedTips, TIP_IDS } from '../src/utils/tips.ts';

test('bir vaqtda bitta maslahat, yopilgani qaytib chiqmaydi', () => {
  assert.equal(pickTip(new Set()), TIP_IDS[0]);
  assert.equal(pickTip(new Set(['freeze'])), 'minutes');
  assert.equal(pickTip(new Set(TIP_IDS)), null);
});

test('saqlash va o\'qish; buzilgan qiymat xatoga olib kelmaydi', () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  saveDismissedTips('u1', new Set(['freeze', 'notes']), st);
  assert.deepEqual([...loadDismissedTips('u1', st)].sort(), ['freeze', 'notes']);
  assert.equal(loadDismissedTips('u2', st).size, 0);
  mem.set('idrok_tips_dismissed_u3', '{not json');
  assert.equal(loadDismissedTips('u3', st).size, 0);
});
