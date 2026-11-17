// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAiReport, reportToText, loadCachedReport, saveCachedReport, aiCacheKey, isNetworkError,
} from '../src/utils/aiReport.ts';

test('tuzilgan javob: 3 bo\'lim, harakatlar ko\'pi bilan 3 ta, bo\'sh qatorlar tashlanadi', () => {
  const r = parseAiReport(JSON.stringify({
    strengths: ['Erta turish 90%', '  '], weaknesses: ['Shanba 20%'], actions: ['a', 'b', 'c', 'd'],
  }))!;
  assert.deepEqual(r, { strengths: ['Erta turish 90%'], weaknesses: ['Shanba 20%'], actions: ['a', 'b', 'c'] });
  assert.match(reportToText(r), /Kuchli tomonlar:\n1\. Erta turish 90%/);
});

test("noto'g'ri yoki bo'sh javob — null; eski server matni — summary", () => {
  assert.equal(parseAiReport('not json'), null);
  assert.equal(parseAiReport({ strengths: [], weaknesses: [], actions: [] }), null);
  assert.equal(parseAiReport(null), null);
  const legacy = parseAiReport({ summary: 'Eski matn' })!;
  assert.equal(legacy.summary, 'Eski matn');
  assert.equal(reportToText(legacy), 'Eski matn');
});

test('oxirgi hisobot foydalanuvchi bo\'yicha saqlanadi (qayta ko\'rish tangasiz)', () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  const value = { report: { strengths: ['x'], weaknesses: [], actions: ['y'] }, generatedAt: '2026-11-17T10:00:00Z' };
  saveCachedReport('u1', value, st);
  assert.ok(mem.has('ai_analysis_last_u1'));
  assert.equal(aiCacheKey('u1'), 'ai_analysis_last_u1');
  assert.deepEqual(loadCachedReport('u1', st), value);
  assert.equal(loadCachedReport('u2', st), null);
  mem.set('ai_analysis_last_u3', '{broken');
  assert.equal(loadCachedReport('u3', st), null);
});

test('tarmoq xatosi aniqlanadi (Failed to fetch)', () => {
  assert.equal(isNetworkError(new TypeError('Failed to fetch')), true);
  assert.equal(isNetworkError(new TypeError('Load failed')), true);
  assert.equal(isNetworkError(new Error('insufficient_coins')), false);
});
