// Tahlil (Analytics) — KpiGrid.
import { BarChart3 } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function KpiGrid({ s }: { s: AnalyticsData }) {
  const { t, card, kpis } = s;

  return (
    <div style={card}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-emerald-400/10">
          <BarChart3 size={16} className="text-emerald-500 dark:text-emerald-400" />
        </div>
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          {t('analytics_title')}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl p-3.5 flex flex-col justify-between overflow-hidden min-w-0"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid rgba(255,255,255,0.05)`,
            }}
          >
            <div className="min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5"
                style={{ background: `${kpi.color}20` }}
              >
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
              <p
                className="text-lg font-bold leading-tight text-slate-900 dark:text-white truncate"
                style={{ fontFamily: "'Geist Mono', monospace" }}
                title={kpi.value}
              >
                {kpi.value}
              </p>
              <p className="text-[11px] mt-1.5 font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {kpi.label}
              </p>
            </div>
            <p className="text-[11px] mt-1 font-medium leading-tight text-slate-400" style={{ color: kpi.color, fontFamily: "'Geist Mono', monospace" }}>
              {kpi.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
