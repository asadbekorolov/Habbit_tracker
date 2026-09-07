import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HABIT_FAILURE_COLOR, HABIT_SUCCESS_COLOR, deleteHabitLog, getLast30DaysLogs, getHabits, getTodayLogs, toggleHabitLog, searchUsers, getStreakFreezes, computeHabitProgress, getCached } from "../../services/db";
import { sortByOrder } from "../../utils/habitOrder";
import { getLevel } from "../../utils/levels";
import { toDateStr } from "../../utils/date";
import type { Habit, Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { useUser } from "../../store/UserContext";
import { soundService } from "../../services/soundService";
import { DAYS_SHORT } from "../../utils/i18n";
import { DailyQuestsCard } from "../../components/DailyQuestsCard";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";
import { QuickLogModal } from "../../components/QuickLogModal";
import { EmptyState } from "../../components/EmptyState";
import { AvatarFrame } from "../../components/AvatarFrame";
import { CoinShopModal } from "../profile/CoinShopModal";
import {
  Coins, Flame, Trophy, ShoppingBag, ArrowRight, Loader2, CalendarDays, CheckCircle2,
  Check, Lightbulb, TrendingUp, AlertTriangle, Search, X, Shield, Lock, ChevronRight,
  SlidersHorizontal, ClipboardList, Bell, Heart, Star, CalendarX2, History, AlertCircle,
  ShieldCheck, RotateCcw, ShieldAlert, Zap, HeartCrack, ChevronUp, ChevronDown, BookOpen, Sparkles
} from "lucide-react";

interface DashboardProps {
  isDark: boolean;
  profile: Profile;
  completedToday: number;
  totalHabits: number;
  onNavigate: (tab: string) => void;
  onCompletedChange?: (completed: number, total: number) => void;
  onUserClick?: (userId: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}

export function Dashboard({ isDark, profile: propsProfile, completedToday: propsCompletedToday, totalHabits: propsTotalHabits, onNavigate, onCompletedChange, onUserClick, onProfileUpdate }: DashboardProps) {
  const { t, lang } = useLang();
  const { profile: contextProfile } = useUser();
  const profile = contextProfile || propsProfile;

  const [logs, setLogs] = useState<any[]>([]);
  const cachedHabits = getCached<Habit[]>(`habits_${profile.id}`);
  const [loading, setLoading] = useState(!cachedHabits);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [todayHabits, setTodayHabits] = useState<Habit[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [logValues, setLogValues] = useState<Record<string, number>>({});
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [negativeHabits, setNegativeHabits] = useState<Habit[]>([]);
  const [negLoggedIds, setNegLoggedIds] = useState<Set<string>>(new Set());
  const [negKeptIds, setNegKeptIds] = useState<Set<string>>(new Set());

  const [activeLogHabit, setActiveLogHabit] = useState<Habit | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);

  const [freezeDates, setFreezeDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [profile.id]);

  async function loadData() {
    const hasCache = getCached<Habit[]>(`habits_${profile.id}`);
    if (!hasCache) setLoading(true);
    try {
      const [logsData, habitsData, todayLogsData, freezeDatesData] = await Promise.all([
        getLast30DaysLogs(profile.id),
        getHabits(profile.id),
        getTodayLogs(profile.id),
        getStreakFreezes(profile.id),
      ]);
      setLogs(logsData || []);

      const sorted = sortByOrder(habitsData || [], profile.id);
      const posHabits = sorted.filter((h: Habit) => h.type === "positive");
      const negHabits = sorted.filter((h: Habit) => h.type === "negative");
      setTodayHabits(posHabits);
      setNegativeHabits(negHabits);

      const posHabitIds = new Set(posHabits.map((h: Habit) => h.id));
      const done = new Set<string>();
      const failed = new Set<string>();
      const logged = new Set<string>();
      const negKept = new Set<string>();
      const values: Record<string, number> = {};

      for (const l of todayLogsData || []) {
        logged.add(l.habit_id);
        values[l.habit_id] = l.value || (l.completed ? 1 : 0);

        if (l.completed) {
          done.add(l.habit_id);
          negKept.add(l.habit_id);
        } else {
          failed.add(l.habit_id);
        }
      }
      setDoneIds(done);
      setFailedIds(failed);
      setLogValues(values);
      setNegLoggedIds(logged);
      setNegKeptIds(negKept);

      const progress = computeHabitProgress(sorted, todayLogsData || []);
      onCompletedChange?.(progress.completed, progress.total);

      setFreezeDates(new Set(freezeDatesData || []));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery, profile.id);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, profile.id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function reportProgress(nextDone: Set<string>, nextNegLogged: Set<string>, nextNegKept: Set<string>) {
    const allHabits = [...todayHabits, ...negativeHabits];
    const posLogs = Array.from(nextDone).map((id) => ({ habit_id: id, completed: true }));
    const negLogs = Array.from(nextNegLogged).map((id) => ({ habit_id: id, completed: nextNegKept.has(id) }));
    const { completed, total } = computeHabitProgress(allHabits, [...posLogs, ...negLogs]);
    onCompletedChange?.(completed, total);
  }

  async function handleQuickTogglePositive(habit: Habit, markFailed: boolean) {
    const alreadyDone = doneIds.has(habit.id);
    const alreadyFailed = failedIds.has(habit.id);
    const sameState = (markFailed && alreadyFailed) || (!markFailed && alreadyDone);
    const value = markFailed ? 0 : (habit.target_value || 1);

    setSavingIds((prev) => new Set(prev).add(habit.id));
    try {
      if (sameState) {
        await deleteHabitLog(habit.id, profile.id, today);
        const nextDone = new Set(doneIds); nextDone.delete(habit.id);
        const nextFailed = new Set(failedIds); nextFailed.delete(habit.id);
        setDoneIds(nextDone);
        setFailedIds(nextFailed);
        reportProgress(nextDone, negLoggedIds, negKeptIds);
      } else {
        const completed = !markFailed;
        if (completed) soundService.play('task_complete');
        else soundService.play('button_tap');
        await toggleHabitLog(habit.id, profile.id, completed, value, alreadyDone);
        const nextDone = new Set(doneIds);
        const nextFailed = new Set(failedIds);
        if (completed) { nextDone.add(habit.id); nextFailed.delete(habit.id); }
        else { nextFailed.add(habit.id); nextDone.delete(habit.id); }
        setDoneIds(nextDone);
        setFailedIds(nextFailed);
        reportProgress(nextDone, negLoggedIds, negKeptIds);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(habit.id); return n; });
    }
  }

  async function handleSaveTimedHabit(value: number) {
    if (!activeLogHabit) return;
    const habit = activeLogHabit;
    const target = habit.target_value || 1;
    const completed = value >= target;
    const wasDone = doneIds.has(habit.id);

    setSavingIds((prev) => new Set(prev).add(habit.id));
    try {
      await toggleHabitLog(habit.id, profile.id, completed, value, wasDone);

      const nextDone = new Set(doneIds);
      const nextFailed = new Set(failedIds);
      if (completed) { nextDone.add(habit.id); nextFailed.delete(habit.id); }
      else { nextFailed.add(habit.id); nextDone.delete(habit.id); }

      setDoneIds(nextDone);
      setFailedIds(nextFailed);
      setLogValues(prev => ({ ...prev, [habit.id]: value }));

      reportProgress(nextDone, negLoggedIds, negKeptIds);
      if (completed && !wasDone) soundService.play('task_complete');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(habit.id); return n; });
    }
  }

  async function handleMarkNegativeHabit(habitId: string, broke: boolean) {
    const alreadyLogged = negLoggedIds.has(habitId);
    const alreadyKept = alreadyLogged && negKeptIds.has(habitId);
    const alreadyBroke = alreadyLogged && !negKeptIds.has(habitId);
    const sameState = (broke && alreadyBroke) || (!broke && alreadyKept);

    setSavingIds(p => new Set(p).add(habitId));
    try {
      if (sameState) {
        await deleteHabitLog(habitId, profile.id, today);
        const nextLogged = new Set(negLoggedIds); nextLogged.delete(habitId);
        const nextKept = new Set(negKeptIds); nextKept.delete(habitId);
        setNegLoggedIds(nextLogged);
        setNegKeptIds(nextKept);
        reportProgress(doneIds, nextLogged, nextKept);
      } else {
        const completed = !broke;
        if (completed) soundService.play('task_complete');
        else soundService.play('button_tap');
        await toggleHabitLog(habitId, profile.id, completed, completed ? 1 : 0, alreadyKept, true, today);

        const nextLogged = new Set(negLoggedIds); nextLogged.add(habitId);
        const nextKept = new Set(negKeptIds);
        if (completed) nextKept.add(habitId); else nextKept.delete(habitId);

        setNegLoggedIds(nextLogged);
        setNegKeptIds(nextKept);
        reportProgress(doneIds, nextLogged, nextKept);
      }
    } catch (e) { console.error(e); }
    finally { setSavingIds(p => { const n = new Set(p); n.delete(habitId); return n; }); }
  }

  const today = toDateStr();

  const getHabitStatus = (habit: Habit) => {
    if (habit.type === "negative") {
      const isLogged = negLoggedIds.has(habit.id);
      if (!isLogged) return "pending";
      return negKeptIds.has(habit.id) ? "success" : "failed";
    } else {
      if (doneIds.has(habit.id)) return "success";
      if (failedIds.has(habit.id)) return "failed";
      return "pending";
    }
  };

  const allDailyHabits = useMemo(() => {
    return [...todayHabits, ...negativeHabits];
  }, [todayHabits, negativeHabits]);

  const pendingHabits = useMemo(() => {
    return allDailyHabits.filter((h) => getHabitStatus(h) === "pending");
  }, [allDailyHabits, doneIds, failedIds, negLoggedIds, negKeptIds]);

  const markedHabits = useMemo(() => {
    return allDailyHabits.filter((h) => getHabitStatus(h) !== "pending");
  }, [allDailyHabits, doneIds, failedIds, negLoggedIds, negKeptIds]);

  const completedTodayCount = useMemo(() => {
    return allDailyHabits.filter((h) => getHabitStatus(h) === "success").length;
  }, [allDailyHabits, doneIds, negLoggedIds, negKeptIds]);

  const totalHabitsCount = allDailyHabits.length;

  const completionByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      if (log.completed) {
        map[log.log_date] = (map[log.log_date] || 0) + 1;
      }
    }
    map[today] = completedTodayCount;
    return map;
  }, [logs, completedTodayCount, today]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const ds = toDateStr(d);
      return {
        day: DAYS_SHORT[lang][d.getDay()],
        completed: completionByDate[ds] || 0,
        isToday: ds === today,
      };
    });
  }, [completionByDate, today, lang]);

  const todayPercent = totalHabitsCount > 0 ? Math.round((completedTodayCount / totalHabitsCount) * 100) : 0;

  const hp = useMemo(() => {
    const brokenNegCount = Array.from(negLoggedIds).filter(id => !negKeptIds.has(id)).length;
    return Math.max(0, 100 - (brokenNegCount * 15));
  }, [negLoggedIds, negKeptIds]);

  const lv = getLevel(profile.score || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Search */}
      <div ref={searchRef} style={{ position: "relative" }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl glass"
          style={{
            background: isDark ? "var(--input-background)" : "#fff",
            border: `1px solid ${searchFocused ? "rgba(16,185,129,0.4)" : isDark ? "var(--border)" : "rgba(0,0,0,0.1)"}`,
            transition: "all 0.2s",
            boxShadow: searchFocused ? "0 0 0 2px rgba(16,185,129,0.1)" : "none",
          }}>
          <Search size={18} style={{ color: isDark ? "var(--muted-foreground)" : "#64748B", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('dash_search_placeholder')}
            className="placeholder:text-slate-400 dark:placeholder:text-slate-500"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: isDark ? "var(--foreground)" : "#0F172A", fontSize: 14, fontWeight: 500,
            }}
          />
          {(searchLoading) && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "var(--muted-foreground)" }} />}
          {searchQuery && !searchLoading && (
            <button type="button" aria-label={t('dash_search_clear')} onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
        {searchFocused && searchQuery.trim() && (
          <div className="absolute left-0 right-0 mt-1 rounded-2xl overflow-hidden z-40"
            style={{
              background: isDark ? "#161B22" : "#fff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
              boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.25)" : "0 10px 25px rgba(0,0,0,0.05)",
            }}>
            {searchResults.length === 0 && !searchLoading ? (
              <div className="px-4 py-5 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t('dash_search_empty').replace('{q}', searchQuery)}
              </div>
            ) : (
              searchResults.map((user) => {
                const ulv = getLevel(user.score || 0);
                const canView = !user.is_private;
                return (
                  <button key={user.id} type="button"
                    onClick={canView ? () => { onUserClick?.(user.id); setSearchFocused(false); setSearchQuery(""); setSearchResults([]); } : undefined}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`, cursor: canView ? "pointer" : "default" }}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: user.avatar_color || "#4ADE80", color: "#fff" }}>
                        {(user.display_name || user.username)[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{user.display_name || user.username}</p>
                      <p className="text-xs text-slate-500">@{user.username}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${ulv.color}20`, color: ulv.color, border: `1px solid ${ulv.color}40` }}>
                      Lv.{ulv.level}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="premium-card p-6 mb-6 overflow-hidden relative shadow-xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-xp/5 rounded-full -ml-12 -mb-12 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <AvatarFrame frameId={profile.active_frame} radius={28}>
                   <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/20 shadow-inner overflow-hidden">
                      {profile.avatar_url ? (
                         <img src={profile.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                         <span className="text-xl font-black text-primary">{(profile.display_name || 'A')[0]}</span>
                      )}
                   </div>
                </AvatarFrame>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-xp text-white flex items-center justify-center text-[10px] font-black shadow-lg border-2 border-card">
                  {lv.level}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-black leading-tight">Salom, {profile.display_name?.split(' ')[0]}! 👋</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{lv.label}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold shadow-sm">
                <Coins size={14} className="fill-gold/20" />
                <span className="text-sm font-black tracking-tight">{profile.coins || 0}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase">
                 <Heart size={10} className="fill-rose-500/20" /> HP {hp}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* XP Meter */}
            <div className="space-y-2">
              <div className="flex justify-between items-end px-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                   <Zap size={12} className="fill-xp text-xp" /> Tajriba (XP)
                </span>
                <span className="text-[10px] font-black text-xp">{profile.score || 0} / {lv.next || profile.score || 0}</span>
              </div>
              <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden p-0.5 border border-border">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${lv.progress}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-xp to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Daily Goal Meter */}
            <div className="space-y-2">
              <div className="flex justify-between items-end px-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                   <CheckCircle2 size={12} className="text-primary" /> Kunlik Maqsad
                </span>
                <span className="text-[10px] font-black text-primary">{completedTodayCount} / {totalHabitsCount}</span>
              </div>
              <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden p-0.5 border border-border">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${todayPercent}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <DailyQuestsCard
        isDark={isDark}
        profile={profile}
        completedToday={completedTodayCount}
        totalHabits={totalHabitsCount}
        negativeWin={negativeHabits.some((h) => negKeptIds.has(h.id))}
        hasNegativeHabits={negativeHabits.length > 0}
        consistencyWin={completedTodayCount > 0 && logs.some((l) => l.log_date === toDateStr(new Date(Date.now() - 86400000)) && l.completed)}
        onProfileUpdate={onProfileUpdate}
      />

      {/* Kunlik Jurnal CTA Button - Vibrant Emerald Hero */}
      <button
        type="button"
        onClick={() => onNavigate('journal')}
        className="w-full py-3.5 px-4 my-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-between border border-emerald-400/30 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-white stroke-[2.2] shrink-0" />
          <span className="text-sm font-bold text-white tracking-wide">
            Kunlik Jurnalga o'tish
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-black/20 text-emerald-100 text-xs font-semibold backdrop-blur-sm">
            {allDailyHabits.length} ta odat
          </span>
          <ArrowRight className="w-4 h-4 text-white stroke-[2.5] shrink-0" />
        </div>
      </button>

      {/* 3. Daily Tasks & Constraints Section */}
      <div className="space-y-4">
        <div className="px-2">
          <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Bugungi Vazifalar
          </h3>
        </div>

        {/* Pending Tasks List */}
        <div className="flex flex-col gap-3">
          {pendingHabits.length === 0 ? (
            <EmptyState
              title="Barcha vazifalar bajarilgan!"
              subtitle="Bugungi barcha rejalashtirilgan odatlar va cheklovlar muvaffaqiyatli yakunlandi"
              icon={CheckCircle2}
            />
          ) : (
            pendingHabits.map((habit) => {
              const status = getHabitStatus(habit);
              const isSuccess = status === "success";
              const isFailed = status === "failed";
              const isNumeric = (habit.target_value || 1) > 1 || !!habit.unit;
              const isNegative = habit.type === "negative";
              const saving = savingIds.has(habit.id);

              return (
                <motion.div
                  layout
                  key={habit.id}
                  whileHover={{ scale: 1.01 }}
                  className="premium-card flex items-center gap-3 p-3.5 group"
                >
                  {/* Emoji / Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                    isNegative ? "bg-rose-500/10 text-rose-500" : "bg-primary/10"
                  }`}>
                    <HabitIcon emoji={habit.emoji} name={habit.name} size={24} noWrapper />
                  </div>

                  {/* Info & Subtitle Badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{cleanHabitName(habit.name)}</p>
                      {isNegative && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                          Cheklov
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!isNegative ? (
                        <>
                          <span className="flex items-center gap-1 text-[10px] font-black text-xp uppercase bg-xp/10 px-1.5 py-0.5 rounded">
                            <Zap size={10} className="fill-xp" /> +5 XP
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-black text-gold uppercase bg-gold/10 px-1.5 py-0.5 rounded">
                            <Coins size={12} className="fill-gold text-amber-400" /> +1
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 text-[10px] font-black text-xp uppercase bg-xp/10 px-1.5 py-0.5 rounded">
                            <Zap size={10} className="fill-xp" /> +15 XP
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                            <Shield size={10} className="fill-rose-400" /> HP Himoyasi
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-black text-gold uppercase bg-gold/10 px-1.5 py-0.5 rounded">
                            <Coins size={12} className="fill-gold text-amber-400" /> +10
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dual Action Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Success (Check) Button */}
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (isNumeric && !isNegative) setActiveLogHabit(habit);
                        else if (isNegative) handleMarkNegativeHabit(habit.id, false);
                        else handleQuickTogglePositive(habit, false);
                      }}
                      disabled={saving}
                      whileTap={{ scale: 0.85 }}
                      title="Bajarildi"
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                    </motion.button>

                    {/* Failed / Skipped (X) Button */}
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (isNegative) handleMarkNegativeHabit(habit.id, true);
                        else handleQuickTogglePositive(habit, true);
                      }}
                      disabled={saving}
                      whileTap={{ scale: 0.85 }}
                      title="Bajarilmadi / Buzildi"
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-rose-500/10 text-rose-400/70 border border-rose-500/20 hover:bg-rose-500 hover:text-white"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={18} strokeWidth={3} />}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Marked / Completed Section (Collapsible) */}
        {markedHabits.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              className="w-full flex items-center justify-between py-2 px-1 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Bugun Bajarilganlar ({markedHabits.length})
              </span>
              {showCompleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showCompleted && (
              <div className="flex flex-col gap-3 mt-3">
                {markedHabits.map((habit) => {
                  const status = getHabitStatus(habit);
                  const isSuccess = status === "success";
                  const isFailed = status === "failed";
                  const isNumeric = (habit.target_value || 1) > 1 || !!habit.unit;
                  const isNegative = habit.type === "negative";
                  const saving = savingIds.has(habit.id);

                  return (
                    <motion.div
                      layout
                      key={habit.id}
                      className={`premium-card flex items-center gap-3 p-3.5 transition-all ${
                        isSuccess
                          ? "border-emerald-500/30 bg-emerald-950/20 dark:bg-emerald-950/20 text-emerald-400"
                          : "border-rose-500/30 bg-rose-950/20 dark:bg-rose-950/20 text-rose-400"
                      }`}
                    >
                      {/* Emoji / Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                        isSuccess ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}>
                        <HabitIcon emoji={habit.emoji} name={habit.name} size={24} noWrapper />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate">{cleanHabitName(habit.name)}</p>
                          {isNegative && (
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                              isSuccess
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}>
                              Cheklov
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          {isSuccess ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {isNegative ? <ShieldCheck size={12} /> : <CheckCircle2 size={12} />}
                              {isNegative ? "HP Saqlandi (+10 Tanga, +15 XP)" : "Bajarildi (+1 Tanga, +5 XP)"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                              {isNegative ? <HeartCrack size={12} /> : <X size={12} />}
                              {isNegative ? "-15 HP (Buzildi)" : "Bajarilmadi"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dual Action Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Success (Check) Button */}
                        <motion.button
                          type="button"
                          onClick={() => {
                            if (isNumeric && !isNegative) setActiveLogHabit(habit);
                            else if (isNegative) handleMarkNegativeHabit(habit.id, false);
                            else handleQuickTogglePositive(habit, false);
                          }}
                          disabled={saving}
                          whileTap={{ scale: 0.85 }}
                          title="Bajarildi"
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            isSuccess
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-500"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                          }`}
                        >
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                        </motion.button>

                        {/* Failed / Skipped (X) Button */}
                        <motion.button
                          type="button"
                          onClick={() => {
                            if (isNegative) handleMarkNegativeHabit(habit.id, true);
                            else handleQuickTogglePositive(habit, true);
                          }}
                          disabled={saving}
                          whileTap={{ scale: 0.85 }}
                          title="Bajarilmadi / Buzildi"
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            isFailed
                              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 border border-rose-500"
                              : "bg-rose-500/10 text-rose-400/70 border border-rose-500/20 hover:bg-rose-500 hover:text-white"
                          }`}
                        >
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={18} strokeWidth={3} />}
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Activity & Gamified Store Banner */}
      <div className="p-5 premium-card">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">So'nggi 7 kun</p>
        <div className="flex gap-2 justify-between">
          {weeklyData.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${
                  d.completed > 0
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110"
                    : "bg-secondary text-muted-foreground border border-border"
                }`}>
                {d.completed || ""}
              </div>
              <span className="text-[9px] font-black text-muted-foreground uppercase">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Redesigned Clean Shop Banner */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setShowShop(true);
          onNavigate('store');
        }}
        className="my-3.5 p-4 rounded-2xl bg-slate-900/80 dark:bg-slate-900/80 bg-white/80 backdrop-blur-md border border-amber-500/20 hover:border-amber-500/30 shadow-md cursor-pointer transition-all flex items-center justify-between gap-3 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
              Odatlar Do'koni
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Noyob ramkalar va bonuslar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 text-amber-400 font-bold font-mono text-xs bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            <span>🪙</span>
            <span>{profile.coins || 0}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
        </div>
      </motion.div>

      {/* Quick Log Modal for numeric habits */}
      {activeLogHabit && (
        <QuickLogModal
          isOpen={!!activeLogHabit}
          onClose={() => setActiveLogHabit(null)}
          habit={activeLogHabit}
          currentValue={logValues[activeLogHabit.id] || 0}
          onSave={handleSaveTimedHabit}
        />
      )}

      {/* Shop Modal */}
      {showShop && (
        <CoinShopModal
          isDark={isDark}
          profile={profile}
          coins={profile.coins || 0}
          onClose={() => setShowShop(false)}
          onCoinsChange={() => {}}
          onProfileUpdate={onProfileUpdate}
        />
      )}

    </div>
  );
}
