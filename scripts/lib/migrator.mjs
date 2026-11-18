// Migratsiya ishga tushirgichining yadrosi (bazaga bog'liq emas — testlarda
// PGlite, haqiqiy bazada `pg` adapteri bilan ishlaydi).
//
// Jurnal: app_meta.schema_migrations — qaysi fayl, qachon, qaysi checksum bilan
// qo'llangani. app_meta sxemasi Supabase API'siga ochilmaydi (anon/authenticated
// huquqsiz).
//
// Qoidalar:
//   * Fayllar: supabase/migrations/NNN_nom.sql, raqam bo'yicha tartibda.
//   * Har fayl o'zining BEGIN/COMMIT'i bilan ishlaydi (ishga tushirgich uni
//     tranzaksiyaga o'ramaydi) va qayta ishga tushirishga chidamli bo'lishi kerak.
//   * Jurnal bo'sh, lekin baza allaqachon ishlayotgan bo'lsa (public.profiles
//     bor) — `up` hech narsa qilmaydi: avval bir martalik `adopt` kerak.
//   * Qo'llanganlaridan eskiroq raqamli yangi fayl — xato (tartib buzilmasin).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LEDGER = 'app_meta.schema_migrations';
const LOCK_KEY = 74_021_056; // pg_advisory_lock kaliti (ixtiyoriy, o'zgarmas son)

const FILE_RE = /^(\d+)_([a-z0-9_]+)\.sql$/i;

/** CRLF/LF farqi checksum'ga ta'sir qilmasin (Windows va CI). */
export function checksum(sql) {
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

/** Papkadagi migratsiyalar: [{ version, name, file, sql, checksum }] */
export function loadMigrations(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const out = [];
  const seen = new Map();
  for (const file of files) {
    const m = file.match(FILE_RE);
    if (!m) throw new Error(`Noto'g'ri migratsiya nomi: ${file} (kerak: NNN_nom.sql)`);
    const [, version, name] = m;
    if (seen.has(version)) throw new Error(`Takroriy raqam ${version}: ${seen.get(version)} va ${file}`);
    seen.set(version, file);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    out.push({ version, name, file, sql, checksum: checksum(sql) });
  }
  return out.sort((a, b) => Number(a.version) - Number(b.version));
}

async function ensureLedger(db) {
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS app_meta;
    CREATE TABLE IF NOT EXISTS ${LEDGER} (
      version    text PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      method     text NOT NULL DEFAULT 'run' CHECK (method IN ('run', 'adopt'))
    );
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON SCHEMA app_meta FROM anon';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app_meta FROM anon';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON SCHEMA app_meta FROM authenticated';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app_meta FROM authenticated';
      END IF;
    END $$;
    REVOKE ALL ON SCHEMA app_meta FROM PUBLIC;
  `);
}

async function ledgerRows(db) {
  const exists = (await db.query(`SELECT to_regclass('${LEDGER}') AS t`)).rows[0].t;
  if (!exists) return [];
  return (await db.query(`SELECT version, name, checksum, applied_at, method FROM ${LEDGER} ORDER BY version`)).rows;
}

async function databaseInUse(db) {
  return !!(await db.query(`SELECT to_regclass('public.profiles') AS t`)).rows[0].t;
}

/**
 * Holat: har bir fayl uchun applied | pending | changed, va jurnalda bor-u
 * faylda yo'q versiyalar (missing).
 */
export async function status(db, dir) {
  const files = loadMigrations(dir);
  const rows = await ledgerRows(db);
  const byVersion = new Map(rows.map((r) => [r.version, r]));
  const items = files.map((f) => {
    const r = byVersion.get(f.version);
    if (!r) return { ...f, state: 'pending' };
    return { ...f, state: r.checksum === f.checksum ? 'applied' : 'changed', applied_at: r.applied_at, method: r.method };
  });
  const known = new Set(files.map((f) => f.version));
  const missing = rows.filter((r) => !known.has(r.version)).map((r) => r.version);
  return { items, missing, ledgerEmpty: rows.length === 0, inUse: await databaseInUse(db) };
}

// Har bir migratsiya bazada qoldiradigan iz — jurnal bo'lmagan (qo'lda
// boshqarilgan) bazada qaysilari qo'llanganini aniqlash uchun.
const MARKERS = [
  ['047', `to_regprocedure('public.toggle_habit_atomic(uuid,date,text,numeric)') IS NOT NULL`],
  ['048', `to_regprocedure('public.get_leaderboard_period(text)') IS NOT NULL`],
  ['049', `to_regclass('public.payment_transactions') IS NOT NULL`],
  ['050', `to_regprocedure('public.use_streak_freeze(date)') IS NOT NULL`],
  ['051', `to_regprocedure('public.is_site_admin()') IS NOT NULL`],
  ['052', `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='habits' AND column_name='days_of_week')`],
  ['053', `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='habit_logs' AND column_name='completed_at')`],
  ['054', `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='habit_logs' AND column_name='fail_reason')`],
  ['055', `to_regprocedure('public.get_public_profile_stats(uuid)') IS NOT NULL`],
  ['056', `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='coin_purchases' AND column_name='expires_at')`],
];

/**
 * Qaysi migratsiyalar (047+) bazada iz qoldirgan: { found: ['047', ...],
 * suggest: uzluksiz qo'llangan eng oxirgisi (adopt --through uchun), gaps }.
 */
export async function detectApplied(db) {
  const found = [];
  for (const [v, cond] of MARKERS) {
    if ((await db.query(`SELECT (${cond}) AS ok`)).rows[0].ok) found.push(v);
  }
  let suggest = found.includes('047') ? '046' : null;
  for (const [v] of MARKERS) {
    if (!found.includes(v)) break;
    suggest = v;
  }
  const gaps = found.filter((v) => Number(v) > Number(suggest ?? 0));
  return { found, suggest, gaps };
}

/**
 * Bir martalik: `through` gacha (shu jumladan) bo'lgan fayllarni ishga
 * tushirmasdan "qo'llangan" deb yozadi — qo'lda qo'llangan bazani jurnalga o'tkazish.
 */
export async function adopt(db, dir, through, { log = () => {} } = {}) {
  if (!/^\d+$/.test(String(through))) throw new Error('--through raqam bo\'lishi kerak (masalan 055)');
  const files = loadMigrations(dir);
  if (!files.some((f) => Number(f.version) === Number(through))) {
    throw new Error(`${through} raqamli migratsiya fayli yo'q`);
  }
  await ensureLedger(db);
  const marked = [];
  for (const f of files) {
    if (Number(f.version) > Number(through)) break;
    const r = await db.query(
      `INSERT INTO ${LEDGER} (version, name, checksum, method) VALUES ($1, $2, $3, 'adopt') ON CONFLICT (version) DO NOTHING RETURNING version`,
      [f.version, f.name, f.checksum]
    );
    if (r.rows.length) { marked.push(f.version); log(`  belgilandi: ${f.file}`); }
  }
  return marked;
}

