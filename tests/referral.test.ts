// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReferralCode,
  parseReferralFromSearch,
  referralLink,
  referralErrorCode,
  isFinalReferralError,
} from '../src/utils/referral.ts';

test('taklif kodi: normallashtirish va format', () => {
  assert.equal(normalizeReferralCode('  x7k9p2a '), 'X7K9P2A');
  assert.equal(normalizeReferralCode('ABC123'), 'ABC123');
  assert.equal(normalizeReferralCode('ABCDEFGH'), 'ABCDEFGH');
  assert.equal(normalizeReferralCode('ABC12'), null, '5 belgi — juda qisqa');
  assert.equal(normalizeReferralCode('ABCDEFGHI'), null, '9 belgi — juda uzun');
  assert.equal(normalizeReferralCode('AB-123'), null);
  assert.equal(normalizeReferralCode(null), null);
  assert.equal(normalizeReferralCode(42), null);
});

test("taklif havolasi: ?ref ni olib, qolgan parametrlar saqlanadi", () => {
  assert.deepEqual(parseReferralFromSearch('?ref=abc1234'), { code: 'ABC1234', rest: '' });
  assert.deepEqual(parseReferralFromSearch('?x=1&ref=abc1234&y=2'), { code: 'ABC1234', rest: '?x=1&y=2' });
  assert.deepEqual(parseReferralFromSearch('?ref=bad!'), { code: null, rest: '' }, "noto'g'ri kod ham manzildan olinadi");
  assert.deepEqual(parseReferralFromSearch('?x=1'), { code: null, rest: '?x=1' });
  assert.deepEqual(parseReferralFromSearch(''), { code: null, rest: '' });
  assert.equal(referralLink('X7K9P2A'), 'https://habit-tracker-asadbek.vercel.app/?ref=X7K9P2A');
});

test('taklif xatolari: server xabaridan kod va qayta urinish', () => {
  assert.equal(referralErrorCode('ERROR: self_referral'), 'self_referral');
  assert.equal(referralErrorCode('referral_window_closed'), 'referral_window_closed');
  assert.equal(referralErrorCode('Failed to fetch'), null);
  assert.equal(referralErrorCode(undefined), null);
  assert.equal(isFinalReferralError('already_referred'), true);
  assert.equal(isFinalReferralError('not_authenticated'), false, 'sessiya yangilangach qayta urinadi');
  assert.equal(isFinalReferralError(null), false, 'tarmoq xatosi — kod saqlanadi');
});
