// Merchant kalitlari faqat Vercel env'dan. Biror kalit yetishmasa — null:
// endpoint'lar "payments_not_configured" qaytaradi, ilova "Tez kunda" deydi.
import type { ClickConfig, PaymeConfig, Provider } from './types';

type Env = Record<string, string | undefined>;

export function readClickConfig(env: Env): ClickConfig | null {
  const serviceId = env.CLICK_SERVICE_ID?.trim();
  const merchantId = env.CLICK_MERCHANT_ID?.trim();
  const secretKey = env.CLICK_SECRET_KEY?.trim();
  if (!serviceId || !merchantId || !secretKey) return null;
  return { serviceId, merchantId, secretKey };
}

export function readPaymeConfig(env: Env): PaymeConfig | null {
  const merchantId = env.PAYME_MERCHANT_ID?.trim();
  const key = env.PAYME_KEY?.trim();
  if (!merchantId || !key) return null;
  return { merchantId, key };
}

export function isProviderConfigured(provider: Provider, env: Env): boolean {
  return provider === 'click' ? !!readClickConfig(env) : !!readPaymeConfig(env);
}

/** To'lovdan keyin qaytish manzili (sayt). */
export function returnUrl(env: Env): string {
  return (env.APP_PUBLIC_URL || 'https://habit-tracker-asadbek.vercel.app').replace(/\/$/, '') + '/store';
}

/** Checkout havolasi — summa va buyurtma faqat serverda yaratilgan tranzaksiyadan. */
export function buildCheckoutUrl(
  provider: Provider,
  txn: { id: string; amount_uzs: number },
  env: Env
): string | null {
  const ret = returnUrl(env);
  if (provider === 'click') {
    const c = readClickConfig(env);
    if (!c) return null;
    const q = new URLSearchParams({
      service_id: c.serviceId,
      merchant_id: c.merchantId,
      amount: String(txn.amount_uzs),
      transaction_param: txn.id,
      return_url: ret,
    });
    return `https://my.click.uz/services/pay?${q.toString()}`;
  }
  const p = readPaymeConfig(env);
  if (!p) return null;
  const params = `m=${p.merchantId};ac.order_id=${txn.id};a=${txn.amount_uzs * 100};c=${ret}`;
  return `https://checkout.paycom.uz/${Buffer.from(params, 'utf8').toString('base64')}`;
}
