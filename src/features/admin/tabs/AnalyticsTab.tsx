// Admin panel — AnalyticsTab.
import { ListChecks, Loader2, UserPlus, Coins, Sparkles, Palette, UsersRound, Clock, CheckCircle2 } from "lucide-react";
import type { AdminPanelState } from "../useAdminPanelState";

export function AnalyticsTab({ s }: { s: AdminPanelState }) {
  const { t, analyticsSummary, analyticsLoading, analyticsError, dashboard, dashboardLoading, dashboardError, cardStyle } = s;

  return (
    <>
      {dashboardError && (
        <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {dashboardError}</p>
      )}

      {dashboardLoading ? (
        <div style={cardStyle} className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        </div>
      ) : dashboard && (
        <>
          {/* ── Foydalanuvchi o'sishi ── */}
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={16} style={{ color: "#3B82F6" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('an_users_title')}</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: t('an_users_total'), value: dashboard.users.total, color: "#3B82F6" },
                { label: t('an_users_new_today'), value: dashboard.users.new_today, color: "#4ADE80" },
                { label: t('an_users_new_week'), value: dashboard.users.new_week, color: "#4ADE80" },
                { label: t('an_users_banned'), value: dashboard.users.banned, color: "#F87171" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                  <p className="text-lg font-bold leading-none" style={{ color: s.color, fontFamily: "'Geist Mono', monospace" }}>{s.value}</p>
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Odat ko'rsatkichlari ── */}
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <ListChecks size={16} style={{ color: "#4ADE80" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('an_habits_title')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                <p className="text-lg font-bold leading-none" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>{dashboard.habits.active_total}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_habits_active')}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                <p className="text-lg font-bold leading-none" style={{ color: "#60A5FA", fontFamily: "'Geist Mono', monospace" }}>{dashboard.habits.completion_rate_pct}%</p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_habits_completion')}</p>
              </div>
            </div>
            <p className="text-[11px] mb-1.5" style={{ color: "var(--muted-foreground)" }}>
              {t('an_habits_split')} · {dashboard.habits.positive_count} {t('an_habits_positive')} / {dashboard.habits.negative_count} {t('an_habits_negative')}
            </p>
            <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div style={{
                width: `${dashboard.habits.active_total > 0 ? (dashboard.habits.positive_count / dashboard.habits.active_total) * 100 : 0}%`,
                background: "#4ADE80",
              }} />
              <div style={{
                width: `${dashboard.habits.active_total > 0 ? (dashboard.habits.negative_count / dashboard.habits.active_total) * 100 : 0}%`,
                background: "#F87171",
              }} />
            </div>
          </div>

          {/* ── Gamifikatsiya iqtisodiyoti ── */}
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Coins size={16} style={{ color: "#FBBF24" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('an_economy_title')}</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { icon: Coins, label: t('an_economy_coins'), value: dashboard.economy.total_coins, color: "#FBBF24" },
                { icon: Sparkles, label: t('an_economy_xp'), value: dashboard.economy.total_xp, color: "#A78BFA" },
                { icon: Palette, label: t('an_economy_frames'), value: dashboard.economy.active_frames, color: "#F97316" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 flex flex-col items-center text-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                  <s.icon size={14} style={{ color: s.color, marginBottom: 6 }} />
                  <p className="text-base font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{s.value}</p>
                  <p className="text-[10px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Guruh va ijtimoiy ko'rsatkichlar ── */}
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <UsersRound size={16} style={{ color: "#34D399" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('an_groups_title')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                <p className="text-lg font-bold leading-none" style={{ color: "#34D399", fontFamily: "'Geist Mono', monospace" }}>{dashboard.groups.total_groups}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_groups_total')}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                <p className="text-lg font-bold leading-none" style={{ color: "#60A5FA", fontFamily: "'Geist Mono', monospace" }}>{dashboard.groups.avg_members}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_groups_avg_members')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{ color: "#FBBF24" }} />
                <span className="text-xs" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{dashboard.groups.pending_proofs}</span>
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('an_groups_pending')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} style={{ color: "#4ADE80" }} />
                <span className="text-xs" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{dashboard.groups.approved_proofs}</span>
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('an_groups_approved')}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Batafsil hodisalar jadvali ── */}
      <div style={cardStyle}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('analytics_summary_title')}</h3>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{t('analytics_summary_sub')}</p>
      {analyticsLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
      ) : analyticsError ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--coral-red)" }}>⚠ {analyticsError}</p>
      ) : analyticsSummary.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>{t('analytics_empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                <th className="text-left py-2 pr-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_event')}</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_total')}</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_users')}</th>
                <th className="text-right py-2 pl-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_sessions')}</th>
              </tr>
            </thead>
            <tbody>
              {analyticsSummary.map((row) => (
                <tr key={row.event_name} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td className="py-2 pr-3 font-mono" style={{ color: "var(--foreground)" }}>{row.event_name}</td>
                  <td className="text-right py-2 px-3" style={{ color: "var(--foreground)" }}>{row.total_count}</td>
                  <td className="text-right py-2 px-3" style={{ color: "var(--muted-foreground)" }}>{row.unique_users}</td>
                  <td className="text-right py-2 pl-3" style={{ color: "var(--muted-foreground)" }}>{row.unique_sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}
