// Ishga tushirish: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSiteAdmin, isSiteAdminEmail, SITE_ADMIN_EMAIL } from '../src/utils/admin.ts';

test('Admin Panel faqat asadbekorolov0@gmail.com uchun', () => {
  assert.equal(isSiteAdminEmail('asadbekorolov0@gmail.com'), true);
  assert.equal(isSiteAdminEmail('  AsadbekOrolov0@Gmail.com '), true);
  assert.equal(isSiteAdminEmail('asadbekorolov0@gmail.com.evil.com'), false);
  assert.equal(isSiteAdminEmail('other@gmail.com'), false);
  assert.equal(isSiteAdminEmail(undefined), false);
  // Bazadagi belgi ham shart (email yolg'iz yetmaydi va aksincha)
  assert.equal(isSiteAdmin({ is_admin: true }, SITE_ADMIN_EMAIL), true);
  assert.equal(isSiteAdmin({ is_admin: false }, SITE_ADMIN_EMAIL), false);
  assert.equal(isSiteAdmin({ is_admin: true }, 'other@gmail.com'), false);
  assert.equal(isSiteAdmin(null, SITE_ADMIN_EMAIL), false);
});

test('ilova va baza (051) bir xil emailni ishlatadi', () => {
  const sql = readFileSync(new URL('../supabase/migrations/051_admin_email_guard.sql', import.meta.url), 'utf8');
  assert.match(sql, new RegExp(`lower\(u\.email\) = '${SITE_ADMIN_EMAIL.replace(/\./g, '\.')}'`));
});

test("Lenta marshruti va bo'limi olib tashlangan", () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../src/features/profile/ProfilePage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /FeedPage/);
  assert.doesNotMatch(profile, /id: "feed"/);
});
