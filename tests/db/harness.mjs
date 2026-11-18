// Migratsiya testlari uchun umumiy vositalar (PGlite — xotiradagi Postgres).
//
// Baza: legacy-schema.sql — Supabase muhitining yaqinlashuvi (anon /
// authenticated / service_role rollari, auth.uid(), default privileges) va
// 047 dan oldingi public sxemaning soddalashtirilgan nusxasi. Repoda 001 yo'q,
// shuning uchun 002–046 bu yerda qo'llanmaydi; to'liq sxema uchun
// supabase/baseline (jonli bazadan generatsiya) ishlatiladi.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

export const MIGRATIONS_DIR = new URL('../../supabase/migrations/', import.meta.url);
const LEGACY = new URL('./legacy-schema.sql', import.meta.url);

/** Migratsiya fayllari (raqam bo'yicha tartiblangan). */
export function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
}

/** '047' yoki '047_secure_economy_and_rpcs.sql' -> fayl matni */
export function readMigration(idOrFile) {
  const file = idOrFile.endsWith('.sql') ? idOrFile : migrationFiles().find((f) => f.startsWith(idOrFile + '_'));
  if (!file) throw new Error(`Migratsiya topilmadi: ${idOrFile}`);
  return fs.readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8');
}

export function readRepoFile(rel) {
  return fs.readFileSync(new URL('../../' + rel, import.meta.url), 'utf8');
}

/**
 * Yangi baza. opts.authUsers — auth.users jadvali (051+ uchun);
 * opts.feedback — 016/041 dagi user_feedback (056 uchun).
 */
export async function createDb({ authUsers = false, feedback = false } = {}) {
  const db = new PGlite();
  await db.exec(fs.readFileSync(LEGACY, 'utf8'));
  if (authUsers) {
    await db.exec(`CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;`);
  }
  if (feedback) {
    await db.exec(readMigration('016'));
    await db.exec(readMigration('041'));
  }
  return db;
}

/** Migratsiyalarni ketma-ket qo'llash: migrate(db, ['047', '048', '048']) */
export async function migrate(db, ids) {
  for (const id of ids) await db.exec(readMigration(id));
}

/** Foydalanuvchi sifatida (authenticated + JWT sub) so'rov. */
export function roles(db) {
  const as = async (uid, sql) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false); SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',false);`);
    try { return (await db.query(sql)).rows; } finally { await db.exec('RESET ROLE'); }
  };
  const asRaw = async (uid, sql) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false); SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',false);`);
    try { return await db.query(sql); } finally { await db.exec('RESET ROLE'); }
  };
  const err = async (uid, sql) => { try { await as(uid, sql); return ''; } catch (e) { return e.message; } };
  const q = async (sql) => (await db.query(sql)).rows;
  return { as, asRaw, err, q };
}

/**
 * Ko'p tekshiruvli test: hamma tekshiruvlar bajariladi, oxirida
 * muvaffaqiyatsizlari bitta xabarda chiqadi.
 */
export function checker() {
  const failures = [];
  const ok = (name, cond, extra = '') => { if (!cond) failures.push(`${name}${extra ? ' | ' + extra : ''}`); };
  const done = () => assert.deepEqual(failures, [], `Muvaffaqiyatsiz tekshiruvlar:\n  - ${failures.join('\n  - ')}`);
  return { ok, done };
}
