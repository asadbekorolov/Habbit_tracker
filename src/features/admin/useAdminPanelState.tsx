// Admin panel — holat va mantiq (UI'dan ajratilgan).
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Users, ListChecks, ShieldAlert, Activity, HeartPulse, MessageSquare, TrendingUp } from "lucide-react";
import { getGlobalStats, getAllProfiles, toggleUserBan, resetAllData, sendGlobalNotification, getAllPendingApprovals, approveGroupLog, rejectGroupLog, getAdminMonitoringStats, getInactiveGroups, adminDeleteGroup, getAllFeedback, replyToFeedback, setFeedbackRead, deleteFeedback, getAllHabitsAdmin, getAnalyticsSummary, getAdminAnalyticsDashboard, getAdminUsersEfficiency, adminGrantBalance, getUserHabitsAdmin, getAllTimeLogs, type AdminMonitoringStats, type InactiveGroup, type FeedbackEntry, type AnalyticsSummaryRow, type AdminAnalyticsDashboard, type AdminHabitEntry } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { downloadCsv } from "../../utils/csv";
import { AdminPanelProps, DATE_LOCALE, AdminTab } from "./adminShared";

export function useAdminPanelState({ profile }: AdminPanelProps) {
  const { t, lang } = useLang();
  // Bildirishnomadan "admin?tab=feedback" bilan kelinsa — darhol shu bo'lim
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    try {
      return new URLSearchParams(window.location.search).get("tab") === "feedback" ? "feedback" : "overview";
    } catch {
      return "overview";
    }
  });

  // Panel ochiq turganda bildirishnoma bosilsa ham bo'limga o'tadi
  const location = useLocation();
  useEffect(() => {
    if (new URLSearchParams(location.search).get("tab") === "feedback") setActiveTab("feedback");
  }, [location.search]);

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

  const [habitsAdmin, setHabitsAdmin] = useState<AdminHabitEntry[]>([]);
  const [habitsAdminLoading, setHabitsAdminLoading] = useState(true);
  const [habitsAdminError, setHabitsAdminError] = useState("");
  const [habitsSearchQuery, setHabitsSearchQuery] = useState("");

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
    loadHabitsAdmin();
  }, []);

  async function loadHabitsAdmin() {
    setHabitsAdminLoading(true);
    setHabitsAdminError("");
    try {
      const data = await getAllHabitsAdmin();
      setHabitsAdmin(data);
    } catch (e: any) {
      setHabitsAdminError(e?.message || t('err_loading'));
    } finally {
      setHabitsAdminLoading(false);
    }
  }

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

  const unreadFeedback = feedback.filter((f) => !f.is_read).length;
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);

  async function handleToggleFeedbackRead(feedbackId: string) {
    const item = feedback.find((f) => f.id === feedbackId);
    if (!item) return;
    const next = !item.is_read;
    setFeedbackBusyId(feedbackId);
    setReplyError("");
    try {
      await setFeedbackRead(feedbackId, next);
      setFeedback((prev) => prev.map((f) => (f.id === feedbackId ? { ...f, is_read: next } : f)));
    } catch (e: any) {
      setReplyError(e?.message || t('err_loading'));
    } finally {
      setFeedbackBusyId(null);
    }
  }

  async function handleDeleteFeedback(feedbackId: string) {
    setFeedbackBusyId(feedbackId);
    setReplyError("");
    try {
      await deleteFeedback(feedbackId);
      setFeedback((prev) => prev.filter((f) => f.id !== feedbackId));
    } catch (e: any) {
      setReplyError(e?.message || t('err_loading'));
    } finally {
      setFeedbackBusyId(null);
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
      setFeedback((prev) => prev.map((f) => f.id === feedbackId ? { ...f, admin_reply: reply, admin_replied_at: now, is_read: true } : f));
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
      `tracker_users_${new Date().toISOString().slice(0, 10)}.csv`,
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
      `tracker_feedback_${new Date().toISOString().slice(0, 10)}.csv`,
      [t('admin_col_name'), t('admin_col_username'), 'Email', t('admin_col_type'), t('admin_col_content'), t('admin_col_date')],
      feedback.map((f) => [
        f.full_name || f.display_name || "",
        f.username || "",
        f.email || "",
        f.type || "feedback",
        f.content,
        new Date(f.created_at).toLocaleString(DATE_LOCALE[lang] || "uz-UZ"),
      ])
    );
  }

  function exportHabitsCsv() {
    downloadCsv(
      `tracker_habits_${new Date().toISOString().slice(0, 10)}.csv`,
      [t('admin_col_name'), t('admin_col_username'), t('admin_col_habit_name'), t('admin_col_type'), t('admin_col_target'), t('admin_col_unit'), t('admin_col_active'), t('admin_col_date')],
      habitsAdmin.map((h) => [
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
    background: "rgba(22,27,34,0.85)",
    border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: 14,
    padding: 20,
  };

  const tabs: { id: AdminTab; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: t('admin_tab_stats'), icon: ShieldAlert },
    { id: "users", label: t('admin_tab_users'), icon: Users },
    { id: "habits", label: t('admin_tab_habits'), icon: ListChecks },
    { id: "feedback", label: t('admin_tab_feedback'), icon: MessageSquare, badge: unreadFeedback },
    { id: "analytics", label: t('admin_tab_analytics'), icon: TrendingUp },
    { id: "monitoring", label: t('admin_tab_monitoring'), icon: Activity },
    { id: "health", label: t('admin_tab_health'), icon: HeartPulse },
  ];

  return {
    profile,
    t,
    lang,
    activeTab,
    setActiveTab,
    stats,
    setStats,
    users,
    setUsers,
    loading,
    setLoading,
    error,
    setError,
    banningId,
    setBanningId,
    searchQuery,
    setSearchQuery,
    efficiencyMap,
    setEfficiencyMap,
    statHover,
    setStatHover,
    bonusUserId,
    setBonusUserId,
    bonusCoins,
    setBonusCoins,
    bonusScore,
    setBonusScore,
    grantingBonus,
    setGrantingBonus,
    bonusError,
    setBonusError,
    detailsUserId,
    setDetailsUserId,
    detailsLoading,
    setDetailsLoading,
    detailsHabits,
    setDetailsHabits,
    detailsCompleted,
    setDetailsCompleted,
    resetting,
    setResetting,
    pushTitle,
    setPushTitle,
    pushBody,
    setPushBody,
    pushSending,
    setPushSending,
    pendingApprovals,
    setPendingApprovals,
    moderationLoading,
    setModerationLoading,
    actioningId,
    setActioningId,
    rejectLogId,
    setRejectLogId,
    rejectReason,
    setRejectReason,
    monitoring,
    setMonitoring,
    monitoringLoading,
    setMonitoringLoading,
    monitoringError,
    setMonitoringError,
    inactiveGroups,
    setInactiveGroups,
    healthLoading,
    setHealthLoading,
    deletingGroupId,
    setDeletingGroupId,
    feedback,
    setFeedback,
    feedbackLoading,
    setFeedbackLoading,
    feedbackError,
    setFeedbackError,
    replyDrafts,
    setReplyDrafts,
    replyingId,
    setReplyingId,
    replyError,
    setReplyError,
    habitsAdmin,
    setHabitsAdmin,
    habitsAdminLoading,
    setHabitsAdminLoading,
    habitsAdminError,
    setHabitsAdminError,
    habitsSearchQuery,
    setHabitsSearchQuery,
    analyticsSummary,
    setAnalyticsSummary,
    analyticsLoading,
    setAnalyticsLoading,
    analyticsError,
    setAnalyticsError,
    dashboard,
    setDashboard,
    dashboardLoading,
    setDashboardLoading,
    dashboardError,
    setDashboardError,
    loadHabitsAdmin,
    loadFeedback,
    handleSendReply,
    loadAnalytics,
    loadDashboard,
    exportUsersCsv,
    exportFeedbackCsv,
    unreadFeedback,
    feedbackBusyId,
    handleToggleFeedbackRead,
    handleDeleteFeedback,
    exportHabitsCsv,
    loadModeration,
    loadMonitoring,
    loadHealth,
    handleDeleteGroup,
    handleApproveLog,
    handleRejectSubmit,
    refreshStats,
    handleToggleBan,
    loadEfficiency,
    openBonusModal,
    handleGrantBonus,
    openDetailsModal,
    handleResetData,
    handleSendGlobalPush,
    cardStyle,
    tabs,
  };
}

export type AdminPanelState = ReturnType<typeof useAdminPanelState>;
