// Ochiq veb-sahifalar (maxfiylik siyosati, hisobni o'chirish) — Vercel'dagi
// statik fayllar (public/*.html). Ilovada tizim brauzerida, vebda yangi oynada.
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { REMOTE_API_BASE } from "../services/apiClient";

export const PRIVACY_PATH = "/privacy.html";
export const DELETE_ACCOUNT_PATH = "/delete-account.html";

export async function openPublicPage(path: string, lang?: string): Promise<void> {
  const url = `${REMOTE_API_BASE}${path}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`;
  if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
