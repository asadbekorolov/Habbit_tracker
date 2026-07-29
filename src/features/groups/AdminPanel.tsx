import { useState, useEffect } from "react";
import { Users, ListChecks, ShieldAlert, Loader2, Ban, ShieldCheck, Search, AlertTriangle, Trash2, Megaphone, Check, X, ClipboardCheck, Activity, HeartPulse, Flame, MessageSquare, Download, TrendingUp, UserPlus, Coins, Sparkles, Palette, UsersRound, Clock, CheckCircle2, Gift, Eye, Crown } from "lucide-react";
import {
  getGlobalStats, getAllProfiles, toggleUserBan, resetAllData, sendGlobalNotification,
  getAllPendingApprovals, approveGroupLog, rejectGroupLog,
  getAdminMonitoringStats, getInactiveGroups, adminDeleteGroup,
  getAllFeedback, replyToFeedback, getAllHabitsAdmin, getAnalyticsSummary, getAdminAnalyticsDashboard,
  getAdminUsersEfficiency, adminGrantBalance, getUserHabitsAdmin, getAllTimeLogs,
  type AdminMonitoringStats, type InactiveGroup, type FeedbackEntry, type AnalyticsSummaryRow, type AdminAnalyticsDashboard,
} from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { downloadCsv } from "../../utils/csv";
import { AvatarFrame } from "../../components/AvatarFrame";

interface AdminPanelProps {
  isDark: boolean;
  profile: Profile;
}

const DATE_LOCALE: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };
type AdminTab = "overview" | "users" | "feedback" | "analytics" | "monitoring" | "health";

