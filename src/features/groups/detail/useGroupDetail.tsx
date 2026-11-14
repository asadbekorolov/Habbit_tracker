// Guruh tafsilotlari — holat va mantiq (UI'dan ajratilgan).
import { useState, useEffect, useRef } from "react";
import { useLang } from "../../../store/LangContext";
import { Users, Trophy, CheckCircle2, Clock, BarChart3, ShieldCheck, AlertCircle, UsersRound, Target, Zap, Sparkles, Flame, Rocket, Gem, Star, Crown, Shield, Heart, Mountain } from "lucide-react";
import { tashkentTodayAnchor, toDateStr } from "../../../utils/date";
import { getGroupMembers, getGroupHabits, deleteGroupHabit, getGroupLeaderboard, logGroupHabit, getTodayGroupLogs, getPendingGroupApprovals, approveGroupLog, rejectGroupLog, getGroupMembersMonthlyStats, updateGroupTelegramLink, getGroupSubteams, createSubteam, addSubteamMember, removeSubteamMember, deleteSubteam, leaveGroup, kickMember, deleteGroup, setGroupMemberRole, transferGroupOwnership } from "../../../services/db";
import { supabase } from "../../../services/supabase";
import type { Profile } from "../../../services/supabase";
import { postApi } from "../../../services/apiClient";
import { DetailTab, LogState } from "../groupsShared";

