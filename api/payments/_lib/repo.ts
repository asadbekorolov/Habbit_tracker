// PaymentRepo'ning Supabase (service_role) amalga oshirilishi.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PaymentRepo, Provider, Txn, TxnPatch } from './types';

export const SUPABASE_URL = 'https://kiwrqzetpyobaemrsquq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z';

const COLS =
  'id, seq, user_id, provider, pack_id, amount_uzs, coins, status, provider_txn_id, provider_state, provider_time, perform_time, cancel_time, cancel_reason';

export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseRepo(db: SupabaseClient): PaymentRepo {
  const one = async (q: any): Promise<Txn | null> => {
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return (data as Txn) ?? null;
  };
  return {
    getById: (id: string) => one(db.from('payment_transactions').select(COLS).eq('id', id)),
    getByProviderTxn: (provider: Provider, providerTxnId: string) =>
      one(db.from('payment_transactions').select(COLS).eq('provider', provider).eq('provider_txn_id', providerTxnId)),
    async update(id: string, patch: TxnPatch) {
      const { error } = await db.from('payment_transactions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    async credit(id: string) {
      const { error } = await db.rpc('credit_payment', { p_txn_id: id });
      if (error) throw error;
    },
    async cancel(id: string, reason: number | null) {
      const { error } = await db.rpc('cancel_payment', { p_txn_id: id, p_reason: reason });
      if (error) throw error;
    },
    async listPayme(fromMs: number, toMs: number) {
      const { data, error } = await db
        .from('payment_transactions')
        .select(COLS)
        .eq('provider', 'payme')
        .gte('provider_time', fromMs)
        .lte('provider_time', toMs)
        .order('provider_time', { ascending: true });
      if (error) throw error;
      return (data as Txn[]) ?? [];
    },
  };
}
