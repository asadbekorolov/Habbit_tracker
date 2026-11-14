// Ishga tushirish: npm test
// Click / Payme callback mantiqi — xotiradagi soxta repo bilan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleClick, clickSign, CLICK_ERR } from '../api/payments/_lib/click.ts';
import { handlePayme, PAYME_ERR, PAYME_TIMEOUT_MS } from '../api/payments/_lib/payme.ts';
import { buildCheckoutUrl, isProviderConfigured } from '../api/payments/_lib/config.ts';
import type { PaymentRepo, Txn } from '../api/payments/_lib/types.ts';

const ORDER = '11111111-2222-3333-4444-555555555555';

function makeRepo(init: Partial<Txn>) {
  const txn: Txn = {
    id: ORDER, seq: 42, user_id: 'u1', provider: 'click', pack_id: 'pack_gold', amount_uzs: 24900, coins: 1650,
    status: 'created', provider_txn_id: null, provider_state: null, provider_time: null,
    perform_time: null, cancel_time: null, cancel_reason: null, ...init,
  };
  let balance = 0;
  const repo: PaymentRepo = {
    async getById(id) { return id === txn.id ? { ...txn } : null; },
    async getByProviderTxn(p, x) { return txn.provider === p && txn.provider_txn_id === x ? { ...txn } : null; },
    async update(_id, patch) { const { last_payload, ...rest } = patch; Object.assign(txn, rest); },
    async credit() {
      if (txn.status === 'paid') return;
      if (txn.status === 'cancelled') throw new Error('transaction_cancelled');
      balance += txn.coins; txn.status = 'paid'; txn.perform_time = new Date(1_700_000_000_000).toISOString();
    },
    async cancel(_id, reason) {
      if (txn.status === 'cancelled') return;
      if (txn.status === 'paid') balance -= txn.coins;
      txn.status = 'cancelled'; txn.cancel_reason = reason; txn.cancel_time = new Date(1_700_000_100_000).toISOString();
    },
    async listPayme() { return txn.provider === 'payme' && txn.provider_txn_id ? [{ ...txn }] : []; },
  };
  return { repo, txn, balance: () => balance };
}

// ── Click ───────────────────────────────────────────────────────────────────
const CLICK = { serviceId: '100', merchantId: '200', secretKey: 'secret' };
function clickReq(action: 0 | 1, extra: Record<string, string | number> = {}) {
  const p: Record<string, string | number> = {
    click_trans_id: 9001, service_id: '100', merchant_trans_id: ORDER, amount: '24900', action,
    sign_time: '2026-11-14 10:00:00', error: 0, ...(action === 1 ? { merchant_prepare_id: 42 } : {}), ...extra,
  };
  p.sign_string = clickSign(p, CLICK.secretKey);
  return p;
}

test('Click: prepare -> complete tanga qo\'shadi; takroriy complete "already paid"', async () => {
  const { repo, txn, balance } = makeRepo({});
  const prep = await handleClick(clickReq(0), CLICK, repo);
  assert.equal(prep.error, CLICK_ERR.SUCCESS);
  assert.equal(prep.merchant_prepare_id, 42);
  assert.equal(txn.status, 'pending');
  const done = await handleClick(clickReq(1), CLICK, repo);
  assert.equal(done.error, CLICK_ERR.SUCCESS);
  assert.equal(balance(), 1650);
  const again = await handleClick(clickReq(1), CLICK, repo);
  assert.equal(again.error, CLICK_ERR.ALREADY_PAID);
  assert.equal(balance(), 1650, 'ikkinchi marta tanga qo\'shilmaydi');
});

test("Click: noto'g'ri imzo, summa va buyurtma rad etiladi", async () => {
  const { repo, balance } = makeRepo({});
  const bad = { ...clickReq(0), sign_string: 'deadbeef' };
  assert.equal((await handleClick(bad, CLICK, repo)).error, CLICK_ERR.SIGN_FAILED);
  assert.equal((await handleClick(clickReq(0, { amount: '100' }), CLICK, repo)).error, CLICK_ERR.BAD_AMOUNT);
  assert.equal((await handleClick(clickReq(0, { merchant_trans_id: '00000000-0000-0000-0000-000000000000' }), CLICK, repo)).error, CLICK_ERR.ORDER_NOT_FOUND);
  assert.equal(balance(), 0);
});

test('Click: complete xato bilan kelsa — bekor qilinadi, tanga yo\'q', async () => {
  const { repo, txn, balance } = makeRepo({});
  await handleClick(clickReq(0), CLICK, repo);
  const r = await handleClick(clickReq(1, { error: -5017 }), CLICK, repo);
  assert.equal(r.error, CLICK_ERR.CANCELLED);
  assert.equal(txn.status, 'cancelled');
  assert.equal(balance(), 0);
});

// ── Payme ───────────────────────────────────────────────────────────────────
const PAYME = { merchantId: 'm1', key: 'pkey' };
const AUTH = 'Basic ' + Buffer.from('Paycom:pkey').toString('base64');
const rpc = (method: string, params: any) => ({ jsonrpc: '2.0', id: 1, method, params });
const T0 = 1_700_000_000_000;

test("Payme: autentifikatsiyasiz so'rov rad etiladi", async () => {
  const { repo } = makeRepo({ provider: 'payme' });
  const r: any = await handlePayme(rpc('CheckPerformTransaction', {}), 'Basic ' + Buffer.from('Paycom:wrong').toString('base64'), PAYME, repo);
  assert.equal(r.error.code, PAYME_ERR.AUTH);
});

