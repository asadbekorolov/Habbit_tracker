// Tahlil (Analytics) — HabitBreakdown.
import { Trophy, AlertCircle, SlidersHorizontal, ChevronRight, Flame } from "lucide-react";
import { HabitIcon, cleanHabitName } from "../../../components/HabitIcon";
import type { AnalyticsData } from "../useAnalyticsData";

export function HabitBreakdown({ s }: { s: AnalyticsData }) {
  const { t, navigate, habitStats, card } = s;

  return (
    <div style={{ ...card, background: "rgba(22,27,34,0.85)" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            {t('analytics_per_habit')}
          </h3>
          <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
            {t('analytics_per_habit_sub')}
          </p>
        </div>

        <button
          onClick={() => navigate('/habits')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold active:scale-95 transition-all shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span>Boshqarish</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>
      </div>

      <div className="mb-6">
        {/* Highlights */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-amber-400/5 border border-amber-400/10">
            <div className="flex items-center gap-2 mb-2">
               <Trophy size={14} className="text-amber-600 dark:text-amber-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 opacity-60">Eng yaxshi</span>
            </div>
            <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{cleanHabitName(habitStats[0].name)}</p>
            <p className="text-[10px] mt-1 text-amber-600 dark:text-amber-400 font-black" style={{ fontFamily: "'Geist Mono', monospace" }}>{habitStats[0].pct}% muvaffaqiyat</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-400/5 border border-rose-400/10">
            <div className="flex items-center gap-2 mb-2">
               <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 opacity-60">E'tibor talab</span>
            </div>
            <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{cleanHabitName(habitStats[habitStats.length-1].name)}</p>
            <p className="text-[10px] mt-1 text-rose-600 dark:text-rose-400 font-black" style={{ fontFamily: "'Geist Mono', monospace" }}>{habitStats[habitStats.length-1].pct}% muvaffaqiyat</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {habitStats.map((h) => {
          const isStrong = h.pct >= 70;
          const isWeak = h.pct < 30;
          const barColor = isStrong ? "#4ADE80" : isWeak ? "#F87171" : "#FBBF24";
          return (
            <div key={h.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <HabitIcon emoji={h.emoji} name={h.name} />
                  <span className="text-sm font-medium text-slate-900 dark:text-card-foreground">
                    {cleanHabitName(h.name)}
                  </span>
                  {h.streak > 1 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: "rgba(249,115,22,0.12)",
                        color: "#F97316",
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      <Flame size={11} className="inline-block align-[-1px] mr-0.5" />{h.streak}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}
                  >
                    {h.completedDays}/30 {t('days')}
                  </span>
                  <span
                    className="text-xs font-bold w-10 text-right"
                    style={{ color: barColor, fontFamily: "'Geist Mono', monospace" }}
                  >
                    {h.pct}%
                  </span>
                </div>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${h.pct}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t flex-wrap" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {[
          { color: "#16A34A", label: t('analytics_strong') },
          { color: "#D97706", label: t('analytics_mid') },
          { color: "#DC2626", label: t('analytics_weak') },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-slate-500 dark:text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
