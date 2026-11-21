// Taklif (referral) kodi: havoladagi ?ref=KOD ni ushlash, saqlash va
// server xatolarini tanish. Mukofotlar serverda (058: apply_referral_code).
export const PUBLIC_SITE_URL = "https://habit-tracker-asadbek.vercel.app";
export const PUBLIC_SITE_HOST = "habit-tracker-asadbek.vercel.app";
export const REFERRER_BONUS = 100;
export const REFERRED_BONUS = 50;
/** Ro'yxatdan o'tgandan keyin kod kiritish muddati (serverda ham shu) */
export const REFERRAL_WINDOW_HOURS = 48;

const STORAGE_KEY = "pending_referral_code";

/** "  x7k9p2a " -> "X7K9P2A"; formatga mos kelmasa — null */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{6,8}$/.test(code) ? code : null;
}

export function referralLink(code: string): string {
  return `${PUBLIC_SITE_URL}/?ref=${encodeURIComponent(code)}`;
}

/** "?ref=abc1234&x=1" -> { code: "ABC1234", rest: "?x=1" } */
export function parseReferralFromSearch(search: string): { code: string | null; rest: string } {
  const params = new URLSearchParams(search);
  const code = normalizeReferralCode(params.get("ref"));
  if (!params.has("ref")) return { code: null, rest: search };
  params.delete("ref");
  const s = params.toString();
  return { code, rest: s ? `?${s}` : "" };
}

/**
 * Ilova ochilishida bir marta: URL'dagi kodni saqlaydi va manzildan olib
 * tashlaydi (sahifa yangilanganda yoki ulashilganda takrorlanmasin).
 */
export function capturePendingReferral(): string | null {
  try {
    const { code, rest } = parseReferralFromSearch(window.location.search);
    if (rest !== window.location.search) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest}${window.location.hash}`);
    }
    if (code) localStorage.setItem(STORAGE_KEY, code);
    return code;
  } catch {
    return null;
  }
}

export function getPendingReferral(): string | null {
  try { return normalizeReferralCode(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

export function clearPendingReferral(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* yo'q */ }
}

export type ReferralErrorCode =
  | "invalid_code"
  | "self_referral"
  | "already_referred"
  | "referral_window_closed"
  | "mutual_referral"
  | "banned"
  | "not_authenticated"
  | "profile_not_found";

const KNOWN: ReferralErrorCode[] = [
  "invalid_code", "self_referral", "already_referred", "referral_window_closed",
  "mutual_referral", "banned", "not_authenticated", "profile_not_found",
];

/** Server xabaridan kod; tanilmasa (tarmoq va h.k.) — null */
export function referralErrorCode(message: string | null | undefined): ReferralErrorCode | null {
  const m = message || "";
  return KNOWN.find((k) => m.includes(k)) ?? null;
}

/** Bu xatodan keyin saqlangan kodni qayta urinish ma'nosiz */
export function isFinalReferralError(code: ReferralErrorCode | null): boolean {
  return code !== null && code !== "not_authenticated";
}
