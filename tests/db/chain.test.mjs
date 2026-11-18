// Migratsiyalar zanjiri: nomlash qoidalari va har bir zamonaviy migratsiya
// (047+) ketma-ket ikki marta xatosiz qo'llanishi (qayta ishga tushirishga chidamli).
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadMigrations } from '../../scripts/lib/migrator.mjs';
import { createDb, migrationFiles, readMigration } from './harness.mjs';

const DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
// 047 dan oldingilari jonli bazada qo'lda qo'llangan va bu yerda
// qayta qurilmaydi (001 repoda yo'q) — ular faqat nom qoidalari bo'yicha tekshiriladi.
const FIRST_TESTED = 47;

test("nomlar: NNN_nom.sql, raqamlar takrorlanmaydi va 002 dan uzluksiz", () => {
  const list = loadMigrations(DIR); // noto'g'ri nom yoki takroriy raqamda xato beradi
  const nums = list.map((m) => Number(m.version));
  assert.equal(nums[0], 2, '001 repoda yo\'q — zanjir 002 dan boshlanadi');
  nums.forEach((n, i) => assert.equal(n, nums[0] + i, `uzilish: ${list[i].file}`));
  for (const m of list) assert.match(m.version, /^\d{3}$/, `${m.file}: raqam 3 xonali bo'lsin`);
});

test(`zanjir: ${FIRST_TESTED}+ migratsiyalar tartib bilan, har biri ikki marta`, async () => {
  const db = await createDb({ authUsers: true, feedback: true });
  const files = migrationFiles().filter((f) => Number(f.slice(0, 3)) >= FIRST_TESTED);
  assert.ok(files.length >= 10);
  for (const f of files) {
    for (let i = 1; i <= 2; i++) {
      try {
        await db.exec(readMigration(f));
      } catch (e) {
        assert.fail(`${f} (${i}-marta): ${e.message}`);
      }
    }
  }
});
