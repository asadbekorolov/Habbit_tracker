// POST /api/payments/payme-callback — Payme Merchant API (JSON-RPC).
// Payme kabinetida "Endpoint URL" sifatida shu manzil yoziladi.
// Payme har doim HTTP 200 kutadi; xatolar JSON-RPC `error` ichida.
import { handlePayme, PAYME_ERR } from './_lib/payme.js';
import { readPaymeConfig } from './_lib/config.js';
import { adminClient, supabaseRepo } from './_lib/repo.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body && typeof req.body === 'object' ? req.body : null;

  const cfg = readPaymeConfig(process.env);
  const db = adminClient();
  if (!cfg || !db) {
    return res.status(200).json({
      jsonrpc: '2.0', id: body?.id ?? null,
      error: { code: PAYME_ERR.AUTH, message: { uz: "Sozlanmagan", ru: 'Не настроено', en: 'Not configured' } },
    });
  }

  try {
    const result = await handlePayme(body, req.headers?.authorization, cfg, supabaseRepo(db));
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('payme callback failed', e?.message);
    return res.status(200).json({
      jsonrpc: '2.0', id: body?.id ?? null,
      error: { code: PAYME_ERR.CANNOT_PERFORM, message: { uz: 'Server xatosi', ru: 'Ошибка сервера', en: 'Server error' } },
    });
  }
}
