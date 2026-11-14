/**
 * Claude habit analysis — client side.
 *
 * The request goes through our own Vercel function (api/ai-analysis.ts),
 * which holds the Anthropic API key. The key must NEVER be put in this file
 * or in any VITE_* env variable: everything VITE_* is bundled into the
 * web build and the Android/iOS app, where anyone can read it.
 */

import { supabase } from "./supabase";
import { postApi } from "./apiClient";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Tahlil uchun qaytadan tizimga kiring.",
  not_configured: "AI tahlil hozircha sozlanmagan.",
  rate_limited: "So'rovlar ko'p. Birozdan so'ng qayta urinib ko'ring.",
  payload_too_large: "Ma'lumot hajmi juda katta.",
  refused: "AI bu so'rovga javob bera olmadi. Tangalar qaytarildi.",
  insufficient_coins: "Tangalar yetarli emas.",
  ai_error: "AI xizmatida xatolik. Tangalar qaytarildi.",
  empty_response: "AI bo'sh javob qaytardi. Tangalar qaytarildi.",
};

export async function requestClaudeHabitAnalysis(telemetryPayload: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error(ERROR_MESSAGES.unauthorized);

  const response = await postApi("/api/ai-analysis", { payload: telemetryPayload });

  const result = await response.json().catch(() => null);
  if (!result?.ok || !result.text) {
    const code = result?.error || `http_${response.status}`;
    console.warn("AI analysis failed:", code);
    throw new Error(ERROR_MESSAGES[code] || "Tahlilni yuklashda xatolik yuz berdi.");
  }
  return result.text;
}
