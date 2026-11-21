// 058: taklif (referral) tizimi — kod generatsiyasi, apply_referral_code
// himoyalari, mukofotlar va get_my_referral_info
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker } from './harness.mjs';

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

test('058: taklif kodi, mukofotlar va himoyalar', async () => {
  const db = await createDb();
  const { ok, done } = checker();
  const U = id(1), N = id(2), M = id(3), OLD = id(4), X = id(5), Y = id(6), BAN = id(7), Z = id(8);

  await migrate(db, ['047']);
  // 058 dan oldin mavjud bo'lgan foydalanuvchilar (U — eski taklif qiluvchi)
  await db.exec(`INSERT INTO profiles (id, username, display_name, coins, created_at) VALUES
    ('${U}','ali','Ali',10, now() - interval '30 days'),
    ('${OLD}','old','Old',0, now() - interval '3 days');`);
  await migrate(db, ['058', '058']); // ikki marta: idempotent

  const { as, err, q } = roles(db);
  const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{7}$/;

  const before = await q(`SELECT id, referral_code FROM profiles ORDER BY id`);
  ok('mavjud foydalanuvchilarga kod berildi (7 belgi, 0/O/1/I/L yo\'q)', before.length === 2 && before.every((r) => CODE_RE.test(r.referral_code || '')), JSON.stringify(before));

  // Yangi foydalanuvchilar — trigger kod beradi
  await db.exec(`INSERT INTO profiles (id, username, display_name, coins) VALUES
    ('${N}','nodir','Nodir',0), ('${M}','malika','Malika',0), ('${X}','xon','Xon',0),
    ('${Y}','yulduz','Yulduz',0), ('${BAN}','ban','Ban',0), ('${Z}','zafar','Zafar',0);
    UPDATE profiles SET is_banned = true WHERE id = '${BAN}';`);
  const codes = Object.fromEntries((await q(`SELECT id, referral_code FROM profiles`)).map((r) => [r.id, r.referral_code]));
  ok('yangi foydalanuvchiga trigger kod beradi', CODE_RE.test(codes[N] || ''), codes[N]);
  ok('kodlar unikal', new Set(Object.values(codes)).size === Object.keys(codes).length);

  // Mijoz ustunlarni o'qiy / o'zgartira olmaydi
  ok("mijoz referral_code ni to'g'ridan-to'g'ri o'qiy olmaydi", (await err(N, `SELECT referral_code FROM profiles WHERE id='${N}'`)).includes('permission denied'));
  ok("mijoz referred_by ni o'zgartira olmaydi", (await err(N, `UPDATE profiles SET referred_by='${U}' WHERE id='${N}'`)).includes('permission denied'));
  ok("mijoz referral_rewards ga yoza olmaydi", (await err(N, `INSERT INTO referral_rewards (referrer_id, referred_id) VALUES ('${U}','${N}')`)).includes('permission denied'));

  // get_my_referral_info
  const infoN = (await as(N, `SELECT get_my_referral_info() i`))[0].i;
  ok("get_my_referral_info: o'z kodi va yangi foydalanuvchi kod kirita oladi", infoN.code === codes[N] && infoN.can_apply === true && infoN.invited_count === 0, JSON.stringify(infoN));
  const infoOld = (await as(OLD, `SELECT get_my_referral_info() i`))[0].i;
  ok('48 soatdan eski akkaunt: can_apply = false', infoOld.can_apply === false, JSON.stringify(infoOld));

  // Muvaffaqiyatli taklif (kichik harf va bo'shliqlar bilan ham)
  const r1 = (await as(N, `SELECT apply_referral_code('  ${codes[U].toLowerCase()} ') r`))[0].r;
  const coins = async (uid) => (await q(`SELECT coins FROM profiles WHERE id='${uid}'`))[0].coins;
  ok('yangi foydalanuvchi +50 tanga', r1.ok === true && r1.bonus === 50 && (await coins(N)) === 50, JSON.stringify(r1));
  ok('taklif qiluvchi +100 tanga', (await coins(U)) === 110);
  const rr = await q(`SELECT referrer_id, referred_id, referrer_coins, referred_coins FROM referral_rewards`);
  ok('referral_rewards ga yozildi', rr.length === 1 && rr[0].referrer_id === U && rr[0].referred_id === N && rr[0].referrer_coins === 100 && rr[0].referred_coins === 50, JSON.stringify(rr));
  ok('profiles.referred_by o\'rnatildi', (await q(`SELECT referred_by FROM profiles WHERE id='${N}'`))[0].referred_by === U);
  const notif = await q(`SELECT title, body, type, link FROM notifications WHERE user_id='${U}'`);
  ok('taklif qiluvchiga bildirishnoma (+100, do\'st profiliga havola)', notif.length === 1 && notif[0].type === 'referral' && notif[0].body.includes('+100') && notif[0].link === `profile:${N}`, JSON.stringify(notif));
  ok("bildirishnomada emoji yo'q", !/\p{Extended_Pictographic}/u.test(notif[0]?.title + notif[0]?.body));

  // Rad etishlar
  ok('ikkinchi marta kod kiritish — already_referred', (await err(N, `SELECT apply_referral_code('${codes[M]}')`)).includes('already_referred'));
  ok("o'zini taklif qilish — self_referral", (await err(M, `SELECT apply_referral_code('${codes[M]}')`)).includes('self_referral'));
  ok("noto'g'ri kod — invalid_code", (await err(M, `SELECT apply_referral_code('ZZZZZZZ')`)).includes('invalid_code'));
  ok("formatga mos kelmaydigan kod — invalid_code", (await err(M, `SELECT apply_referral_code('AB-12')`)).includes('invalid_code'));
  ok('bloklangan foydalanuvchi kodi — invalid_code', (await err(M, `SELECT apply_referral_code('${codes[BAN]}')`)).includes('invalid_code'));
  ok('48 soatdan eski akkaunt — referral_window_closed', (await err(OLD, `SELECT apply_referral_code('${codes[U]}')`)).includes('referral_window_closed'));
  ok('anon chaqira olmaydi', !(await q(`SELECT has_function_privilege('anon','public.apply_referral_code(text)','execute') p`))[0].p);
  ok('rad etilganda tanga o\'zgarmaydi', (await coins(M)) === 0 && (await coins(OLD)) === 0 && (await coins(U)) === 110);

  // O'zaro taklif: X Y ni taklif qildi, endi Y X ning kodini kiritadi
  await as(X, `SELECT apply_referral_code('${codes[Y]}')`);
  ok("o'zaro taklif — mutual_referral", (await err(Y, `SELECT apply_referral_code('${codes[X]}')`)).includes('mutual_referral'));

  // Kunlik chegara: U bugun yana 9 ta mukofot oldi (jami 10) — keyingisi uchun 0
  const fakes = Array.from({ length: 9 }, (_, i) => id(100 + i));
  await db.exec(`INSERT INTO profiles (id, username, coins) VALUES ${fakes.map((f, i) => `('${f}','f${i}',0)`).join(',')};
    INSERT INTO referral_rewards (referrer_id, referred_id, referrer_coins, referred_coins) VALUES ${fakes.map((f) => `('${U}','${f}',100,50)`).join(',')};`);
  const uBefore = await coins(U);
  const r2 = (await as(Z, `SELECT apply_referral_code('${codes[U]}') r`))[0].r;
  ok("kunlik chegaradan keyin: do'st +50 oladi, taklif qiluvchi 0", r2.ok === true && (await coins(Z)) === 50 && (await coins(U)) === uBefore, JSON.stringify(r2));
  const lastNotif = (await q(`SELECT body FROM notifications WHERE user_id='${U}' AND link='profile:${Z}'`))[0];
  ok('chegara bildirishnomasida tanga va\'da qilinmaydi', lastNotif && !lastNotif.body.includes('+'), JSON.stringify(lastNotif));

  const infoU = (await as(U, `SELECT get_my_referral_info() i`))[0].i;
  ok('get_my_referral_info: taklif qilinganlar soni va ishlangan tangalar', infoU.invited_count === 11 && infoU.earned_coins === 1000, JSON.stringify(infoU));
  done();
});
