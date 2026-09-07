import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../../store/LangContext";
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  Users, Plus, LogIn, ArrowLeft, Copy, Check, Crown,
  Loader2, Trophy, Trash2, CheckCircle2, Circle, UserPlus,
  Clock, X, ChevronRight, BarChart3, ShieldCheck, AlertCircle,
  MessageSquare, Download, Send, Pencil, UsersRound, Target,
  Settings, LogOut, UserMinus, Shield, ArrowRightLeft, UserCheck, Zap,
  Footprints, BookOpen, Moon, Sparkles, Apple, Utensils, Droplets, Dumbbell, Flame, ClipboardList, Medal, Compass,
  PenTool, Music, Smartphone, Activity, Sun, Timer, Sunrise
} from "lucide-react";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";
import { toDateStr } from "../../utils/date";
import {
  createGroup, joinGroup, getMyGroups, getGroupMembers,
  getGroupHabits, addGroupHabit, updateGroupHabit, deleteGroupHabit,
  getGroupLeaderboard, logGroupHabit, getTodayGroupLogs,
  getPendingGroupApprovals, approveGroupLog, rejectGroupLog,
  getGroupMembersMonthlyStats, updateGroupTelegramLink,
  getGroupSubteams, createSubteam, addSubteamMember, removeSubteamMember, deleteSubteam,
  isStarActive, leaveGroup, kickMember, deleteGroup, setGroupMemberRole, transferGroupOwnership,
} from "../../services/db";
import { supabase } from "../../services/supabase";
import type { Profile } from "../../services/supabase";
import { trackEvent } from "../../utils/analytics";
import { UserBadge } from "../../components/UserBadge";
import { GroupWeeklyCompetition } from "./GroupWeeklyCompetition";
import { AddGroupHabitModal } from "../../components/AddGroupHabitModal";

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
  const [subView, setSubView] = useState<"my" | "explore">("my");
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
        onGroupRemoved={(groupId) => {
          setGroups((prev) => prev.filter((g) => g.id !== groupId));
          setView("list");
          setSelectedGroup(null);
        }}
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
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('groups_title')}</h2>
          <p className="text-xs mt-0.5 text-slate-500 dark:text-muted-foreground">
            {t('groups_sub')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowJoin(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
              color: isDark ? "var(--muted-foreground)" : "#64748B",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
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

      {/* Sub-view Switcher */}
      <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 mb-6">
        <button
          onClick={() => setSubView('my')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subView === 'my'
              ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-500 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Users size={14} />
          Mening Guruhlarim
        </button>
        <button
          onClick={() => setSubView('explore')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subView === 'explore'
              ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-500 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Compass size={14} />
          Ommaviy Guruhlar
        </button>
      </div>

      {showCreate && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full sm:max-w-md p-8 rounded-t-[2.5rem] sm:rounded-3xl"
            style={{ background: isDark ? "#0D1117" : "#fff", borderTop: isDark ? "1px solid rgba(255,255,255,0.1)" : "none" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('groups_create_title')}</h3>
              <button onClick={() => setShowCreate(false)} data-modal-close-trigger aria-label={t('close')} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">{t('groups_name')}</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-white transition-all"
                  placeholder={t('groups_name_ph') || 'Guruh nomini kiriting'}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus
                />
              </div>
            </div>
            {error && <p className="text-xs mt-3 text-rose-500 text-center">⚠ {error}</p>}
            <button
              onClick={handleCreate}
              disabled={creating || !newGroupName.trim()}
              className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {t('create')}
            </button>
          </motion.div>
        </div>
      )}

      {showJoin && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowJoin(false)}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full sm:max-w-md p-8 rounded-t-[2.5rem] sm:rounded-3xl"
            style={{ background: isDark ? "#0D1117" : "#fff", borderTop: isDark ? "1px solid rgba(255,255,255,0.1)" : "none" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('groups_join_title')}</h3>
              <button onClick={() => setShowJoin(false)} data-modal-close-trigger aria-label={t('close')} className="text-slate-400"><X size={20} /></button>
            </div>
            <p className="text-xs mb-6 text-slate-500 font-medium leading-relaxed">{t('groups_join_hint')}</p>
            <input
              style={{ textTransform: "uppercase", letterSpacing: 4, textAlign: "center", fontFamily: "'Geist Mono', monospace" }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black focus:border-emerald-500 outline-none text-white transition-all"
              placeholder="ABC123" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus maxLength={6} />
            {error && <p className="text-xs mt-3 text-rose-500 text-center">⚠ {error}</p>}
            <button
              onClick={handleJoin}
              disabled={joining || joinCode.length < 4}
              className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {joining ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {t('groups_join')}
            </button>
          </motion.div>
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
        <div className="flex flex-col gap-4">
          {groups.filter(g => subView === 'my' ? true : g.is_public).map((group) => {
            const isOwner = group.admin_id === profile.id;
            const adminProfile = group.admin_profile;
            // Mock data for new UI elements
            const memberCount = group.member_count || 1;
            const maxMembers = 20;
            const groupProgress = 65; // Mock progress

            return (
              <motion.div
                whileTap={{ scale: 0.98 }}
                key={group.id}
                className="p-5 rounded-[2rem] bg-white dark:bg-[#161B22]/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-xl group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 glass border-slate-200 dark:border-white/10 shadow-md dark:shadow-lg relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.2) 100%)" }}>
                    <Users className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg text-slate-900 dark:text-white truncate">{group.name}</p>
                      {isOwner && <Crown size={16} className="text-amber-500 dark:text-amber-400" />}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5">
                       <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 uppercase tracking-tighter">
                          {memberCount} / {maxMembers} a'zo
                       </span>
                       <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter">
                          Bugun {groupProgress}%
                       </span>
                    </div>

                    <div className="mt-3 w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                       <motion.div
                         initial={{ width: 0 }}
                         animate={{ width: `${groupProgress}%` }}
                         className="h-full bg-emerald-500"
                       />
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedGroup(group); setView("detail"); }}
                    className="self-center w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white dark:hover:text-black transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {isOwner && group.invite_code && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('groups_code')}</span>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(group.invite_code); }} className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 active:scale-95 transition-all">
                      <Copy size={12} />
                      <span style={{ fontFamily: "'Geist Mono', monospace" }}>{group.invite_code}</span>
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Group Detail ─────────────────────────────────────────────
function GroupDetail({
  isDark, profile, group, onBack, onGroupRemoved, card, inputStyle, onUserClick
}: {
  isDark: boolean; profile: Profile; group: any; onBack: () => void;
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
      const html2canvas = (await import("html2canvas")).default;
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

  const EMOJI_MAP: Record<string, any> = {
    '🔥': Flame,
    '🏆': Trophy,
    '🚀': Zap,
    '💎': Zap,
    '🌟': Sparkles,
    '🎯': Target,
    '⚡': Zap
  };

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
  const nowForStats = new Date();
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
        emoji: row.group_habits?.emoji || "🎯",
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
          <button onClick={() => { setEditingHabitId(null); setShowAddHabit(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "var(--neon-green)", color: "#0E1117" }}>
            <Plus size={13} /> {t('groups_add_habit_btn')}
          </button>
        )}
        <button onClick={() => { setShowSettings(true); setLeaveError(""); setConfirmDelete(false); }}
          className="p-2 rounded-xl shrink-0"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}>
          <Settings size={16} style={{ color: "var(--foreground)" }} />
        </button>
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

      {loadError && (
        <p className="text-xs px-1 mb-3" style={{ color: "var(--coral-red)" }}>⚠ {loadError}</p>
      )}

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
                data-modal-close-trigger
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
      {/* Guruh sozlamalari modal */}
      {showSettings && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>{t('groups_settings_title')}</h3>

            {leaveError && (
              <p className="text-xs mb-3" style={{ color: "var(--coral-red)" }}>⚠ {leaveError}</p>
            )}

            <button type="button" onClick={handleLeaveGroup} disabled={leaving || deletingGroup}
              className="w-full flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium mb-2"
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6", color: "var(--foreground)", opacity: leaving ? 0.6 : 1 }}>
              {leaving ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              {t('groups_leave')}
            </button>

            {isOwner && (
              <button type="button" onClick={handleDeleteGroup} disabled={leaving || deletingGroup}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium"
                style={{
                  background: confirmDelete ? "rgba(248,113,113,0.15)" : isDark ? "rgba(248,113,113,0.08)" : "rgba(248,113,113,0.06)",
                  color: "#F87171", border: `1px solid rgba(248,113,113,${confirmDelete ? 0.4 : 0.2})`,
                  opacity: deletingGroup ? 0.6 : 1,
                }}>
                {deletingGroup ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {confirmDelete ? t('groups_delete_confirm') : t('groups_delete')}
              </button>
            )}

            <button type="button" onClick={() => setShowSettings(false)}
              data-modal-close-trigger
              className="w-full py-2.5 rounded-xl text-sm font-medium mt-3"
              style={{ color: "var(--muted-foreground)" }}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {rejectLogId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                data-modal-close-trigger
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
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                data-modal-close-trigger
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

      <AddGroupHabitModal
        isOpen={showAddHabit}
        onClose={resetHabitForm}
        isDark={isDark}
        initialData={editingHabitId ? habits.find(h => h.id === editingHabitId) : undefined}
        onAdd={async (habitData) => {
          if (editingHabitId) {
            const h = await updateGroupHabit(editingHabitId, {
              name: habitData.name,
              emoji: habitData.emoji,
              type: habitData.type,
              target_value: habitData.target_value,
              unit: habitData.unit
            });
            setHabits((prev) => prev.map((x) => x.id === editingHabitId ? h : x));
          } else {
            const h = await addGroupHabit(group.id, habitData.name, habitData.emoji, habitData.type, habitData.target_value, habitData.unit);
            setHabits((prev) => [...prev, h]);
          }
        }}
      />

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
                  <ClipboardList size={28} style={{ color: "var(--muted-foreground)" }} />
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    {isAdmin ? t('groups_first_habit') : t('groups_no_habits')}
                  </p>
                </div>
              ) : (
                habits.map((habit) => {
                  const logState = todayLogs[habit.id];
                  const isMarked = logState?.completed;
                  const canMark = !isMarked || logState?.status === "rejected";
                  const category = getHabitCategory(habit.name, habit.emoji);
                  const theme = getCategoryTheme(category);

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

                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden transition-all duration-300"
                          style={{
                            background: theme.gradient,
                            border: `1px solid ${theme.border}`,
                            boxShadow: theme.shadow
                          }}
                        >
                           <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                           <theme.icon size={20} color={theme.color} strokeWidth={2.5} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium"
                              style={{ color: logState?.status === "approved" || logState?.status === "auto" ? "#4ADE80" : "var(--foreground)" }}>
                              {cleanHabitName(habit.name)}
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
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEditHabit(habit)}
                              className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
                              style={{ color: "var(--muted-foreground)" }}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteHabit(habit.id)}
                              className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
                              style={{ color: "var(--coral-red)" }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
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
                  const isThisOwner = m.user_id === group.admin_id;
                  const isSelf = m.user_id === profile.id;
                  const busy = memberActionId === m.user_id;
                  const showTransferConfirm = transferTargetId === m.user_id;
                  return (
                    <div key={m.id || i} className="flex items-center gap-3 p-3.5 rounded-2xl transition-colors"
                      style={card}>
                      <div onClick={() => onUserClick?.(m.user_id)} className="flex items-center gap-3 flex-1 min-w-0"
                        style={{ cursor: onUserClick ? "pointer" : "default" }}>
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
                            {isThisOwner ? (
                              <Crown size={12} style={{ color: "#FBBF24" }} />
                            ) : m.role === "admin" ? (
                              <Shield size={12} style={{ color: "#38BDF8" }} />
                            ) : null}
                          </div>
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{p.username}</p>
                          {mStats && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981" }}>
                                <CheckCircle2 size={10} /> {mStats.approved}
                              </span>
                              {mStats.pending > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(251, 191, 36, 0.1)", color: "#FBBF24" }}>
                                  <Clock size={10} /> {mStats.pending}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {!isSelf && !isThisOwner && (isOwner || isAdmin) && (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                          ) : showTransferConfirm ? (
                            <>
                              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('groups_transfer_confirm')}</span>
                              <button type="button" onClick={() => handleTransferOwnership(m.user_id)}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                                style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                                {t('groups_confirm_yes')}
                              </button>
                              <button type="button" onClick={() => setTransferTargetId(null)}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                                style={{ color: "var(--muted-foreground)" }}>
                                {t('cancel_short')}
                              </button>
                            </>
                          ) : (
                            <>
                              {isOwner && (
                                <>
                                  <button type="button" title={m.role === "admin" ? t('groups_demote') : t('groups_promote')}
                                    onClick={() => handleToggleCoAdmin(m.user_id, m.role === "admin" ? "member" : "admin")}
                                    className="p-1.5 rounded-lg" style={{ color: m.role === "admin" ? "#38BDF8" : "var(--muted-foreground)" }}>
                                    <Shield size={13} />
                                  </button>
                                  <button type="button" title={t('groups_transfer_ownership')}
                                    onClick={() => setTransferTargetId(m.user_id)}
                                    className="p-1.5 rounded-lg" style={{ color: "var(--muted-foreground)" }}>
                                    <ArrowRightLeft size={13} />
                                  </button>
                                </>
                              )}
                              <button type="button" title={t('groups_kick')}
                                onClick={() => handleKickMember(m.user_id)}
                                className="p-1.5 rounded-lg" style={{ color: "#F87171" }}>
                                <UserMinus size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── LEADERBOARD TAB ── */}
          {activeTab === "leaderboard" && (
            <div className="flex flex-col gap-3">
              <GroupWeeklyCompetition isDark={isDark} groupId={group.id} myUserId={profile.id} card={card} />
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
                  const isMe = entry.userId === profile.id;
                  const medalColors = ["#FBBF24", "#94A3B8", "#B45309"];
                  return (
                    <div key={entry.userId} className="flex items-center gap-3 p-3.5 rounded-2xl"
                      style={{
                        ...card,
                        background: isMe ? (isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.04)") : card.background,
                        border: isMe ? "1px solid rgba(74,222,128,0.25)" : card.border,
                      }}>
                      <div className="w-8 flex justify-center shrink-0">
                        {i < 3 ? (
                          <Trophy size={18} style={{ color: medalColors[i] }} strokeWidth={2.5} />
                        ) : (
                          <span className="text-xs font-bold opacity-40" style={{ fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                        style={{ background: entry.color || "#4ADE80", color: "#0E1117" }}>
                        {entry.avatarUrl ? (
                          <img src={entry.avatarUrl} alt="" className="w-9 h-9 object-cover" />
                        ) : (
                          (entry.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        )}
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
                {rankedMemberStats.length > 0 && (
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

              <div ref={statsRef} className="flex flex-col gap-4 rounded-2xl p-4"
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
                        background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}`,
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
                    style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}` }}>
                    <BarChart3 size={28} style={{ color: "var(--muted-foreground)" }} />
                    <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>{t('groups_stats_no_activity')}</p>
                  </div>
                ) : (
                  <>
                    {/* Daily trend chart */}
                    <div className="rounded-xl p-4"
                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}` }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_stats_trend_title')}</p>
                      <p className="text-[11px] mt-0.5 mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_stats_trend_sub')}</p>
                      <div style={{ height: 160, marginLeft: -12 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={dailyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? "#8B949E" : "#6B7280" }}
                              interval={Math.max(0, Math.ceil(dailyTrend.length / 7) - 1)} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: isDark ? "#8B949E" : "#6B7280" }} axisLine={false} tickLine={false} width={24} />
                            <Tooltip
                              contentStyle={{ background: isDark ? "#161B22" : "#ffffff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, borderRadius: 10, fontSize: 11 }}
                              labelStyle={{ color: isDark ? "#8B949E" : "#6B7280" }}
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
                        style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}` }}>
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
                                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
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
                              background: isDark ? "rgba(22,27,34,0.85)" : "#ffffff",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
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
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
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
                    <Users size={28} style={{ color: "var(--muted-foreground)" }} />
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
                          {(() => {
                             const TeamIcon = EMOJI_MAP[team.emoji] || Users;
                             const colorClass = (team.emoji === '🔥' || team.emoji === 'Flame') ? 'text-orange-500'
                                              : (team.emoji === '🏆' || team.emoji === 'Trophy') ? 'text-amber-400'
                                              : 'text-emerald-400';
                             return <TeamIcon size={20} className={colorClass} />
                          })()}
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
                            {t('pending')}
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
