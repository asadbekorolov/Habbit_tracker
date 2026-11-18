// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicName, nameInitials } from '../src/utils/publicName.ts';

test("to'liq ism > display_name > @username", () => {
  assert.equal(publicName({ full_name: ' Ali Valiyev ', display_name: 'Ali', username: 'ali' }), 'Ali Valiyev');
  assert.equal(publicName({ full_name: '', display_name: 'Ali V.', username: 'ali' }), 'Ali V.');
  assert.equal(publicName({ username: 'ali' }), '@ali');
  assert.equal(publicName(null, "A'zo"), "A'zo");
});

test('bosh harflar', () => {
  assert.equal(nameInitials('Ali Valiyev'), 'AV');
  assert.equal(nameInitials('@ali'), 'A');
  assert.equal(nameInitials(''), '?');
});
