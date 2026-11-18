// 048: davrlar bo'yicha reyting (get_leaderboard_period, get_my_leaderboard_rank)
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, checker, readRepoFile } from './harness.mjs';

test("048: davrlar bo'yicha reyting", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await migrate(db, ['047', '048', '048']);
  const q = async (sql) => (await db.query(sql)).rows;
  // Seed: A (2 habits, created 10 days ago), B (1 habit, private, new), C banned, D no habits
  const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', C='00000000-0000-0000-0000-00000000000c', D='00000000-0000-0000-0000-00000000000d';
  await db.exec(`
    INSERT INTO profiles (id, username, display_name, avatar_url, profile_private, is_banned, score, created_at) VALUES
     ('${A}','alice','Alice Smith','http://a.png',false,false,50, now() - interval '9 days'),
     ('${B}','bob','Bob','http://b.png',true,false,10, now()),
     ('${C}','carl','Carl','',false,true,999, now() - interval '100 days'),
     ('${D}','dan','Dan','',false,false,0, now());
    INSERT INTO habits (id, user_id, name, type) VALUES
     ('10000000-0000-0000-0000-000000000001','${A}','a1','positive'),
     ('10000000-0000-0000-0000-000000000002','${A}','a2','positive'),
     ('10000000-0000-0000-0000-000000000003','${B}','b1','positive'),
     ('10000000-0000-0000-0000-000000000004','${C}','c1','positive'),
     ('10000000-0000-0000-0000-000000000005','${A}','a3','positive');
    -- A: today both done, yesterday one done, 20 days ago one done (outside account age → not counted for monthly since age 10)
    INSERT INTO habit_logs (habit_id, user_id, log_date, completed) VALUES
     ('10000000-0000-0000-0000-000000000001','${A}', tashkent_today(), true),
     ('10000000-0000-0000-0000-000000000002','${A}', tashkent_today(), true),
     ('10000000-0000-0000-0000-000000000001','${A}', tashkent_today()-1, true),
     ('10000000-0000-0000-0000-000000000003','${B}', tashkent_today(), false),
     ('10000000-0000-0000-0000-000000000004','${C}', tashkent_today(), true);
  `);


  const daily = await q(`SELECT * FROM get_leaderboard_period('daily')`);
  ok('daily: A first, 2/3 = 67%', daily[0]?.username === 'alice' && daily[0].efficiency_pct === 67 && daily[0].completed_count === 2 && Number(daily[0].rank) === 1, JSON.stringify(daily));
  ok('banned C excluded, no-habit D excluded', !daily.some(r => ['carl','dan'].includes(r.username)));
  const bob = daily.find(r => r.username === 'bob');
  ok('private B: avatar hidden, label=username', bob && bob.avatar_url === null && bob.display_label === 'bob' && bob.efficiency_pct === 0, JSON.stringify(bob));
  const monthly = await q(`SELECT * FROM get_leaderboard_period('monthly')`);
  const am = monthly.find(r => r.username === 'alice');
  ok('monthly A: 3 / (3 habits × 10 days) = 10%', am.completed_count === 3 && am.efficiency_pct === 10, JSON.stringify(am));
  ok('label "Alice S."', am.display_label === 'Alice S.', am.display_label);
  const all = await q(`SELECT * FROM get_leaderboard_period('all')`);
  ok('all A same as monthly (age 10 days)', all.find(r=>r.username==='alice').efficiency_pct === 10);
  try { await q(`SELECT * FROM get_leaderboard_period('weekly_bad')`); ok('invalid period', false); } catch (e) { ok('invalid period raises', /invalid_period/.test(e.message), e.message); }
  // rank as user
  await db.exec('BEGIN'); await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [B]); await db.exec('SET LOCAL ROLE authenticated');
  const rB = (await db.query(`SELECT get_my_leaderboard_rank('daily') r`)).rows[0].r;
  let denied = false; try { await db.query(`SELECT * FROM _leaderboard_rows('daily')`); } catch (e) { denied = /permission denied/.test(e.message); }
  await db.exec('ROLLBACK');
  ok('B rank daily = 2', rB === 2, String(rB));
  ok('_leaderboard_rows denied for user', denied);
  // supabase/tests/048_verify.sql
  const sql = readRepoFile('supabase/tests/048_verify.sql');
  const idx = sql.lastIndexOf('SELECT * FROM public._verify_048();');
  await db.exec(sql.slice(0, idx));
  const res = (await db.query('SELECT * FROM public._verify_048();')).rows;
  ok('048_verify natijalari bor', res.length > 3);
  for (const r of res) ok(`048_verify #${r.n} ${r.test}`, r.result === 'PASS', r.detail || '');
  done();
});
