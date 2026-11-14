// POST /api/payments/click-callback — Click SHOP API (Prepare va Complete bitta URL'da).
// Click kabinetida Prepare URL va Complete URL ikkalasiga shu manzil yoziladi.
import { handleClick, CLICK_ERR } from './_lib/click.js';
import { readClickConfig } from './_lib/config.js';
import { adminClient, supabaseRepo } from './_lib/repo.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const params = (req.body && typeof req.body === 'object') ? req.body : {};

  const cfg = readClickConfig(process.env);
  const db = adminClient();
  if (!cfg || !db) {
    return res.status(200).json({ error: CLICK_ERR.BAD_REQUEST, error_note: 'Payments not configured' });
  }

  try {
    const result = await handleClick(params, cfg, supabaseRepo(db));
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('click callback failed', e?.message);
    return res.status(200).json({
      click_trans_id: params.click_trans_id,
      merchant_trans_id: params.merchant_trans_id,
      error: e?.message?.includes('transaction_cancelled') ? CLICK_ERR.CANCELLED : CLICK_ERR.BAD_REQUEST,
      error_note: 'Internal error',
    });
  }
}
