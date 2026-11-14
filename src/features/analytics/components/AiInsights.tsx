// Tahlil (Analytics) — AiInsights.
import { Loader2, Brain, Sparkles, RotateCw, Coins, AlertTriangle } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function AiInsights({ s }: { s: AnalyticsData }) {
  const { t, aiCardRef, coachNote, coachGeneratedAt, coachLoading, coachError, PREMIUM_AI_COST, insights, canGenerateCoachNote, handleGenerateCoachNote, handlePremiumAI } = s;

  return (
    <div
      ref={aiCardRef}
      id="ai-tahlil-card-detail"
      className="rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        background: "rgba(22,27,34,0.9)",
        border: coachLoading ? "1px solid rgba(251,191,36,0.5)" : `1px solid rgba(255,255,255,0.07)`,
        boxShadow: coachLoading ? "0 0 30px rgba(251,191,36,0.15)" : "none"
      }}
    >
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)" }}>
          <Brain size={15} style={{ color: "#A78BFA" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('analytics_ai')}</p>
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_ai_sub')}</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {/* AI Coach Note — real LLM call, generated on demand and cached in ai_coach_notes */}
        <div
          className={`p-4 rounded-2xl relative transition-all duration-500 ${coachLoading ? 'animate-pulse' : ''}`}
          style={{
            background: "rgba(167,139,250,0.08)",
            border: coachLoading ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(167,139,250,0.25)"
          }}
        >
          {coachLoading && (
            <div className="flex flex-col items-center justify-center py-8">
               <Sparkles className="w-8 h-8 text-amber-400 animate-spin mb-4" />
               <p className="text-sm font-bold text-amber-400 uppercase tracking-widest text-center">
                 AI murabbiy sizning barcha ko'rsatkichlaringizni chuqur tahlil qilmoqda...
               </p>
            </div>
          )}
          {!coachLoading && coachNote ? (
            <>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--foreground)" }}>{coachNote}</p>
              <div
                className="flex items-center justify-between mt-3 pt-3"
                style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}
              >
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {coachGeneratedAt ? new Date(coachGeneratedAt).toLocaleDateString() : ""}
                </span>
                <button
                  type="button"
                  onClick={handleGenerateCoachNote}
                  disabled={coachLoading}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-400"
                  style={{ opacity: coachLoading ? 0.6 : 1 }}
                >
                  {coachLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                  <span>Yangilash</span>
                  <Coins className="w-3.5 h-3.5 text-amber-400 ml-1" />
                  <span>{PREMIUM_AI_COST}</span>
                </button>
              </div>
            </>
          ) : !coachLoading && (
            <div className="text-center py-2">
              <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>
                {canGenerateCoachNote ? t('ai_coach_intro') : t('ai_coach_not_enough_data')}
              </p>
              <button
                type="button"
                onClick={handlePremiumAI}
                disabled={!canGenerateCoachNote || coachLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{
                  background: canGenerateCoachNote ? "#A78BFA" : "rgba(255,255,255,0.06)",
                  color: canGenerateCoachNote ? "#0a0a0a" : "var(--muted-foreground)",
                  opacity: coachLoading ? 0.7 : 1,
                }}
              >
                {coachLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {coachLoading ? t('ai_coach_generating') : `${t('ai_coach_generate_btn')} · ${PREMIUM_AI_COST}`}
                {!coachLoading && <Coins className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </button>
            </div>
          )}
          {coachError && (
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{coachError}</p>
          )}
        </div>

        {/* Existing lightweight, instant client-side correlations (mood/sleep/screen) */}
        {insights.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide px-1" style={{ color: "var(--muted-foreground)" }}>
              {t('analytics_ai_patterns_heading')}
            </p>
            {insights.map((ins, i) => (
              <div key={i} className="p-4 rounded-2xl" style={{ background: ins.bg, border: `1px solid ${ins.border}` }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ins.color}15` }}>
                     <ins.icon size={18} style={{ color: ins.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: ins.color }}>{ins.title}</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{ins.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
