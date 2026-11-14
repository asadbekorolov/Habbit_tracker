/**
 * Calls our own Vercel functions (/api/*).
 *
 * In the browser the API is on the same origin. Inside the native app the
 * WebView runs on https://localhost, so requests must go to the deployed
 * site instead. Every call carries the Supabase session token so the
 * server can check who is asking.
 */

import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

const API_BASE = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_BASE_URL || "https://habit-tracker-asadbek.vercel.app")
  : "";

export async function postApi(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
