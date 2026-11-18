// 051: admin faqat asadbekorolov0@gmail.com, habit_logs maxfiyligi
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration, readRepoFile } from './harness.mjs';

test("051: admin faqat asadbekorolov0@gmail.com, habit_logs maxfiyligi", async () => {
  const db = await createDb({ authUsers: true });
  const { ok, done } = checker();
  const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';
  await db.exec(`INSERT INTO auth.users VALUES ('${A}','AsadbekOrolov0@gmail.com',now()), ('${B}','other@mail.com',now()), ('${C}','asadbekorolov0@gmail.com.evil.com',now());`);
  await migrate(db, ['047', '048', '049', '050']);
  await db.exec(`INSERT INTO profiles (id, username, display_name, is_admin) VALUES ('${A}','a','A',false), ('${B}','b','B',true), ('${C}','c','C',false);`);
  await db.exec(`INSERT INTO habits (id, user_id, name, emoji, type) VALUES ('10000000-0000-0000-0000-000000000001','${A}','x','','positive'), ('10000000-0000-0000-0000-000000000002','${B}','y','','positive');`);
  await db.exec(`INSERT INTO habit_logs (habit_id, user_id, log_date, completed) VALUES ('10000000-0000-0000-0000-000000000001','${A}',current_date,true), ('10000000-0000-0000-0000-000000000002','${B}',current_date,true);`);
  await migrate(db, ['051', '051']);
  const q = async (sql) => (await db.query(sql)).rows;
  const admins = (await q(`SELECT id FROM profiles WHERE is_admin ORDER BY id`)).map(r => r.id);
  ok('faqat asadbekorolov0@gmail.com admin (katta-kichik harf farqsiz)', admins.length === 1 && admins[0] === A, JSON.stringify(admins));
  await db.exec(`UPDATE profiles SET is_admin = true WHERE id = '${B}'`);
  ok("boshqasini admin qilib bo'lmaydi (trigger)", !(await q(`SELECT is_admin FROM profiles WHERE id='${B}'`))[0].is_admin);
  await db.exec(`UPDATE profiles SET is_admin = false WHERE id = '${A}'`);
  ok('asl admin belgisi saqlanadi', (await q(`SELECT is_admin FROM profiles WHERE id='${A}'`))[0].is_admin);
  await db.exec(`INSERT INTO profiles (id, username, display_name, is_admin) VALUES ('00000000-0000-0000-0000-00000000000d','d','D',true)`);
  ok("yangi profil o'zini admin qila olmaydi", !(await q(`SELECT is_admin FROM profiles WHERE id='00000000-0000-0000-0000-00000000000d'`))[0].is_admin);
  const asUser = async (uid, sql) => {
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false); SELECT set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',false);`);
    try { return (await db.query(sql)).rows; } finally { await db.exec('RESET ROLE'); }
  };
  const bSees = await asUser(B, `SELECT user_id FROM habit_logs`);
  ok("oddiy foydalanuvchi faqat o'z yozuvlarini ko'radi", bSees.length === 1 && bSees[0].user_id === B, JSON.stringify(bSees));
  const aSees = await asUser(A, `SELECT user_id FROM habit_logs`);
  ok('admin hammasini ko\'radi', aSees.length === 2, JSON.stringify(aSees));
  ok('is_site_admin(): admin true, boshqa false', (await asUser(A, `SELECT is_site_admin() v`))[0].v === true && (await asUser(B, `SELECT is_site_admin() v`))[0].v === false);
  let threw = ''; try { await asUser(B, `SELECT _is_site_admin_uid('${A}')`); } catch (e) { threw = e.message; }
  ok('ichki funksiya mijozga yopiq', /permission/i.test(threw), threw);
  done();
});
