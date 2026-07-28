import { useState, useEffect, useRef } from "react";
import { useLang } from "../../store/LangContext";
import html2canvas from "html2canvas";
import {
  Users, Plus, LogIn, ArrowLeft, Copy, Check, Crown,
  Loader2, Trophy, Trash2, CheckCircle2, Circle, UserPlus,
  Clock, X, ChevronRight, BarChart3, ShieldCheck, AlertCircle,
  MessageSquare, Download, Send, Pencil, UsersRound,
} from "lucide-react";
import {
  createGroup, joinGroup, getMyGroups, getGroupMembers,
  getGroupHabits, addGroupHabit, deleteGroupHabit,
  getGroupLeaderboard, logGroupHabit, getTodayGroupLogs,
  getPendingGroupApprovals, approveGroupLog, rejectGroupLog,
  getGroupMembersMonthlyStats, updateGroupTelegramLink,
  getGroupSubteams, createSubteam, addSubteamMember, removeSubteamMember, deleteSubteam,
  isStarActive,
} from "../../services/db";
import { supabase } from "../../services/supabase";
import type { Profile } from "../../services/supabase";
import { trackEvent } from "../../utils/analytics";
import { UserBadge } from "../../components/UserBadge";

const DATE_LOCALE: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

interface GroupsPageProps {
  isDark: boolean;
  profile: Profile;
  onUserClick?: (userId: string) => void;
}

type View = "list" | "detail";
type DetailTab = "habits" | "members" | "leaderboard" | "approve" | "stats" | "teams";

type LogState = {
  id: string;
  completed: boolean;
  status: "pending" | "approved" | "rejected" | "auto";
  proofNote: string;
  rejectReason?: string;
};