export function AdminPanel({ isDark, profile }: AdminPanelProps) {
  const { t, lang } = useLang();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const [stats, setStats] = useState({ users: 0, habits: 0 });
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [efficiencyMap, setEfficiencyMap] = useState<Record<string, number>>({});
  const [statHover, setStatHover] = useState<string | null>(null);

  // Bonus tanga/ball berish modali
  const [bonusUserId, setBonusUserId] = useState<string | null>(null);
  const [bonusCoins, setBonusCoins] = useState("0");
  const [bonusScore, setBonusScore] = useState("0");
  const [grantingBonus, setGrantingBonus] = useState(false);
  const [bonusError, setBonusError] = useState("");

  // "Batafsil" — foydalanuvchining faol odatlari va statistikasi modali
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsHabits, setDetailsHabits] = useState<any[]>([]);
  const [detailsCompleted, setDetailsCompleted] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [moderationLoading, setModerationLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectLogId, setRejectLogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [monitoring, setMonitoring] = useState<AdminMonitoringStats | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const [monitoringError, setMonitoringError] = useState("");
  const [inactiveGroups, setInactiveGroups] = useState<InactiveGroup[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState("");
  const [exportingHabits, setExportingHabits] = useState(false);
  const [exportError, setExportError] = useState("");

  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummaryRow[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");

  const [dashboard, setDashboard] = useState<AdminAnalyticsDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      setError(null);
      try {
        const [globalStats, profilesData] = await Promise.all([
          getGlobalStats(),
          getAllProfiles()
        ]);
        setStats(globalStats);
        setUsers(profilesData || []);
      } catch (e: any) {
        console.error("Admin ma'lumotlarini yuklashda xatolik:", e);
        setError(e?.message || t('err_loading'));
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
    loadModeration();
    loadMonitoring();
    loadHealth();
    loadEfficiency();
    loadFeedback();
    loadAnalytics();
    loadDashboard();
  }, []);

  async function loadFeedback() {
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      const data = await getAllFeedback();
      setFeedback(data);
    } catch (e: any) {
      setFeedbackError(e?.message || t('err_loading'));
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function handleSendReply(feedbackId: string) {
    const reply = (replyDrafts[feedbackId] || "").trim();
    if (!reply) return;
    setReplyingId(feedbackId);
    setReplyError("");
    try {
      await replyToFeedback(feedbackId, reply);
      const now = new Date().toISOString();
      setFeedback((prev) => prev.map((f) => f.id === feedbackId ? { ...f, admin_reply: reply, admin_replied_at: now } : f));
      setReplyDrafts((prev) => { const next = { ...prev }; delete next[feedbackId]; return next; });
    } catch (e: any) {
      setReplyError(e?.message || t('err_loading'));
    } finally {
      setReplyingId(null);
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const data = await getAnalyticsSummary(30);
      setAnalyticsSummary(data);
    } catch (e: any) {
      setAnalyticsError(e?.message || t('err_loading'));
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const data = await getAdminAnalyticsDashboard();
      setDashboard(data);
    } catch (e: any) {
      setDashboardError(e?.message || t('err_loading'));
    } finally {
      setDashboardLoading(false);
    }
  }

  function exportUsersCsv() {
    downloadCsv(
      `traccer_users_${new Date().toISOString().slice(0, 10)}.csv`,
      [t('admin_col_name'), t('admin_col_username'), t('admin_col_score'), t('admin_col_joined'), t('admin_col_last_seen')],
      users.map((u) => [
        u.display_name,
        u.username,
        u.score || 0,
        new Date(u.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ"),
        u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ") : "",
      ])
    );
  }

  function exportFeedbackCsv() {
    downloadCsv(
      `traccer_feedback_${new Date().toISOString().slice(0, 10)}.csv`,
      [t('admin_col_name'), t('admin_col_username'), t('admin_col_content'), t('admin_col_date')],
      feedback.map((f) => [
        f.display_name,
        f.username,
        f.content,
        new Date(f.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ"),
      ])
    );
  }

  async function exportHabitsCsv() {
    setExportingHabits(true);
    setExportError("");
    try {
      const habitsData = await getAllHabitsAdmin();
      downloadCsv(
        `traccer_habits_${new Date().toISOString().slice(0, 10)}.csv`,
        [t('admin_col_name'), t('admin_col_username'), t('admin_col_habit_name'), t('admin_col_type'), t('admin_col_target'), t('admin_col_unit'), t('admin_col_active'), t('admin_col_date')],
        habitsData.map((h) => [
          h.profiles?.display_name ?? "",
          h.profiles?.username ?? "",
          h.name,
          h.type,
          h.target_value ?? "",
          h.unit ?? "",
          h.is_active ? t('admin_col_yes') : t('admin_col_no'),
          new Date(h.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ"),
        ])
      );
    } catch (e: any) {
      setExportError(e?.message || t('err_loading'));
    } finally {
      setExportingHabits(false);
    }
  }

  async function loadModeration() {
    setModerationLoading(true);
    try {
      const data = await getAllPendingApprovals();
      setPendingApprovals(data);
    } catch (e) {
      console.error("Moderatsiya ma'lumotlarini yuklashda xatolik:", e);
    } finally {
      setModerationLoading(false);
    }
  }

  async function loadMonitoring() {
    setMonitoringLoading(true);
    setMonitoringError("");
    try {
      const data = await getAdminMonitoringStats();
      setMonitoring(data);
    } catch (e: any) {
      console.error("Monitoring ma'lumotlarini yuklashda xatolik:", e);
      setMonitoringError(e?.message || String(e));
    } finally {
      setMonitoringLoading(false);
    }
  }

  async function loadHealth() {
    setHealthLoading(true);
    try {
      const data = await getInactiveGroups();
      setInactiveGroups(data);
    } catch (e) {
      console.error("Sog'liq tekshiruvi ma'lumotlarini yuklashda xatolik:", e);
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!window.confirm(t('health_delete_confirm'))) return;
    setDeletingGroupId(groupId);
    try {
      await adminDeleteGroup(groupId);
      setInactiveGroups((prev) => prev.filter((g) => g.group_id !== groupId));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingGroupId(null);
    }
  }

  async function handleApproveLog(logId: string) {
    setActioningId(logId);
    try {
      await approveGroupLog(logId);
      setPendingApprovals((prev) => prev.filter((p) => p.id !== logId));
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectLogId) return;
    setActioningId(rejectLogId);
    try {
      await rejectGroupLog(rejectLogId, rejectReason);
      setPendingApprovals((prev) => prev.filter((p) => p.id !== rejectLogId));
      setRejectLogId(null);
      setRejectReason("");
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  }

  async function refreshStats() {
    const globalStats = await getGlobalStats();
    setStats(globalStats);
  }

  async function handleToggleBan(userId: string, currentStatus: boolean) {
    setBanningId(userId);
    try {
      await toggleUserBan(userId, !currentStatus);
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !currentStatus } : u));
    } catch (e) {
      console.error("Bloklashda xatolik:", e);
    } finally {
      setBanningId(null);
    }
  }

  async function loadEfficiency() {
    try {
      const map = await getAdminUsersEfficiency();
      setEfficiencyMap(map);
    } catch (e) {
      console.error("Samaradorlik ma'lumotlarini yuklashda xatolik:", e);
    }
  }

  function openBonusModal(userId: string) {
    setBonusUserId(userId);
    setBonusCoins("0");
    setBonusScore("0");
    setBonusError("");
  }

  async function handleGrantBonus() {
    if (!bonusUserId) return;
    const coinsDelta = parseInt(bonusCoins, 10) || 0;
    const scoreDelta = parseInt(bonusScore, 10) || 0;
    if (coinsDelta === 0 && scoreDelta === 0) { setBonusError(t('admin_bonus_zero')); return; }
    setGrantingBonus(true);
    setBonusError("");
    try {
      await adminGrantBalance(bonusUserId, coinsDelta, scoreDelta);
      setUsers(users.map(u => u.id === bonusUserId
        ? { ...u, coins: Math.max(0, (u.coins || 0) + coinsDelta), score: Math.max(0, (u.score || 0) + scoreDelta) }
        : u));
      setBonusUserId(null);
    } catch (e: any) {
      setBonusError(e?.message || t('err_loading'));
    } finally {
      setGrantingBonus(false);
    }
  }

  async function openDetailsModal(userId: string) {
    setDetailsUserId(userId);
    setDetailsLoading(true);
    setDetailsHabits([]);
    setDetailsCompleted(0);
    try {
      const [habits, logs] = await Promise.all([
        getUserHabitsAdmin(userId),
        getAllTimeLogs(userId),
      ]);
      setDetailsHabits(habits);
      setDetailsCompleted((logs || []).length);
    } catch (e) {
      console.error("Foydalanuvchi tafsilotlarini yuklashda xatolik:", e);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleResetData() {
    const confirm1 = window.confirm(t('admin_reset_confirm'));
    if (!confirm1) return;

    setResetting(true);
    try {
      await resetAllData();
      await refreshStats();
      alert(t('admin_reset_success'));
    } catch (e: any) {
      alert(`${t('error')}: ${e.message}`);
    } finally {
      setResetting(false);
    }
  }

  async function handleSendGlobalPush() {
    if (!pushTitle.trim() || !pushBody.trim()) return;
    const confirmMsg = window.confirm(t('admin_broadcast_confirm'));
    if (!confirmMsg) return;

    setPushSending(true);
    try {
      await sendGlobalNotification(pushTitle.trim(), pushBody.trim());
      alert(t('admin_broadcast_success'));
      setPushTitle("");
      setPushBody("");
    } catch (e: any) {
      alert(`${t('error')}: ${e.message}`);
    } finally {
      setPushSending(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
    padding: 20,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: "overview", label: t('admin_tab_stats'), icon: ShieldAlert },
    { id: "users", label: t('admin_tab_users'), icon: Users },
    { id: "feedback", label: t('admin_tab_feedback'), icon: MessageSquare },
    { id: "analytics", label: t('admin_tab_analytics'), icon: TrendingUp },
    { id: "monitoring", label: t('admin_tab_monitoring'), icon: Activity },
    { id: "health", label: t('admin_tab_health'), icon: HeartPulse },
  ];

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
        <p className="text-xs px-3 py-2.5 rounded-lg" style={{ color: "var(--coral-red)", background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2" }}>
          ⚠ {error}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 overflow-x-auto" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6" }}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setActiveTab(tb.id)}
            className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[44px] whitespace-nowrap"
            style={{
              background: activeTab === tb.id ? (isDark ? "rgba(255,255,255,0.1)" : "#fff") : "transparent",
              color: activeTab === tb.id ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: activeTab === tb.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <tb.icon size={13} /> {tb.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Global Ko'rsatkichlar */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {[
              { label: t('admin_stat_users'), value: stats.users, icon: Users, color: "#3B82F6", bg: "rgba(59,130,246,0.12)", onClick: () => setActiveTab("users") },
              { label: t('admin_stat_habits'), value: stats.habits, icon: ListChecks, color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  ...cardStyle,
                  padding: 14,
                  cursor: stat.onClick ? "pointer" : "default",
                  transition: "transform 0.15s, border-color 0.15s",
                  ...(stat.onClick && statHover === stat.label
                    ? { transform: "scale(1.02)", borderColor: "var(--neon-green)" }
                    : {}),
                }}
                className="flex flex-col"
                onClick={stat.onClick}
                onMouseEnter={stat.onClick ? () => setStatHover(stat.label) : undefined}
                onMouseLeave={stat.onClick ? () => setStatHover(null) : undefined}
                role={stat.onClick ? "button" : undefined}
                tabIndex={stat.onClick ? 0 : undefined}
                onKeyDown={stat.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stat.onClick!(); } } : undefined}
                title={stat.onClick ? t('admin_stat_view_users') : undefined}
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 sm:mb-3" style={{ background: stat.bg }}>
                  <stat.icon size={16} style={{ color: stat.color }} />
                </div>
                <p className="text-xl sm:text-3xl font-bold leading-none truncate" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {stat.value}
                </p>
                <p className="text-[10px] sm:text-xs mt-1.5 sm:mt-2 truncate" style={{ color: "var(--muted-foreground)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* CSV Eksport — tashqi Data Analysis uchun 3 ta datasetni eksport qilish */}
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <Download size={18} style={{ color: "#60A5FA" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('admin_export_title')}</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{t('admin_export_desc')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportUsersCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: isDark ? "rgba(96,165,250,0.12)" : "#EFF6FF", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}
              >
                <Download size={13} /> {t('admin_export_users')}
              </button>
              <button
                onClick={exportFeedbackCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: isDark ? "rgba(96,165,250,0.12)" : "#EFF6FF", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}
              >
                <Download size={13} /> {t('admin_export_feedback')}
              </button>
              <button
                onClick={exportHabitsCsv}
                disabled={exportingHabits}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: isDark ? "rgba(96,165,250,0.12)" : "#EFF6FF", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)", opacity: exportingHabits ? 0.7 : 1 }}
              >
                {exportingHabits ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {t('admin_export_habits')}
              </button>
            </div>
            {exportError && (
              <p className="text-xs mt-3" style={{ color: "var(--coral-red)" }}>⚠ {exportError}</p>
            )}
          </div>

          {/* Moderatsiya — barcha guruhlar bo'yicha kutilayotgan isbotlar */}
          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck size={18} style={{ color: "#4ADE80" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('mod_title')}</h3>
            </div>
            {moderationLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('mod_empty')}</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: item.profiles?.avatar_color || "#4ADE80", color: "#000" }}>
                        {(item.profiles?.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {item.profiles?.display_name} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>· {item.groups?.name}</span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          {item.group_habits?.emoji} {item.group_habits?.name}
                        </p>
                        {item.proof_note && (
                          <p className="text-xs mt-1 italic" style={{ color: "var(--muted-foreground)" }}>"{item.proof_note}"</p>
                        )}
                      </div>
                    </div>
                    {rejectLogId === item.id ? (
                      <div className="flex gap-2 mt-2.5">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t('mod_reject_placeholder')}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                          style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: "var(--foreground)" }}
                        />
                        <button onClick={handleRejectSubmit} disabled={actioningId === item.id}
                          className="px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]" style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}>
                          {actioningId === item.id ? <Loader2 size={13} className="animate-spin" /> : t('reject')}
                        </button>
                        <button onClick={() => { setRejectLogId(null); setRejectReason(""); }}
                          className="px-3 py-2.5 rounded-lg text-xs min-h-[44px]" style={{ color: "var(--muted-foreground)" }}>
                          {t('cancel_short')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2.5">
                        <button onClick={() => handleApproveLog(item.id)} disabled={actioningId === item.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                          style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                          {actioningId === item.id ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} /> {t('groups_approve_btn')}</>}
                        </button>
                        <button onClick={() => setRejectLogId(item.id)} disabled={actioningId === item.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                          style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}>
                          <X size={13} /> {t('reject')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ommaviy Xabar (Global Push) */}
          <div style={{ ...cardStyle, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.3)"}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={18} style={{ color: "#3B82F6" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('admin_broadcast_title')}</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
              {t('admin_broadcast_desc')}
            </p>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder={t('admin_broadcast_title_ph')}
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-xl text-sm outline-none transition-colors"
                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: "var(--foreground)" }}
              />
              <textarea
                placeholder={t('admin_broadcast_body_ph')}
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-xl text-sm outline-none transition-colors resize-none"
                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: "var(--foreground)" }}
              />
            </div>
            <button
              onClick={handleSendGlobalPush}
              disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(59,130,246,0.1)",
                color: "#3B82F6",
                border: "1px solid rgba(59,130,246,0.2)",
                opacity: (pushSending || !pushTitle.trim() || !pushBody.trim()) ? 0.7 : 1,
              }}
            >
              {pushSending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
              {pushSending ? t('admin_broadcast_sending') : t('admin_broadcast_send')}
            </button>
          </div>

          {/* Xavfli Hudud */}
          <div style={{ ...cardStyle, border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.3)"}` }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={18} style={{ color: "#EF4444" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('admin_danger_zone')}</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
              {t('admin_danger_desc')}
            </p>
            <button
              onClick={handleResetData}
              disabled={resetting}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.2)",
                opacity: resetting ? 0.7 : 1,
              }}
            >
              {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {resetting ? t('admin_resetting') : t('admin_reset_btn')}
            </button>
          </div>
        </>
      )}

      {activeTab === "users" && (
        <div style={cardStyle}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              {searchQuery ? t('admin_search_results') : t('admin_tab_users')}
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>({users.length})</span>
            </h3>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder={t('admin_search_ph')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors min-h-[44px]"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  color: "var(--foreground)"
                }}
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 860 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
                  {[t('admin_col_name'), t('admin_col_status'), t('admin_col_role'), t('admin_col_balance'), t('admin_col_efficiency'), t('admin_col_joined'), ""].map((h, i) => (
                    <th key={i} className="text-left pb-2 pr-3" style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) =>
                    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.username.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .slice()
                  .reverse()
                  .slice(0, searchQuery ? 100 : 25)
                  .map((u) => (
                    <tr
                      key={u.id}
                      className={u.is_banned ? "opacity-50" : ""}
                      style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarFrame frameId={u.active_frame} radius={9999}>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden"
                              style={{ background: u.avatar_color || "#4ADE80", color: "#000" }}
                            >
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-7 h-7 object-cover" />
                              ) : (
                                u.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                              )}
                            </div>
                          </AvatarFrame>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{u.display_name}</p>
                            <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={u.is_banned
                            ? { background: "rgba(248,113,113,0.12)", color: "#F87171" }
                            : { background: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                          {u.is_banned ? t('admin_status_banned') : t('admin_status_active')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {u.is_admin ? (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold w-fit" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>
                            <Crown size={10} /> {t('admin_role_admin')}
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('admin_role_user')}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        🪙{u.coins || 0} · ⭐{u.score || 0}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-semibold" style={{ color: (efficiencyMap[u.id] ?? 0) >= 50 ? "#4ADE80" : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {efficiencyMap[u.id] ?? 0}%
                      </td>
                      <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {new Date(u.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDetailsModal(u.id)}
                            className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
                            title={t('admin_view_details')}
                          >
                            <Eye size={14} style={{ color: "#60A5FA" }} />
                          </button>
                          <button
                            onClick={() => openBonusModal(u.id)}
                            className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
                            title={t('admin_grant_bonus')}
                          >
                            <Gift size={14} style={{ color: "#A78BFA" }} />
                          </button>
                          {u.id !== profile.id && (
                            <button
                              onClick={() => handleToggleBan(u.id, !!u.is_banned)}
                              disabled={banningId === u.id}
                              className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
                              title={u.is_banned ? t('admin_unban') : t('admin_ban')}
                            >
                              {banningId === u.id ? <Loader2 size={14} className="animate-spin text-gray-500" /> : u.is_banned ? <ShieldCheck size={14} className="text-green-500" /> : <Ban size={14} className="text-red-500" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Bonus tanga/ball berish modali ── */}
      {bonusUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setBonusUserId(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
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
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}>🪙 {t('admin_bonus_coins')}</label>
                <input type="number" value={bonusCoins} onChange={(e) => setBonusCoins(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: "var(--foreground)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}>⭐ {t('admin_bonus_score')}</label>
                <input type="number" value={bonusScore} onChange={(e) => setBonusScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: "var(--foreground)" }} />
              </div>
            </div>
            {bonusError && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {bonusError}</p>}
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
            <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, maxHeight: "80vh", overflowY: "auto" }}>
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
                      { label: t('an_economy_coins'), value: `🪙${u.coins || 0}` },
                      { label: t('admin_col_score'), value: `⭐${u.score || 0}` },
                      { label: t('admin_col_efficiency'), value: `${efficiencyMap[u.id] ?? 0}%` },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
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
                        <div key={h.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB" }}>
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

      {activeTab === "feedback" && (
        <div style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              {t('admin_tab_feedback')}
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>({feedback.length})</span>
            </h3>
          </div>
          {feedbackLoading ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
          ) : feedbackError ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--coral-red)" }}>⚠ {feedbackError}</p>
          ) : feedback.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>{t('admin_feedback_empty')}</p>
          ) : (
            <div className="space-y-3">
              {feedback.map((f) => (
                <div key={f.id} className="p-3.5 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                      {f.display_name} <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>@{f.username}</span>
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                      {new Date(f.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted-foreground)" }}>{f.content}</p>

                  {f.admin_reply ? (
                    <div className="mt-3 pl-3 flex flex-col gap-1" style={{ borderLeft: `2px solid ${isDark ? "rgba(74,222,128,0.4)" : "rgba(74,222,128,0.5)"}` }}>
                      <span className="text-[10px] font-semibold" style={{ color: "#4ADE80" }}>
                        {t('admin_feedback_your_reply')}
                        {f.admin_replied_at && (
                          <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>
                            {" · "}{new Date(f.admin_replied_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                          </span>
                        )}
                      </span>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{f.admin_reply}</p>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={replyDrafts[f.id] || ""}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        placeholder={t('admin_feedback_reply_ph')}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                        style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: "var(--foreground)" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendReply(f.id)}
                        disabled={replyingId === f.id || !(replyDrafts[f.id] || "").trim()}
                        className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                        style={{
                          background: "var(--neon-green)", color: "#0E1117",
                          opacity: (replyingId === f.id || !(replyDrafts[f.id] || "").trim()) ? 0.5 : 1,
                        }}
                      >
                        {replyingId === f.id ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                        {t('admin_feedback_reply_btn')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {replyError && <p className="text-xs text-center" style={{ color: "var(--coral-red)" }}>⚠ {replyError}</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
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
                    <div key={s.label} className="rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
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
                  <div className="rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
                    <p className="text-lg font-bold leading-none" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>{dashboard.habits.active_total}</p>
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_habits_active')}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
                    <p className="text-lg font-bold leading-none" style={{ color: "#60A5FA", fontFamily: "'Geist Mono', monospace" }}>{dashboard.habits.completion_rate_pct}%</p>
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_habits_completion')}</p>
                  </div>
                </div>
                <p className="text-[11px] mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                  {t('an_habits_split')} · {dashboard.habits.positive_count} {t('an_habits_positive')} / {dashboard.habits.negative_count} {t('an_habits_negative')}
                </p>
                <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
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
                    <div key={s.label} className="rounded-xl p-3 flex flex-col items-center text-center" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
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
                  <div className="rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
                    <p className="text-lg font-bold leading-none" style={{ color: "#34D399", fontFamily: "'Geist Mono', monospace" }}>{dashboard.groups.total_groups}</p>
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{t('an_groups_total')}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
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
                  <tr style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
                    <th className="text-left py-2 pr-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_event')}</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_total')}</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_users')}</th>
                    <th className="text-right py-2 pl-3 font-medium" style={{ color: "var(--muted-foreground)" }}>{t('analytics_col_sessions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsSummary.map((row) => (
                    <tr key={row.event_name} style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
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
      )}

      {activeTab === "monitoring" && (
        <>
          {monitoringError && (
            <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {monitoringError}</p>
          )}
          <div style={cardStyle} className="flex flex-col">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(74,222,128,0.12)" }}>
              <Activity size={18} style={{ color: "#4ADE80" }} />
            </div>
            {monitoringLoading ? (
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} />
            ) : (
              <p className="text-3xl font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {monitoring?.dau ?? 0}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
              {t('mon_dau_label')}
            </p>
          </div>

          <div style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Flame size={18} style={{ color: "#F97316" }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('mon_top_habits')}</h3>
            </div>
            {monitoringLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
            ) : !monitoring?.top_habits?.length ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('mon_no_data')}</p>
            ) : (
              <div className="space-y-2">
                {monitoring.top_habits.map((h, i) => {
                  const maxCompletions = monitoring.top_habits[0].completions || 1;
                  return (
                    <div key={h.name + i} className="flex items-center gap-3">
                      <span className="text-xs font-bold w-4 text-right" style={{ color: "var(--muted-foreground)" }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{h.name}</span>
                          <span className="text-xs shrink-0 ml-2" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                            {h.completions} {t('mon_completions_suffix')}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(h.completions / maxCompletions) * 100}%`, background: "#F97316" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "health" && (
        <div style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse size={18} style={{ color: "#F87171" }} />
            <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('health_inactive_groups')}</h3>
          </div>
          {healthLoading ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
          ) : inactiveGroups.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('health_no_inactive')}</p>
          ) : (
            <div className="space-y-3">
              {inactiveGroups.map((g) => (
                <div key={g.group_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{g.group_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {t('health_leader_label')} {g.leader_name || "—"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {t('health_last_log')} {g.last_log_date ? new Date(g.last_log_date).toLocaleDateString(DATE_LOCALE[lang]) : t('health_never')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(g.group_id)}
                    disabled={deletingGroupId === g.group_id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold shrink-0 min-h-[44px] w-full sm:w-auto"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
                  >
                    {deletingGroupId === g.group_id ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> {t('health_delete_group')}</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
