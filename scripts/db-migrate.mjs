// Supabase migratsiyalarini jurnal bilan qo'llash.
//
//   npm run db:status                       — qaysilari qo'llangan / kutilmoqda
//   npm run db:migrate                      — kutilayotganlarni qo'llash
//   npm run db:migrate -- --dry-run         — faqat ro'yxat, hech narsa qo'llanmaydi
//   npm run db:adopt -- --through 055       — BIR MARTALIK: qo'lda qo'llangan
//                                             002..055 ni jurnalga yozish
//
// Ulanish: SUPABASE_DB_URL (Supabase -> Connect -> Session pooler, 5432-port).
// Parol faqat muhit o'zgaruvchisida — faylga/commit'ga yozilmaydi.
// "self-signed certificate" xatosi: Supabase CA sertifikati kerak — scripts/lib/pgSsl.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pgSsl, sslHint } from './lib/pgSsl.mjs';
import { status, up, adopt, detectApplied } from './lib/migrator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'supabase', 'migrations');
const [cmd = 'status', ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL o'rnatilmagan (Supabase -> Connect -> Session pooler).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: pgSsl(),
});
const db = {
  query: (sql, params) => client.query(sql, params),
  exec: (sql) => client.query(sql),
};
const log = (s) => console.log(s);

try {
  await client.connect();
} catch (e) {
  console.error('Ulanib bo\x27lmadi:', e.message);
  const hint = sslHint(e);
  if (hint) console.error(hint);
  process.exit(1);
}
try {
  if (cmd === 'status') {
    const st = await status(db, dir);
    const mark = { applied: '  ok     ', pending: '  KUTMOQDA', changed: '  OZGARGAN' };
    for (const i of st.items) console.log(`${mark[i.state]}  ${i.file}${i.method === 'adopt' ? '  (adopt)' : ''}`);
    if (st.missing.length) console.log(`\nJurnalda bor, faylda yo'q: ${st.missing.join(', ')}`);
    const pending = st.items.filter((i) => i.state === 'pending').length;
    if (st.ledgerEmpty && st.inUse) {
      console.log("\nJurnal bo'sh, baza esa ishlab turibdi: avval bir martalik adopt kerak.");
      const d = await detectApplied(db);
      console.log(`Bazada izi topilgan migratsiyalar (047+): ${d.found.join(', ') || "yo'q"}`);
      if (d.gaps.length) console.log(`DIQQAT: oraliqda qo'llanmaganlari bor, keyingilari esa qo'llangan: ${d.gaps.join(', ')} — qo'lda tekshiring.`);
      if (d.suggest) console.log(`Taklif: npm run db:adopt -- --through ${d.suggest}`);
      process.exitCode = 2;
    } else {
      console.log(`\nKutilayotgan: ${pending}`);
    }
  } else if (cmd === 'up') {
    const r = await up(db, dir, { dryRun: flag('--dry-run'), log });
    if (flag('--dry-run')) console.log(r.pending.length ? `Qo'llanadi:\n  ${r.pending.join('\n  ')}` : "Kutilayotgan migratsiya yo'q.");
    else console.log(r.applied.length ? `Qo'llandi: ${r.applied.length} ta` : "Kutilayotgan migratsiya yo'q.");
  } else if (cmd === 'adopt') {
    const through = opt('--through');
    if (!through) throw new Error('Foydalanish: npm run db:adopt -- --through 055');
    const marked = await adopt(db, dir, through, { log });
    console.log(`Jurnalga yozildi: ${marked.length} ta (hech qaysi SQL ishga tushirilmadi).`);
  } else {
    throw new Error(`Noma'lum buyruq: ${cmd} (status | up | adopt)`);
  }
} catch (e) {
  console.error('XATO:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
