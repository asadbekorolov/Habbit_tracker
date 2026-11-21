// Ilovaning ommaviy sayt manzili — BITTA joyda.
//
// Taklif (?ref) va to'plam (?pack) havolalari, poster pastidagi manzil
// shu yerdan olinadi. `.uz` domen ulanganda faqat SITE_URL ni almashtiring
// va ilovani qayta yig'ing (docs/DOMAIN.md). Env orqali emas — Android build
// va Vercel build bir xil manzilni ko'rishi uchun kodda turadi (sir emas).

/** Vercel'ning doimiy manzili. Domen ulangandan keyin ham ishlashda davom etadi. */
export const LEGACY_SITE_URL = "https://habit-tracker-asadbek.vercel.app";

/** Foydalanuvchilarga ko'rsatiladigan va ulashiladigan asosiy sayt. */
export const SITE_URL = LEGACY_SITE_URL;

/**
 * Ilova ichidan /api chaqiruvlari boradigan manzil (apiClient.ts).
 * Ataylab LEGACY'da qoldirilgan: o'rnatilgan eski versiyalar ham shu yerga
 * murojaat qiladi va vercel.app hech qachon yo'qolmaydi. Domen barqaror
 * ishlagach, xohlasangiz SITE_URL ga o'tkazish mumkin.
 */
export const API_SITE_URL = LEGACY_SITE_URL;

/** "https://idrok.uz/" -> "https://idrok.uz"; https bo'lmasa yoki yo'l bo'lsa — null */
export function normalizeSiteUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export const PUBLIC_SITE_URL = normalizeSiteUrl(SITE_URL) ?? LEGACY_SITE_URL;
export const PUBLIC_SITE_HOST = new URL(PUBLIC_SITE_URL).host;
