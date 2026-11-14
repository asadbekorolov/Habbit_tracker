// To'lov qatlamining umumiy turlari. (Vercel `_` bilan boshlangan papkani
// endpoint qilmaydi — bu yerdagi fayllar faqat ichki modul.)

export type Provider = 'click' | 'payme';
export type TxnStatus = 'created' | 'pending' | 'paid' | 'cancelled' | 'failed';

export interface Txn {
  id: string;
  seq: number;
  user_id: string;
  provider: Provider;
  pack_id: string;
  amount_uzs: number;
  coins: number;
  status: TxnStatus;
  provider_txn_id: string | null;
  provider_state: number | null;
  provider_time: number | null;
  perform_time: string | null;
  cancel_time: string | null;
  cancel_reason: number | null;
}

export type TxnPatch = Partial<Pick<Txn, 'status' | 'provider_txn_id' | 'provider_state' | 'provider_time'>> & {
  last_payload?: unknown;
};

/** Bazaga kirish — callback mantiqi shu interfeys orqali ishlaydi (testda soxta). */
export interface PaymentRepo {
  getById(id: string): Promise<Txn | null>;
  getByProviderTxn(provider: Provider, providerTxnId: string): Promise<Txn | null>;
  update(id: string, patch: TxnPatch): Promise<void>;
  /** credit_payment RPC: tanga qo'shadi (idempotent). */
  credit(id: string): Promise<void>;
  /** cancel_payment RPC: to'langan bo'lsa tangani qaytarib oladi. */
  cancel(id: string, reason: number | null): Promise<void>;
  listPayme(fromMs: number, toMs: number): Promise<Txn[]>;
}

export interface ClickConfig {
  serviceId: string;
  merchantId: string;
  secretKey: string;
}

export interface PaymeConfig {
  merchantId: string;
  key: string;
}
