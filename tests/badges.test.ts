// Ishga tushirish: npm test
// Nishon shartlari serverdagi claim_badge_reward (047) bilan bir xil bo'lishi shart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BADGE_DEFS, computeBadgeStats, evaluateBadges } from '../src/utils/badges.ts';

const logs = (dates: string[]) => dates.map((log_date) => ({ log_date, completed: true }));

test('statistika: jami, faol kunlar, eng uzun ketma-ketlik (oy chegarasidan o\'tib)', () => {
  const s = computeBadgeStats(
    [...logs(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-01', '2026-11-05']), { log_date: '2026-11-06', completed: false }],
    320
  );
  assert.deepEqual(s, { score: 320, totalCompleted: 5, activeDays: 4, bestStreak: 3 });
  assert.equal(computeBadgeStats([], 0).bestStreak, 0);
});

test('Profil, Nishonlar sahifasi va oyna bir xil sonni oladi (bitta funksiya)', () => {
  const stats = computeBadgeStats(logs(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-08']), 1300);
  const unlocked = evaluateBadges(stats).filter((b) => b.isUnlocked).map((b) => b.id).sort();
  // 7 ta bajarilgan, 7 faol kun, eng uzun seriya 6, 1300 XP
  assert.deepEqual(unlocked, ['first_step', 'health_ambassador', 'knowledge_miner', 'morning_hero']);
});

test('ID, chegara va mukofotlar serverdagi claim_badge_reward bilan mos', () => {
  const sql = readFileSync(new URL('../supabase/migrations/047_secure_economy_and_rpcs.sql', import.meta.url), 'utf8');
  const fn = sql.slice(sql.indexOf('FUNCTION public.claim_badge_reward'));
  const metricSql: Record<string, string> = {
    totalCompleted: 'v_total_completed', bestStreak: 'v_best_streak', activeDays: 'v_active_days', score: 'v_score',
  };
  for (const b of BADGE_DEFS) {
    assert.match(fn, new RegExp(`\\('${b.id}',\\s*${b.reward.xp},\\s*${b.reward.coins}\\)`), `${b.id} mukofoti`);
    assert.match(fn, new RegExp(`WHEN '${b.id}'\\s+THEN ${metricSql[b.metric]} >= ${b.target}\\b`), `${b.id} sharti`);
  }
  assert.equal(new Set(BADGE_DEFS.map((b) => b.id)).size, 7);
});
