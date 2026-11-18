// 052: odatning hafta kunlari (days_of_week) va RLS
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration, readRepoFile } from './harness.mjs';

test("052: odatning hafta kunlari (days_of_week) va RLS", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await db.exec(`ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS habits_all ON habits;
  CREATE POLICY habits_select ON habits FOR SELECT TO authenticated USING (true);
  CREATE POLICY habits_insert_own ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY habits_update_own ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`);
  const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
  await db.exec(`INSERT INTO profiles (id, username, display_name) VALUES ('${A}','a','A'), ('${B}','b','B');
  INSERT INTO habits (id, user_id, name, type) VALUES ('10000000-0000-0000-0000-000000000001','${A}','Eski odat','positive');`);
  await migrate(db, ['052', '052']);
  const q = async (sql) => (await db.query(sql)).rows;
  const as = async (uid, sql) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false); SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',false);`);
    try { return (await db.query(sql)); } finally { await db.exec('RESET ROLE'); }
  };
  const err = async (uid, sql) => { try { await as(uid, sql); return ''; } catch (e) { return e.message; } };
  ok("eski odat — har kuni", JSON.stringify((await q(`SELECT days_of_week d FROM habits`))[0].d) === '[1,2,3,4,5,6,7]');
  await as(A, `INSERT INTO habits (user_id, name, type, days_of_week) VALUES ('${A}','Yugurish','positive','{1,3,5}')`);
  ok("egasi kunlarni tanlab yarata oladi", JSON.stringify((await q(`SELECT days_of_week d FROM habits WHERE name='Yugurish'`))[0].d) === '[1,3,5]');
  await as(A, `UPDATE habits SET days_of_week='{6,7}' WHERE name='Yugurish'`);
  ok("egasi tahrirlay oladi", JSON.stringify((await q(`SELECT days_of_week d FROM habits WHERE name='Yugurish'`))[0].d) === '[6,7]');
  const r = await as(B, `UPDATE habits SET days_of_week='{1}' WHERE name='Yugurish'`);
  ok("boshqa foydalanuvchi o'zgartira olmaydi (RLS)", r.affectedRows === 0 && JSON.stringify((await q(`SELECT days_of_week d FROM habits WHERE name='Yugurish'`))[0].d) === '[6,7]');
  ok("bo'sh massiv rad etiladi", /check/i.test(await err(A, `UPDATE habits SET days_of_week='{}' WHERE name='Yugurish'`)));
  ok("8 kun rad etiladi", /check/i.test(await err(A, `UPDATE habits SET days_of_week='{1,8}' WHERE name='Yugurish'`)));
  ok("NULL rad etiladi", /null/i.test(await err(A, `UPDATE habits SET days_of_week=NULL WHERE name='Yugurish'`)));
  done();
});
