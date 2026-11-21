// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packLink, parsePackFromSearch, defaultPackSelection, habitPackErrorCode } from '../src/utils/habitPack.ts';
import { PUBLIC_SITE_URL } from '../src/config/site.ts';

test("to'plam havolasi: pack va ixtiyoriy ref", () => {
  assert.equal(packLink('ABC1234'), `${PUBLIC_SITE_URL}/?pack=ABC1234`);
  assert.equal(packLink('ABC1234', 'X7K9P2A'), `${PUBLIC_SITE_URL}/?pack=ABC1234&ref=X7K9P2A`);
  assert.equal(packLink('ABC1234', null), `${PUBLIC_SITE_URL}/?pack=ABC1234`);
});

test("?pack ni olib, ref va boshqalar qoladi (ref'ni referral.ts alohida oladi)", () => {
  assert.deepEqual(parsePackFromSearch('?pack=abc1234&ref=x7k9p2a'), { code: 'ABC1234', rest: '?ref=x7k9p2a' });
  assert.deepEqual(parsePackFromSearch('?pack=bad!'), { code: null, rest: '' });
  assert.deepEqual(parsePackFromSearch('?ref=x7k9p2a'), { code: null, rest: '?ref=x7k9p2a' });
});

test("maxfiylik: salbiy (cheklov) odatlar sukut bo'yicha belgilanmaydi", () => {
  const sel = defaultPackSelection([
    { id: 'a', type: 'positive' },
    { id: 'b', type: 'negative' },
    { id: 'c', type: 'positive' },
  ]);
  assert.deepEqual([...sel].sort(), ['a', 'c']);
});

test("to'plam xatolari: server xabaridan kod", () => {
  assert.equal(habitPackErrorCode('ERROR: habit_not_owned'), 'habit_not_owned');
  assert.equal(habitPackErrorCode('own_pack'), 'own_pack');
  assert.equal(habitPackErrorCode('Failed to fetch'), null);
});
