// 055: get_public_profile_stats — faqat yig'ma raqamlar
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration, readRepoFile } from './harness.mjs';

test("055: get_public_profile_stats — faqat yig'ma raqamlar", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await migrate(db, ['047', '048', '052', '053', '054', '055', '055']);
  const { as } = roles(db);
  const U = '00000000-0000-0000-0000-00000000000a', V = '00000000-0000-0000-0000-00000000000b', P = '00000000-0000-0000-0000-00000000000c';
  const H = '10000000-0000-0000-0000-000000000001', H2 = '10000000-0000-0000-0000-000000000002';
  await db.exec(`INSERT INTO profiles (id, username, display_name) VALUES ('${U}','a','A'), ('${V}','v','V');
  INSERT INTO profiles (id, username, display_name, profile_private) VALUES ('${P}','p','P', true);
  INSERT INTO habits (id, user_id, name, type) VALUES ('${H}','${U}','Erta turish','positive'), ('${H2}','${U}','Kitob','positive');
  -- U: bugun, kecha, (3 kun oldin muzlatilgan) 2 kun oldin? yo'q: bugun, -1, -2 muzlatilgan, -3 ; eski zanjir -10..-14 (5 kun)
  INSERT INTO habit_logs (user_id, habit_id, log_date, completed, value) VALUES
   ('${U}','${H}', tashkent_today(), true, 1), ('${U}','${H2}', tashkent_today(), true, 1),
   ('${U}','${H}', tashkent_today()-1, true, 1),
   ('${U}','${H}', tashkent_today()-3, true, 1),
   ('${U}','${H}', tashkent_today()-10, true, 1), ('${U}','${H}', tashkent_today()-11, true, 1), ('${U}','${H}', tashkent_today()-12, true, 1),
   ('${U}','${H}', tashkent_today()-13, true, 1), ('${U}','${H}', tashkent_today()-14, true, 1),
   ('${U}','${H}', tashkent_today()-20, false, 0);
  INSERT INTO streak_freezes (user_id, freeze_date) VALUES ('${U}', tashkent_today()-2);
  INSERT INTO habit_logs (user_id, habit_id, log_date, completed, value) VALUES ('${P}','${H}', tashkent_today(), true, 1);`);
  const s = (await as(V, `SELECT get_public_profile_stats('${U}') s`))[0].s;
  ok('boshqa foydalanuvchi faqat raqamlarni oladi', s && s.private === false && Object.keys(s).sort().join() === 'active_days,best_streak,current_streak,habits_count,private,total_completed', JSON.stringify(s));
  ok('jami bajarilgan = 9, faol kunlar = 8', s.total_completed === 9 && s.active_days === 8, JSON.stringify(s));
  ok('joriy zanjir muzlatilgan kundan o\'tadi: 3', s.current_streak === 3, JSON.stringify(s));
  ok('eng uzun zanjir = 5 (047 ta\'rifi)', s.best_streak === 5, JSON.stringify(s));
  ok('faol odatlar = 2', s.habits_count === 2);
  const p = (await as(V, `SELECT get_public_profile_stats('${P}') s`))[0].s;
  ok('yopiq profil — faqat {private:true}', p.private === true && Object.keys(p).length === 1, JSON.stringify(p));
  const pSelf = (await as(P, `SELECT get_public_profile_stats('${P}') s`))[0].s;
  ok("o'zi yopiq profilini ko'radi", pSelf.private === false && pSelf.total_completed === 1);
  ok("yo'q foydalanuvchi — NULL", (await as(V, `SELECT get_public_profile_stats('00000000-0000-0000-0000-0000000000ff') s`))[0].s === null);
  ok('anon chaqira olmaydi', !(await db.query(`SELECT has_function_privilege('anon','public.get_public_profile_stats(uuid)','execute') p`)).rows[0].p);
  done();
});
