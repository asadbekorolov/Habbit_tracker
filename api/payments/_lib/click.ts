// Click SHOP API (Prepare action=0 / Complete action=1).
// Hujjat: https://docs.click.uz/click-api-request/
import { createHash } from 'node:crypto';
import type { ClickConfig, PaymentRepo } from './types';

export const CLICK_ERR = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  BAD_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TXN_NOT_FOUND: -6,
  BAD_REQUEST: -8,
  CANCELLED: -9,
} as const;

export type ClickParams = Record<string, string | number | undefined>;

const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/** sign_string = md5(click_trans_id + service_id + SECRET + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time) */
export function clickSign(p: ClickParams, secretKey: string): string {
  const action = s(p.action);
  const parts = [s(p.click_trans_id), s(p.service_id), secretKey, s(p.merchant_trans_id)];
  if (action === '1') parts.push(s(p.merchant_prepare_id));
  parts.push(s(p.amount), action, s(p.sign_time));
  return createHash('md5').update(parts.join('')).digest('hex');
}

export interface ClickResponse {
  click_trans_id?: string | number;
  merchant_trans_id?: string;
  merchant_prepare_id?: number;
  merchant_confirm_id?: number;
  error: number;
  error_note: string;
}

export async function handleClick(p: ClickParams, cfg: ClickConfig, repo: PaymentRepo): Promise<ClickResponse> {
  const base = { click_trans_id: p.click_trans_id, merchant_trans_id: s(p.merchant_trans_id) };
  const fail = (error: number, error_note: string): ClickResponse => ({ ...base, error, error_note });

  const required = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string'];
  if (required.some((k) => s(p[k]) === '')) return fail(CLICK_ERR.BAD_REQUEST, 'Error in request from click');
  if (s(p.service_id) !== cfg.serviceId) return fail(CLICK_ERR.BAD_REQUEST, 'Unknown service');
  if (clickSign(p, cfg.secretKey) !== s(p.sign_string).toLowerCase()) return fail(CLICK_ERR.SIGN_FAILED, 'SIGN CHECK FAILED!');

  const action = s(p.action);
  if (action !== '0' && action !== '1') return fail(CLICK_ERR.ACTION_NOT_FOUND, 'Action not found');

  const txn = /^[0-9a-f-]{36}$/i.test(s(p.merchant_trans_id)) ? await repo.getById(s(p.merchant_trans_id)) : null;
  if (!txn || txn.provider !== 'click') return fail(CLICK_ERR.ORDER_NOT_FOUND, 'Order not found');
  if (Math.abs(Number(p.amount) - txn.amount_uzs) > 0.009) return fail(CLICK_ERR.BAD_AMOUNT, 'Incorrect parameter amount');
  if (txn.status === 'paid') return fail(CLICK_ERR.ALREADY_PAID, 'Already paid');
  if (txn.status === 'cancelled' || txn.status === 'failed') return fail(CLICK_ERR.CANCELLED, 'Transaction cancelled');

  if (action === '0') {
    await repo.update(txn.id, { status: 'pending', provider_txn_id: s(p.click_trans_id), last_payload: p });
    return { ...base, merchant_prepare_id: txn.seq, error: CLICK_ERR.SUCCESS, error_note: 'Success' };
  }

  // Complete
  if (s(p.merchant_prepare_id) !== String(txn.seq)) return fail(CLICK_ERR.TXN_NOT_FOUND, 'Transaction does not exist');
  if (Number(p.error) < 0) {
    // Click to'lov amalga oshmaganini xabar qildi
    await repo.cancel(txn.id, Number(p.error));
    return fail(CLICK_ERR.CANCELLED, 'Transaction cancelled');
  }
  await repo.credit(txn.id);
  await repo.update(txn.id, { last_payload: p });
  return { ...base, merchant_confirm_id: txn.seq, error: CLICK_ERR.SUCCESS, error_note: 'Success' };
}
