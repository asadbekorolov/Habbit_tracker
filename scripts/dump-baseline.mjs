// Jonli Supabase bazasidan public sxemaning to'liq DDL'ini olib,
// supabase/baseline/000_baseline_schema.sql ga yozadi (faqat o'qiydi).
//
// Ishlatish (PowerShell):
//   $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<PAROL>@aws-0-<region>.pooler.supabase.com:5432/postgres"
//   node scripts/dump-baseline.mjs
// Ulanish satri: Supabase -> Connect -> Session pooler. Parol faqat sizning
// kompyuteringizda qoladi; fayl/commit'ga yozilmaydi.
// "self-signed certificate" xatosi chiqsa: $env:DB_SSL_NO_VERIFY = "1"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pgSsl, sslHint } from './lib/pgSsl.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL o\'rnatilmagan (Supabase -> Connect -> Session pooler).');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: pgSsl(),
});
const sql = fs.readFileSync(path.join(root, 'supabase/baseline/generate_baseline.sql'), 'utf8');
const out = path.join(root, 'supabase/baseline/000_baseline_schema.sql');

try {
  await client.connect();
} catch (e) {
  console.error('Ulanib bo\x27lmadi:', e.message);
  const hint = sslHint(e);
  if (hint) console.error(hint);
  process.exit(1);
}
try {
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(sql);
  await client.query('ROLLBACK');
  const ddl = rows[0]?.ddl;
  if (!ddl) throw new Error('Bo\'sh natija');
  fs.writeFileSync(out, ddl);
  const count = (re) => (ddl.match(re) || []).length;
  console.log(`Yozildi: ${path.relative(root, out)} (${(ddl.length / 1024).toFixed(0)} KB)`);
  console.log(`  jadvallar: ${count(/^CREATE TABLE/gm)}, funksiyalar: ${count(/^CREATE OR REPLACE FUNCTION/gm)}, policy'lar: ${count(/^CREATE POLICY/gm)}`);
} finally {
  await client.end();
}