/**
 * Kutilayotgan migratsiyalarni tartib bilan qo'llaydi. Birinchi xatoda to'xtaydi
 * (xato bergan fayl jurnalga yozilmaydi).
 */
export async function up(db, dir, { dryRun = false, log = () => {} } = {}) {
  const st = await status(db, dir);
  if (st.ledgerEmpty && st.inUse) {
    throw new Error(
      "Baza ishlab turibdi, lekin migratsiyalar jurnali bo'sh. Avval bir martalik " +
      "`npm run db:adopt -- --through <prod'da oxirgi qo'llangan raqam>` ni bajaring " +
      '(aks holda eski migratsiyalar qayta ishga tushib ketardi).'
    );
  }
  const pending = st.items.filter((i) => i.state === 'pending');
  const applied = st.items.filter((i) => i.state !== 'pending');
  const maxApplied = applied.reduce((m, i) => Math.max(m, Number(i.version)), -1);
  const outOfOrder = pending.filter((p) => Number(p.version) < maxApplied);
  if (outOfOrder.length) {
    throw new Error(
      `Tartib buzilgan: ${outOfOrder.map((p) => p.file).join(', ')} qo'llangan eng oxirgi (${String(maxApplied).padStart(3, '0')}) ` +
      'migratsiyadan eskiroq raqamga ega. Faylga yangi (kattaroq) raqam bering.'
    );
  }
  for (const c of st.items.filter((i) => i.state === 'changed')) {
    log(`  OGOHLANTIRISH: ${c.file} qo'llangandan keyin o'zgargan (checksum farq qiladi)`);
  }
  if (dryRun || pending.length === 0) return { applied: [], pending: pending.map((p) => p.file) };

  await ensureLedger(db);
  const done = [];
  await db.query(`SELECT pg_advisory_lock(${LOCK_KEY})`);
  try {
    for (const m of pending) {
      // Parallel ishga tushirilgan bo'lsa — boshqasi allaqachon qo'llagan
      const again = await db.query(`SELECT 1 FROM ${LEDGER} WHERE version = $1`, [m.version]);
      if (again.rows.length) continue;
      log(`  qo'llanmoqda: ${m.file}`);
      try {
        await db.exec(m.sql);
      } catch (e) {
        // Fayl ichidagi BEGIN ochiq qolgan bo'lsa — bekor qilinadi
        try { await db.exec('ROLLBACK'); } catch { /* tranzaksiya yo'q */ }
        throw new Error(`${m.file} xato berdi: ${e.message}`);
      }
      await db.query(`INSERT INTO ${LEDGER} (version, name, checksum, method) VALUES ($1, $2, $3, 'run')`, [m.version, m.name, m.checksum]);
      done.push(m.file);
    }
  } finally {
    await db.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`);
  }
  return { applied: done, pending: [] };
}
