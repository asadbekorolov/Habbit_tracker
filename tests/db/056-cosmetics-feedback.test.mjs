// 056: kosmetika (20 kun, narxlar, yoqish/o'chirish, qayta sotib olish) va
// fikr-takliflar (RLS, adminga bildirishnoma, admin RPC'lari)
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker, readMigration } from './harness.mjs';

test('056: kosmetika va fikr-takliflar', async () => {
  const db = await createDb({ authUsers: true, feedback: true });
  const { ok, done } = checker();
  const A = '00000000-0000-0000-0000-00000000000a', U = '00000000-0000-0000-0000-00000000000b', V = '00000000-0000-0000-0000-00000000000c';
  await db.exec(`INSERT INTO auth.users VALUES ('${A}','asadbekorolov0@gmail.com',now()), ('${U}','u@mail.com',now()), ('${V}','v@mail.com',now());`);
  await migrate(db, ['047', '048', '051']);
  await db.exec(`INSERT INTO profiles (id, username, display_name, full_name, coins) VALUES
    ('${A}','admin','Asadbek','Asadbek Orolov',0), ('${U}','ali','Ali','Ali Valiyev',5000), ('${V}','vali','Vali',NULL,100);
  INSERT INTO habits (id, user_id, name, type) VALUES ('10000000-0000-0000-0000-000000000001','${U}','x','positive'), ('10000000-0000-0000-0000-000000000002','${V}','y','positive');
  INSERT INTO coin_purchases (user_id, item_id, purchased_at) VALUES
    ('${V}','frame_bronze', now() - interval '25 days'),
    ('${V}','frame_silver', now() - interval '35 days'),
    ('${V}','username_glow', now() - interval '100 days');
  UPDATE profiles SET active_frame = 'frame_bronze', username_glow = true WHERE id = '${V}';`);
  await db.exec(`INSERT INTO user_feedback (user_id, content, created_at) VALUES ('${V}', 'Eski fikr', now() - interval '3 days');`);
  // Eski mijozlar yozgan (qo'lda yaratilgan) feedback_reports jadvali
  await db.exec(`CREATE TABLE feedback_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, message text, created_at timestamptz DEFAULT now());
  INSERT INTO feedback_reports (user_id, type, message, created_at) VALUES ('${U}', 'bug', 'Ilova qotib qoldi', now() - interval '2 days');`);
  await migrate(db, ['056', '056']); // ikki marta: idempotent
  const { as, err, q } = roles(db);
  const days = (ts) => Math.round((new Date(ts).getTime() - Date.now()) / 86400000);


  const items = Object.fromEntries((await q(`SELECT id, price, duration_days, repeatable FROM shop_items WHERE kind IN ('frame','glow')`)).map(r => [r.id, r]));
  ok('narxlar: 300 / 600 / 1000 / 800', items.frame_bronze.price === 300 && items.frame_silver.price === 600 && items.frame_gold.price === 1000 && items.username_glow.price === 800, JSON.stringify(items));
  ok('hammasi 20 kun, qayta sotib olinadi', Object.values(items).every(r => r.duration_days === 20 && r.repeatable));
  const legacy = Object.fromEntries((await q(`SELECT item_id, expires_at FROM coin_purchases WHERE user_id='${V}'`)).map(r => [r.item_id, r.expires_at]));
  ok("eski ramka o'z 30 kunini saqlaydi (5 kun qoldi)", days(legacy.frame_bronze) === 5, legacy.frame_bronze);
  ok('eski yaltirash: bugundan 20 kun', days(legacy.username_glow) === 20, legacy.username_glow);

  const r1 = (await as(U, `SELECT purchase_shop_item('frame_gold') r`))[0].r;
  ok('xarid: 1000 tanga yechildi, 20 kun', r1.coins === 4000 && days(r1.expires_at) === 20, JSON.stringify(r1));
  ok('xarid ramkani taqadi', (await q(`SELECT active_frame FROM profiles WHERE id='${U}'`))[0].active_frame === 'frame_gold');
  ok("faol ramkani qayta sotib bo'lmaydi", (await err(U, `SELECT purchase_shop_item('frame_gold')`)).includes('already_active'));
  ok("balans o'zgarmadi", (await q(`SELECT coins FROM profiles WHERE id='${U}'`))[0].coins === 4000);
  await as(U, `SELECT equip_cosmetic('frame', NULL)`);
  ok('yechish: active_frame = NULL', (await q(`SELECT active_frame FROM profiles WHERE id='${U}'`))[0].active_frame === null);
  ok('yechish muddatni kuydirmaydi', days((await q(`SELECT expires_at FROM coin_purchases WHERE user_id='${U}' AND item_id='frame_gold'`))[0].expires_at) === 20);
  await as(U, `SELECT equip_cosmetic('frame', 'frame_gold')`);
  ok('qayta taqish ishlaydi', (await q(`SELECT active_frame FROM profiles WHERE id='${U}'`))[0].active_frame === 'frame_gold');
  ok("sotib olinmagan ramkani taqib bo'lmaydi", (await err(U, `SELECT equip_cosmetic('frame', 'frame_silver')`)).includes('not_owned'));

  await as(U, `SELECT purchase_shop_item('username_glow')`);
  ok('yaltirash xaridi yoqadi', (await q(`SELECT username_glow FROM profiles WHERE id='${U}'`))[0].username_glow === true);
  await as(U, `SELECT equip_cosmetic('glow', NULL)`);
  ok("yaltirashni o'chirish", (await q(`SELECT username_glow FROM profiles WHERE id='${U}'`))[0].username_glow === false);
  await as(U, `SELECT equip_cosmetic('glow', 'username_glow')`);
  ok('yaltirashni qayta yoqish', (await q(`SELECT username_glow FROM profiles WHERE id='${U}'`))[0].username_glow === true);
  ok("faol yaltirashni qayta sotib bo'lmaydi", (await err(U, `SELECT purchase_shop_item('username_glow')`)).includes('already_active'));

  ok("muddati o'tgan ramkani taqib bo'lmaydi", (await err(V, `SELECT equip_cosmetic('frame', 'frame_silver')`)).includes('not_owned'));
  await db.exec(`UPDATE coin_purchases SET expires_at = now() - interval '1 minute' WHERE user_id='${V}'`);
  const lb = Object.fromEntries((await as(U, `SELECT id, active_frame, username_glow FROM get_leaderboard_period('monthly')`)).map(r => [r.id, r]));
  ok("reyting: muddati o'tgan ramka va yaltirash ko'rinmaydi", lb[V] && lb[V].active_frame === null && lb[V].username_glow === false, JSON.stringify(lb[V]));
  ok("reyting: faol ramka va yaltirash ko'rinadi", lb[U] && lb[U].active_frame === 'frame_gold' && lb[U].username_glow === true, JSON.stringify(lb[U]));
  ok('cleanup: NULL qaytaradi', (await as(V, `SELECT cleanup_expired_frame('${V}') f`))[0].f === null);
  const pv = (await q(`SELECT active_frame, username_glow FROM profiles WHERE id='${V}'`))[0];
  ok('cleanup: ramka va yaltirash yechildi', pv.active_frame === null && pv.username_glow === false, JSON.stringify(pv));
  ok('cleanup faol ramkaga tegmaydi', (await as(U, `SELECT cleanup_expired_frame('${U}') f`))[0].f === 'frame_gold');
  await db.exec(`UPDATE profiles SET coins = 700 WHERE id='${V}'`);
  const r2 = (await as(V, `SELECT purchase_shop_item('frame_silver') r`))[0].r;
  ok('muddat tugagach yana sotib olish: 600, yangi 20 kun', r2.coins === 100 && days(r2.expires_at) === 20, JSON.stringify(r2));
  ok('anon xarid qila olmaydi', !(await q(`SELECT has_function_privilege('anon','public.purchase_shop_item(text)','execute') p`))[0].p);
  ok("ichki funksiya authenticated'ga yopiq", !(await q(`SELECT has_function_privilege('authenticated','public._cosmetic_expires_at(uuid,text)','execute') p`))[0].p);
  ok("mijoz coin_purchases'ga yoza olmaydi", (await err(U, `INSERT INTO coin_purchases (user_id, item_id) VALUES ('${U}','frame_bronze')`)).length > 0);
  // ---- Fikr va takliflar
  {
    const notifs = async () => q(`SELECT user_id, title, body, type, link FROM notifications WHERE type = 'feedback_new' ORDER BY body`);

      const moved = await q(`SELECT type FROM user_feedback WHERE user_id='${U}' AND content='Ilova qotib qoldi'`);
      ok("feedback_reports dagi eski yozuv ko'chirildi (bir marta, turi bilan)", moved.length === 1 && moved[0].type === 'bug', JSON.stringify(moved));
      ok("eski fikr turi 'feedback', o'qilmagan", (await q(`SELECT type, is_read FROM user_feedback WHERE content='Eski fikr'`))[0].type === 'feedback');
      ok("ko'chirilgan eski xabarlar adminga bildirishnoma yubormaydi", (await notifs()).length === 0);

      await as(U, `INSERT INTO user_feedback (user_id, content, type) VALUES ('${U}', 'Kun tartibini   haftalik ko''rish mumkinmi?', 'question')`);
      let n = await notifs();
      ok('yangi fikr — adminga bildirishnoma', n.length === 1 && n[0].user_id === A && n[0].title === 'Yangi fikr va taklif' && n[0].link === 'admin?tab=feedback', JSON.stringify(n));
      ok("bildirishnomada to'liq ism, tur va qisqa matn", n[0] && n[0].body === "Ali Valiyev · Savol: Kun tartibini haftalik ko'rish mumkinmi?", n[0] && n[0].body);

      await as(V, `INSERT INTO user_feedback (user_id, content, type) VALUES ('${V}', '${'a'.repeat(300)}', 'suggestion')`);
      n = await notifs();
      const long = n.find((x) => x.body.startsWith('Vali'));
      ok("to'liq ism yo'q — display_name; uzun matn 140 belgida kesiladi", long && long.body === 'Vali · Taklif: ' + 'a'.repeat(140) + '…', long && long.body);

      ok("boshqa nomidan yozib bo'lmaydi", (await err(U, `INSERT INTO user_feedback (user_id, content) VALUES ('${V}', 'x')`)).length > 0);
      ok("is_read ni o'zi belgilab yozolmaydi", (await err(U, `INSERT INTO user_feedback (user_id, content, is_read) VALUES ('${U}', 'x', true)`)).length > 0);
      ok("noto'g'ri tur rad etiladi", (await err(U, `INSERT INTO user_feedback (user_id, content, type) VALUES ('${U}', 'x', 'spam')`)).includes('user_feedback_type_check'));
      ok("oddiy foydalanuvchi hech qanday fikrni o'qiy olmaydi (o'zinikini ham)", (await as(U, `SELECT id FROM user_feedback`)).length === 0);
      const total = Number((await q(`SELECT count(*)::int c FROM user_feedback`))[0].c);
      ok("admin RLS orqali hammasini o'qiydi", (await as(A, `SELECT id FROM user_feedback`)).length === total && total === 4, String(total));

      ok("get_all_feedback — oddiy foydalanuvchiga yopiq", (await err(U, `SELECT * FROM get_all_feedback()`)).includes('admin'));
      const list = await as(A, `SELECT * FROM get_all_feedback()`);
      const mine = list.find((r) => r.type === 'question');
      ok("get_all_feedback: to'liq ism, email, @username, tur", mine && mine.full_name === 'Ali Valiyev' && mine.email === 'u@mail.com' && mine.username === 'ali' && mine.is_read === false, JSON.stringify(mine));

      await as(A, `SELECT set_feedback_read('${mine.id}', true)`);
      const r1 = (await q(`SELECT is_read, read_at FROM user_feedback WHERE id='${mine.id}'`))[0];
      ok("admin: o'qildi deb belgilash", r1.is_read === true && r1.read_at !== null);
      ok("o'qilganlar ro'yxat oxirida", (await as(A, `SELECT id FROM get_all_feedback()`)).at(-1).id === mine.id);
      await as(A, `SELECT set_feedback_read('${mine.id}', false)`);
      ok("admin: o'qilmagan deb qaytarish", (await q(`SELECT is_read FROM user_feedback WHERE id='${mine.id}'`))[0].is_read === false);
      ok("oddiy foydalanuvchi belgilay olmaydi", (await err(U, `SELECT set_feedback_read('${mine.id}', true)`)).includes('admin'));
      await as(U, `UPDATE user_feedback SET is_read = true WHERE id='${mine.id}'`).catch(() => {});
      ok("to'g'ridan-to'g'ri UPDATE ham ishlamaydi (RLS)", (await q(`SELECT is_read FROM user_feedback WHERE id='${mine.id}'`))[0].is_read === false);

      await as(A, `SELECT reply_to_feedback('${mine.id}', 'Ha, keyingi versiyada')`);
      const rep = await q(`SELECT title FROM notifications WHERE type='feedback_reply' AND user_id='${U}'`);
      ok("javob: muallifga bildirishnoma (emoji'siz) va o'qildi", rep.length === 1 && rep[0].title === 'Fikr-mulohazangizga javob keldi' && (await q(`SELECT is_read FROM user_feedback WHERE id='${mine.id}'`))[0].is_read === true, JSON.stringify(rep));

      ok("oddiy foydalanuvchi o'chira olmaydi", (await err(U, `SELECT delete_feedback('${mine.id}')`)).includes('admin'));
      await as(U, `DELETE FROM user_feedback WHERE id='${mine.id}'`).catch(() => {});
      ok("to'g'ridan-to'g'ri DELETE ham ishlamaydi", (await q(`SELECT count(*)::int c FROM user_feedback WHERE id='${mine.id}'`))[0].c === 1);
      await as(A, `SELECT delete_feedback('${mine.id}')`);
      ok("admin o'chiradi", (await q(`SELECT count(*)::int c FROM user_feedback WHERE id='${mine.id}'`))[0].c === 0);

      await db.exec(`INSERT INTO feedback_reports (user_id, type, message) VALUES ('${V}', 'bug', 'Eski APK dan xatolik')`);
      const fwd = await q(`SELECT type FROM user_feedback WHERE content='Eski APK dan xatolik'`);
      ok("eski APK feedback_reports ga yozsa ham admin panelga tushadi", fwd.length === 1 && fwd[0].type === 'bug');
      ok("... va adminga bildirishnoma keladi", (await notifs()).some((x) => x.body === 'Vali · Xatolik: Eski APK dan xatolik'));

      ok("anon get_all_feedback chaqira olmaydi", !(await q(`SELECT has_function_privilege('anon','public.get_all_feedback()','execute') p`))[0].p);
      ok("anon user_feedback ga yoza olmaydi", !(await q(`SELECT has_table_privilege('anon','public.user_feedback','insert') p`))[0].p);
  }
  done();
});

test("056: feedback_reports jadvali yo'q bazada ham ikki marta xatosiz", async () => {
  const db = await createDb({ authUsers: true, feedback: true });
  await migrate(db, ['047', '048', '051', '056', '056']);
  const t = (await db.query(`SELECT count(*)::int c FROM pg_trigger WHERE tgname IN ('user_feedback_notify_admin','coin_purchases_set_expiry')`)).rows[0].c;
  const { ok, done } = checker();
  ok('triggerlar yaratildi', t === 2, String(t));
  done();
});
