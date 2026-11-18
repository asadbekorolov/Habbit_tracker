// 053: habit_logs.completed_at — backfill va RPC
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration, readRepoFile } from './harness.mjs';

test("053: habit_logs.completed_at — backfill va RPC", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await migrate(db, ['047', '048', '052']);
  const U = '00000000-0000-0000-0000-00000000000a', H = '10000000-0000-0000-0000-000000000001';
  await db.exec(`INSERT INTO profiles (id, username, display_name) VALUES ('${U}','a','A');
  INSERT INTO habits (id, user_id, name, type) VALUES ('${H}','${U}','Yugurish','positive');
  INSERT INTO habit_logs (habit_id, user_id, log_date, completed, created_at) VALUES
   ('${H}','${U}','2026-11-10',true,'2026-11-10 02:30:00+00'),
   ('${H}','${U}','2026-11-11',true,'2026-11-12 03:00:00+00');`);
  await migrate(db, ['053', '053']);
  const q = async (sql) => (await db.query(sql)).rows;
  const rows = await q(`SELECT log_date::text d, completed_at FROM habit_logs ORDER BY log_date`);
  ok("backfill: o'z kunidagi yozuvga created_at", rows[0].completed_at && new Date(rows[0].completed_at).toISOString() === '2026-11-10T02:30:00.000Z', JSON.stringify(rows));
  ok("backfill: ertasi kuni belgilangani — NULL", rows[1].completed_at === null);
  // RPC orqali belgilash (047: _set_habit_status) — avval fail, keyin done
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${U}',false); SELECT set_config('request.jwt.claims','{"sub":"${U}","role":"authenticated"}',false);`);
  await db.query(`SELECT toggle_habit_atomic('${H}', tashkent_today(), 'fail', 0)`);
  let r = (await db.query(`SELECT completed_at FROM habit_logs WHERE log_date = tashkent_today()`)).rows[0];
  ok('bajarilmadi — completed_at NULL', r && r.completed_at === null, JSON.stringify(r));
  await db.query(`SELECT toggle_habit_atomic('${H}', tashkent_today(), 'done', 1)`);
  r = (await db.query(`SELECT completed_at FROM habit_logs WHERE log_date = tashkent_today()`)).rows[0];
  ok('bajarildi — completed_at hozir', r && r.completed_at !== null && Math.abs(new Date(r.completed_at) - Date.now()) < 60000, JSON.stringify(r));
  const first = r.completed_at;
  await db.query(`SELECT toggle_habit_atomic('${H}', tashkent_today(), 'done', 3)`);
  r = (await db.query(`SELECT completed_at FROM habit_logs WHERE log_date = tashkent_today()`)).rows[0];
  ok("qayta 'done' (qiymat o'zgardi) — vaqt saqlanadi", new Date(r.completed_at).getTime() === new Date(first).getTime());
  const own = (await db.query(`SELECT completed_at FROM habit_logs`)).rows;
  ok("egasi completed_at ni o'qiy oladi", own.length >= 1);
  await db.exec('RESET ROLE');
  done();
});
