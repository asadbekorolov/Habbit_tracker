// 059: odatlar to'plamini ulashish — yaratish, kod orqali ko'rish,
// tanlab nusxalash va himoyalar
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, roles, checker } from './harness.mjs';

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

test("059: odatlar to'plami — yaratish, ko'rish, nusxalash", async () => {
  const db = await createDb({ authUsers: true });
  const { ok, done } = checker();
  const A = id(1), B = id(2), C = id(3), BAN = id(4);
  const H1 = id(11), H2 = id(12), H3 = id(13), HB = id(21);

  // Jonli bazadagi habits ustunlari (010, 023)
  await db.exec(`ALTER TABLE habits ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS scheduled_start time;
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS scheduled_end time;`);
  await migrate(db, ['052']);
  await db.exec(`INSERT INTO profiles (id, username, display_name, full_name) VALUES
      ('${A}','ali','Ali','Ali Valiyev'), ('${B}','bek','Bek',NULL), ('${C}','sara','Sara',NULL), ('${BAN}','ban','Ban',NULL);
    UPDATE profiles SET is_banned = true WHERE id = '${BAN}';
    INSERT INTO habits (id, user_id, name, emoji, type, target_value, unit, description, days_of_week, scheduled_start) VALUES
      ('${H1}','${A}','Suv ichish','w','positive',8,'stakan','shaxsiy izoh','{1,3,5}','07:00'),
      ('${H2}','${A}','Chekmaslik','c','negative',1,'','yashirin','{1,2,3,4,5,6,7}',NULL),
      ('${H3}','${A}','Kitob o''qish','b','positive',20,'bet','', '{1,2,3,4,5,6,7}','21:30'),
      ('${HB}','${B}','Yugurish','r','positive',1,'','', '{1,2,3,4,5,6,7}',NULL);
    INSERT INTO habit_logs (habit_id, user_id, log_date, completed) VALUES ('${H1}','${A}', current_date, true);`);
  await migrate(db, ['059', '059']); // ikki marta: idempotent

  const { as, err, q } = roles(db);

  // Yaratish
  const created = (await as(A, `SELECT create_habit_pack('  Tonggi intizom  ', ARRAY['${H3}','${H1}','${H3}']::uuid[]) r`))[0].r;
  ok("to'plam yaratildi (7 belgili kod, takror olib tashlandi)", /^[A-HJ-KM-NP-Z2-9]{7}$/.test(created.code) && created.count === 2, JSON.stringify(created));
  const row = (await q(`SELECT title, items, creator_id FROM habit_packs WHERE code = '${created.code}'`))[0];
  ok("sarlavha tozalandi, tanlangan tartib saqlandi", row.title === 'Tonggi intizom' && row.items[0].name === "Kitob o'qish" && row.items[1].name === 'Suv ichish', JSON.stringify(row));
  const keys = Object.keys(row.items[1]).sort().join(',');
  ok("items: faqat sozlamalar (id, user_id, izoh, log yo'q)", keys === 'days_of_week,emoji,name,scheduled_end,scheduled_start,target_value,type,unit', keys);
  ok("items: maqsad, birlik, kunlar va vaqt ko'chirildi", row.items[1].target_value === 8 && row.items[1].unit === 'stakan' && JSON.stringify(row.items[1].days_of_week) === '[1,3,5]' && row.items[1].scheduled_start === '07:00:00', JSON.stringify(row.items[1]));

  // Himoyalar
  ok("begona odatni to'plamga qo'shib bo'lmaydi", (await err(A, `SELECT create_habit_pack('X', ARRAY['${H1}','${HB}']::uuid[])`)).includes('habit_not_owned'));
  ok("mavjud bo'lmagan odat — habit_not_owned", (await err(A, `SELECT create_habit_pack('X', ARRAY['${id(99)}']::uuid[])`)).includes('habit_not_owned'));
  ok("bo'sh ro'yxat — no_habits", (await err(A, `SELECT create_habit_pack('X', ARRAY[]::uuid[])`)).includes('no_habits'));
  ok("bo'sh sarlavha — invalid_title", (await err(A, `SELECT create_habit_pack('   ', ARRAY['${H1}']::uuid[])`)).includes('invalid_title'));
  ok("bloklangan foydalanuvchi yarata olmaydi", (await err(BAN, `SELECT create_habit_pack('X', ARRAY['${H1}']::uuid[])`)).includes('banned'));
  ok("jadvalga to'g'ridan-to'g'ri yozib bo'lmaydi", (await err(B, `INSERT INTO habit_packs (code, creator_id, title, items) VALUES ('ZZZZZZZ','${B}','x','[{}]')`)).includes('permission denied'));
  ok("begona to'plamlar to'g'ridan-to'g'ri ko'rinmaydi", (await as(B, `SELECT count(*)::int n FROM habit_packs`))[0].n === 0);
  ok("egasi o'z to'plamini ko'radi", (await as(A, `SELECT count(*)::int n FROM habit_packs`))[0].n === 1);
  ok('anon get_habit_pack ni chaqira olmaydi', !(await q(`SELECT has_function_privilege('anon','public.get_habit_pack(text)','execute') p`))[0].p);
  ok("habit_pack_imports mijozga yopiq", (await err(B, `SELECT * FROM habit_pack_imports`)).includes('permission denied'));

  // Kod orqali ko'rish
  const pack = (await as(B, `SELECT get_habit_pack('${created.code.toLowerCase()}') p`))[0].p;
  ok("get_habit_pack: sarlavha, muallif to'liq ismi, 2 ta odat", pack.title === 'Tonggi intizom' && pack.creator_name === 'Ali Valiyev' && pack.items.length === 2 && pack.is_own === false, JSON.stringify(pack));
  ok("get_habit_pack: muallif id'si qaytarilmaydi", !('creator_id' in pack) && !JSON.stringify(pack).includes(A));
  ok("noto'g'ri kod — pack_not_found", (await err(B, `SELECT get_habit_pack('ZZZZZZZ')`)).includes('pack_not_found'));

  // Nusxalash: B faqat ikkinchisini (Suv ichish)
  const r1 = (await as(B, `SELECT import_habit_pack('${created.code}', ARRAY[1]) r`))[0].r;
  const bHabits = await q(`SELECT name, type, target_value, unit, description, days_of_week, scheduled_start FROM habits WHERE user_id = '${B}' ORDER BY created_at, name`);
  const copy = bHabits.find((h) => h.name === 'Suv ichish');
  ok('tanlangan bitta odat nusxalandi', r1.imported === 1 && r1.habit_ids.length === 1 && bHabits.length === 2, JSON.stringify(r1));
  ok("nusxa mustaqil: sozlamalar ko'chdi, izoh ko'chmadi", copy && copy.target_value === 8 && copy.unit === 'stakan' && copy.description === '' && JSON.stringify(copy.days_of_week) === '[1,3,5]' && copy.scheduled_start === '07:00:00', JSON.stringify(copy));
  ok("nusxada zanjir/log yo'q", (await q(`SELECT count(*)::int n FROM habit_logs WHERE habit_id = '${r1.habit_ids[0]}'`))[0].n === 0);
  ok("asl odat o'zgarmadi", (await q(`SELECT user_id FROM habits WHERE id = '${H1}'`))[0].user_id === A);
  const cnt = async () => (await q(`SELECT imports_count FROM habit_packs WHERE code = '${created.code}'`))[0].imports_count;
  ok('imports_count = 1', (await cnt()) === 1);

  // Hammasi (NULL) — yana 2 ta, lekin hisob bir foydalanuvchi uchun bir marta
  const r2 = (await as(B, `SELECT import_habit_pack('${created.code}', NULL) r`))[0].r;
  ok("NULL — hamma odat nusxalanadi", r2.imported === 2, JSON.stringify(r2));
  ok("qayta nusxalash imports_count ni oshirmaydi", (await cnt()) === 1);
  await as(C, `SELECT import_habit_pack('${created.code}', ARRAY[0,0,1]) r`);
  ok("boshqa foydalanuvchi — imports_count = 2, takror indeks bitta", (await cnt()) === 2 && (await q(`SELECT count(*)::int n FROM habits WHERE user_id='${C}'`))[0].n === 2);

  ok("o'z to'plamini nusxalab bo'lmaydi — own_pack", (await err(A, `SELECT import_habit_pack('${created.code}', NULL)`)).includes('own_pack'));
  ok("indeks chegaradan tashqari — invalid_selection", (await err(B, `SELECT import_habit_pack('${created.code}', ARRAY[5])`)).includes('invalid_selection'));
  ok("bo'sh tanlov — no_habits", (await err(B, `SELECT import_habit_pack('${created.code}', ARRAY[]::int[])`)).includes('no_habits'));
  ok("noto'g'ri kod bilan nusxalash — pack_not_found", (await err(B, `SELECT import_habit_pack('ZZZZZZZ', NULL)`)).includes('pack_not_found'));

  // Salbiy odat ham to'g'ri turi bilan ko'chadi
  const neg = (await as(A, `SELECT create_habit_pack('Cheklovlar', ARRAY['${H2}']::uuid[]) r`))[0].r;
  await as(C, `SELECT import_habit_pack('${neg.code}', NULL)`);
  ok("salbiy odat turi saqlanadi", (await q(`SELECT type FROM habits WHERE user_id='${C}' AND name='Chekmaslik'`))[0]?.type === 'negative');

  // O'chirish: faqat egasi
  await as(B, `DELETE FROM habit_packs WHERE code = '${neg.code}'`);
  ok("begona o'chira olmaydi", (await q(`SELECT count(*)::int n FROM habit_packs WHERE code='${neg.code}'`))[0].n === 1);
  await as(A, `DELETE FROM habit_packs WHERE code = '${neg.code}'`);
  ok("egasi o'chiradi", (await q(`SELECT count(*)::int n FROM habit_packs WHERE code='${neg.code}'`))[0].n === 0);
  done();
});
