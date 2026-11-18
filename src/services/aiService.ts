/**
 * Claude habit analysis — client side.
 *
 * The request goes through our own Vercel function (api/ai-analysis.ts),
 * which holds the Anthropic API key. The key must NEVER be put in this file
 * or in any VITE_* env variable: everything VITE_* is bundled into the
 * web build and the Android/iOS app, where anyone can read it.
 *
 * Tangalar faqat serverda yechiladi va AI natija bermasa o'sha yerda
 * qaytariladi. So'rov serverga yetmasa (internet yo'q) — hech narsa yechilmaydi.
 */

import { supabase } from "./supabase";
import { postApi } from "./apiClient";
import { st } from "../utils/serviceT";
import type { TKey } from "../utils/i18n";
import { isNetworkError, parseAiReport, type AiReport } from "../utils/aiReport";

// Server xato kodlari -> foydalanuvchi tilidagi xabar (ai_err_* kalitlari)
const AI_ERROR_KEYS: Record<string, TKey> = {
  network: "ai_err_network",
  unauthorized: "ai_err_unauthorized",
  not_configured: "ai_err_not_configured",
  rate_limited: "ai_err_rate_limited",
  payload_too_large: "ai_err_payload_too_large",
  refused: "ai_err_refused",
  insufficient_coins: "ai_err_insufficient_coins",
  ai_error: "ai_err_ai_error",
  empty_response: "ai_err_empty_response",
  bad_format: "ai_err_bad_format",
  charge_failed: "ai_err_charge_failed",
  network_error: "ai_err_network_error",
};
const aiErrorMessage = (code: string) => st(AI_ERROR_KEYS[code] ?? "ai_err_generic");

export async function requestClaudeHabitAnalysis(telemetryPayload: string): Promise<AiReport> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error(aiErrorMessage("unauthorized"));

  let response: Response;
  try {
    response = await postApi("/api/ai-analysis", { payload: telemetryPayload });
  } catch (e) {
    // fetch() faqat tarmoq darajasida yiqiladi (internet yo'q, server javob
    // bermadi) — so'rov serverga yetmagan, demak tanga ham yechilmagan.
    console.warn("AI analysis request failed:", isNetworkError(e) ? "network" : e);
    throw new Error(aiErrorMessage("network"));
  }

  const result = await response.json().catch(() => null);
  // Yangi server — tuzilgan report; eski server (hali yangilanmagan) — oddiy matn.
  // Ikkalasida ham tanga yechilgan, shuning uchun natija albatta ko'rsatiladi.
  const report = result?.ok
    ? parseAiReport(result.report) ?? (typeof result.text === "string" ? parseAiReport({ summary: result.text }) : null)
    : null;
  if (!report) {
    const code = result?.error || (result?.ok ? "bad_format" : `http_${response.status}`);
    console.warn("AI analysis failed:", code);
    throw new Error(aiErrorMessage(code));
  }
  return report;
}
