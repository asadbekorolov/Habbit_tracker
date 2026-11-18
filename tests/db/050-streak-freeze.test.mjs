// 050: use_streak_freeze — oyiga 2 bepul, do'kondagisi, sana chegarasi
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration, readRepoFile } from './harness.mjs';

test("050: use_streak_freeze — oyiga 2 bepul, do'kondagisi, sana chegarasi", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await migrate(db, ['047', '048', '049', '050', '050']);
  const U = '00000000-0000-0000-0000-00000000000a';
  await db.exec(`INSERT INTO profiles (id, username, display_name, coins) VALUES ('${U}','a','A',0);`);
  const q = async (sql) => (await db.query(sql)).rows;
  const asUser = async (sql) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${U}',false); SELECT set_config('request.jwt.claims','{"sub":"${U}","role":"authenticated"}',false);`);
    try { return await q(sql); } finally { await db.exec('RESET ROLE'); }
  };
  const err = async (sql) => { try { await asUser(sql); return ''; } catch (e) { return e.message; } };
  const today = (await q(`SELECT tashkent_today()::text d`))[0].d;
  const r1 = (await asUser(`SELECT use_streak_freeze(tashkent_today() - 1) r`))[0].r;
  ok('kechani muzlatish, 1 ta qoldi', r1.remaining === 1, JSON.stringify(r1));
  ok('takroriy — already_frozen', (await err(`SELECT use_streak_freeze(tashkent_today() - 1)`)).includes('already_frozen'));
  ok('2 kun oldin — date_not_allowed', (await err(`SELECT use_streak_freeze(tashkent_today() - 2)`)).includes('date_not_allowed'));
  const r2 = (await asUser(`SELECT use_streak_freeze(tashkent_today()) r`))[0].r;
  ok('bugunni muzlatish, 0 qoldi', r2.remaining === 0, JSON.stringify(r2));
  await db.exec(`DELETE FROM streak_freezes WHERE freeze_date = '${today}'::date`);
  await db.exec(`INSERT INTO streak_freezes (user_id, freeze_date) VALUES ('${U}', date_trunc('month', tashkent_today())::date)`);
  // endi bu oy 2 ta (kecha bu oyda bo'lsa) yoki kamida limitga yaqin
  const used = (await q(`SELECT count(*)::int n FROM streak_freezes WHERE user_id='${U}' AND freeze_date >= date_trunc('month', tashkent_today())::date`))[0].n;
  if (used >= 2) {
    ok('limit tugagan — no_freezes_left', (await err(`SELECT use_streak_freeze(tashkent_today())`)).includes('no_freezes_left'));
    await db.exec(`INSERT INTO coin_purchases (user_id, item_id) VALUES ('${U}', 'streak_freeze')`);
    const r3 = (await asUser(`SELECT use_streak_freeze(tashkent_today()) r`))[0].r;
    ok("do'kondan sotib olingan muzlatish ishlaydi", r3.remaining === 0, JSON.stringify(r3));
  } else console.log('  (oy boshi: limit testi o\'tkazib yuborildi)');
  ok('anon chaqira olmaydi', !(await q(`SELECT has_function_privilege('anon','public.use_streak_freeze(date)','execute') p`))[0].p);
  ok('mijoz streak_freezes ga to\'g\'ridan yoza olmaydi', !!(await err(`INSERT INTO streak_freezes (user_id, freeze_date) VALUES ('${U}', tashkent_today())`)));
  done();
});
