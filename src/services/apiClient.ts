/**
 * Calls our own Vercel functions (/api/*).
 *
 * In the browser the API is on the same origin. Inside the native app the
 * WebView runs on https://localhost (Android) or capacitor://localhost (iOS),
 * where /api does not exist, so requests must go to the deployed site
 * instead. Every call carries the Supabase session token so the server can
 * check who is asking.
 */

import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";
import { API_SITE_URL } from "../config/site";

export const REMOTE_API_BASE = import.meta.env.VITE_API_BASE_URL || API_SITE_URL;

/**
 * API manzili har chaqiruvda aniqlanadi: modul yuklanishida Capacitor
 * ko'prigi hali tayyor bo'lmasa ham WebView manzilidan bilib olinadi.
 */
export function apiBase(): string {
  if (Capacitor.isNativePlatform()) return REMOTE_API_BASE;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (protocol === "capacitor:" || (protocol === "https:" && hostname === "localhost")) return REMOTE_API_BASE;
  }
  return "";
}

export async function postApi(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
