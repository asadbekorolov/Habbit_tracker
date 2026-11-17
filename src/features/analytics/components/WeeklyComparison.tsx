// Tahlil (Analytics) — WeeklyComparison.
import type { AnalyticsData } from "../useAnalyticsData";

export function WeeklyComparison({ s }: { s: AnalyticsData }) {
  const { t, weeklyComparison, card } = s;

  return (
    <div style={card}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            {t('analytics_comparison')}
          </h3>
          <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
            {t('analytics_comparison_sub')}
          </p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{
            background: weeklyComparison.diff > 0
              ? "rgba(74,222,128,0.12)"
              : weeklyComparison.diff < 0
              ? "rgba(248,113,113,0.12)"
              : "rgba(255,255,255,0.06)",
            color: weeklyComparison.diff > 0 ? "#16A34A" : weeklyComparison.diff < 0 ? "#DC2626" : "#64748B",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {weeklyComparison.diff > 0 ? `↑ +${weeklyComparison.pct}%` : weeklyComparison.diff < 0 ? `↓ ${weeklyComparison.pct}%` : "= O'zgarishsiz"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Bu hafta */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "rgba(74,222,128,0.06)",
            border: "1px solid rgba(74,222,128,0.18)",
          }}
        >
          <p className="text-[11px] font-semibold mb-1" style={{ color: "#4ADE80" }}>{t('analytics_this_7')}</p>
          <p className="text-3xl font-bold leading-none" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
            {weeklyComparison.thisTotal}
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>{t('done')}</p>
          <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--muted-foreground)" }}>
            {weeklyComparison.thisDays}/7 faol kun
          </p>
        </div>
        {/* Oldingi hafta */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(255,255,255,0.06)`,
          }}
        >
          <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>{t('analytics_prev_7')}</p>
          <p className="text-3xl font-bold leading-none" style={{ color: "var(--card-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {weeklyComparison.prevTotal}
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>{t('done')}</p>
          <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--muted-foreground)" }}>
            {weeklyComparison.prevDays}/7 faol kun
          </p>
        </div>
      </div>

      {/* Bar comparison: 7 pairs */}
      <div>
        <div className="flex items-end gap-1" style={{ height: 56 }}>
          {weeklyComparison.thisBars.map((thisPct, i) => {
            const prevPct = weeklyComparison.prevBars[i];
            const maxPct = Math.max(thisPct, prevPct, 1);
            return (
              <div key={i} className="flex-1 flex items-end gap-px" style={{ height: "100%" }}>
                <div className="flex-1 rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max((prevPct / maxPct) * 100, prevPct > 0 ? 6 : 0)}%`,
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
                <div className="flex-1 rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max((thisPct / maxPct) * 100, thisPct > 0 ? 6 : 0)}%`,
                    background: thisPct >= prevPct ? "#4ADE80" : "#F87171",
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(255,255,255,0.12)" }} />
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_prev_week')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4ADE80" }} />
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('reflect_this_week')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