test("Payme: to'liq oqim Check -> Create -> Perform -> Cancel (tanga qaytariladi)", async () => {
  const { repo, txn, balance } = makeRepo({ provider: 'payme' });
  const now = () => T0 + 1000;
  const acc = { order_id: ORDER };
  assert.deepEqual((await handlePayme(rpc('CheckPerformTransaction', { amount: 2_490_000, account: acc }), AUTH, PAYME, repo, now) as any).result, { allow: true });
  assert.equal((await handlePayme(rpc('CheckPerformTransaction', { amount: 1, account: acc }), AUTH, PAYME, repo, now) as any).error.code, PAYME_ERR.BAD_AMOUNT);

  const created: any = await handlePayme(rpc('CreateTransaction', { id: 'pm1', time: T0, amount: 2_490_000, account: acc }), AUTH, PAYME, repo, now);
  assert.equal(created.result.state, 1);
  // Takroriy Create — o'sha javob
  assert.equal((await handlePayme(rpc('CreateTransaction', { id: 'pm1', time: T0, amount: 2_490_000, account: acc }), AUTH, PAYME, repo, now) as any).result.transaction, ORDER);
  // Boshqa Payme tranzaksiyasi bilan — band
  assert.equal((await handlePayme(rpc('CreateTransaction', { id: 'pm2', time: T0, amount: 2_490_000, account: acc }), AUTH, PAYME, repo, now) as any).error.code, PAYME_ERR.ORDER_BUSY);

  const performed: any = await handlePayme(rpc('PerformTransaction', { id: 'pm1' }), AUTH, PAYME, repo, now);
  assert.equal(performed.result.state, 2);
  assert.equal(balance(), 1650);
  // Takroriy Perform — tanga ikki marta qo'shilmaydi
  await handlePayme(rpc('PerformTransaction', { id: 'pm1' }), AUTH, PAYME, repo, now);
  assert.equal(balance(), 1650);

  const check: any = await handlePayme(rpc('CheckTransaction', { id: 'pm1' }), AUTH, PAYME, repo, now);
  assert.equal(check.result.state, 2);

  const cancelled: any = await handlePayme(rpc('CancelTransaction', { id: 'pm1', reason: 5 }), AUTH, PAYME, repo, now);
  assert.equal(cancelled.result.state, -2);
  assert.equal(balance(), 0, "to'langan tranzaksiya bekor qilinsa tanga qaytarib olinadi");
  assert.equal(txn.cancel_reason, 5);

  const statement: any = await handlePayme(rpc('GetStatement', { from: 0, to: T0 * 2 }), AUTH, PAYME, repo, now);
  assert.equal(statement.result.transactions.length, 1);
});

test('Payme: 12 soatdan keyin Perform — muddati o\'tgan, bekor qilinadi', async () => {
  const { repo, txn, balance } = makeRepo({ provider: 'payme' });
  await handlePayme(rpc('CreateTransaction', { id: 'pm1', time: T0, amount: 2_490_000, account: { order_id: ORDER } }), AUTH, PAYME, repo, () => T0);
  const r: any = await handlePayme(rpc('PerformTransaction', { id: 'pm1' }), AUTH, PAYME, repo, () => T0 + PAYME_TIMEOUT_MS + 1);
  assert.equal(r.error.code, PAYME_ERR.CANNOT_PERFORM);
  assert.equal(txn.status, 'cancelled');
  assert.equal(txn.provider_state, -1);
  assert.equal(balance(), 0);
});

test("Payme: noma'lum tranzaksiya va metod", async () => {
  const { repo } = makeRepo({ provider: 'payme' });
  assert.equal((await handlePayme(rpc('PerformTransaction', { id: 'nope' }), AUTH, PAYME, repo) as any).error.code, PAYME_ERR.TXN_NOT_FOUND);
  assert.equal((await handlePayme(rpc('Foo', {}), AUTH, PAYME, repo) as any).error.code, PAYME_ERR.METHOD_NOT_FOUND);
});

// ── Konfiguratsiya ─────────────────────────────────────────────────────────
test("Kalitlar bo'lmasa to'lov o'chiq, havola yasalmaydi", () => {
  assert.equal(isProviderConfigured('click', {}), false);
  assert.equal(isProviderConfigured('payme', { PAYME_MERCHANT_ID: 'x' }), false);
  assert.equal(buildCheckoutUrl('payme', { id: ORDER, amount_uzs: 100 }, {}), null);
  const url = buildCheckoutUrl('payme', { id: ORDER, amount_uzs: 24900 }, { PAYME_MERCHANT_ID: 'm1', PAYME_KEY: 'k' })!;
  const decoded = Buffer.from(url.split('/').pop()!, 'base64').toString();
  assert.match(decoded, /^m=m1;ac\.order_id=11111111-2222-3333-4444-555555555555;a=2490000;c=https:\/\//);
  const click = buildCheckoutUrl('click', { id: ORDER, amount_uzs: 24900 }, { CLICK_SERVICE_ID: '1', CLICK_MERCHANT_ID: '2', CLICK_SECRET_KEY: 's' })!;
  assert.match(click, /transaction_param=11111111-2222-3333-4444-555555555555/);
  assert.match(click, /amount=24900/);
});
