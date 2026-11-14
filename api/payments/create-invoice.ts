// POST /api/payments/create-invoice  { pack_id, provider: 'click' | 'payme' }
// Narx va tanga soni faqat serverdagi coin_packs'dan; mijoz faqat pack_id yuboradi.
// Merchant kalitlari env'da bo'lmasa — 503 payments_not_configured
// (ilova "Tez kunda ishga tushadi" deydi, singan havola ochilmaydi).
import { createClient } from '@supabase/supabase-js';
import { adminClient, SUPABASE_URL, SUPABASE_ANON_KEY } from './_lib/repo.js';
import { buildCheckoutUrl, isProviderConfigured } from './_lib/config.js';

const ALLOWED_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);

function setCors(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const provider = req.body?.provider;
  const packId = req.body?.pack_id;
  if ((provider !== 'click' && provider !== 'payme') || typeof packId !== 'string') {
    return res.status(400).json({ ok: false, error: 'bad_request' });
  }

  // Kalitlar hali kiritilmagan bo'lsa — hech narsa yaratmaymiz.
  const db = adminClient();
  if (!db || !isProviderConfigured(provider, process.env)) {
    return res.status(503).json({ ok: false, error: 'payments_not_configured' });
  }

  const auth: string = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const { data: userData, error: userError } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const { data: pack, error: packError } = await db
    .from('coin_packs')
    .select('id, coins, bonus, price_uzs')
    .eq('id', packId)
    .eq('is_active', true)
    .maybeSingle();
  if (packError) {
    console.error('coin_packs read failed', packError.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!pack) return res.status(404).json({ ok: false, error: 'pack_not_found' });

  const { data: txn, error: insError } = await db
    .from('payment_transactions')
    .insert({
      user_id: userData.user.id,
      provider,
      pack_id: pack.id,
      amount_uzs: pack.price_uzs,
      coins: pack.coins + pack.bonus,
    })
    .select('id, amount_uzs')
    .single();
  if (insError || !txn) {
    console.error('payment insert failed', insError?.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const url = buildCheckoutUrl(provider, txn, process.env);
  if (!url) return res.status(503).json({ ok: false, error: 'payments_not_configured' });
  return res.status(200).json({ ok: true, url, transaction_id: txn.id });
}
