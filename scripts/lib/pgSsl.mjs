// Supabase'ga TLS ulanish sozlamasi (pg.Client `ssl` opsiyasi).
//
// Supabase pooler sertifikati Supabase'ning o'z ildiz CA'si bilan imzolangan —
// u Node'ning standart ro'yxatida yo'q, shuning uchun "self-signed certificate
// in certificate chain" xatosi chiqadi. To'g'ri yechim — shu CA bilan tekshirish:
//   1) Supabase -> Database -> Settings -> SSL Configuration -> Download certificate
//   2) faylni supabase/certs/prod-ca-2021.crt ga saqlang (ommaviy sertifikat,
//      maxfiy emas — commit qilish mumkin), yoki DB_SSL_CA=<yo'l> bering.
// DB_SSL_NO_VERIFY=1 — tekshiruvsiz (faqat oxirgi chora, tavsiya etilmaydi).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_CA = path.join(root, 'supabase', 'certs', 'prod-ca-2021.crt');

export function pgSsl(env = process.env) {
  const caPath = env.DB_SSL_CA || (fs.existsSync(DEFAULT_CA) ? DEFAULT_CA : null);
  if (caPath) return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  if (env.DB_SSL_NO_VERIFY === '1') return { rejectUnauthorized: false };
  return true;
}

/** Ulanish xatosiga tushunarli maslahat. */
export function sslHint(err) {
  if (err && /self-signed certificate/i.test(err.message || '')) {
    return "Supabase CA sertifikati kerak: Database -> Settings -> SSL Configuration -> " +
      `Download certificate, faylni ${path.relative(root, DEFAULT_CA)} ga saqlang (yoki DB_SSL_CA=<yo'l>).`;
  }
  return '';
}
