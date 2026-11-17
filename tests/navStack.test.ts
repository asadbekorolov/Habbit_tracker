// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushVisit, popBack, decideBack, normalizePath, EXIT_WINDOW_MS } from '../src/utils/navStack.ts';

const walk = (...paths: string[]) => paths.reduce<string[]>((s, p) => pushVisit(s, p), []);

test('tarix: ketma-ket bir xil sahifa yozilmaydi, kirish sahifalari yozilmaydi', () => {
  assert.deepEqual(walk('/login', '/dashboard', '/dashboard', '/analytics', '/analytics/'.replace(/\/$/, '')), ['/dashboard', '/analytics']);
  assert.equal(normalizePath('/analytics/'), '/analytics');
  assert.equal(normalizePath('/habits', '?section=routines'), '/habits?section=routines');
});

test('Tahlil -> Reyting -> Orqaga = Tahlil; Profil -> Sozlamalar -> Orqaga = Profil', () => {
  let stack = walk('/dashboard', '/analytics', '/leaderboard');
  let a = decideBack({ overlayOpen: false, stack, currentPath: '/leaderboard', now: 0, lastPressAt: 0 });
  assert.deepEqual(a, { type: 'navigate', to: '/analytics', stack: ['/dashboard', '/analytics'] });

  stack = walk('/dashboard', '/profile', '/settings');
  a = decideBack({ overlayOpen: false, stack, currentPath: '/settings', now: 0, lastPressAt: 0 });
  assert.equal(a.type === 'navigate' && a.to, '/profile');
});

test('LIFO: har bosishda bir qadam; qaytilgan sahifaga navigatsiya tarixni ikkilamaydi', () => {
  let stack = walk('/dashboard', '/journal', '/analytics', '/profile');
  const seen: string[] = [];
  for (;;) {
    const r = popBack(stack);
    if (!r.target) break;
    seen.push(r.target);
    stack = pushVisit(r.stack, r.target); // router o'sha sahifaga o'tganda yoziladi
  }
  assert.deepEqual(seen, ['/analytics', '/journal', '/dashboard']);
  assert.deepEqual(stack, ['/dashboard']);
});

test("avval ochiq oyna yopiladi; tarixsiz ichki sahifa — Bosh sahifaga", () => {
  assert.deepEqual(decideBack({ overlayOpen: true, stack: walk('/dashboard', '/settings'), currentPath: '/settings', now: 0, lastPressAt: 0 }), { type: 'close-overlay' });
  assert.deepEqual(decideBack({ overlayOpen: false, stack: ['/profile'], currentPath: '/profile', now: 0, lastPressAt: 0 }), { type: 'navigate', to: '/dashboard', stack: ['/dashboard'] });
});

test('Bosh sahifada: birinchi bosish — ogohlantirish, 2 soniya ichida ikkinchisi — chiqish', () => {
  const base = { overlayOpen: false, stack: ['/dashboard'], currentPath: '/dashboard' };
  assert.equal(decideBack({ ...base, now: 10_000, lastPressAt: 0 }).type, 'confirm-exit');
  assert.equal(decideBack({ ...base, now: 10_000 + EXIT_WINDOW_MS - 1, lastPressAt: 10_000 }).type, 'exit');
  assert.equal(decideBack({ ...base, now: 10_000 + EXIT_WINDOW_MS + 1, lastPressAt: 10_000 }).type, 'confirm-exit');
});
