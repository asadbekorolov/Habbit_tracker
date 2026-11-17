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
import { isNetworkError, parseAiReport, type AiReport } from "../utils/aiReport";

const ERROR_MESSAGES: Record<string, string> = {
  network: "Server bilan bog'lanib bo'lmadi, internetni tekshiring. Tangalar yechilmadi.",
  unauthorized: "Tahlil uchun qaytadan tizimga kiring.",
  not_configured: "AI tahlil hozircha sozlanmagan. Tangalar yechilmadi.",
  rate_limited: "So'rovlar ko'p. Birozdan so'ng qayta urinib ko'ring.",
  payload_too_large: "Ma'lumot hajmi juda katta.",
  refused: "AI bu so'rovga javob bera olmadi. Tangalar qaytarildi.",
  insufficient_coins: "Tangalar yetarli emas.",
  ai_error: "AI xizmatida xatolik. Tangalar qaytarildi.",
  empty_response: "AI bo'sh javob qaytardi. Tangalar qaytarildi.",
  bad_format: "AI javobini o'qib bo'lmadi. Tangalar qaytarildi.",
  charge_failed: "Server xatosi. Tangalar yechilmadi.",
  network_error: "Server xatosi. Tangalar qaytarildi.",
};

export async function requestClaudeHabitAnalysis(telemetryPayload: string): Promise<AiReport> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error(ERROR_MESSAGES.unauthorized);

  let response: Response;
  try {
    response = await postApi("/api/ai-analysis", { payload: telemetryPayload });
  } catch (e) {
    // fetch() faqat tarmoq darajasida yiqiladi (internet yo'q, server javob
    // bermadi) — so'rov serverga yetmagan, demak tanga ham yechilmagan.
    console.warn("AI analysis request failed:", isNetworkError(e) ? "network" : e);
    throw new Error(ERROR_MESSAGES.network);
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
    throw new Error(ERROR_MESSAGES[code] || "Tahlilni yuklashda xatolik yuz berdi.");
  }
  return report;
}
