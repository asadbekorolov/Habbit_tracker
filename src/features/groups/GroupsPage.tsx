import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyGroupsQuery, queryKeys } from "../../hooks/queries";
import { motion } from "framer-motion";
import { useLang } from "../../store/LangContext";
import { Users, Plus, LogIn, Copy, Crown, Loader2, X, ChevronRight, Compass } from "lucide-react";
import { createGroup, joinGroup } from "../../services/db";
import { trackEvent } from "../../utils/analytics";
import { useProfile } from "../../store/UserContext";
import { GroupsPageProps, View } from "./groupsShared";
import { GroupDetail } from "./detail/GroupDetail";

export function GroupsPage({ onUserClick }: GroupsPageProps) {
  const profile = useProfile();
  const { t } = useLang();
  const [view, setView] = useState<View>("list");
  const [subView, setSubView] = useState<"my" | "explore">("my");
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [error, setError] = useState("");

  // Guruhlar ro'yxati — yagona React Query keshi. `setGroups` keshni darhol
  // o'zgartiradi (setQueryData) va serverdan qayta tekshiradi (invalidate).
  const queryClient = useQueryClient();
  const groupsQ = useMyGroupsQuery(profile.id);
  const groups: any[] = groupsQ.data || [];
  const loading = groupsQ.isPending;
  const setGroups = (updater: (prev: any[]) => any[]) => {
    queryClient.setQueryData<any[]>(queryKeys.myGroups(profile.id), (old) => updater(old || []));
    queryClient.invalidateQueries({ queryKey: queryKeys.myGroups(profile.id) });
  };
  useEffect(() => {
    if (groupsQ.isError && !groupsQ.data) setError(t('groups_err_load'));
  }, [groupsQ.isError, groupsQ.data]);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);



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
    background: "rgba(22,27,34,0.85)",
    border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: 14,
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid rgba(255,255,255,0.1)`,
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
              background: "rgba(255,255,255,0.06)",
              color: "var(--muted-foreground)",
              border: `1px solid rgba(255,255,255,0.08)`,
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
            style={{ background: "#0D1117", borderTop: "1px solid rgba(255,255,255,0.1)" }}
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
            style={{ background: "#0D1117", borderTop: "1px solid rgba(255,255,255,0.1)" }}
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

      {loading && groups.length === 0 ? (
        <div className="flex flex-col gap-4 max-w-2xl animate-pulse">
          <div className="h-28 bg-slate-800/40 rounded-3xl w-full" />
          <div className="h-28 bg-slate-800/40 rounded-3xl w-full" />
        </div>
      ) : groups.length === 0 ? (
        <div style={card} className="p-10 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <Users size={28} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('groups_empty')}</p>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            {t('groups_empty_hint')}
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => { setShowJoin(true); setError(""); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--foreground)", border: `1px solid rgba(255,255,255,0.1)` }}>
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

                    <div className="flex items-center gap-1.5 shrink-0 mt-1.5">
                       <span className="text-[10px] font-['Geist_Mono',monospace] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 uppercase tracking-tight shrink-0">
                          {memberCount}/{maxMembers} A'ZO
                       </span>
                       <span className="text-[10px] font-['Geist_Mono',monospace] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 uppercase tracking-tight shrink-0">
                          BUGUN {groupProgress}%
                       </span>
                    </div>

                    <div className="mt-3 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                       <motion.div
                         initial={{ width: 0 }}
                         animate={{ width: `${groupProgress}%` }}
                         className="h-full bg-emerald-500"
                       />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedGroup(group); setView("detail"); }}
                    className="self-center w-9 h-9 rounded-2xl bg-slate-800/60 border border-slate-700/60 shrink-0 flex items-center justify-center text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5 stroke-[2.2]" />
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
