// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBuyCoins } from '../src/utils/platformPolicy.ts';

test("tanga sotib olish faqat vebda (Google Play to'lov qoidasi)", () => {
  assert.equal(canBuyCoins('web'), true);
  assert.equal(canBuyCoins('android'), false);
  assert.equal(canBuyCoins('ios'), false);
});
