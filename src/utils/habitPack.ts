// Odatlar to'plami havolasi: ?pack=KOD (va ixtiyoriy &ref=TAKLIF_KODI).
// Kod ilova ochilishida saqlanadi, tizimga kirgach qabul qilish oynasi ochiladi.
import { PUBLIC_SITE_URL, normalizeReferralCode } from "./referral.ts";

const STORAGE_KEY = "pending_habit_pack";

/** To'plam kodi taklif kodi bilan bir xil formatda (6–8 katta harf/raqam) */
export const normalizePackCode = normalizeReferralCode;

export function packLink(code: string, refCode?: string | null): string {
  const params = new URLSearchParams({ pack: code });
  if (refCode) params.set("ref", refCode);
  return `${PUBLIC_SITE_URL}/?${params.toString()}`;
}

/** "?pack=abc1234&x=1" -> { code: "ABC1234", rest: "?x=1" } */
export function parsePackFromSearch(search: string): { code: string | null; rest: string } {
  const params = new URLSearchParams(search);
  if (!params.has("pack")) return { code: null, rest: search };
  const code = normalizePackCode(params.get("pack"));
  params.delete("pack");
  const s = params.toString();
  return { code, rest: s ? `?${s}` : "" };
}

export function capturePendingPack(): string | null {
  try {
    const { code, rest } = parsePackFromSearch(window.location.search);
    if (rest !== window.location.search) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest}${window.location.hash}`);
    }
    if (code) localStorage.setItem(STORAGE_KEY, code);
    return code;
  } catch {
    return null;
  }
}

export function getPendingPack(): string | null {
  try { return normalizePackCode(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

export function clearPendingPack(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* yo'q */ }
}

/** Maxfiylik: ijobiy odatlar sukut bo'yicha belgilangan, salbiy (cheklov) odatlar — yo'q */
export function defaultPackSelection<T extends { id: string; type: string }>(habits: T[]): Set<string> {
  return new Set(habits.filter((h) => h.type !== "negative").map((h) => h.id));
}

export type HabitPackErrorCode =
  | "pack_not_found"
  | "own_pack"
  | "habit_not_owned"
  | "no_habits"
  | "too_many_habits"
  | "invalid_title"
  | "invalid_selection"
  | "rate_limited"
  | "banned"
  | "not_authenticated";

const KNOWN: HabitPackErrorCode[] = [
  "pack_not_found", "own_pack", "habit_not_owned", "no_habits", "too_many_habits",
  "invalid_title", "invalid_selection", "rate_limited", "banned", "not_authenticated",
];

export function habitPackErrorCode(message: string | null | undefined): HabitPackErrorCode | null {
  const m = message || "";
  return KNOWN.find((k) => m.includes(k)) ?? null;
}
