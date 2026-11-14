// Admin panel.
import { ShieldAlert, Loader2, X, Gift, Eye, AlertTriangle, Coins, Star } from "lucide-react";
import { AdminPanelProps } from "./adminShared";
import { useAdminPanelState } from "./useAdminPanelState";
import { OverviewTab } from "./tabs/OverviewTab";
import { UsersTab } from "./tabs/UsersTab";
import { HabitsTab } from "./tabs/HabitsTab";
import { FeedbackTab } from "./tabs/FeedbackTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { MonitoringTab } from "./tabs/MonitoringTab";
import { HealthTab } from "./tabs/HealthTab";

export function AdminPanel(props: AdminPanelProps) {
  const s = useAdminPanelState(props);
  const { t, activeTab, setActiveTab, users, loading, error, efficiencyMap, bonusUserId, setBonusUserId, bonusCoins, setBonusCoins, bonusScore, setBonusScore, grantingBonus, bonusError, detailsUserId, setDetailsUserId, detailsLoading, detailsHabits, detailsCompleted, handleGrantBonus, tabs } = s;


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
          <ShieldAlert size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('admin_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {t('admin_subtitle')}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs px-3 py-2.5 rounded-lg" style={{ color: "var(--coral-red)", background: "rgba(248,113,113,0.1)" }}>
          <AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 overflow-x-auto" style={{ background: "rgba(255,255,255,0.05)" }}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setActiveTab(tb.id)}
            className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[44px] whitespace-nowrap"
            style={{
              background: activeTab === tb.id ? ("rgba(255,255,255,0.1)") : "transparent",
              color: activeTab === tb.id ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: activeTab === tb.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <tb.icon size={13} /> {tb.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab s={s} />}

      {activeTab === "users" && <UsersTab s={s} />}

      {activeTab === "habits" && <HabitsTab s={s} />}

      {/* ── Bonus tanga/ball berish modali ── */}
      {bonusUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setBonusUserId(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.08)` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Gift size={15} style={{ color: "#A78BFA" }} /> {t('admin_grant_bonus')}
              </h3>
              <button onClick={() => setBonusUserId(null)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] mb-1" style={{ color: "var(--muted-foreground)" }}>{t('admin_bonus_hint')}</p>
            <div className="flex flex-col gap-3 mt-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}><Coins size={11} className="inline-block align-[-1px] mr-1" />{t('admin_bonus_coins')}</label>
                <input type="number" value={bonusCoins} onChange={(e) => setBonusCoins(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "var(--foreground)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}><Star size={11} className="inline-block align-[-1px] mr-1" />{t('admin_bonus_score')}</label>
                <input type="number" value={bonusScore} onChange={(e) => setBonusScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "var(--foreground)" }} />
              </div>
            </div>
            {bonusError && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{bonusError}</p>}
            <button
              onClick={handleGrantBonus}
              disabled={grantingBonus}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "var(--neon-green)", color: "#0E1117", opacity: grantingBonus ? 0.7 : 1 }}
            >
              {grantingBonus ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />}
              {t('admin_bonus_submit')}
            </button>
          </div>
        </div>
      )}

      {/* ── Foydalanuvchi tafsilotlari modali ── */}
      {detailsUserId && (() => {
        const u = users.find((x) => x.id === detailsUserId);
        if (!u) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setDetailsUserId(null); }}>
            <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.08)`, maxHeight: "80vh", overflowY: "auto" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <Eye size={15} style={{ color: "#60A5FA" }} /> {u.display_name}
                </h3>
                <button onClick={() => setDetailsUserId(null)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
                  <X size={14} />
                </button>
              </div>
              {detailsLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: t('an_economy_coins'), value: `${u.coins || 0}` },
                      { label: t('admin_col_score'), value: `${u.score || 0}` },
                      { label: t('admin_col_efficiency'), value: `${efficiencyMap[u.id] ?? 0}%` },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                        <p className="text-sm font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{s.value}</p>
                        <p className="text-[9px] mt-1" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mb-2" style={{ color: "var(--muted-foreground)" }}>
                    {t('admin_details_total_completed')}: <span style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{detailsCompleted}</span>
                  </p>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>{t('admin_details_active_habits')} ({detailsHabits.length})</p>
                  {detailsHabits.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('admin_details_no_habits')}</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {detailsHabits.map((h) => (
                        <div key={h.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <span className="text-sm">{h.emoji}</span>
                          <span className="text-xs flex-1 truncate" style={{ color: "var(--foreground)" }}>{h.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: h.type === "negative" ? "rgba(248,113,113,0.12)" : "rgba(74,222,128,0.12)", color: h.type === "negative" ? "#F87171" : "#4ADE80" }}>
                            {h.type === "negative" ? t('an_habits_negative') : t('an_habits_positive')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === "feedback" && <FeedbackTab s={s} />}

      {activeTab === "analytics" && <AnalyticsTab s={s} />}

      {activeTab === "monitoring" && <MonitoringTab s={s} />}

      {activeTab === "health" && <HealthTab s={s} />}
    </div>
  );
}