export function GroupsPage({ isDark, profile, onUserClick }: GroupsPageProps) {
  const { t } = useLang();
  const [view, setView] = useState<View>("list");
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => { loadGroups(); }, [profile.id]);

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await getMyGroups(profile.id);
      setGroups((data || []).map((m: any) => m.groups).filter(Boolean));
    } catch {
      setError(t('groups_err_load'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const group = await createGroup(newGroupName.trim(), profile.id);
      trackEvent('group_created', {}, profile.id);
      setGroups((prev) => [group, ...prev]);
      setNewGroupName("");
      setShowCreate(false);
    } catch (e: any) {
      setError(e.message || t('groups_err_create'));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoining(true);
    setError("");
    try {
      const group = await joinGroup(joinCode.trim().toUpperCase(), profile.id);
      trackEvent('group_joined', {}, profile.id);
      setGroups((prev) => [group, ...prev]);
      setJoinCode("");
      setShowJoin(false);
    } catch (e: any) {
      setError(e.message || t('groups_err_join'));
    } finally {
      setJoining(false);
    }
  }

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  if (view === "detail" && selectedGroup) {
    return (
      <GroupDetail
        isDark={isDark}
        profile={profile}
        group={selectedGroup}
        onBack={() => { setView("list"); setSelectedGroup(null); }}
        card={card}
        inputStyle={inputStyle}
        onUserClick={onUserClick}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {t('groups_sub')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowJoin(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              color: "var(--muted-foreground)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            }}
          >
            <LogIn size={13} /> {t('groups_join')}
          </button>
          <button
            onClick={() => { setShowCreate(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "var(--neon-green)", color: "#0E1117" }}
          >
            <Plus size={13} /> {t('groups_create')}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm p-6 rounded-2xl"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t('groups_create_title')}</h3>
            <input style={inputStyle} placeholder={t('groups_name')} value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button onClick={handleCreate} disabled={creating || !newGroupName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--neon-green)", color: "#0E1117", opacity: creating ? 0.6 : 1 }}>
                {creating ? <Loader2 size={15} className="animate-spin" /> : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowJoin(false)}>
          <div className="w-full max-w-sm p-6 rounded-2xl"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>{t('groups_join_title')}</h3>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{t('groups_join_hint')}</p>
            <input
              style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: 4, textAlign: "center", fontFamily: "'Geist Mono', monospace" }}
              placeholder="ABC123" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus maxLength={6} />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button onClick={handleJoin} disabled={joining || joinCode.length < 4}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--neon-green)", color: "#0E1117", opacity: joining ? 0.6 : 1 }}>
                {joining ? <Loader2 size={15} className="animate-spin" /> : t('groups_join')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        </div>
      ) : groups.length === 0 ? (
        <div style={card} className="p-10 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6" }}>
            <Users size={28} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('groups_empty')}</p>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            {t('groups_empty_hint')}
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => { setShowJoin(true); setError(""); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--foreground)", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
              <LogIn size={14} /> {t('groups_join')}
            </button>
            <button onClick={() => { setShowCreate(true); setError(""); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--neon-green)", color: "#0E1117" }}>
              <Plus size={14} /> {t('groups_create')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isOwner = group.admin_id === profile.id;
            const adminProfile = group.admin_profile;
            return (
              <div key={group.id} style={{ ...card, overflow: "hidden" }}>
                <button onClick={() => { setSelectedGroup(group); setView("detail"); }}
                  className="w-full flex items-center gap-4 p-4 text-left transition-all hover:opacity-90"
                  style={{ cursor: "pointer" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: isDark ? "rgba(74,222,128,0.12)" : "#DCFCE7" }}>
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>{group.name}</p>
                      {isOwner && <Crown size={13} style={{ color: "#FBBF24", flexShrink: 0 }} />}
                    </div>
                    {/* Admin info */}
                    {adminProfile && !isOwner && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onUserClick?.(adminProfile.id); }}
                        className="flex items-center gap-1 mt-0.5"
                        style={{ color: "var(--muted-foreground)" }}>
                        {adminProfile.avatar_url ? (
                          <img src={adminProfile.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                            style={{ background: adminProfile.avatar_color || "#4ADE80", color: "#0E1117" }}>
                            {adminProfile.display_name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs">{t('groups_leader')} {adminProfile.display_name}</span>
                      </button>
                    )}
                    {isOwner && (
                      <p className="text-xs mt-0.5" style={{ color: "#FBBF24" }}>{t('groups_you_leader')}</p>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
                </button>
                {/* Invite code — only admin sees it */}
                {isOwner && group.invite_code && (
                  <div className="px-4 pb-3 flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('groups_code')}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
                      {group.invite_code}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Group Detail ─────────────────────────────────────────────
function GroupDetail({
  isDark, profile, group, onBack, card, inputStyle, onUserClick
}: {
  isDark: boolean; profile: Profile; group: any; onBack: () => void;
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
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Subteam state
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("⚡");
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

  // Add habit
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitEmoji, setNewHabitEmoji] = useState("🏃");
  const [newHabitType, setNewHabitType] = useState<"positive" | "negative">("positive");
  const [newMetricType, setNewMetricType] = useState<"check" | "count" | "time">("check");
  const [newTarget, setNewTarget] = useState(1);
  const [newUnit, setNewUnit] = useState("");
  const [adding, setAdding] = useState(false);

  const isAdmin = group.admin_id === profile.id;
  const EMOJIS = ["🏃", "📚", "💪", "🧘", "🥗", "💧", "😴", "🎯", "✍️", "🎵", "🌿", "🏊", "⏰", "📱", "🚶", "🔄"];

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
    try {
      const [mem, hab, lb, logs, pending, stats, teams] = await Promise.all([
        getGroupMembers(group.id),
        getGroupHabits(group.id),
        getGroupLeaderboard(group.id),
        getTodayGroupLogs(group.id, profile.id),
        isAdmin ? getPendingGroupApprovals(group.id) : Promise.resolve([]),
        getGroupMembersMonthlyStats(group.id),
        getGroupSubteams(group.id),
      ]);
      setMembers(mem || []);
      setHabits(hab || []);
      setLeaderboard(lb || []);
      setPendingApprovals(pending || []);
      setMonthlyStats(stats || []);
      setSubteams(teams || []);

      const logMap: Record<string, LogState> = {};
      for (const l of (logs || [])) {
        logMap[l.group_habit_id] = {
          id: l.id,
          completed: l.completed,
          status: l.approval_status || "auto",
          proofNote: l.proof_note || "",
          rejectReason: l.reject_reason || "",
        };
      }
      setTodayLogs(logMap);
    } catch {
      setError(t('groups_err_load_data'));
    } finally {
      setLoading(false);
    }
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
        fetch('/api/notify-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completer_name: logItem.profiles?.display_name || "A'zo",
            habit_emoji: logItem.group_habits?.emoji || '🎯',
            habit_name: logItem.group_habits?.name || '',
            group_id: group.id,
            completer_id: logItem.user_id,
          }),
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

  async function handleAddHabit() {
    if (!newHabitName.trim()) return;
    setAdding(true);
    try {
      const targetValue = newMetricType === "check" ? 1 : newTarget;
      const unit = newMetricType === "time" ? "daqiqa" : newMetricType === "count" ? (newUnit || "ta") : "";
      const h = await addGroupHabit(group.id, newHabitName.trim(), newHabitEmoji, newHabitType, targetValue, unit);
      setHabits((prev) => [...prev, h]);
      setNewHabitName("");
      setNewHabitType("positive");
      setNewMetricType("check");
      setNewTarget(1);
      setNewUnit("");
      setShowAddHabit(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
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

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const team = await createSubteam(group.id, newTeamName.trim(), newTeamEmoji, profile.id);
      setSubteams((prev) => [...prev, { ...team, group_subteam_members: [] }]);
      setNewTeamName("");
      setNewTeamEmoji("⚡");
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
      const canvas = await html2canvas(statsRef.current, {
        backgroundColor: isDark ? "#0D1117" : "#F9FAFB",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      const monthLabel = new Date().toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
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

  function statusIcon(state?: LogState) {
    if (!state || !state.completed) return null;
    if (state.status === "approved" || state.status === "auto") return <CheckCircle2 size={22} style={{ color: "#4ADE80" }} />;
    if (state.status === "pending") return <Clock size={22} style={{ color: "#FBBF24" }} />;
    if (state.status === "rejected") return <AlertCircle size={22} style={{ color: "#F87171" }} />;
    return null;
  }

  function statusBg(state?: LogState, dark = isDark): string {
    if (!state || !state.completed) return "";
    if (state.status === "approved" || state.status === "auto") return dark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.04)";
    if (state.status === "pending") return dark ? "rgba(251,191,36,0.06)" : "rgba(251,191,36,0.04)";
    if (state.status === "rejected") return dark ? "rgba(248,113,113,0.06)" : "rgba(248,113,113,0.04)";
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
  const memberStatsMap: Record<string, { name: string; color: string; approved: number; pending: number; rejected: number; total: number }> = {};
  for (const row of monthlyStats) {
    if (!row.user_id) continue;
    if (!memberStatsMap[row.user_id]) {
      memberStatsMap[row.user_id] = {
        name: row.profiles?.display_name || "?",
        color: row.profiles?.avatar_color || "#4ADE80",
        approved: 0, pending: 0, rejected: 0, total: 0,
      };
    }
    memberStatsMap[row.user_id].total++;
    if (row.approval_status === "approved" || row.approval_status === "auto") memberStatsMap[row.user_id].approved++;
    else if (row.approval_status === "pending") memberStatsMap[row.user_id].pending++;
    else if (row.approval_status === "rejected") memberStatsMap[row.user_id].rejected++;
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-2 rounded-xl"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}>
          <ArrowLeft size={16} style={{ color: "var(--foreground)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold truncate" style={{ color: "var(--foreground)" }}>{group.name}</h2>
            {isAdmin && <Crown size={14} style={{ color: "#FBBF24" }} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{members.length} {t('groups_member')}</span>
            {isAdmin && group.invite_code && (
              <button onClick={copyInviteCode}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg"
                style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? t('copied') : t('groups_code_label').replace('{code}', group.invite_code)}
              </button>
            )}
          </div>
          {/* Telegram group link */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {tgLink ? (
              <a href={tgLink.startsWith("http") ? tgLink : `https://t.me/${tgLink.replace("@", "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(56,189,248,0.12)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.25)" }}>
                <Send size={10} /> {t('groups_open_tg_group')}
              </a>
            ) : isAdmin ? (
              <button type="button" onClick={() => { setTgInput(""); setShowTgEdit(true); }}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(56,189,248,0.08)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.2)" }}>
                <Plus size={10} /> {t('groups_add_tg_link')}
              </button>
            ) : null}
            {isAdmin && tgLink && (
              <button type="button" onClick={() => { setTgInput(tgLink); setShowTgEdit(true); }}
                className="flex items-center p-0.5 rounded"
                style={{ color: "var(--muted-foreground)" }}>
                <Pencil size={11} />
              </button>
            )}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => { setShowAddHabit(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "var(--neon-green)", color: "#0E1117" }}>
            <Plus size={13} /> {t('groups_add_habit_btn')}
          </button>
        )}
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: activeTab === t.id
                ? (t.id === "approve" ? "rgba(74,222,128,0.15)" : isDark ? "rgba(255,255,255,0.12)" : "#fff")
                : "transparent",
              color: activeTab === t.id
                ? (t.id === "approve" ? "#4ADE80" : "var(--foreground)")
                : "var(--muted-foreground)",
              border: activeTab === t.id
                ? (t.id === "approve" ? "1px solid rgba(74,222,128,0.3)" : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`)
                : "1px solid transparent",
              fontWeight: t.id === "approve" && pendingApprovals.length > 0 ? 700 : undefined,
            }}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Proof note modal */}
      {proofHabitId && (() => {
        const proofHabit = habits.find(h => h.id === proofHabitId);
        const needsCount = !!proofHabit && (proofHabit.target_value > 1 || !!proofHabit.unit);
        return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setProofHabitId(null); setProofNote(""); setProofCount(1); }}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              {proofHabit?.emoji} {proofHabit?.name}
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
              {t('groups_proof_ph')}
            </p>
            {needsCount && (
              <div className="mb-3">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
                  {t('groups_how_many')} {proofHabit?.unit ? `(${proofHabit.unit})` : ""}
                </label>
                <input
                  type="number" min={1} max={9999}
                  style={{ ...inputStyle, textAlign: "center", fontFamily: "'Geist Mono', monospace" }}
                  value={proofCount === 0 ? "" : proofCount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") { setProofCount(0); return; }
                    setProofCount(Math.max(0, Math.min(9999, parseInt(raw) || 0)));
                  }}
                  onBlur={() => setProofCount((v) => Math.max(1, v))}
                />
              </div>
            )}
            <textarea
              style={{ ...inputStyle, resize: "none", minHeight: 72, lineHeight: 1.5, fontSize: 13 }}
              placeholder={t('groups_proof_hint')}
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              maxLength={200}
              rows={3}
              autoFocus
            />
            <p className="text-[11px] text-right mb-3" style={{ color: "var(--muted-foreground)" }}>{proofNote.length}/200</p>
            {error && <p className="text-xs mb-3" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setProofHabitId(null); setProofNote(""); setProofCount(1); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button onClick={submitHabit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--neon-green)", color: "#0E1117", opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {t('done_mark')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Reject modal */}
      {rejectLogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setRejectLogId(null); setRejectReason(""); }}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid rgba(248,113,113,0.3)` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>{t('groups_reject_reason')}</h3>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_reject_hint')}</p>
            <textarea
              style={{ ...inputStyle, resize: "none", minHeight: 72, fontSize: 13 }}
              placeholder={t('groups_reject_ph')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3} autoFocus
            />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setRejectLogId(null); setRejectReason(""); setError(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button onClick={handleRejectSubmit} disabled={rejecting || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(248,113,113,0.15)", color: "#F87171", opacity: rejecting ? 0.6 : 1 }}>
                {rejecting ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                {t('reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram link edit modal */}
      {showTgEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowTgEdit(false)}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Send size={15} style={{ color: "#38BDF8" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_tg_link')}</h3>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_tg_hint')}</p>
            <input
              style={inputStyle}
              placeholder={t('groups_tg_ph')}
              value={tgInput}
              onChange={(e) => setTgInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTgLink()}
              autoFocus
            />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => { setShowTgEdit(false); setError(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button type="button" onClick={handleSaveTgLink} disabled={savingTg}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(56,189,248,0.15)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.3)", opacity: savingTg ? 0.6 : 1 }}>
                {savingTg ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add habit modal */}
      {showAddHabit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowAddHabit(false)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, maxHeight: "85vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_add_habit')}</h3>

              {/* Odat turi */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>{t('groups_habit_type')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([["positive", t('positive'), "#4ADE80"], ["negative", t('negative'), "#F87171"]] as const).map(([val, label, color]) => (
                    <button key={val} type="button" onClick={() => setNewHabitType(val)}
                      className="py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: newHabitType === val ? `${color}18` : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"),
                        border: `1px solid ${newHabitType === val ? `${color}50` : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)")}`,
                        color: newHabitType === val ? color : "var(--muted-foreground)",
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Emoji tanlash */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>{t('groups_emoji')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => setNewHabitEmoji(em)}
                      className="w-9 h-9 rounded-lg text-lg transition-all"
                      style={{
                        background: newHabitEmoji === em ? (isDark ? "rgba(74,222,128,0.2)" : "#DCFCE7") : (isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB"),
                        border: newHabitEmoji === em ? "1px solid rgba(74,222,128,0.5)" : "1px solid transparent",
                      }}>{em}</button>
                  ))}
                </div>
              </div>

              {/* Odat nomi */}
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{t('groups_habit_name')}</p>
                <input style={inputStyle} placeholder={t('groups_habit_name_ph')} value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddHabit()} autoFocus />
              </div>

              {/* O'lchov turi */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>{t('groups_measure')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["check", t('groups_yes_no')], ["count", t('groups_count')], ["time", t('groups_time_m')]] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setNewMetricType(val)}
                      className="py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: newMetricType === val ? (isDark ? "rgba(255,255,255,0.12)" : "#fff") : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"),
                        border: `1px solid ${newMetricType === val ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)") : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}`,
                        color: newMetricType === val ? "var(--foreground)" : "var(--muted-foreground)",
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Maqsad miqdori (count yoki time tanlanganda) */}
              {newMetricType !== "check" && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                      {newMetricType === "time" ? t('groups_how_many_min') : t('groups_how_many')}
                    </p>
                    <input
                      type="number" min={1} max={9999}
                      style={{ ...inputStyle, textAlign: "center", fontFamily: "'Geist Mono', monospace" }}
                      value={newTarget === 0 ? "" : newTarget}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") { setNewTarget(0); return; }
                        setNewTarget(Math.max(0, Math.min(9999, parseInt(raw) || 0)));
                      }}
                      onBlur={() => setNewTarget((v) => Math.max(1, v))}
                    />
                  </div>
                  {newMetricType === "count" && (
                    <div className="flex-1">
                      <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{t('groups_unit')}</p>
                      <input style={inputStyle} placeholder={t('groups_unit_ph')} value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)} maxLength={10} />
                    </div>
                  )}
                  {newMetricType === "time" && (
                    <div className="flex-1 flex items-end pb-1">
                      <span className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>daqiqa</span>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAddHabit(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                  {t('cancel_short')}
                </button>
                <button type="button" onClick={handleAddHabit} disabled={adding || !newHabitName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--neon-green)", color: "#0E1117", opacity: (adding || !newHabitName.trim()) ? 0.5 : 1 }}>
                  {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {t('add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        </div>
      ) : (
        <>
          {/* ── HABITS TAB ── */}
          {activeTab === "habits" && (
            <div className="flex flex-col gap-3">
              {error && !proofHabitId && !showAddHabit && (
                <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>
              )}
              {/* Legend */}
              <div className="flex items-center gap-3 px-1 pb-1 flex-wrap">
                {[
                  { color: "#4ADE80", label: t('groups_approved') },
                  { color: "#FBBF24", label: t('pending') },
                  { color: "#F87171", label: t('rejected') },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {habits.length === 0 ? (
                <div style={card} className="p-8 flex flex-col items-center gap-2">
                  <p className="text-2xl">📋</p>
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    {isAdmin ? t('groups_first_habit') : t('groups_no_habits')}
                  </p>
                </div>
              ) : (
                habits.map((habit) => {
                  const logState = todayLogs[habit.id];
                  const isMarked = logState?.completed;
                  const canMark = !isMarked || logState?.status === "rejected";

                  return (
                    <div key={habit.id} className="rounded-2xl overflow-hidden"
                      style={{ ...card, background: isMarked ? statusBg(logState) : card.background, border: statusBorder(logState) }}>
                      <div className="flex items-center gap-3 p-4">
                        <button
                          onClick={() => { if (canMark) { setProofHabitId(habit.id); setProofCount(habit.target_value || 1); setError(""); } }}
                          className="shrink-0 transition-all"
                          style={{ cursor: canMark ? "pointer" : "default" }}
                        >
                          {isMarked ? statusIcon(logState) : <Circle size={22} style={{ color: "var(--muted-foreground)" }} />}
                        </button>
                        <span className="text-xl">{habit.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium"
                              style={{ color: logState?.status === "approved" || logState?.status === "auto" ? "#4ADE80" : "var(--foreground)" }}>
                              {habit.name}
                            </p>
                            {habit.target_value > 1 && habit.unit && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6", color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                                {habit.target_value} {habit.unit}
                              </span>
                            )}
                            {habit.type === "negative" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}>{t('groups_negative_badge_lower')}</span>
                            )}
                          </div>
                          {logState?.status === "pending" && (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "#FBBF24" }}>
                              <Clock size={10} /> {t('groups_pending_leader_approval')}
                            </p>
                          )}
                          {logState?.status === "rejected" && (
                            <p className="text-[11px] mt-0.5" style={{ color: "#F87171" }}>
                              {t('groups_rejected_retry').replace('{reason}', logState.rejectReason ? `: ${logState.rejectReason}` : "")}
                            </p>
                          )}
                          {logState?.proofNote && (logState.status === "pending" || logState.status === "approved") && (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                              <MessageSquare size={10} /> {logState.proofNote}
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteHabit(habit.id)}
                            className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity shrink-0"
                            style={{ color: "var(--coral-red)" }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-center mt-1" style={{ color: "var(--muted-foreground)" }}>
                {Object.values(todayLogs).filter((l) => l.completed && (l.status === "approved" || l.status === "auto")).length} tasdiqlangan
                {" / "}
                {Object.values(todayLogs).filter((l) => l.completed && l.status === "pending").length} kutilmoqda
                {" / "}
                {habits.length} ta odat
              </p>
            </div>
          )}

          {/* ── MEMBERS TAB ── */}
          {activeTab === "members" && (
            <div className="flex flex-col gap-3">
              {members.length === 0 ? (
                <div style={card} className="p-8 flex flex-col items-center gap-2">
                  <UserPlus size={28} style={{ color: "var(--muted-foreground)" }} />
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t('groups_no_members')}</p>
                </div>
              ) : (
                members.map((m: any, i) => {
                  const p = m.profiles;
                  if (!p) return null;
                  const initials = (p.display_name || "??").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                  const mStats = memberStatsMap[m.user_id];
                  return (
                    <div key={m.id || i} className="flex items-center gap-3 p-3.5 rounded-2xl transition-colors"
                      onClick={() => onUserClick?.(m.user_id)}
                      style={{ ...card, cursor: onUserClick ? "pointer" : "default" }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                        style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                        {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-10 h-10 object-cover" /> : initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                            {p.display_name}
                          </p>
                          <UserBadge active={isStarActive(p)} size={12} />
                          {m.role === "admin" && <Crown size={12} style={{ color: "#FBBF24" }} />}
                        </div>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{p.username}</p>
                        {mStats && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                              ✓ {mStats.approved}
                            </span>
                            {mStats.pending > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>
                                ⏳ {mStats.pending}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── LEADERBOARD TAB ── */}
          {activeTab === "leaderboard" && (
            <div className="flex flex-col gap-3">
              <div className="px-1 pb-1">
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t('groups_only_approved_counted')}
                </p>
              </div>
              {leaderboard.length === 0 ? (
                <div style={card} className="p-8 flex flex-col items-center gap-2">
                  <Trophy size={28} style={{ color: "var(--muted-foreground)" }} />
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t('groups_no_approved')}</p>
                </div>
              ) : (
                leaderboard.map((entry, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const isMe = entry.userId === profile.id;
                  return (
                    <div key={entry.userId} className="flex items-center gap-3 p-3.5 rounded-2xl"
                      style={{
                        ...card,
                        background: isMe ? (isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.04)") : card.background,
                        border: isMe ? "1px solid rgba(74,222,128,0.25)" : card.border,
                      }}>
                      <span className="text-lg w-7 text-center shrink-0">{medals[i] || String(i + 1)}</span>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: entry.color || "#4ADE80", color: "#0E1117" }}>
                        {(entry.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: isMe ? "#4ADE80" : "var(--foreground)" }}>
                          {entry.name} {isMe && t('lb_you')}
                          <UserBadge active={entry.hasStar} size={12} />
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min((entry.score / (leaderboard[0]?.score || 1)) * 100, 100)}%`,
                              maxWidth: 100,
                              background: isMe ? "#4ADE80" : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                            }} />
                          <span className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                            {entry.completed} ta
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold" style={{ color: isMe ? "#4ADE80" : "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {entry.score}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── STATS TAB ── */}
          {activeTab === "stats" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t('groups_month_all_stats').replace('{date}', new Date().toLocaleDateString(DATE_LOCALE[lang], { month: 'long', year: 'numeric' }))}
                </p>
                {Object.entries(memberStatsMap).length > 0 && (
                  <button
                    onClick={handleDownloadStats}
                    disabled={downloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: isDark ? "rgba(74,222,128,0.12)" : "#DCFCE7",
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

              {Object.entries(memberStatsMap).length === 0 ? (
                <div style={card} className="p-8 flex flex-col items-center gap-2">
                  <BarChart3 size={28} style={{ color: "var(--muted-foreground)" }} />
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t('groups_no_month_results')}</p>
                </div>
              ) : (
                <div ref={statsRef} className="flex flex-col gap-3 rounded-2xl p-4"
                  style={{ background: isDark ? "#0D1117" : "#F9FAFB" }}>
                  {/* Report header (visible in downloaded image) */}
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>👥 {group.name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date().toLocaleDateString(DATE_LOCALE[lang], { month: 'long', year: 'numeric' })} {t('groups_month_report_suffix')}
                      </p>
                    </div>
                    <p className="text-[10px] px-2 py-0.5 rounded-lg font-medium"
                      style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                      traccer.app
                    </p>
                  </div>
                  {Object.entries(memberStatsMap).map(([uid, s]) => {
                    const total = s.approved + s.pending + s.rejected || 1;
                    const approvedPct = Math.round((s.approved / total) * 100);
                    const isMe = uid === profile.id;
                    return (
                      <div key={uid} className="p-4 rounded-xl"
                        style={{
                          background: isDark ? "rgba(22,27,34,0.85)" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
                        }}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: s.color, color: "#0E1117" }}>
                            {s.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
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
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
                          <div className="h-full rounded-full" style={{ width: `${approvedPct}%`, background: "#4ADE80" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TEAMS TAB ── */}
          {activeTab === "teams" && (
            <div className="flex flex-col gap-3">
              {error && !showCreateTeam && !managingTeam && (
                <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>
              )}
              <div className="flex items-center justify-between px-1">
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t('groups_create_teams_desc')}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => { setShowCreateTeam(true); setError(""); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{ background: "var(--neon-green)", color: "#0E1117" }}
                  >
                    <Plus size={12} /> {t('groups_team_btn')}
                  </button>
                )}
              </div>

              {subteams.length === 0 ? (
                <div style={card} className="p-10 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6" }}>
                    👥
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_no_teams')}</p>
                  <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
                    {isAdmin ? t('groups_split_into_teams') : t('groups_leader_no_teams')}
                  </p>
                </div>
              ) : (
                subteams.map((team) => {
                  const teamMembers: any[] = team.group_subteam_members || [];
                  const myTeam = teamMembers.some((m: any) => m.user_id === profile.id);
                  return (
                    <div key={team.id} style={{ ...card, ...(myTeam ? { border: "1px solid rgba(74,222,128,0.3)" } : {}) }}
                      className="p-4 rounded-2xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}>
                          {team.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: myTeam ? "#4ADE80" : "var(--foreground)" }}>
                              {team.name}
                            </p>
                            {myTeam && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                                {t('groups_your_team')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                            {teamMembers.length} {t('groups_member')}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openManageTeam(team)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                              style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6", color: "var(--muted-foreground)" }}
                            >
                              <Pencil size={11} /> {t('groups_manage')}
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              disabled={deletingTeam === team.id}
                              className="p-1.5 rounded-lg"
                              style={{ color: "var(--coral-red)", opacity: deletingTeam === team.id ? 0.4 : 0.6 }}
                            >
                              {deletingTeam === team.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        )}
                      </div>
                      {teamMembers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {teamMembers.map((m: any) => {
                            const p = m.profiles;
                            if (!p) return null;
                            const initials = (p.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                            return (
                              <div key={m.user_id}
                                onClick={() => onUserClick?.(m.user_id)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer"
                                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }}>
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden"
                                  style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-5 h-5 object-cover" /> : initials}
                                </div>
                                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{p.display_name}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {t('groups_no_members_team')}
                        </p>
                      )}
                    </div>
                  );
                })
              )}

              {/* Create team modal */}
              {showCreateTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                  onClick={() => setShowCreateTeam(false)}>
                  <div className="w-full max-w-sm p-5 rounded-2xl"
                    style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}
                    onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                      {t('groups_new_team')}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {["⚡", "🔥", "🏆", "🚀", "💎", "🌟", "🎯", "🦁", "🐯", "🦅", "🌊", "⚽"].map((em) => (
                        <button key={em} type="button" onClick={() => setNewTeamEmoji(em)}
                          className="w-9 h-9 rounded-lg text-lg"
                          style={{
                            background: newTeamEmoji === em ? (isDark ? "rgba(74,222,128,0.2)" : "#DCFCE7") : (isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB"),
                            border: newTeamEmoji === em ? "1px solid rgba(74,222,128,0.5)" : "1px solid transparent",
                          }}>{em}</button>
                      ))}
                    </div>
                    <input
                      style={inputStyle}
                      placeholder={t('groups_team_name_ph')}
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                      autoFocus
                      maxLength={30}
                    />
                    {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
                    <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => setShowCreateTeam(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                        {t('cancel_short')}
                      </button>
                      <button type="button" onClick={handleCreateTeam} disabled={creatingTeam || !newTeamName.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: "var(--neon-green)", color: "#0E1117", opacity: (creatingTeam || !newTeamName.trim()) ? 0.5 : 1 }}>
                        {creatingTeam ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        {t('create')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Manage team members modal */}
              {managingTeam && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                  style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                  onClick={() => setManagingTeam(null)}>
                  <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
                    style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, maxHeight: "80vh" }}
                    onClick={(e) => e.stopPropagation()}>
                    <div className="px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {managingTeam.emoji} {managingTeam.name} — {t('groups_manage_members_suffix')}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {t('groups_select_members')}
                      </p>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-2" style={{ maxHeight: "50vh" }}>
                      {members.map((m: any) => {
                        const p = m.profiles;
                        if (!p) return null;
                        const initials = (p.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                        const isChecked = managingSelected.has(m.user_id);
                        return (
                          <button
                            key={m.user_id || m.id}
                            type="button"
                            onClick={() => setManagingSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(m.user_id)) next.delete(m.user_id);
                              else next.add(m.user_id);
                              return next;
                            })}
                            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                            style={{
                              background: isChecked ? (isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.08)") : (isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB"),
                              border: `1px solid ${isChecked ? "rgba(74,222,128,0.3)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}`,
                            }}
                          >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
                              style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                              {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-8 h-8 object-cover" /> : initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{p.display_name}</p>
                              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{p.username}</p>
                            </div>
                            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: isChecked ? "#4ADE80" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)") }}>
                              {isChecked && <Check size={12} style={{ color: "#0E1117" }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {error && (
                      <p className="text-xs px-4 pt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>
                    )}
                    <div className="px-4 py-3 flex gap-2"
                      style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
                      <button type="button" onClick={() => { setManagingTeam(null); setError(""); }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                        {t('cancel_short')}
                      </button>
                      <button type="button" onClick={handleSaveTeamMembers} disabled={savingTeamMembers}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: "var(--neon-green)", color: "#0E1117", opacity: savingTeamMembers ? 0.6 : 1 }}>
                        {savingTeamMembers ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        {`${t('groups_save_team').replace('{n}', String(managingSelected.size))}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── APPROVE TAB (admin only) ── */}
          {activeTab === "approve" && isAdmin && (
            <div className="flex flex-col gap-3">
              {error && <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
              {pendingApprovals.length === 0 ? (
                <div style={card} className="p-10 flex flex-col items-center gap-3">
                  <ShieldCheck size={32} style={{ color: "#4ADE80" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_all_checked')}</p>
                  <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
                    {t('groups_no_pending')}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
                    {`${t('groups_pending_count').replace('{n}', String(pendingApprovals.length))}`}
                  </p>
                  {pendingApprovals.map((item) => {
                    const p = item.profiles;
                    const h = item.group_habits;
                    if (!p || !h) return null;
                    const initials = (p.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                    return (
                      <div key={item.id} style={{ ...card, border: "1px solid rgba(251,191,36,0.2)" }} className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                            style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                            {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-9 h-9 object-cover" /> : initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.display_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span>{h.emoji}</span>
                              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{h.name}</span>
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                              {item.log_date}
                            </p>
                          </div>
                          <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                            style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>
                            ⏳ {t('pending')}
                          </div>
                        </div>

                        {item.proof_note && (
                          <div className="mb-3 p-2.5 rounded-xl flex items-start gap-2"
                            style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB" }}>
                            <MessageSquare size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 1 }} />
                            <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{item.proof_note}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => { setRejectLogId(item.id); setRejectReason(""); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                            <X size={13} /> {t('reject')}
                          </button>
                          <button onClick={() => handleApprove(item.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}>
                            <Check size={13} /> {t('groups_approve_btn')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
