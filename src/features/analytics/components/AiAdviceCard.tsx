// Tahlil (Analytics) — AiAdviceCard.
import { Sparkles, Coins } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function AiAdviceCard({ s }: { s: AnalyticsData }) {
  const { setShowPremiumAI } = s;

  return (
    <div id="ai-tahlil-card" className="rounded-2xl p-5 mb-5 relative overflow-hidden group border border-amber-500/20"
         style={{ background: "linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)" }}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="flex items-start gap-4 relative z-10">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/20 shrink-0">
           <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
           <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">AI Intellektual Tahlil</h3>
           <p className="text-[11px] text-amber-800 dark:text-amber-200/60 leading-relaxed mb-4">
              Zaif odatlaringizni aniqlang va AI murabbiyidan shaxsiy tavsiyalar oling.
           </p>
           <button
             onClick={() => setShowPremiumAI(true)}
             className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all active:scale-95 flex items-center gap-2"
           >
              AI Tahlilni Boshlash (200 <Coins className="w-3.5 h-3.5 fill-current" />)
           </button>
        </div>
      </div>
    </div>
  );
}
