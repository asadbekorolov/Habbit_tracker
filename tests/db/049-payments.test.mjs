// 049: to'lov tranzaksiyalari (credit_payment / cancel_payment, idempotentlik, RLS)
// Ishga tushirish: npm run test:db
import { test } from 'node:test';
import { createDb, migrate, checker } from './harness.mjs';

test("049: to'lov tranzaksiyalari", async () => {
  const db = await createDb();
  const { ok, done } = checker();
  await migrate(db, ['047', '048', '049', '049']);
  const U = '00000000-0000-0000-0000-00000000000a', V = '00000000-0000-0000-0000-00000000000b';
  await db.exec(`INSERT INTO profiles (id, username, display_name, coins) VALUES ('${U}','alice','Alice',100), ('${V}','vic','Vic',0);`);
  const q = async (sql) => (await db.query(sql)).rows;

  const coins = async (id = U) => (await q(`SELECT coins FROM profiles WHERE id='${id}'`))[0].coins;

  ok('3 ta paket', (await q(`SELECT count(*)::int n FROM coin_packs`))[0].n === 3);
  const [t] = await q(`INSERT INTO payment_transactions (user_id, provider, pack_id, amount_uzs, coins) VALUES ('${U}','payme','pack_gold',24900,1650) RETURNING id, seq, status`);
  ok('yaratildi, seq butun son', t.status === 'created' && Number(t.seq) > 0);
  const r1 = (await q(`SELECT * FROM credit_payment('${t.id}')`))[0];
  ok('credit: +1650', r1.status === 'paid' && r1.coins_added === 1650 && (await coins()) === 1750, JSON.stringify(r1));
  const r2 = (await q(`SELECT * FROM credit_payment('${t.id}')`))[0];
  ok('takroriy credit: already_paid, balans o\'zgarmaydi', r2.status === 'already_paid' && (await coins()) === 1750);
  const c1 = (await q(`SELECT * FROM cancel_payment('${t.id}', 5)`))[0];
  ok('to\'langanni bekor qilish: -1650', c1.coins_removed === 1650 && (await coins()) === 100);
  const c2 = (await q(`SELECT * FROM cancel_payment('${t.id}', 5)`))[0];
  ok('takroriy cancel: o\'zgarishsiz', c2.status === 'already_cancelled' && (await coins()) === 100);
  let threw = '';
  try { await q(`SELECT * FROM credit_payment('${t.id}')`); } catch (e) { threw = e.message; }
  ok('bekor qilinganni credit qilib bo\'lmaydi', threw.includes('transaction_cancelled'), threw);

  // Unikal provider_txn_id
  await db.exec(`UPDATE payment_transactions SET provider_txn_id='pm1' WHERE id='${t.id}'`);
  const [t2] = await q(`INSERT INTO payment_transactions (user_id, provider, pack_id, amount_uzs, coins) VALUES ('${U}','payme','pack_small',9900,500) RETURNING id`);
  threw = ''; try { await db.exec(`UPDATE payment_transactions SET provider_txn_id='pm1' WHERE id='${t2.id}'`); } catch (e) { threw = e.message; }
  ok('bir xil Payme ID ikki buyurtmaga biriktirilmaydi', /unique|duplicate/i.test(threw), threw);

  // Huquqlar
  const priv = async (role, fn) => (await q(`SELECT has_function_privilege('${role}', '${fn}', 'execute') p`))[0].p;
  ok('authenticated credit_payment chaqira olmaydi', !(await priv('authenticated', 'public.credit_payment(uuid)')));
  ok('anon cancel_payment chaqira olmaydi', !(await priv('anon', 'public.cancel_payment(uuid,integer)')));
  ok('service_role credit_payment chaqira oladi', await priv('service_role', 'public.credit_payment(uuid)'));
  ok('authenticated INSERT qila olmaydi', !(await q(`SELECT has_table_privilege('authenticated','public.payment_transactions','INSERT') p`))[0].p);

  // RLS: foydalanuvchi faqat o'zinikini ko'radi
  await db.exec(`INSERT INTO payment_transactions (user_id, provider, pack_id, amount_uzs, coins) VALUES ('${V}','click','pack_small',9900,500)`);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${V}', false); SELECT set_config('request.jwt.claims', '{"sub":"${V}","role":"authenticated"}', false);`);
  const seen = await q(`SELECT user_id FROM payment_transactions`);
  await db.exec(`RESET ROLE`);
  ok('RLS: Vic faqat o\'z tranzaksiyasini ko\'radi', seen.length === 1 && seen[0].user_id === V, JSON.stringify(seen));
  done();
});
