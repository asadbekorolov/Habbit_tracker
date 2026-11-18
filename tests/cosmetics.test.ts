// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRAMES, USERNAME_GLOW_ID, USERNAME_GLOW_PRICE, COSMETIC_DURATION_DAYS, cosmeticState, cosmeticDaysLeft } from '../src/utils/cosmetics.ts';

const NOW = Date.parse('2026-11-18T12:00:00Z');
const DAY = 86400000;

test("bezak holati: yo'q / amal qilyapti / tugagan", () => {
  assert.equal(cosmeticState(null, NOW), 'none');
  assert.equal(cosmeticState(new Date(NOW + DAY).toISOString(), NOW), 'active');
  assert.equal(cosmeticState(new Date(NOW - 1000).toISOString(), NOW), 'expired');
  assert.equal(cosmeticState('buzuq', NOW), 'none');
});

test('necha kun qoldi — yuqoriga yaxlitlanadi, tugagan bo\'lsa 0', () => {
  assert.equal(cosmeticDaysLeft(new Date(NOW + 20 * DAY).toISOString(), NOW), 20);
  assert.equal(cosmeticDaysLeft(new Date(NOW + 17.2 * DAY).toISOString(), NOW), 18);
  assert.equal(cosmeticDaysLeft(new Date(NOW + 60_000).toISOString(), NOW), 1);
  assert.equal(cosmeticDaysLeft(new Date(NOW - DAY).toISOString(), NOW), 0);
});

test('frontend narx va muddatlari 056-migratsiyadagi shop_items bilan bir xil', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/056_cosmetics_20d_and_feedback_admin.sql', import.meta.url), 'utf8');
  const rows = new Map<string, { price: number; days: number }>();
  for (const m of sql.matchAll(/\('(frame_\w+|username_glow)',\s*'(?:frame|glow)',\s*(\d+),\s*true,\s*(\d+)\)/g)) {
    rows.set(m[1], { price: Number(m[2]), days: Number(m[3]) });
  }
  assert.equal(COSMETIC_DURATION_DAYS, 20);
  for (const f of FRAMES) assert.deepEqual(rows.get(f.id), { price: f.price, days: 20 }, f.id);
  assert.deepEqual(rows.get(USERNAME_GLOW_ID), { price: USERNAME_GLOW_PRICE, days: 20 });
  assert.deepEqual(FRAMES.map((f) => f.price), [300, 600, 1000]);
  assert.equal(USERNAME_GLOW_PRICE, 800);
});
