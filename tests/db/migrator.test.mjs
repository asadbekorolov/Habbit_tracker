// scripts/lib/migrator.mjs — jurnal bilan migratsiya ishga tushirgichi
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { status, up, adopt, loadMigrations, checksum, detectApplied, LEDGER } from '../../scripts/lib/migrator.mjs';
import { createDb, migrate, migrationFiles } from './harness.mjs';

const REAL_DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const adapter = (db) => ({ query: (sql, params) => db.query(sql, params), exec: (sql) => db.exec(sql) });

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idrok-mig-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}
const tableExists = async (db, t) => !!(await db.query(`SELECT to_regclass('${t}') t`)).rows[0].t;
const ledger = async (db) => (await db.query(`SELECT version, method FROM ${LEDGER} ORDER BY version`)).rows;

test("toza baza: hammasi qo'llanadi, ikkinchi marta hech narsa", async () => {
  const pg = new PGlite(); const db = adapter(pg);
  const dir = tmpDir({
    '001_profiles.sql': 'CREATE TABLE profiles (id int);',
    '002_more.sql': 'BEGIN; CREATE TABLE t2 (id int); COMMIT;',
  });
  const r1 = await up(db, dir);
  assert.deepEqual(r1.applied, ['001_profiles.sql', '002_more.sql']);
  assert.ok(await tableExists(pg, 't2'));
  assert.deepEqual((await ledger(pg)).map((r) => [r.version, r.method]), [['001', 'run'], ['002', 'run']]);
  assert.deepEqual((await up(db, dir)).applied, []);
  assert.ok((await status(db, dir)).items.every((i) => i.state === 'applied'));
});

