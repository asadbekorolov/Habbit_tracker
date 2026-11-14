// Payme Merchant API (JSON-RPC 2.0).
// Hujjat: https://developer.help.paycom.uz/metody-merchant-api/
import type { PaymeConfig, PaymentRepo, Txn } from './types';

export const PAYME_ERR = {
  AUTH: -32504,
  METHOD_NOT_FOUND: -32601,
  PARSE: -32700,
  BAD_AMOUNT: -31001,
  TXN_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  ORDER_NOT_FOUND: -31050,
  ORDER_BUSY: -31099,
} as const;

/** Yaratilgan, lekin bajarilmagan tranzaksiya 12 soatdan keyin eskiradi. */
export const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const REASON_TIMEOUT = 4;

const MESSAGES: Record<number, { uz: string; ru: string; en: string }> = {
  [PAYME_ERR.AUTH]: { uz: "Ruxsat yo'q", ru: 'Недостаточно привилегий', en: 'Insufficient privileges' },
  [PAYME_ERR.METHOD_NOT_FOUND]: { uz: 'Metod topilmadi', ru: 'Метод не найден', en: 'Method not found' },
  [PAYME_ERR.PARSE]: { uz: "So'rov noto'g'ri", ru: 'Ошибка разбора', en: 'Parse error' },
  [PAYME_ERR.BAD_AMOUNT]: { uz: "Summa noto'g'ri", ru: 'Неверная сумма', en: 'Incorrect amount' },
  [PAYME_ERR.TXN_NOT_FOUND]: { uz: 'Tranzaksiya topilmadi', ru: 'Транзакция не найдена', en: 'Transaction not found' },
  [PAYME_ERR.CANNOT_CANCEL]: { uz: "Bekor qilib bo'lmaydi", ru: 'Невозможно отменить', en: 'Cannot cancel' },
  [PAYME_ERR.CANNOT_PERFORM]: { uz: "Bajarib bo'lmaydi", ru: 'Невозможно выполнить операцию', en: 'Cannot perform operation' },
  [PAYME_ERR.ORDER_NOT_FOUND]: { uz: 'Buyurtma topilmadi', ru: 'Заказ не найден', en: 'Order not found' },
  [PAYME_ERR.ORDER_BUSY]: { uz: "Buyurtma boshqa to'lov bilan band", ru: 'Заказ ожидает другую оплату', en: 'Order is awaiting another payment' },
};

type RpcId = string | number | null;
export type RpcResponse =
  | { jsonrpc: '2.0'; id: RpcId; result: unknown }
  | { jsonrpc: '2.0'; id: RpcId; error: { code: number; message: { uz: string; ru: string; en: string }; data?: string } };

const err = (id: RpcId, code: number, data?: string): RpcResponse => ({
  jsonrpc: '2.0', id, error: { code, message: MESSAGES[code], ...(data ? { data } : {}) },
});
const ok = (id: RpcId, result: unknown): RpcResponse => ({ jsonrpc: '2.0', id, result });

