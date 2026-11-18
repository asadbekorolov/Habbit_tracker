// 047: xavfsiz iqtisod — toggle_habit_atomic, do'kon, AI to'lovi, profil maxfiyligi,
// nishonlar, Telegram, guruh tasdig'i. (047 holati; keyingi o'zgarishlar
// o'z testlarida: masalan, 056 dagi yangi narxlar.)
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, checker, readRepoFile } from './harness.mjs';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

test("047: xavfsiz iqtisod va RPC'lar", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  // Rol va JWT bilan alohida tranzaksiyada so'rov
  async function as(role, uid, sql, params = []) {
    await db.exec('BEGIN');
    try {
      await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid || '']);
      await db.exec(`SET LOCAL ROLE ${role}`);
      const r = await db.query(sql, params);
      await db.exec('COMMIT');
      return { rows: r.rows };
    } catch (e) {
      await db.exec('ROLLBACK');
      return { error: e.message };
    }
  }
  const user = (uid, sql, p) => as('authenticated', uid, sql, p);
  const svc = (sql, p) => as('service_role', null, sql, p);
  const bal = async (uid) => (await db.query('SELECT coins, score, total_xp FROM profiles WHERE id = $1', [uid])).rows[0];
  const today = async () => (await db.query('SELECT tashkent_today()::text AS d')).rows[0].d;
  const expectErr = (name, r, re) => ok(name, r.error && re.test(r.error), JSON.stringify(r));
  const expectOk = (name, r) => ok(name, !r.error, r.error || '');

  await migrate(db, ['047', '047']); // ikki marta: idempotent

  await db.exec(`
    INSERT INTO profiles (id, username, display_name, phone, telegram_username, telegram_private)
    VALUES ('${A}', 'a', 'A', '+998901', 'a_tg', true), ('${B}', 'b', 'B', '+998902', 'b_tg', false);
    INSERT INTO habits (id, user_id, name, type) VALUES
      ('10000000-0000-0000-0000-000000000001', '${A}', 'pos', 'positive'),
      ('10000000-0000-0000-0000-000000000002', '${A}', 'neg', 'negative'),
      ('10000000-0000-0000-0000-000000000003', '${B}', 'bpos', 'positive');
  `);
  const HP = '10000000-0000-0000-0000-000000000001';
  const HN = '10000000-0000-0000-0000-000000000002';
  const HB = '10000000-0000-0000-0000-000000000003';
  const D = await today();
  const toggle = (uid, habit, status, date = D) =>
    user(uid, 'SELECT toggle_habit_atomic($1, $2::date, $3) AS r', [habit, date, status]);


  let b0 = await bal(A);
  let r = await toggle(A, HP, 'done');
  expectOk('done works', r);
  let b1 = await bal(A);
  ok('done grants +1 coin/+1 score/+5 xp', b1.coins === b0.coins + 1 && b1.score === b0.score + 1 && b1.total_xp === 5, JSON.stringify(b1));
  r = await toggle(A, HP, 'done');
  let b2 = await bal(A);
  ok('repeat done grants nothing', b2.coins === b1.coins && b2.total_xp === b1.total_xp, JSON.stringify(b2));
  await toggle(A, HP, 'neutral');
  let b3 = await bal(A);
  ok('neutral revokes reward', b3.coins === b0.coins && b3.score === b0.score && b3.total_xp === 0, JSON.stringify(b3));
  for (let i = 0; i < 5; i++) { await toggle(A, HP, 'done'); await toggle(A, HP, 'neutral'); }
  let b4 = await bal(A);
  ok('5x done/neutral cycle -> balance unchanged', b4.coins === b0.coins && b4.total_xp === 0, JSON.stringify(b4));
  await toggle(A, HP, 'done');
  await toggle(A, HP, 'fail');
  let b5 = await bal(A);
  ok('fail also revokes', b5.coins === b0.coins, JSON.stringify(b5));
  let logRow = (await db.query('SELECT completed FROM habit_logs WHERE habit_id = $1 AND log_date = $2', [HP, D])).rows[0];
  ok('fail writes completed=false log', logRow && logRow.completed === false);
  await toggle(A, HP, 'neutral');
  logRow = (await db.query('SELECT 1 FROM habit_logs WHERE habit_id = $1 AND log_date = $2', [HP, D])).rows;
  ok('neutral deletes log', logRow.length === 0);

  let bn0 = await bal(A);
  r = await toggle(A, HN, 'done');
  let bn1 = await bal(A);
  ok('negative kept: +10 coins +15 xp (+ quest bonus)', bn1.total_xp === bn0.total_xp + 15 && bn1.coins >= bn0.coins + 10, JSON.stringify(bn1));
  await toggle(A, HN, 'neutral');
  let bn2 = await bal(A);
  ok('negative neutral returns to start (quests revoked too)', bn2.coins === bn0.coins && bn2.score === bn0.score && bn2.total_xp === bn0.total_xp, JSON.stringify([bn0, bn2]));


  await svc(`UPDATE profiles SET coins = 0, score = 0, total_xp = 0 WHERE id = '${A}'`);
  await toggle(A, HN, 'done');            // +10 (+5 quest q_negative_win)
  let s1 = await bal(A);
  await svc(`INSERT INTO shop_items (id, kind, price, repeatable) VALUES ('test_item', 'buff', ${s1.coins}, true) ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price`);
  r = await user(A, `SELECT purchase_shop_item('test_item') AS r`);
  expectOk('spend all coins', r);
  await toggle(A, HN, 'neutral');
  let s2 = await bal(A);
  ok('revoke after spending leaves debt (negative coins)', s2.coins === -s1.coins, JSON.stringify(s2));
  await toggle(A, HN, 'done');
  let s3 = await bal(A);
  ok('re-done only clears debt, no free coins', s3.coins === 0, JSON.stringify(s3));
  r = await user(A, `SELECT purchase_shop_item('streak_freeze') AS r`);
  expectErr('cannot buy with 0 coins', r, /insufficient_coins/);
  await toggle(A, HN, 'neutral');


  expectErr('2 days ago is locked', await toggle(A, HP, 'done', 'today'.length && (await db.query(`SELECT (tashkent_today() - 2)::text d`)).rows[0].d), /date_locked/);
  expectErr('tomorrow is locked', await toggle(A, HP, 'done', (await db.query(`SELECT (tashkent_today() + 1)::text d`)).rows[0].d), /date_locked/);
  expectErr("someone else's habit", await toggle(A, HB, 'done'), /habit_not_found/);
  expectErr('invalid status', await toggle(A, HP, 'maybe'), /invalid_status/);
  expectErr('anon cannot toggle', await as('anon', null, `SELECT toggle_habit_atomic('${HP}', '${D}', 'done')`), /permission denied/);


  expectErr('insert habit_logs directly', await user(A, `INSERT INTO habit_logs (habit_id, user_id, log_date, completed) VALUES ('${HP}', '${A}', '${D}', true)`), /permission denied/);
  expectErr('increment_coins', await user(A, `SELECT increment_coins('${A}', 1000000)`), /permission denied/);
  expectErr('increment_score', await user(A, `SELECT increment_score('${A}', 1000000)`), /permission denied/);
  expectErr('spend_coins', await user(A, `SELECT spend_coins('${A}', 1)`), /permission denied/);
  expectErr('add_xp_to_user', await user(A, `SELECT add_xp_to_user('${HP}', 50)`), /permission denied/);
  expectErr('claim_daily_quest', await user(A, `SELECT claim_daily_quest('${A}', 'q_complete_3')`), /permission denied/);
  expectErr('reconcile for another user', await user(A, `SELECT reconcile_daily_missions('${B}', '${D}')`), /not_authorized/);
  expectOk('reconcile for self', await user(A, `SELECT reconcile_daily_missions('${A}', '${D}')`));
  expectErr('insert coin_purchases directly', await user(A, `INSERT INTO coin_purchases (user_id, item_id) VALUES ('${A}', 'frame_gold')`), /permission denied/);
  expectErr('internal _set_habit_status', await user(A, `SELECT _set_habit_status('${A}', '${HP}', '${D}', 'done')`), /permission denied/);
  expectErr('internal _apply_balance', await user(A, `SELECT _apply_balance('${A}', 0, 999, 0)`), /permission denied/);
  expectErr('update own coins', await user(A, `UPDATE profiles SET coins = 99999 WHERE id = '${A}'`), /permission denied/);
  expectErr('update own username_glow', await user(A, `UPDATE profiles SET username_glow = true WHERE id = '${A}'`), /permission denied/);
  expectErr('update own active_frame', await user(A, `UPDATE profiles SET active_frame = 'frame_gold' WHERE id = '${A}'`), /permission denied/);
  expectOk('update own display_name', await user(A, `UPDATE profiles SET display_name = 'AA' WHERE id = '${A}'`));
  expectErr('insert profile with coins', await user('00000000-0000-0000-0000-0000000000cc', `INSERT INTO profiles (id, username, coins) VALUES ('00000000-0000-0000-0000-0000000000cc', 'cc', 9999)`), /permission denied/);
  expectOk('insert profile with allowed columns', await user('00000000-0000-0000-0000-0000000000cc', `INSERT INTO profiles (id, username, display_name) VALUES ('00000000-0000-0000-0000-0000000000cc', 'cc', 'C')`));


  await svc(`UPDATE profiles SET coins = 100 WHERE id = '${A}'`);
  r = await user(A, `SELECT purchase_shop_item('frame_gold') AS r`);
  expectOk('buy frame_gold', r);
  let shopB = await bal(A);
  ok('frame_gold costs 50 (server price)', shopB.coins === 50, JSON.stringify(shopB));
  let fr = (await db.query(`SELECT active_frame FROM profiles WHERE id = '${A}'`)).rows[0];
  ok('frame auto-equipped', fr.active_frame === 'frame_gold');
  expectErr('insufficient coins', await user(A, `SELECT purchase_shop_item('title_master')`), /insufficient_coins/);
  expectOk('buy username_glow', await user(A, `SELECT purchase_shop_item('username_glow')`));
  expectErr('glow twice -> already_owned', await user(A, `SELECT purchase_shop_item('username_glow')`), /already_owned/);
  expectErr('unknown item', await user(A, `SELECT purchase_shop_item('free_money')`), /unknown_item/);
  expectErr('equip unowned frame', await user(A, `SELECT equip_cosmetic('frame', 'frame_silver')`), /not_owned/);
  expectOk('equip owned frame', await user(A, `SELECT equip_cosmetic('frame', 'frame_gold')`));
  expectOk('unequip frame', await user(A, `SELECT equip_cosmetic('frame', NULL)`));
  await svc(`UPDATE profiles SET coins = 600 WHERE id = '${A}'`);
  expectOk('buy_star still works (internal spend_coins)', await user(A, `SELECT buy_star('${A}')`));
  ok('buy_star charged 500', (await bal(A)).coins === 100);


  expectErr('user cannot call spend_coins_for_ai', await user(A, `SELECT spend_coins_for_ai('${A}')`), /permission denied/);
  expectErr('service: insufficient for AI', await svc(`SELECT spend_coins_for_ai('${A}')`), /insufficient_coins/);
  await svc(`UPDATE profiles SET coins = 250 WHERE id = '${A}'`);
  expectOk('service: charge AI', await svc(`SELECT spend_coins_for_ai('${A}')`));
  ok('AI costs 200', (await bal(A)).coins === 50);
  expectOk('service: refund AI', await svc(`SELECT refund_coins_for_ai('${A}')`));
  ok('refund returns 200', (await bal(A)).coins === 250);


  expectErr('B cannot read A phone', await user(B, `SELECT phone FROM profiles WHERE id = '${A}'`), /permission denied/);
  expectErr('select * on profiles fails', await user(B, `SELECT * FROM profiles`), /permission denied/);
  expectErr('telegram_username hidden', await user(B, `SELECT telegram_username FROM profiles`), /permission denied/);
  r = await user(B, `SELECT display_name, score, coins, active_frame FROM profiles WHERE id = '${A}'`);
  ok('public columns readable', !r.error && r.rows.length === 1, JSON.stringify(r));
  r = await user(A, `SELECT get_my_profile() AS p`);
  ok('get_my_profile returns own phone', !r.error && r.rows[0].p.phone === '+998901', JSON.stringify(r));
  r = await user(B, `SELECT get_telegram_contact('${A}') AS c`);
  ok('private telegram hidden', !r.error && r.rows[0].c.username === null && r.rows[0].c.has_telegram === true, JSON.stringify(r));
  r = await user(A, `SELECT get_telegram_contact('${B}') AS c`);
  ok('public telegram visible', !r.error && r.rows[0].c.username === 'b_tg', JSON.stringify(r));
  await db.exec(`INSERT INTO telegram_requests (requester_id, target_id, status) VALUES ('${B}', '${A}', 'approved')`);
  r = await user(B, `SELECT get_telegram_contact('${A}') AS c`);
  ok('approved request reveals telegram', !r.error && r.rows[0].c.username === 'a_tg', JSON.stringify(r));


  await svc(`UPDATE profiles SET coins = 0, score = 0 WHERE id = '${A}'`);
  await toggle(A, HP, 'done');
  let bb0 = await bal(A);
  r = await user(A, `SELECT claim_badge_reward('first_step') AS r`);
  expectOk('claim first_step', r);
  let bb1 = await bal(A);
  ok('first_step gives +5 coins +20 score', bb1.coins === bb0.coins + 5 && bb1.score === bb0.score + 20, JSON.stringify([bb0, bb1]));
  expectErr('claim twice', await user(A, `SELECT claim_badge_reward('first_step')`), /already_claimed/);
  expectErr('not eligible', await user(A, `SELECT claim_badge_reward('consistency_7')`), /not_eligible/);
  expectErr('unknown badge', await user(A, `SELECT claim_badge_reward('free')`), /unknown_badge/);
  await toggle(A, HP, 'neutral');


  r = await user(A, `SELECT create_telegram_link_token() AS t`);
  const tok = r.rows?.[0]?.t;
  ok('token created', !!tok && tok.length === 32, JSON.stringify(r));
  expectErr('user cannot link directly', await user(A, `SELECT link_telegram_account('${tok}', 555)`), /permission denied/);
  expectErr('anon cannot read habits via bot fn', await as('anon', null, `SELECT get_habits_for_telegram(555)`), /permission denied/);
  r = await svc(`SELECT link_telegram_account('${tok}', 555) AS r`);
  ok('service links with token', !r.error && r.rows[0].r.ok === true, JSON.stringify(r));
  r = await svc(`SELECT link_telegram_account('${tok}', 777) AS r`);
  ok('token is single-use', !r.error && r.rows[0].r.ok === false, JSON.stringify(r));
  r = await svc(`SELECT link_telegram_account('deadbeef', 777) AS r`);
  ok('random token rejected', !r.error && r.rows[0].r.ok === false);
  let t0 = await bal(A);
  r = await svc(`SELECT complete_habit_via_telegram(555, '${HP}') AS r`);
  ok('bot completes habit', !r.error && r.rows[0].r.ok === true && r.rows[0].r.already_done === false, JSON.stringify(r));
  let t1 = await bal(A);
  await toggle(A, HP, 'done');
  let t2 = await bal(A);
  ok('bot + app on same habit -> one reward', t1.total_xp === t0.total_xp + 5 && t2.total_xp === t1.total_xp && t2.coins === t1.coins, JSON.stringify([t0, t1, t2]));
  r = await svc(`SELECT get_habits_for_telegram(555) AS r`);
  ok('bot sees habit as done', !r.error && r.rows[0].r.habits.some((h) => h.done), JSON.stringify(r));
  await toggle(A, HP, 'neutral');


  await db.exec(`
    INSERT INTO groups (id, admin_id) VALUES ('20000000-0000-0000-0000-000000000001', '${B}');
    INSERT INTO group_habits (id, group_id, name) VALUES ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'g');
    INSERT INTO group_habit_links (group_habit_id, user_id, habit_id) VALUES ('30000000-0000-0000-0000-000000000001', '${A}', '${HP}');
    INSERT INTO group_habit_logs (id, group_habit_id, group_id, user_id, log_date) VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '${A}', '${D}');
  `);
  await toggle(A, HP, 'done');
  let g0 = await bal(A);
  expectErr('member cannot approve', await user(A, `SELECT approve_group_log('40000000-0000-0000-0000-000000000001')`), /sardor/);
  expectOk('group admin approves', await user(B, `SELECT approve_group_log('40000000-0000-0000-0000-000000000001')`));
  let g1 = await bal(A);
  ok('approval of already-done habit gives no extra reward', g1.coins === g0.coins && g1.total_xp === g0.total_xp, JSON.stringify([g0, g1]));
  done();
});