test("ishlab turgan baza, jurnal bo'sh: adopt'siz up rad etiladi; adopt SQL ishga tushirmaydi", async () => {
  const pg = new PGlite(); const db = adapter(pg);
  await pg.exec('CREATE TABLE profiles (id int);');
  const dir = tmpDir({
    '001_profiles.sql': 'CREATE TABLE profiles (id int);', // qayta ishga tushsa xato berardi
    '002_more.sql': 'CREATE TABLE t2 (id int);',
  });
  await assert.rejects(up(db, dir), /adopt/);
  const st = await status(db, dir);
  assert.ok(st.ledgerEmpty && st.inUse);
  assert.deepEqual(await adopt(db, dir, '002'), ['001', '002']);
  assert.ok(!(await tableExists(pg, 't2')), 'adopt SQL ni ishga tushirmasligi kerak');
  assert.deepEqual((await ledger(pg)).map((r) => r.method), ['adopt', 'adopt']);
  assert.deepEqual(await adopt(db, dir, '002'), [], 'adopt qayta chaqirilsa — hech narsa');
  fs.writeFileSync(path.join(dir, '003_new.sql'), 'CREATE TABLE t3 (id int);');
  assert.deepEqual((await up(db, dir)).applied, ['003_new.sql']);
  assert.ok(await tableExists(pg, 't3'));
  await assert.rejects(adopt(db, dir, '099'), /fayli yo'q/);
});

test("xato bergan migratsiya: to'xtaydi, jurnalga yozilmaydi, keyingilari qo'llanmaydi", async () => {
  const pg = new PGlite(); const db = adapter(pg);
  const dir = tmpDir({
    '001_a.sql': 'CREATE TABLE profiles (id int);',
    '002_broken.sql': 'BEGIN; CREATE TABLE x (id int); SELECT 1/0; COMMIT;',
    '003_c.sql': 'CREATE TABLE t3 (id int);',
  });
  await assert.rejects(up(db, dir), /002_broken\.sql xato berdi/);
  assert.ok(!(await tableExists(pg, 'x')), 'xato bergan fayl orqaga qaytarilishi kerak');
  assert.ok(!(await tableExists(pg, 't3')));
  assert.deepEqual((await ledger(pg)).map((r) => r.version), ['001']);
  fs.writeFileSync(path.join(dir, '002_broken.sql'), 'BEGIN; CREATE TABLE x (id int); COMMIT;');
  assert.deepEqual((await up(db, dir)).applied, ['002_broken.sql', '003_c.sql']);
});

test("tartib buzilishi rad etiladi; dry-run hech narsa qo'llamaydi", async () => {
  const pg = new PGlite(); const db = adapter(pg);
  const dir = tmpDir({ '001_a.sql': 'CREATE TABLE profiles (id int);', '003_c.sql': 'CREATE TABLE t3 (id int);' });
  await up(db, dir);
  fs.writeFileSync(path.join(dir, '002_late.sql'), 'CREATE TABLE t2 (id int);');
  await assert.rejects(up(db, dir), /Tartib buzilgan/);
  fs.renameSync(path.join(dir, '002_late.sql'), path.join(dir, '004_late.sql'));
  const dry = await up(db, dir, { dryRun: true });
  assert.deepEqual(dry.pending, ['004_late.sql']);
  assert.ok(!(await tableExists(pg, 't2')));
});

test("checksum: o'zgargan fayl 'changed', faqat CRLF farqi — yo'q; noto'g'ri nom — xato", async () => {
  const pg = new PGlite(); const db = adapter(pg);
  const dir = tmpDir({ '001_a.sql': 'CREATE TABLE profiles (id int);\nSELECT 1;\n' });
  await up(db, dir);
  fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE profiles (id int);\r\nSELECT 1;\r\n');
  assert.equal((await status(db, dir)).items[0].state, 'applied');
  fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE profiles (id bigint);\n');
  assert.equal((await status(db, dir)).items[0].state, 'changed');
  assert.equal(checksum('a\r\nb'), checksum('a\nb'));
  const bad = tmpDir({ 'add_column.sql': 'SELECT 1;' });
  assert.throws(() => loadMigrations(bad), /Noto'g'ri migratsiya nomi/);
  const dup = tmpDir({ '005_a.sql': 'SELECT 1;', '005_b.sql': 'SELECT 1;' });
  assert.throws(() => loadMigrations(dup), /Takroriy raqam/);
});

test("jurnal anon va authenticated uchun yopiq", async () => {
  const pg = await createDb();
  const db = adapter(pg);
  await adopt(db, REAL_DIR, '046');
  const p = (await pg.query(`SELECT
      has_schema_privilege('anon', 'app_meta', 'USAGE') a1,
      has_schema_privilege('authenticated', 'app_meta', 'USAGE') a2,
      has_table_privilege('authenticated', '${LEDGER}', 'SELECT') a3`)).rows[0];
  assert.deepEqual(p, { a1: false, a2: false, a3: false });
});

test("haqiqiy repo: 046 gacha adopt, keyin up 047..oxirgisini qo'llaydi", async () => {
  const pg = await createDb({ authUsers: true, feedback: true });
  const db = adapter(pg);
  await adopt(db, REAL_DIR, '046');
  const r = await up(db, REAL_DIR);
  const expected = migrationFiles().filter((f) => Number(f.slice(0, 3)) > 46);
  assert.deepEqual(r.applied, expected);
  assert.deepEqual((await up(db, REAL_DIR)).applied, []);
});

test("detectApplied: qo'lda qo'llangan bazada --through taklifi va oraliqlar", async () => {
  const pg = await createDb({ authUsers: true, feedback: true });
  const db = adapter(pg);
  assert.deepEqual(await detectApplied(db), { found: [], suggest: null, gaps: [] });
  await migrate(pg, ['047', '048', '049', '050', '051', '052', '053']);
  let d = await detectApplied(db);
  assert.deepEqual(d.found, ['047', '048', '049', '050', '051', '052', '053']);
  assert.equal(d.suggest, '053');
  await migrate(pg, ['055']); // 054 o'tkazib yuborilgan
  d = await detectApplied(db);
  assert.equal(d.suggest, '053');
  assert.deepEqual(d.gaps, ['055']);
  await migrate(pg, ['054', '056']);
  d = await detectApplied(db);
  assert.equal(d.suggest, '056');
  assert.deepEqual(d.gaps, []);
});