export function checkPaymeAuth(header: string | undefined, cfg: PaymeConfig): boolean {
  if (!header || !header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  return idx > 0 && decoded.slice(idx + 1) === cfg.key;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

async function findOrder(repo: PaymentRepo, account: any): Promise<Txn | null> {
  const orderId = account && typeof account.order_id === 'string' ? account.order_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const t = await repo.getById(orderId);
  return t && t.provider === 'payme' ? t : null;
}

function txnState(t: Txn): number {
  if (t.provider_state != null) return t.provider_state;
  return t.status === 'paid' ? 2 : t.status === 'cancelled' ? -1 : 1;
}

export async function handlePayme(
  body: any,
  authHeader: string | undefined,
  cfg: PaymeConfig,
  repo: PaymentRepo,
  now: () => number = Date.now
): Promise<RpcResponse> {
  const id: RpcId = body?.id ?? null;
  if (!checkPaymeAuth(authHeader, cfg)) return err(id, PAYME_ERR.AUTH);
  if (!body || typeof body.method !== 'string') return err(id, PAYME_ERR.PARSE);
  const p = body.params || {};

  switch (body.method) {
    case 'CheckPerformTransaction': {
      const t = await findOrder(repo, p.account);
      if (!t) return err(id, PAYME_ERR.ORDER_NOT_FOUND, 'order_id');
      if (Number(p.amount) !== t.amount_uzs * 100) return err(id, PAYME_ERR.BAD_AMOUNT);
      if (t.status !== 'created' && t.status !== 'pending') return err(id, PAYME_ERR.ORDER_NOT_FOUND, 'order_id');
      return ok(id, { allow: true });
    }

    case 'CreateTransaction': {
      const existing = await repo.getByProviderTxn('payme', String(p.id));
      if (existing) {
        if (txnState(existing) !== 1) return err(id, PAYME_ERR.CANNOT_PERFORM);
        if (now() - (existing.provider_time ?? 0) > PAYME_TIMEOUT_MS) {
          await repo.cancel(existing.id, REASON_TIMEOUT);
          await repo.update(existing.id, { provider_state: -1 });
          return err(id, PAYME_ERR.CANNOT_PERFORM);
        }
        return ok(id, { create_time: existing.provider_time, transaction: existing.id, state: 1 });
      }
      const t = await findOrder(repo, p.account);
      if (!t) return err(id, PAYME_ERR.ORDER_NOT_FOUND, 'order_id');
      if (Number(p.amount) !== t.amount_uzs * 100) return err(id, PAYME_ERR.BAD_AMOUNT);
      if (t.status !== 'created') {
        // Buyurtma boshqa Payme tranzaksiyasi bilan band yoki yakunlangan
        return err(id, t.status === 'pending' ? PAYME_ERR.ORDER_BUSY : PAYME_ERR.ORDER_NOT_FOUND, 'order_id');
      }
      await repo.update(t.id, {
        status: 'pending', provider_txn_id: String(p.id), provider_state: 1,
        provider_time: Number(p.time), last_payload: body,
      });
      return ok(id, { create_time: Number(p.time), transaction: t.id, state: 1 });
    }

    case 'PerformTransaction': {
      const t = await repo.getByProviderTxn('payme', String(p.id));
      if (!t) return err(id, PAYME_ERR.TXN_NOT_FOUND);
      const st = txnState(t);
      if (st === 2) return ok(id, { transaction: t.id, perform_time: ms(t.perform_time), state: 2 });
      if (st !== 1) return err(id, PAYME_ERR.CANNOT_PERFORM);
      if (now() - (t.provider_time ?? 0) > PAYME_TIMEOUT_MS) {
        await repo.cancel(t.id, REASON_TIMEOUT);
        await repo.update(t.id, { provider_state: -1 });
        return err(id, PAYME_ERR.CANNOT_PERFORM);
      }
      await repo.credit(t.id);
      await repo.update(t.id, { provider_state: 2, last_payload: body });
      const fresh = await repo.getById(t.id);
      return ok(id, { transaction: t.id, perform_time: ms(fresh?.perform_time ?? null) || now(), state: 2 });
    }

    case 'CancelTransaction': {
      const t = await repo.getByProviderTxn('payme', String(p.id));
      if (!t) return err(id, PAYME_ERR.TXN_NOT_FOUND);
      const st = txnState(t);
      if (st === -1 || st === -2) {
        return ok(id, { transaction: t.id, cancel_time: ms(t.cancel_time), state: st });
      }
      // 1 -> -1 (to'lanmagan), 2 -> -2 (to'langan: tangalar qaytarib olinadi)
      const newState = st === 2 ? -2 : -1;
      await repo.cancel(t.id, p.reason != null ? Number(p.reason) : null);
      await repo.update(t.id, { provider_state: newState, last_payload: body });
      const fresh = await repo.getById(t.id);
      return ok(id, { transaction: t.id, cancel_time: ms(fresh?.cancel_time ?? null) || now(), state: newState });
    }

    case 'CheckTransaction': {
      const t = await repo.getByProviderTxn('payme', String(p.id));
      if (!t) return err(id, PAYME_ERR.TXN_NOT_FOUND);
      return ok(id, {
        create_time: t.provider_time ?? 0,
        perform_time: ms(t.perform_time),
        cancel_time: ms(t.cancel_time),
        transaction: t.id,
        state: txnState(t),
        reason: t.cancel_reason,
      });
    }

    case 'GetStatement': {
      const list = await repo.listPayme(Number(p.from), Number(p.to));
      return ok(id, {
        transactions: list.map((t) => ({
          id: t.provider_txn_id,
          time: t.provider_time,
          amount: t.amount_uzs * 100,
          account: { order_id: t.id },
          create_time: t.provider_time,
          perform_time: ms(t.perform_time),
          cancel_time: ms(t.cancel_time),
          transaction: t.id,
          state: txnState(t),
          reason: t.cancel_reason,
        })),
      });
    }

    default:
      return err(id, PAYME_ERR.METHOD_NOT_FOUND, body.method);
  }
}
