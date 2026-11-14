// Guruh tafsilotlari — StatsTab.
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Users, Crown, Loader2, CheckCircle2, Clock, BarChart3, Download, UserCheck, Zap, Medal } from "lucide-react";
import { getHabitCategory, getCategoryTheme } from "../../../../utils/categoryTheme";
import { tashkentTodayAnchor } from "../../../../utils/date";
import { DATE_LOCALE } from "../../groupsShared";
import type { GroupDetailState } from "../useGroupDetail";

export function StatsTab({ s }: { s: GroupDetailState }) {
  const { profile, group, t, lang, members, downloading, statsRef, handleDownloadStats, rankedMemberStats, dailyTrend, habitBreakdown, maxHabitApproved, totalApprovedMonth, activeMembersCount, pendingCount, groupAvgPct } = s;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t('groups_month_all_stats').replace('{date}', tashkentTodayAnchor().toLocaleDateString(DATE_LOCALE[lang], { month: 'long', year: 'numeric' }))}
        </p>
        {rankedMemberStats.length > 0 && (
          <button
            onClick={handleDownloadStats}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: "rgba(74,222,128,0.12)",
              color: "#4ADE80",
              border: "1px solid rgba(74,222,128,0.25)",
              opacity: downloading ? 0.6 : 1,
            }}
          >
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {downloading ? t('groups_downloading') : t('groups_download_btn')}
          </button>
        )}
      </div>

      <div ref={statsRef} className="flex flex-col gap-4 rounded-2xl p-4"
        style={{ background: "#0D1117" }}>
        {/* Report header (visible in downloaded image) */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Users size={16} className="stroke-[2.2]" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{group.name}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {tashkentTodayAnchor().toLocaleDateString(DATE_LOCALE[lang], { month: 'long', year: 'numeric' })} {t('groups_month_report_suffix')}
              </p>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: CheckCircle2, label: t('groups_stats_total_approved'), value: String(totalApprovedMonth), color: "#10B981" },
            { icon: UserCheck, label: t('groups_stats_active_members'), value: `${activeMembersCount}/${members.length}`, color: "#38BDF8" },
            { icon: Clock, label: t('groups_stats_pending'), value: String(pendingCount), color: "#FBBF24" },
            { icon: Zap, label: t('groups_stats_avg'), value: `${groupAvgPct}%`, color: "#22D3EE" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl p-3.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid rgba(255,255,255,0.05)`,
              }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5" style={{ background: `${kpi.color}20` }}>
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
              <p className="text-lg font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {kpi.value}
              </p>
              <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        {totalApprovedMonth === 0 ? (
          <div className="p-8 flex flex-col items-center gap-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
            <BarChart3 size={28} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>{t('groups_stats_no_activity')}</p>
          </div>
        ) : (
          <>
            {/* Daily trend chart */}
            <div className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_stats_trend_title')}</p>
              <p className="text-[11px] mt-0.5 mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_stats_trend_sub')}</p>
              <div style={{ height: 160, marginLeft: -12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={"rgba(255,255,255,0.06)"} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#8B949E" }}
                      interval={Math.max(0, Math.ceil(dailyTrend.length / 7) - 1)} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "#8B949E" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip
                      contentStyle={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, fontSize: 11 }}
                      labelStyle={{ color: "#8B949E" }}
                      formatter={(value: number) => [value, t('groups_stats_total_approved')]}
                    />
                    <Area type="monotone" dataKey="count" stroke="#4ADE80" strokeWidth={2} fill="#4ADE80" fillOpacity={0.15} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-habit breakdown */}
            {habitBreakdown.length > 0 && (
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_stats_habit_breakdown_title')}</p>
                <p className="text-[11px] mt-0.5 mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_stats_habit_breakdown_sub')}</p>
                <div className="flex flex-col gap-3">
                  {habitBreakdown.map((h) => {
                    const pct = Math.round((h.approved / maxHabitApproved) * 100);
                    const category = getHabitCategory(h.name, h.emoji);
                    const theme = getCategoryTheme(category);
                    const Icon = theme.icon;

                    return (
                      <div key={h.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${theme.color}15`, border: `1px solid ${theme.color}30` }}>
                              <Icon size={14} style={{ color: theme.color }} />
                            </div>
                            <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{h.name}</span>
                          </div>
                          <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                            {h.approved} ta · {h.participants} {t('groups_stats_participants_suffix')}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: theme.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Per-member ranking */}
        {rankedMemberStats.length > 0 && (
          <div>
            <p className="text-sm font-semibold px-1 mb-2" style={{ color: "var(--foreground)" }}>{t('groups_stats_members_title')}</p>
            <div className="flex flex-col gap-3">
              {rankedMemberStats.map(([uid, s], i) => {
                const total = s.approved + s.pending + s.rejected || 1;
                const approvedPct = Math.round((s.approved / total) * 100);
                const isMe = uid === profile.id;
                return (
                  <div key={uid} className="p-4 rounded-xl"
                    style={{
                      background: "rgba(22,27,34,0.85)",
                      border: `1px solid rgba(255,255,255,0.06)`,
                    }}>
                    <div className="flex items-center gap-2 mb-3">
                      {i === 0 ? <Crown size={16} className="text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
                        : i === 1 ? <Medal size={16} className="text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.5)]" />
                        : i === 2 ? <Medal size={16} className="text-amber-700 drop-shadow-[0_0_6px_rgba(180,83,9,0.5)]" />
                        : null}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
                        style={{ background: s.color, color: "#0E1117" }}>
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt="" className="w-8 h-8 object-cover" />
                        ) : (
                          s.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: isMe ? "#4ADE80" : "var(--foreground)" }}>
                          {s.name} {isMe && t('lb_you')}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {s.approved} {t('groups_approved')} · {s.pending} {t('pending')} · {s.rejected} {t('rejected')}
                        </p>
                      </div>
                      <div className="ml-auto text-sm font-bold" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
                        {approvedPct}%
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full" style={{ width: `${approvedPct}%`, background: "#4ADE80" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
