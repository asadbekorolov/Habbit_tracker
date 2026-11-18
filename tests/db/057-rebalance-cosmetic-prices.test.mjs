// 057: bezak narxlari (150/300/400/600), admin statistikasi va boshqa
// foydalanuvchilarning amaldagi bezaklari expires_at bo'yicha
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker } from './harness.mjs';

test('057: narxlar, admin statistikasi va get_effective_cosmetics', async () => {
  const db = await createDb({ authUsers: true, feedback: true });
  const { ok, done } = checker();
  const A = '00000000-0000-0000-0000-00000000000a', U = '00000000-0000-0000-0000-00000000000b', V = '00000000-0000-0000-0000-00000000000c';
  await db.exec(`INSERT INTO auth.users VALUES ('${A}','asadbekorolov0@gmail.com',now()), ('${U}','u@mail.com',now()), ('${V}','v@mail.com',now());`);
  await migrate(db, ['047', '048', '051']);
  await db.exec(`INSERT INTO profiles (id, username, display_name, coins) VALUES ('${A}','admin','A',0), ('${U}','ali','Ali',1000), ('${V}','vali','Vali',0);`);
  await db.exec(`CREATE TABLE IF NOT EXISTS groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_id uuid);`);
  await db.exec(`ALTER TABLE group_habit_logs ADD COLUMN IF NOT EXISTS approval_status text;`);
  await migrate(db, ['056', '057', '057']); // ikki marta: idempotent
  const { as, err, q } = roles(db);
  const days = (ts) => Math.round((new Date(ts).getTime() - Date.now()) / 86400000);

  const prices = Object.fromEntries((await q(`SELECT id, price, duration_days FROM shop_items WHERE kind IN ('frame','glow')`)).map((r) => [r.id, [r.price, r.duration_days]]));
  ok('narxlar 150 / 300 / 400 / 600, 20 kun', JSON.stringify(prices) === JSON.stringify({ frame_bronze: [150, 20], frame_silver: [300, 20], frame_gold: [600, 20], username_glow: [400, 20] }) ||
    (prices.frame_bronze?.[0] === 150 && prices.frame_silver?.[0] === 300 && prices.frame_gold?.[0] === 600 && prices.username_glow?.[0] === 400 && Object.values(prices).every((p) => p[1] === 20)), JSON.stringify(prices));

  const r1 = (await as(U, `SELECT purchase_shop_item('frame_gold') r`))[0].r;
  ok('Oltin ramka 600 tanga, 20 kun', r1.coins === 400 && days(r1.expires_at) === 20, JSON.stringify(r1));
  const r2 = (await as(U, `SELECT purchase_shop_item('username_glow') r`))[0].r;
  ok('Yaltiroq ism 400 tanga', r2.coins === 0, JSON.stringify(r2));
  ok("tanga yetmasa — insufficient_coins", (await err(U, `SELECT purchase_shop_item('frame_bronze')`)).includes('insufficient_coins'));

  // V: ramka va yaltirash yoqilgan, lekin muddati o'tgan (xarid yaqinda — eski
  // "purchased_at + 30 kun" mantiqi uni faol deb sanardi)
  await db.exec(`INSERT INTO coin_purchases (user_id, item_id, purchased_at, expires_at) VALUES
    ('${V}','frame_silver', now() - interval '5 days', now() - interval '1 minute'),
    ('${V}','username_glow', now() - interval '5 days', now() - interval '1 minute');
    UPDATE profiles SET active_frame = 'frame_silver', username_glow = true WHERE id = '${V}';`);

  const dash = (await as(A, `SELECT get_admin_analytics_dashboard() d`))[0].d;
  ok('admin statistikasi: faqat amaldagi ramkalar (U = 1, V muddati o\'tgan)', dash.economy.active_frames === 1, JSON.stringify(dash.economy));
  ok("admin statistikasi oddiy foydalanuvchiga yopiq", (await err(U, `SELECT get_admin_analytics_dashboard()`)).includes('admin'));

  const eff = Object.fromEntries((await as(A, `SELECT * FROM get_effective_cosmetics(ARRAY['${U}','${V}']::uuid[])`)).map((r) => [r.user_id, r]));
  ok('get_effective_cosmetics: faol ramka va yaltirash ko\'rinadi', eff[U]?.active_frame === 'frame_gold' && eff[U]?.username_glow === true, JSON.stringify(eff[U]));
  ok("get_effective_cosmetics: muddati o'tgani yashiriladi", eff[V] && eff[V].active_frame === null && eff[V].username_glow === false, JSON.stringify(eff[V]));
  ok("profiles jadvali o'zgarmaydi (faqat o'qiladi)", (await q(`SELECT active_frame FROM profiles WHERE id='${V}'`))[0].active_frame === 'frame_silver');
  const big = await as(A, `SELECT count(*)::int n FROM get_effective_cosmetics((SELECT array_agg(gen_random_uuid()) FROM generate_series(1, 2000)) || ARRAY['${U}']::uuid[])`);
  ok('500 tadan ortiq id kesiladi', big[0].n === 0, JSON.stringify(big));
  ok('anon chaqira olmaydi', !(await q(`SELECT has_function_privilege('anon','public.get_effective_cosmetics(uuid[])','execute') p`))[0].p);
  done();
});
