// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutineSchedule } from '../src/utils/routineSchedule.ts';
import { getTashkentTimeHM, getTashkentIsoWeekday } from '../src/utils/date.ts';
import type { Routine } from '../src/services/supabase.ts';

const r = (id: string, start: string, end: string, extra: Partial<Routine> = {}): Routine => ({
  id, user_id: 'u', title: id, time_start: `${start}:00`, time_end: `${end}:00`, icon_name: 'Sun',
  days_of_week: [1, 2, 3, 4, 5, 6, 7], is_active: true, created_at: '', items: [], ...extra,
});

const DAY = [r('ertalab', '07:00', '08:00'), r('ish', '10:00', '12:00'), r('kitob', '15:00', '16:00'), r('kech', '21:30', '22:00')];

test("23:00 da hech biri faol emas — hammasi o'tgan", () => {
  const s = buildRoutineSchedule(DAY, '23:00', 1);
  assert.equal(s.current, null);
  assert.equal(s.next, null);
  assert.deepEqual(s.items.map((i) => i.status), ['completed', 'completed', 'completed', 'completed']);
});

test('11:00 da "ish" faol, keyingilari kutilmoqda', () => {
  const s = buildRoutineSchedule(DAY, '11:00', 1);
  assert.equal(s.current?.routine.id, 'ish');
  assert.deepEqual(s.items.map((i) => i.status), ['completed', 'active', 'upcoming', 'upcoming']);
});

test("13:00 da faol yo'q — navbatdagisi kitob", () => {
  const s = buildRoutineSchedule(DAY, '13:00', 1);
  assert.equal(s.current, null);
  assert.equal(s.next?.routine.id, 'kitob');
});

test('tugash daqiqasida faol emas; tunni kesib o\'tadigan oraliq', () => {
  assert.equal(buildRoutineSchedule(DAY, '12:00', 1).current, null);
  const night = [r('uyqu', '23:00', '06:00')];
  assert.equal(buildRoutineSchedule(night, '02:30', 1).current?.routine.id, 'uyqu');
  assert.equal(buildRoutineSchedule(night, '23:30', 1).current?.routine.id, 'uyqu');
  assert.equal(buildRoutineSchedule(night, '12:00', 1).next?.routine.id, 'uyqu');
});

test('boshqa kunga, nofaol tartib chiqmaydi; bandlari bajarilgani — yakunlangan', () => {
  const list = [
    r('dam', '10:00', '12:00', { days_of_week: [6, 7] }),
    r('off', '10:00', '12:00', { is_active: false }),
    r('done', '10:00', '12:00', { items: [{ id: 'i', routine_id: 'done', title: 'x', order_index: 0, is_completed_today: true }] as any }),
  ];
  const s = buildRoutineSchedule(list, '11:00', 1);
  assert.deepEqual(s.items.map((i) => i.routine.id), ['done']);
  assert.equal(s.items[0].status, 'completed');
});

test('Toshkent vaqti qurilma zonasidan mustaqil', () => {
  const t = new Date('2026-11-16T18:05:00Z'); // Toshkentda 23:05, dushanba
  assert.equal(getTashkentTimeHM(t), '23:05');
  assert.equal(getTashkentIsoWeekday(t), 1);
  assert.equal(getTashkentIsoWeekday(new Date('2026-11-15T19:30:00Z')), 1); // yakshanba UTC, Toshkentda dushanba 00:30
});
