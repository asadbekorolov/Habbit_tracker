// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBrokenStreaks, formatFailReasons, formatBrokenStreaks } from '../src/utils/aiTwin.ts';

const L = (habit_id: string, log_date: string, completed = true) => ({ habit_id, log_date, completed });

test('3 kunlik zanjir keyingi kun bajarilmasa — uzilgan', () => {
  const logs = [L('a', '2026-11-01'), L('a', '2026-11-02'), L('a', '2026-11-03'), L('a', '2026-11-04', false)];
  const r = findBrokenStreaks({ logs, habitIds: ['a'], from: '2026-11-01', to: '2026-11-05' });
  assert.deepEqual(r, [{ habitId: 'a', length: 3, date: '2026-11-04' }]);
});

test('qisqa zanjir hisobga olinmaydi; muzlatilgan kun uzmaydi', () => {
  const logs = [L('a', '2026-11-01'), L('a', '2026-11-02'), L('a', '2026-11-04')];
  assert.deepEqual(findBrokenStreaks({ logs, habitIds: ['a'], from: '2026-11-01', to: '2026-11-05' }), []);
  const r = findBrokenStreaks({ logs, habitIds: ['a'], from: '2026-11-01', to: '2026-11-05', freezeDates: ['2026-11-03'] });
  assert.deepEqual(r, [{ habitId: 'a', length: 3, date: '2026-11-05' }]);
});

test('rejalashtirilmagan kun zanjirni uzmaydi', () => {
  // 2026-11-02 dushanba ... 11-08 yakshanba; odat faqat Du/Cho/Ju
  const logs = [L('a', '2026-11-02'), L('a', '2026-11-04'), L('a', '2026-11-06')];
  const none = findBrokenStreaks({ logs, habitIds: ['a'], from: '2026-11-02', to: '2026-11-08', schedules: { a: [1, 3, 5] } });
  assert.deepEqual(none, []);
  const broke = findBrokenStreaks({ logs, habitIds: ['a'], from: '2026-11-02', to: '2026-11-09', schedules: { a: [1, 3, 5] } });
  assert.deepEqual(broke, [{ habitId: 'a', length: 3, date: '2026-11-09' }]);
});

test('sabablar: yangisi tepada, bo\'shlari tashlanadi, nom bilan', () => {
  const rows = [
    { habit_id: 'a', log_date: '2026-11-01', fail_reason: 'Charchadim' },
    { habit_id: 'b', log_date: '2026-11-03', fail_reason: '  Kech   uxladim ' },
    { habit_id: 'a', log_date: '2026-11-02', fail_reason: '  ' },
  ];
  const names: Record<string, string> = { a: 'Yugurish', b: 'Kitob' };
  assert.deepEqual(formatFailReasons(rows, (id) => names[id]), [
    '2026-11-03 | Kitob | "Kech uxladim"',
    '2026-11-01 | Yugurish | "Charchadim"',
  ]);
  assert.deepEqual(formatBrokenStreaks([{ habitId: 'b', length: 5, date: '2026-11-03' }], (id) => names[id]), [
    '2026-11-03 | Kitob | 5 kunlik zanjir uzildi',
  ]);
});