test('047: supabase/tests/047_verify.sql — barcha tekshiruvlar PASS, ma\'lumot qolmaydi', async () => {
  const db = await createDb();
  await migrate(db, ['047']);
  await db.exec(`
    INSERT INTO profiles (id, username, display_name, coins) VALUES ('${A}','a','A', 7), ('${B}','b','B', 0);
    INSERT INTO habits (user_id, name, type) VALUES ('${A}','p','positive');`);
  const sql = readRepoFile('supabase/tests/047_verify.sql');
  const idx = sql.lastIndexOf('SELECT * FROM public._verify_047();');
  await db.exec(sql.slice(0, idx));
  const rows = (await db.query('SELECT * FROM public._verify_047();')).rows;
  const { ok, done } = checker();
  ok('natijalar bor', rows.length > 5, String(rows.length));
  for (const r of rows) ok(`#${r.n} ${r.test}`, r.result === 'PASS', r.detail || '');
  const after = (await db.query(`SELECT (SELECT count(*)::int FROM habit_logs) logs, (SELECT coins FROM profiles WHERE username='a') coins`)).rows[0];
  ok("tekshiruv ma'lumot qoldirmaydi", after.logs === 0 && after.coins === 7, JSON.stringify(after));
  await db.exec(sql); // ikkinchi to'liq ishga tushirish
  done();
});
