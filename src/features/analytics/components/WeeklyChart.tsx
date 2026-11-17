// Tahlil (Analytics) — WeeklyChart.
import { TrendingUp } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function WeeklyChart({ s }: { s: AnalyticsData }) {
  const { totalHabits, t, weeklyData, card } = s;

  return (
    <div style={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-400/10">
            <TrendingUp size={16} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              {t('analytics_weekly')}
            </h3>
            <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
              {t('analytics_weekly_sub')}
            </p>
          </div>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            background: "rgba(74,222,128,0.12)",
            color: "var(--neon-green)",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {weeklyData.find((d) => d.isToday)?.pct ?? 0}% {t('analytics_today_label')}
        </span>
      </div>

      {totalHabits === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
          {t('analytics_no_habits')}
        </p>
      ) : (
        <>
          <div className="flex items-end gap-2" style={{ height: 96 }}>
            {weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span
                  className="text-[10px]"
                  style={{
                    color: d.isToday ? "#4ADE80" : "var(--muted-foreground)",
                    fontFamily: "'Geist Mono', monospace",
                    minHeight: 14,
                  }}
                >
                  {d.pct > 0 ? `${d.pct}%` : ""}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: 64 }}>
                  <div
                    className="w-full rounded-t-md transition-all duration-500"
                    style={{
                      height: d.pct > 0 ? `${Math.max(d.pct, 6)}%` : "3px",
                      background: d.isToday
                        ? "#4ADE80"
                        : d.pct > 0
                        ? "rgba(74,222,128,0.35)"
                        : "rgba(255,255,255,0.05)",
                      boxShadow: d.isToday ? "0 0 10px rgba(74,222,128,0.4)" : "none",
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-medium"
                  style={{
                    color: d.isToday ? "#4ADE80" : "var(--muted-foreground)",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {d.day}
                </span>
              </div>
            ))}
          </div>
          {/* Target line label */}
          <div className="flex items-center justify-end mt-3 gap-1.5">
            <div className="w-4 h-px border-t border-dashed" style={{ borderColor: "rgba(74,222,128,0.4)" }} />
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              100% = {totalHabits} ta odat
            </span>
          </div>
        </>
      )}
    </div>
  );
}
