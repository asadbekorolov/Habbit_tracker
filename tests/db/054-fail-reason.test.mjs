// 054: 'bajarilmadi' sababi — set_habit_fail_reason
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration, readRepoFile } from './harness.mjs';

test("054: 'bajarilmadi' sababi — set_habit_fail_reason", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await migrate(db, ['047', '048', '052', '053', '054', '054']);
  const U = '00000000-0000-0000-0000-00000000000a', V = '00000000-0000-0000-0000-00000000000b', H = '10000000-0000-0000-0000-000000000001';
  await db.exec(`INSERT INTO profiles (id, username, display_name) VALUES ('${U}','a','A'), ('${V}','v','V');
  INSERT INTO habits (id, user_id, name, type) VALUES ('${H}','${U}','Erta turish','positive');`);
  const as = async (uid, sql) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false); SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',false);`);
    try { return (await db.query(sql)).rows; } finally { await db.exec('RESET ROLE'); }
  };
  const err = async (uid, sql) => { try { await as(uid, sql); return ''; } catch (e) { return e.message; } };
  const reason = async () => (await db.query(`SELECT fail_reason FROM habit_logs WHERE habit_id='${H}' AND log_date = tashkent_today()`)).rows[0]?.fail_reason;
  
  await as(U, `SELECT toggle_habit_atomic('${H}', tashkent_today(), 'fail', 0)`);
  const r1 = (await as(U, `SELECT set_habit_fail_reason('${H}', tashkent_today(), '  Kech uxladim, telefon  ') r`))[0].r;
  ok("bajarilmadi + sabab saqlanadi (bo'shliqlar kesiladi)", r1 === true && (await reason()) === 'Kech uxladim, telefon', String(await reason()));
  await as(U, `SELECT toggle_habit_atomic('${H}', tashkent_today(), 'done', 1)`);
  ok("bajarildi — sabab avtomatik NULL", (await reason()) === null);
  const r2 = (await as(U, `SELECT set_habit_fail_reason('${H}', tashkent_today(), 'x') r`))[0].r;
  ok("bajarilgan yozuvga sabab yozilmaydi", r2 === false && (await reason()) === null);
  await as(U, `SELECT toggle_habit_atomic('${H}', tashkent_today(), 'fail', 0)`);
  await as(U, `SELECT set_habit_fail_reason('${H}', tashkent_today(), 'y')`);
  await as(U, `SELECT toggle_habit_atomic('${H}', tashkent_today(), 'neutral', 0)`);
  ok("belgisiz holat — yozuv (va sabab) o'chadi", (await reason()) === undefined);
  await as(U, `SELECT toggle_habit_atomic('${H}', tashkent_today(), 'fail', 0)`);
  const r3 = (await as(V, `SELECT set_habit_fail_reason('${H}', tashkent_today(), 'begona') r`))[0].r;
  ok("boshqa foydalanuvchi sabab yoza olmaydi", r3 === false && (await reason()) === null);
  ok("yopiq kun — date_locked", (await err(U, `SELECT set_habit_fail_reason('${H}', tashkent_today() - 5, 'eski')`)).includes('date_locked'));
  ok("500 belgidan uzun matn kesiladi", (await as(U, `SELECT set_habit_fail_reason('${H}', tashkent_today(), repeat('a', 900)) r`))[0].r === true && (await reason()).length === 500);
  ok('anon chaqira olmaydi', !(await db.query(`SELECT has_function_privilege('anon','public.set_habit_fail_reason(uuid,date,text)','execute') p`)).rows[0].p);
  done();
});
