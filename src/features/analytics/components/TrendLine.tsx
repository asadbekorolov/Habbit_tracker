// Tahlil (Analytics) — TrendLine.
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { AnalyticsData } from "../useAnalyticsData";

export function TrendLine({ s }: { s: AnalyticsData }) {
  const { t, trendData, card } = s;
  // O'q yorliqlari: birinchi kundan BUGUNGACHA teng oraliqda (oxirgisi doim bugun).
  const last = trendData.length - 1;
  const xTicks = last > 0
    ? Array.from(new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * last) / 4)))).map((i) => trendData[i].label)
    : trendData.map((d) => d.label);

  return (
    <div style={{ ...card, background: "rgba(22,27,34,0.85)" }}>
      <div className="mb-1">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          {t('analytics_trend')}
        </h3>
        <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
          {t('analytics_trend_sub')}
        </p>
      </div>
      <div className="flex items-center gap-4 mt-3 mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4ADE80" }} />
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_trend_daily')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-0.5 rounded-sm" style={{ background: "#60A5FA" }} />
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_trend_avg7')}</span>
        </div>
      </div>
      <div style={{ height: 180, marginLeft: -12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={"rgba(255,255,255,0.06)"} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#8B949E" }}
              ticks={xTicks}
              interval={0}
              padding={{ left: 6, right: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              allowDataOverflow
              ticks={[0, 50, 100]}
              tick={{ fontSize: 9, fill: "#8B949E" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: "#161B22",
                border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 10,
                fontSize: 11,
              }}
              labelStyle={{ color: "#8B949E" }}
              formatter={(value: number, name: string) => [`${value}%`, name === "pct" ? t('analytics_trend_daily') : t('analytics_trend_avg7')]}
            />
            <Area type="linear" dataKey="pct" stroke="#4ADE80" strokeWidth={2} fill="#4ADE80" fillOpacity={0.12} />
            <Line type="linear" dataKey="avg" stroke="#60A5FA" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