export function useGroupDetail({ profile, group, onBack, onGroupRemoved, card, inputStyle, onUserClick
}: { profile: Profile; group: any; onBack: () => void;
  onGroupRemoved: (groupId: string) => void;
  card: React.CSSProperties; inputStyle: React.CSSProperties;
  onUserClick?: (userId: string) => void;
}) {
  const { t, lang } = useLang();
  const [activeTab, setActiveTab] = useState<DetailTab>("habits");
  const [members, setMembers] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [todayLogs, setTodayLogs] = useState<Record<string, LogState>>({});
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [subteams, setSubteams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Subteam state
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("Zap");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [managingTeam, setManagingTeam] = useState<any | null>(null);
  const [managingSelected, setManagingSelected] = useState<Set<string>>(new Set());
  const [savingTeamMembers, setSavingTeamMembers] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<string | null>(null);

  // Telegram group link
  const [tgLink, setTgLink] = useState<string>(group.telegram_link || "");
  const [showTgEdit, setShowTgEdit] = useState(false);
  const [tgInput, setTgInput] = useState("");
  const [savingTg, setSavingTg] = useState(false);

  // Proof modal
  const [proofHabitId, setProofHabitId] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [proofCount, setProofCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Reject modal
  const [rejectLogId, setRejectLogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const isOwner = group.admin_id === profile.id;
  const myMembership = members.find((m: any) => m.user_id === profile.id);
  const isAdmin = isOwner || myMembership?.role === 'admin';

  // Guruh sozlamalari (chiqish / o'chirish) + a'zolikni boshqarish
  const [showSettings, setShowSettings] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, [group.id]);

  // Real-time sync: a'zo odat bajarganda/tasdiqlanganda yoki
  // qo'shilganda/chiqib ketganda barcha ochiq oynalarda darhol
  // yangilanishi uchun — faqat ta'sirlangan qismlarni qayta yuklaymiz,
  // to'liq loadAll() emas (yengilroq va boshqa mahalliy state'ni
  // buzmaydi, masalan ochiq modallar).
  useEffect(() => {
    const channel = supabase
      .channel('group:' + group.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_habit_logs', filter: `group_id=eq.${group.id}` },
        async () => {
          getGroupLeaderboard(group.id).then((lb) => setLeaderboard(lb || [])).catch(() => {});
          if (isAdmin) {
            getPendingGroupApprovals(group.id).then((p) => setPendingApprovals(p || [])).catch(() => {});
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${group.id}` },
        () => {
          getGroupMembers(group.id).then((mem) => setMembers(mem || [])).catch(() => {});
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group.id, isAdmin]);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    // allSettled — bitta so'rov (masalan oylik statistika) xato bersa ham,
    // qolganlari (a'zolar, odatlar...) bo'sh holatga tushib qolmasin.
    // Har bir muvaffaqiyatsiz qism o'z nomi bilan konsolda va bannerda
    // ko'rinadi, shuning uchun kelajakda sababini topish oson bo'ladi.
    const [memR, habR, lbR, logsR, pendingR, statsR, teamsR] = await Promise.allSettled([
      getGroupMembers(group.id),
      getGroupHabits(group.id),
      getGroupLeaderboard(group.id),
      getTodayGroupLogs(group.id, profile.id),
      isAdmin ? getPendingGroupApprovals(group.id) : Promise.resolve([]),
      getGroupMembersMonthlyStats(group.id),
      getGroupSubteams(group.id),
    ]);

    const failedParts: string[] = [];
    const unwrap = <T,>(r: PromiseSettledResult<T>, label: string, fallback: T): T => {
      if (r.status === "fulfilled") return r.value ?? fallback;
      console.error(`GroupDetail loadAll: ${label} failed`, r.reason);
      failedParts.push(`${label} (${(r.reason as any)?.message || r.reason})`);
      return fallback;
    };

    setMembers(unwrap(memR, "members", []));
    setHabits(unwrap(habR, "habits", []));
    setLeaderboard(unwrap(lbR, "leaderboard", []));
    setPendingApprovals(unwrap(pendingR, "approvals", []));
    setMonthlyStats(unwrap(statsR, "stats", []));
    setSubteams(unwrap(teamsR, "teams", []));

    const logs = unwrap(logsR, "logs", [] as any[]);
    const logMap: Record<string, LogState> = {};
    for (const l of logs) {
      logMap[l.group_habit_id] = {
        id: l.id,
        completed: l.completed,
        status: l.approval_status || "auto",
        proofNote: l.proof_note || "",
        rejectReason: l.reject_reason || "",
      };
    }
    setTodayLogs(logMap);

    if (failedParts.length > 0) setLoadError(`${t('groups_err_load_data')}: ${failedParts.join('; ')}`);
    setLoading(false);
  }

  async function submitHabit() {
    if (!proofHabitId) return;
    setSubmitting(true);
    try {
      const reps = Math.max(1, proofCount || 1);
      const log = await logGroupHabit(proofHabitId, group.id, profile.id, true, reps, proofNote);
      setTodayLogs((prev) => ({
        ...prev,
        [proofHabitId]: { id: log.id, completed: true, status: "pending", proofNote, rejectReason: "" },
      }));
      setProofHabitId(null);
      setProofNote("");
      setProofCount(1);
      if (isAdmin) {
        const updated = await getPendingGroupApprovals(group.id);
        setPendingApprovals(updated || []);
      }
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(logId: string) {
    const logItem = pendingApprovals.find((p) => p.id === logId);
    setError("");
    try {
      await approveGroupLog(logId);
      setPendingApprovals((prev) => prev.filter((p) => p.id !== logId));
      const lb = await getGroupLeaderboard(group.id);
      setLeaderboard(lb || []);

      if (logItem) {
        postApi('/api/notify-group', {
          completer_name: logItem.profiles?.display_name || "A'zo",
          habit_emoji: logItem.group_habits?.emoji || 'Target',
          habit_name: logItem.group_habits?.name || '',
          group_id: group.id,
          completer_id: logItem.user_id,
        }).catch(() => {});
      }
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    }
  }

  async function handleRejectSubmit() {
    if (!rejectLogId) return;
    setRejecting(true);
    setError("");
    try {
      await rejectGroupLog(rejectLogId, rejectReason);
      setPendingApprovals((prev) => prev.filter((p) => p.id !== rejectLogId));
      setRejectLogId(null);
      setRejectReason("");
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setRejecting(false);
    }
  }

  function resetHabitForm() {
    setEditingHabitId(null);
    setShowAddHabit(false);
  }

  function openEditHabit(h: any) {
    setEditingHabitId(h.id);
    setError("");
    setShowAddHabit(true);
  }

  async function handleDeleteHabit(habitId: string) {
    setError("");
    try {
      await deleteGroupHabit(habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    }
  }

  async function handleLeaveGroup() {
    setLeaving(true);
    setLeaveError("");
    try {
      await leaveGroup(group.id);
      onGroupRemoved(group.id);
    } catch (e: any) {
      setLeaveError(e.message?.includes("owner_must_transfer") ? t('groups_err_owner_must_transfer') : (e.message || t('groups_err_generic')));
      setLeaving(false);
    }
  }

  async function handleDeleteGroup() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeletingGroup(true);
    setLeaveError("");
    try {
      await deleteGroup(group.id);
      onGroupRemoved(group.id);
    } catch (e: any) {
      setLeaveError(e.message || t('groups_err_generic'));
      setDeletingGroup(false);
    }
  }

  async function handleKickMember(userId: string) {
    setMemberActionId(userId);
    setError("");
    try {
      await kickMember(group.id, userId);
      setMembers((prev) => prev.filter((m: any) => m.user_id !== userId));
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleToggleCoAdmin(userId: string, nextRole: "admin" | "member") {
    setMemberActionId(userId);
    setError("");
    try {
      await setGroupMemberRole(group.id, userId, nextRole);
      setMembers((prev) => prev.map((m: any) => m.user_id === userId ? { ...m, role: nextRole } : m));
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleTransferOwnership(userId: string) {
    setMemberActionId(userId);
    setError("");
    try {
      await transferGroupOwnership(group.id, userId);
      group.admin_id = userId;
      setMembers((prev) => prev.map((m: any) => m.user_id === userId ? { ...m, role: "admin" } : m));
      setTransferTargetId(null);
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const team = await createSubteam(group.id, newTeamName.trim(), newTeamEmoji, profile.id);
      setSubteams((prev) => [...prev, { ...team, group_subteam_members: [] }]);
      setNewTeamName("");
      setNewTeamEmoji("Zap");
      setShowCreateTeam(false);
    } catch (e: any) {
      setError(e.message || t('groups_err_create_team'));
    } finally {
      setCreatingTeam(false);
    }
  }

  function openManageTeam(team: any) {
    const currentIds = new Set<string>(
      (team.group_subteam_members || []).map((m: any) => m.user_id)
    );
    setManagingSelected(currentIds);
    setManagingTeam(team);
    setError("");
  }

  async function handleSaveTeamMembers() {
    if (!managingTeam) return;
    setSavingTeamMembers(true);
    try {
      const currentIds = new Set<string>(
        (managingTeam.group_subteam_members || []).map((m: any) => m.user_id)
      );
      const toAdd = [...managingSelected].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !managingSelected.has(id));
      await Promise.all([
        ...toAdd.map((uid) => addSubteamMember(managingTeam.id, uid)),
        ...toRemove.map((uid) => removeSubteamMember(managingTeam.id, uid)),
      ]);
      const refreshed = await getGroupSubteams(group.id);
      setSubteams(refreshed || []);
      setManagingTeam(null);
    } catch (e: any) {
      setError(e.message || t('groups_err_save'));
    } finally {
      setSavingTeamMembers(false);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    setDeletingTeam(teamId);
    setError("");
    try {
      await deleteSubteam(teamId);
      setSubteams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setDeletingTeam(null);
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(group.invite_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadStats() {
    if (!statsRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(statsRef.current, {
        backgroundColor: "#0D1117",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      const monthLabel = tashkentTodayAnchor().toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
      link.download = `${group.name}-${monthLabel}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  }

  async function handleSaveTgLink() {
    setSavingTg(true);
    setError("");
    try {
      const link = tgInput.trim() || null;
      await updateGroupTelegramLink(group.id, link);
      setTgLink(link || "");
      setShowTgEdit(false);
    } catch (e: any) {
      setError(e.message || t('groups_err_generic'));
    } finally {
      setSavingTg(false);
    }
  }

  const tabs = [
    { id: "habits" as DetailTab, label: t('groups_tab_habits'), icon: CheckCircle2 },
    { id: "members" as DetailTab, label: t('groups_tab_members'), icon: Users },
    { id: "leaderboard" as DetailTab, label: t('groups_tab_rating'), icon: Trophy },
    { id: "teams" as DetailTab, label: t('groups_tab_teams'), icon: UsersRound },
    { id: "stats" as DetailTab, label: t('groups_tab_analytics'), icon: BarChart3 },
    ...(isAdmin ? [{ id: "approve" as DetailTab, label: `${t('groups_tab_approve')}${pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ""}`, icon: ShieldCheck }] : []),
  ];

  // Jamoa belgisi: ikonka nomi. Eski jamoalarda bazada emoji saqlangan —
  // ular ham shu xarita orqali ikonkaga aylanadi (kalitlar unicode escape).
  const EMOJI_MAP: Record<string, any> = {
    Zap, Flame, Trophy, Rocket, Gem, Star, Target, Crown, Shield, Heart, Sparkles, Mountain,
    '\u{1F525}': Flame,
    '\u{1F3C6}': Trophy,
    '\u{1F680}': Rocket,
    '\u{1F48E}': Gem,
    '\u{1F31F}': Star,
    '\u{1F3AF}': Target,
    '\u26A1': Zap,
  };
  const TEAM_ICON_NAMES = ['Zap', 'Flame', 'Trophy', 'Rocket', 'Gem', 'Star', 'Target', 'Crown', 'Shield', 'Heart', 'Sparkles', 'Mountain'];

  function statusIcon(state?: LogState) {
    if (!state || !state.completed) return null;
    if (state.status === "approved" || state.status === "auto") return <CheckCircle2 size={22} style={{ color: "#4ADE80" }} />;
    if (state.status === "pending") return <Clock size={22} style={{ color: "#FBBF24" }} />;
    if (state.status === "rejected") return <AlertCircle size={22} style={{ color: "#F87171" }} />;
    return null;
  }

  function statusBg(state?: LogState): string {
    if (!state || !state.completed) return "";
    if (state.status === "approved" || state.status === "auto") return "rgba(74,222,128,0.06)";
    if (state.status === "pending") return "rgba(251,191,36,0.06)";
    if (state.status === "rejected") return "rgba(248,113,113,0.06)";
    return "";
  }

  function statusBorder(state?: LogState): string {
    if (!state || !state.completed) return card.border as string;
    if (state.status === "approved" || state.status === "auto") return "1px solid rgba(74,222,128,0.3)";
    if (state.status === "pending") return "1px solid rgba(251,191,36,0.3)";
    if (state.status === "rejected") return "1px solid rgba(248,113,113,0.3)";
    return card.border as string;
  }

  // Monthly stats by member
  const memberStatsMap: Record<string, { name: string; color: string; avatarUrl: string | null; approved: number; pending: number; rejected: number; total: number }> = {};
  for (const row of monthlyStats) {
    if (!row.user_id) continue;
    if (!memberStatsMap[row.user_id]) {
      memberStatsMap[row.user_id] = {
        name: row.profiles?.display_name || "?",
        color: row.profiles?.avatar_color || "#4ADE80",
        avatarUrl: row.profiles?.avatar_url || null,
        approved: 0, pending: 0, rejected: 0, total: 0,
      };
    }
    memberStatsMap[row.user_id].total++;
    if (row.approval_status === "approved" || row.approval_status === "auto") memberStatsMap[row.user_id].approved++;
    else if (row.approval_status === "pending") memberStatsMap[row.user_id].pending++;
    else if (row.approval_status === "rejected") memberStatsMap[row.user_id].rejected++;
  }
  const rankedMemberStats = Object.entries(memberStatsMap).sort((a, b) => b[1].approved - a[1].approved);

  // Kunlik trend: shu oy boshidan buguni gacha, guruh bo'yicha tasdiqlangan
  // (approved/auto) loglar soni — bo'sh kunlar ham 0 bilan chizilishi uchun
  // to'liq sana ro'yxati generatsiya qilinadi (faqat log bo'lgan kunlar emas).
  const uzMonthsShort = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
  const nowForStats = tashkentTodayAnchor();
  const daysElapsed = nowForStats.getDate();
  const dailyTrendMap: Record<string, number> = {};
  for (const row of monthlyStats) {
    if (row.approval_status === "approved" || row.approval_status === "auto") {
      dailyTrendMap[row.log_date] = (dailyTrendMap[row.log_date] || 0) + 1;
    }
  }
  const dailyTrend = Array.from({ length: daysElapsed }, (_, i) => {
    const d = new Date(nowForStats.getFullYear(), nowForStats.getMonth(), i + 1);
    const ds = toDateStr(d);
    return { label: `${d.getDate()} ${uzMonthsShort[d.getMonth()]}`, count: dailyTrendMap[ds] || 0 };
  });

  // Odat kesimida statistika — qaysi guruh odati eng ko'p bajarilyapti
  const habitStatsMap: Record<string, { name: string; emoji: string; approved: number; participants: Set<string> }> = {};
  for (const row of monthlyStats) {
    if (!row.group_habit_id) continue;
    if (!habitStatsMap[row.group_habit_id]) {
      habitStatsMap[row.group_habit_id] = {
        name: row.group_habits?.name || "?",
        emoji: row.group_habits?.emoji || "Target",
        approved: 0,
        participants: new Set(),
      };
    }
    if (row.approval_status === "approved" || row.approval_status === "auto") {
      habitStatsMap[row.group_habit_id].approved++;
      habitStatsMap[row.group_habit_id].participants.add(row.user_id);
    }
  }
  const habitBreakdown = Object.values(habitStatsMap)
    .map((h) => ({ name: h.name, emoji: h.emoji, approved: h.approved, participants: h.participants.size }))
    .sort((a, b) => b.approved - a.approved);
  const maxHabitApproved = Math.max(1, ...habitBreakdown.map((h) => h.approved));

  // Umumiy guruh KPI'lari
  const totalApprovedMonth = Object.values(dailyTrendMap).reduce((s, v) => s + v, 0);
  const activeMembersCount = new Set(
    monthlyStats.filter((r) => r.approval_status === "approved" || r.approval_status === "auto").map((r) => r.user_id)
  ).size;
  const pendingCount = monthlyStats.filter((r) => r.approval_status === "pending").length;
  const maxPossibleCompletions = habits.length * members.length * daysElapsed;
  const groupAvgPct = maxPossibleCompletions > 0
    ? Math.min(100, Math.round((totalApprovedMonth / maxPossibleCompletions) * 100))
    : 0;

  return {
    profile,
    group,
    onBack,
    onGroupRemoved,
    card,
    inputStyle,
    onUserClick,
    t,
    lang,
    activeTab,
    setActiveTab,
    members,
    setMembers,
    habits,
    setHabits,
    leaderboard,
    setLeaderboard,
    todayLogs,
    setTodayLogs,
    pendingApprovals,
    setPendingApprovals,
    monthlyStats,
    setMonthlyStats,
    subteams,
    setSubteams,
    loading,
    setLoading,
    error,
    setError,
    loadError,
    setLoadError,
    copied,
    setCopied,
    downloading,
    setDownloading,
    statsRef,
    showCreateTeam,
    setShowCreateTeam,
    newTeamName,
    setNewTeamName,
    newTeamEmoji,
    setNewTeamEmoji,
    creatingTeam,
    setCreatingTeam,
    managingTeam,
    setManagingTeam,
    managingSelected,
    setManagingSelected,
    savingTeamMembers,
    setSavingTeamMembers,
    deletingTeam,
    setDeletingTeam,
    tgLink,
    setTgLink,
    showTgEdit,
    setShowTgEdit,
    tgInput,
    setTgInput,
    savingTg,
    setSavingTg,
    proofHabitId,
    setProofHabitId,
    proofNote,
    setProofNote,
    proofCount,
    setProofCount,
    submitting,
    setSubmitting,
    rejectLogId,
    setRejectLogId,
    rejectReason,
    setRejectReason,
    rejecting,
    setRejecting,
    showAddHabit,
    setShowAddHabit,
    editingHabitId,
    setEditingHabitId,
    isOwner,
    myMembership,
    isAdmin,
    showSettings,
    setShowSettings,
    leaveError,
    setLeaveError,
    leaving,
    setLeaving,
    confirmDelete,
    setConfirmDelete,
    deletingGroup,
    setDeletingGroup,
    memberActionId,
    setMemberActionId,
    transferTargetId,
    setTransferTargetId,
    loadAll,
    submitHabit,
    handleApprove,
    handleRejectSubmit,
    resetHabitForm,
    openEditHabit,
    handleDeleteHabit,
    handleLeaveGroup,
    handleDeleteGroup,
    handleKickMember,
    handleToggleCoAdmin,
    handleTransferOwnership,
    handleCreateTeam,
    openManageTeam,
    handleSaveTeamMembers,
    handleDeleteTeam,
    copyInviteCode,
    handleDownloadStats,
    handleSaveTgLink,
    tabs,
    EMOJI_MAP,
    TEAM_ICON_NAMES,
    statusIcon,
    statusBg,
    statusBorder,
    memberStatsMap,
    rankedMemberStats,
    uzMonthsShort,
    nowForStats,
    daysElapsed,
    dailyTrendMap,
    dailyTrend,
    habitStatsMap,
    habitBreakdown,
    maxHabitApproved,
    totalApprovedMonth,
    activeMembersCount,
    pendingCount,
    maxPossibleCompletions,
    groupAvgPct,
  };
}

export type GroupDetailState = ReturnType<typeof useGroupDetail>;
