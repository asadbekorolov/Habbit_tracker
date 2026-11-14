import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Check, Flame, Loader2, Lock, Save, ChevronLeft, ChevronRight, Snowflake, WifiOff, X, SlidersHorizontal, Shield, ClipboardList, TrendingUp, AlertCircle, ShieldCheck, HeartCrack, Zap, Coins, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";
import { HABIT_FAILURE_COLOR, HABIT_SUCCESS_COLOR, getStreakFreezes, getMonthlyFreezeCount, getExtraFreezeCount, FREE_FREEZES_PER_MONTH, isLogDateLocked, computeHabitProgress, checkAndUnlockAchievements, getHealthLog, upsertHabitMetric, type HabitMetricKey } from "../../services/db";
import { tashkentTodayAnchor, toDateStr, addDays } from "../../utils/date";
import { habitSyncQueue } from "../../services/habitSyncQueue";
import { useHabitsQuery, useDayLogsQuery, useLogsRangeQuery, queryKeys } from "../../hooks/queries";
import type { Habit, Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { QuickLogModal } from "../../components/QuickLogModal";
import { EmptyState } from "../../components/EmptyState";
import { CalendarX2, History } from "lucide-react";

const HOUR_H = 64;

const BLOCK_COLORS = [
  "#0891B2", "#4F46E5", "#0D9488", "#059669",
  "#7C3AED", "#D97706", "#DB2777", "#0369A1",
];

function blockColor(idx: number) { return BLOCK_COLORS[idx % BLOCK_COLORS.length]; }

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmtTime(t: string) { return t.slice(0, 5); }

const UZ_DAYS_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const UZ_MONTHS = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

function getWeekDays(dateStr: string): Date[] {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + offset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return x;
  });
}

interface HabitsLogProps {
  profile: Profile;
  onCompletedChange: (completed: number, total: number) => void;
  onScoreChange?: (delta: number) => void;
  onStreakMilestone?: (name: string, emoji: string, days: number) => void;
}

export function HabitsLog({ profile, onCompletedChange, onScoreChange, onStreakMilestone }: HabitsLogProps) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [positiveHabits, setPositiveHabits] = useState<Habit[]>([]);
  const [negativeHabits, setNegativeHabits] = useState<Habit[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [logValues, setLogValues] = useState<Record<string, number>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [negStreaks, setNegStreaks] = useState<Record<string, number>>({});
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(() => toDateStr());
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeError, setFreezeError] = useState("");
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const [activeLogHabit, setActiveLogHabit] = useState<Habit | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const today = toDateStr();
  const isToday = selectedDate === today;
  const dateLocked = isLogDateLocked(selectedDate);

  // ─── Ma'lumot: yagona React Query keshi ─────────────────────────────
  // Kunlik loglar keshi navbatdagi (hali yuborilmagan) belgilarni ham o'z
  // ichiga oladi; har bosishda navbat keshni darhol yangilaydi, server rad
  // etsa — kesh serverdan qayta yuklanadi (queryClient.onHabitSyncRejected).
  const habitsQ = useHabitsQuery(profile.id);
  const dayLogsQ = useDayLogsQuery(profile.id, selectedDate);
  const historyQ = useLogsRangeQuery(profile.id, addDays(today, -30), today);
  const freezeQ = useQuery({
    queryKey: queryKeys.freezes(profile.id),
    queryFn: async () => {
      const [dates, monthly, extra] = await Promise.all([
        getStreakFreezes(profile.id),
        getMonthlyFreezeCount(profile.id),
        getExtraFreezeCount(profile.id),
      ]);
      return { dates: dates as string[], monthly, extra };
    },
    enabled: !!profile.id,
  });
  const freezeDates = new Set<string>(freezeQ.data?.dates || []);
  const monthlyFreezeCount = freezeQ.data?.monthly ?? 0;
  const extraFreezeCount = freezeQ.data?.extra ?? 0;
  const loading = habitsQ.isPending || dayLogsQ.isPending;

  useEffect(() => {
    if (!loading && timelineRef.current) {
      const now = new Date();
      const scrollTo = Math.max(0, (now.getHours() - 1) * HOUR_H);
      timelineRef.current.scrollTop = scrollTo;
    }
  }, [loading]);

  // Kesh o'zgarganda (yuklash, bosish, server javobi) ko'rinish holatini qayta hisoblaymiz.
  useEffect(() => {
    if (!habitsQ.data || !dayLogsQ.data) return;
    const sorted = habitsQ.data;
    const effectiveLogs = dayLogsQ.data;
    const historyData = historyQ.data || [];
    const freezeDatesData = freezeQ.data?.dates || [];

    const posHabits = sorted.filter((h: Habit) => h.type === "positive");
    const negHabits = sorted.filter((h: Habit) => h.type === "negative");
    setPositiveHabits(posHabits);
    setNegativeHabits(negHabits);

    const completed = new Set<string>();
    const logged = new Set<string>();
    const values: Record<string, number> = {};
    for (const log of effectiveLogs) {
      logged.add(log.habit_id);
      if (log.completed) completed.add(log.habit_id);
      values[log.habit_id] = log.value || (log.completed ? 1 : 0);
    }
    setCompletedIds(completed);
    setLoggedIds(logged);
    setLogValues(values);

    if (isToday) {
      const { completed: doneCount, total } = computeHabitProgress([...posHabits, ...negHabits], effectiveLogs);
      onCompletedChange(doneCount, total);
    }

    const todayStr = toDateStr();
    const byHabit: Record<string, Set<string>> = {};
    for (const log of historyData) {
      if (log.completed) {
        if (!byHabit[log.habit_id]) byHabit[log.habit_id] = new Set();
        byHabit[log.habit_id].add(log.log_date);
      }
    }
    for (const id of Array.from(completed)) {
      if (!byHabit[id]) byHabit[id] = new Set();
      byHabit[id].add(todayStr);
    }
    const newStreaks: Record<string, number> = {};
    const now = tashkentTodayAnchor();
    const freezeSet = new Set(freezeDatesData);
    for (const [habitId, days] of Object.entries(byHabit)) {
      let streak = 0;
      const startOffset = days.has(todayStr) ? 0 : 1;
      for (let i = startOffset; i < 31; i++) {
        const dd = new Date(now);
        dd.setDate(dd.getDate() - i);
        const ds = toDateStr(dd);
        if (days.has(ds) || freezeSet.has(ds)) streak++;
        else break;
      }
      if (streak > 0) newStreaks[habitId] = streak;
    }
    setStreaks(newStreaks);

    const negHabitIds = new Set(negHabits.map((h: Habit) => h.id));
    const negByHabit: Record<string, Set<string>> = {};
    for (const log of historyData) {
      if (negHabitIds.has(log.habit_id) && log.completed) {
        if (!negByHabit[log.habit_id]) negByHabit[log.habit_id] = new Set();
        negByHabit[log.habit_id].add(log.log_date);
      }
    }
    for (const log of effectiveLogs) {
      if (negHabitIds.has(log.habit_id) && log.completed) {
        if (!negByHabit[log.habit_id]) negByHabit[log.habit_id] = new Set();
        negByHabit[log.habit_id].add(selectedDate);
      }
    }
    const newNegStreaks: Record<string, number> = {};
    for (const [habitId, days] of Object.entries(negByHabit)) {
      let streak = 0;
      const startOffset = days.has(todayStr) ? 0 : 1;
      for (let i = startOffset; i < 31; i++) {
        const dd = new Date(now);
        dd.setDate(dd.getDate() - i);
        const ds = toDateStr(dd);
        if (days.has(ds)) streak++;
        else break;
      }
      if (streak > 0) newNegStreaks[habitId] = streak;
    }
    setNegStreaks(newNegStreaks);

    const yesterdayStr = toDateStr(new Date(now.getTime() - 86400000));
    const atRisk = Object.entries(byHabit).some(([, days]) =>
      days.size > 0 && !days.has(yesterdayStr) && !freezeSet.has(yesterdayStr)
    );
    setStreakAtRisk(atRisk);
  }, [habitsQ.data, dayLogsQ.data, historyQ.data, freezeQ.data, selectedDate, isToday]);

  function reportProgress(nextCompleted: Set<string>, nextLogged: Set<string>) {
    const allHabits = [...positiveHabits, ...negativeHabits];
    const logs = Array.from(nextLogged).map((id) => ({ habit_id: id, completed: nextCompleted.has(id) }));
    const { completed, total } = computeHabitProgress(allHabits, logs);
    onCompletedChange(completed, total);
  }

  function triggerAchievementCheck() {
    checkAndUnlockAchievements(profile.id).catch(() => {});
  }

  function toggleHabit(habitId: string, isNegative = false) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const wasDone = completedIds.has(habitId);
    const wasLogged = loggedIds.has(habitId);
    const newState = !wasDone;
    const resetting = wasDone && !newState;

    const snapshot = {
      completedIds: new Set(completedIds),
      loggedIds: new Set(loggedIds),
      streaks: { ...streaks },
    };

    const nextCompleted = new Set(completedIds);
    if (newState) nextCompleted.add(habitId); else nextCompleted.delete(habitId);
    const nextLogged = new Set(loggedIds);
    if (resetting) nextLogged.delete(habitId); else nextLogged.add(habitId);

    setCompletedIds(nextCompleted);
    setLoggedIds(nextLogged);
    if (!isNegative) reportProgress(nextCompleted, nextLogged);

    if (!isNegative) onScoreChange?.(newState ? 1 : -1);
    if (newState && !isNegative) {
      const ns = (streaks[habitId] || 0) + 1;
      setStreaks(p => ({ ...p, [habitId]: ns }));
      if ([7, 14, 21, 30].includes(ns)) {
        const h = positiveHabits.find(h => h.id === habitId);
        if (h) onStreakMilestone?.(h.name, h.emoji, ns);
      }
    } else if (!newState && !isNegative) {
      setStreaks(p => ({ ...p, [habitId]: Math.max(0, (p[habitId] || 1) - 1) }));
    }

    habitSyncQueue.enqueue({
      habitId,
      userId: profile.id,
      completed: newState,
      value: newState ? 1 : 0,
      prevCompleted: wasDone,
      isNegative,
      date: selectedDate,
      isDelete: resetting,
      snapshot,
      onRollback: (snap) => {
        if (snap.completedIds) setCompletedIds(snap.completedIds);
        if (snap.loggedIds) setLoggedIds(snap.loggedIds);
        if (snap.streaks) setStreaks(snap.streaks);
        if (!isNegative) reportProgress(snap.completedIds || completedIds, snap.loggedIds || loggedIds);
      },
      onSuccess: () => {
        if (newState) triggerAchievementCheck();
      },
    });
  }

  function handleValueChange(habit: Habit, newValue: number) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const target = habit.target_value || 1;
    const completed = newValue >= target;
    const prevCompleted = completedIds.has(habit.id);

    const snapshot = {
      completedIds: new Set(completedIds),
      loggedIds: new Set(loggedIds),
      logValues: { ...logValues },
      streaks: { ...streaks },
    };

    setLogValues(p => ({ ...p, [habit.id]: newValue }));
    const nextCompleted = new Set(completedIds);
    if (completed) nextCompleted.add(habit.id); else nextCompleted.delete(habit.id);
    setCompletedIds(nextCompleted);
    const nextLogged = new Set(loggedIds);
    nextLogged.add(habit.id);
    setLoggedIds(nextLogged);

    if (habit.type === "positive") reportProgress(nextCompleted, nextLogged);
    if (completed !== prevCompleted) {
      onScoreChange?.(completed ? 1 : -1);
      if (completed && habit.type === "positive") {
        const ns = (streaks[habit.id] || 0) + 1;
        setStreaks(p => ({ ...p, [habit.id]: ns }));
        if ([7, 14, 21, 30].includes(ns)) onStreakMilestone?.(habit.name, habit.emoji, ns);
      } else if (!completed && habit.type === "positive") {
        setStreaks(p => ({ ...p, [habit.id]: Math.max(0, (p[habit.id] || 1) - 1) }));
      }
    }

    habitSyncQueue.enqueue({
      habitId: habit.id,
      userId: profile.id,
      completed,
      value: newValue,
      prevCompleted,
      date: selectedDate,
      snapshot,
      onRollback: (snap) => {
        if (snap.completedIds) setCompletedIds(snap.completedIds);
        if (snap.loggedIds) setLoggedIds(snap.loggedIds);
        if (snap.logValues) setLogValues(snap.logValues);
        if (snap.streaks) setStreaks(snap.streaks);
        if (habit.type === "positive") reportProgress(snap.completedIds || completedIds, snap.loggedIds || loggedIds);
      },
      onSuccess: () => {
        if (completed) triggerAchievementCheck();
      },
    });
  }

  function markNegativeHabit(habitId: string, broke: boolean) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const alreadyLogged = loggedIds.has(habitId);
    const alreadyKept = alreadyLogged && completedIds.has(habitId);
    const alreadyBroke = alreadyLogged && !completedIds.has(habitId);
    const sameState = (broke && alreadyBroke) || (!broke && alreadyKept);

    const snapshot = {
      completedIds: new Set(completedIds),
      loggedIds: new Set(loggedIds),
    };

    if (sameState) {
      const nextLogged = new Set(loggedIds); nextLogged.delete(habitId);
      const nextCompleted = new Set(completedIds); nextCompleted.delete(habitId);
      setLoggedIds(nextLogged);
      setCompletedIds(nextCompleted);
      reportProgress(nextCompleted, nextLogged);

      habitSyncQueue.enqueue({
        habitId,
        userId: profile.id,
        completed: false,
        value: 0,
        isDelete: true,
        date: selectedDate,
        snapshot,
        onRollback: (snap) => {
          if (snap.completedIds) setCompletedIds(snap.completedIds);
          if (snap.loggedIds) setLoggedIds(snap.loggedIds);
          reportProgress(snap.completedIds || completedIds, snap.loggedIds || loggedIds);
        },
      });
    } else {
      const completed = !broke;
      const nextLogged = new Set(loggedIds); nextLogged.add(habitId);
      const nextCompleted = new Set(completedIds);
      if (completed) nextCompleted.add(habitId); else nextCompleted.delete(habitId);
      setLoggedIds(nextLogged);
      setCompletedIds(nextCompleted);
      reportProgress(nextCompleted, nextLogged);

      habitSyncQueue.enqueue({
        habitId,
        userId: profile.id,
        completed,
        value: completed ? 1 : 0,
        prevCompleted: alreadyKept,
        isNegative: true,
        date: selectedDate,
        snapshot,
        onRollback: (snap) => {
          if (snap.completedIds) setCompletedIds(snap.completedIds);
          if (snap.loggedIds) setLoggedIds(snap.loggedIds);
          reportProgress(snap.completedIds || completedIds, snap.loggedIds || loggedIds);
        },
        onSuccess: () => {
          if (completed) triggerAchievementCheck();
        },
      });
    }
  }

  function markPositiveFailed(habit: Habit) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const wasDone = completedIds.has(habit.id);
    const wasLogged = loggedIds.has(habit.id);
    const wasFailed = wasLogged && !wasDone;

    const snapshot = {
      completedIds: new Set(completedIds),
      loggedIds: new Set(loggedIds),
    };

    if (wasFailed) {
      const nextLogged = new Set(loggedIds); nextLogged.delete(habit.id);
      const nextCompleted = new Set(completedIds); nextCompleted.delete(habit.id);
      setLoggedIds(nextLogged);
      setCompletedIds(nextCompleted);
      reportProgress(nextCompleted, nextLogged);

      habitSyncQueue.enqueue({
        habitId: habit.id,
        userId: profile.id,
        completed: false,
        value: 0,
        isDelete: true,
        date: selectedDate,
        snapshot,
        onRollback: (snap) => {
          if (snap.completedIds) setCompletedIds(snap.completedIds);
          if (snap.loggedIds) setLoggedIds(snap.loggedIds);
          reportProgress(snap.completedIds || completedIds, snap.loggedIds || loggedIds);
        },
      });
    } else {
      const nextLogged = new Set(loggedIds); nextLogged.add(habit.id);
      const nextCompleted = new Set(completedIds); nextCompleted.delete(habit.id);
      setLoggedIds(nextLogged);
      setCompletedIds(nextCompleted);
      reportProgress(nextCompleted, nextLogged);

      habitSyncQueue.enqueue({
        habitId: habit.id,
        userId: profile.id,
        completed: false,
        value: 0,
        prevCompleted: wasDone,
        date: selectedDate,
        snapshot,
        onRollback: (snap) => {
          if (snap.completedIds) setCompletedIds(snap.completedIds);
          if (snap.loggedIds) setLoggedIds(snap.loggedIds);
          reportProgress(snap.completedIds || completedIds, snap.loggedIds || loggedIds);
        },
      });
    }
  }

  const scheduledHabits = positiveHabits.filter(h => h.scheduled_start && h.scheduled_end);
  const unscheduledHabits = positiveHabits.filter(h => !h.scheduled_start || !h.scheduled_end);

  const { completed: unifiedCompleted, total: unifiedTotal } = computeHabitProgress(
    [...positiveHabits, ...negativeHabits],
    Array.from(loggedIds).map((id) => ({ habit_id: id, completed: completedIds.has(id) }))
  );

  const selDateObj = new Date(selectedDate + "T00:00:00");
  const weekDays = getWeekDays(selectedDate);

  const card = {
    background: "rgba(22,27,34,0.95)",
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 20,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid rgba(255,255,255,0.1)`,
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTopPx = (currentMinutes / 60) * HOUR_H;

  return (
    <div className="flex flex-col gap-4 pb-28">

      {/* ─── Journal Header ─── */}
      <div style={{ ...card, background: "rgba(22,27,34,0.95)", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">
            {UZ_MONTHS[selDateObj.getMonth()]} {selDateObj.getFullYear()}
          </span>
          {selectedDate !== today && (
            <button type="button" onClick={() => setSelectedDate(today)}
              className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              BUGUN
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {weekDays.map((d, i) => {
            const ds = toDateStr(d);
            const isSel = ds === selectedDate;
            const isTod = ds === today;
            const isFuture = ds > today;

            return (
              <button
                type="button"
                key={i}
                onClick={() => !isFuture && setSelectedDate(ds)}
                disabled={isFuture}
                className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all ${
                  isTod
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 font-bold"
                    : isSel
                    ? "bg-emerald-600/80 text-white border border-emerald-400/40"
                    : "bg-transparent text-slate-400 hover:bg-slate-800/40"
                }`}
                style={{
                  opacity: isFuture ? 0.3 : 1,
                  cursor: isFuture ? "default" : "pointer",
                }}
              >
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isTod ? "text-emerald-100" : isSel ? "text-emerald-200" : "text-muted-foreground"
                }`}>
                  {UZ_DAYS_SHORT[d.getDay()]}
                </span>
                <span
                  className={`text-base font-black mt-1 ${
                    isTod || isSel ? "text-white" : "text-slate-200 dark:text-slate-300"
                  }`}
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate + "T00:00:00");
              d.setDate(d.getDate() - 7);
              const minDate = tashkentTodayAnchor(); minDate.setDate(minDate.getDate() - 30);
              if (d >= minDate) setSelectedDate(toDateStr(d));
            }}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-colors text-slate-500 bg-white/5"
          >
            <ChevronLeft size={14} /> Oldingi hafta
          </button>

          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate + "T00:00:00");
              d.setDate(d.getDate() + 7);
              if (toDateStr(d) <= today) setSelectedDate(toDateStr(d));
            }}
            disabled={toDateStr(weekDays[6]) >= today}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-colors text-slate-500 bg-white/5"
            style={{
              opacity: toDateStr(weekDays[6]) >= today ? 0.3 : 1,
            }}
          >
            Keyingi hafta <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="px-1">
        {unifiedTotal > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round((unifiedCompleted / unifiedTotal) * 100)}%`, background: "var(--neon-green)" }}
              />
            </div>
            <span className="text-[10px] font-black text-emerald-400 font-mono">
              {unifiedCompleted}/{unifiedTotal}
            </span>
          </div>
        )}

        {dateLocked && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 mb-2">
            <Lock size={16} className="text-slate-500" />
            <p className="text-xs text-slate-400">{t('log_locked_banner')}</p>
          </div>
        )}
      </div>

      {/* ─── Timeline ─── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Kun Tartibi</h3>
          </div>
          <button
            onClick={() => navigate('/habits')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-tighter"
          >
            <SlidersHorizontal size={14} />
            Tahrirlash
          </button>
        </div>

        <div style={card}>
          <div ref={timelineRef} className="overflow-y-auto" style={{ maxHeight: "40vh", position: "relative" }}>
            {scheduledHabits.length === 0 && (
              <div className="py-4">
                <EmptyState
                  title="Rejalashtirilgan odat yo'q"
                  subtitle="Ushbu vaqt oralig'i uchun yangi maqsad belgilashingiz mumkin"
                  icon={CalendarX2}
                />
              </div>
            )}

            {scheduledHabits.length > 0 && (
              <div className="relative" style={{ height: 24 * HOUR_H }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute flex w-full" style={{ top: h * HOUR_H, left: 0, right: 0 }}>
                    <span className="text-[10px] text-right shrink-0 pr-2 w-10 text-slate-700 font-mono">
                      {String(h).padStart(2, "0")}:00
                    </span>
                    <div className="flex-1 border-t border-white/[0.03]" />
                  </div>
                ))}
                {isToday && (
                  <div className="absolute flex items-center" style={{ top: currentTopPx, left: 0, right: 0, zIndex: 20 }}>
                    <div className="w-2 h-2 rounded-full bg-rose-500 ml-[2.4rem]" />
                    <div className="flex-1 h-px bg-rose-500/50" />
                  </div>
                )}
                {scheduledHabits.map((habit, idx) => {
                  const startMin = toMin(habit.scheduled_start!);
                  const endMin = toMin(habit.scheduled_end!);
                  const topPx = (startMin / 60) * HOUR_H;
                  const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_H, 36);
                  const done = completedIds.has(habit.id);
                  const logged = loggedIds.has(habit.id);
                  const missed = logged && !done;
                  const saving = savingIds.has(habit.id);
                  const color = blockColor(idx);
                  const isNumeric = (habit.target_value || 1) > 1 || !!habit.unit;

                  return (
                    <button
                      type="button" key={habit.id}
                      onClick={() => {
                        if (dateLocked || saving) return;
                        if (isNumeric) setActiveLogHabit(habit);
                        else toggleHabit(habit.id);
                      }}
                      className="absolute rounded-2xl overflow-hidden text-left transition-all active:scale-[0.98]"
                      style={{
                        top: topPx + 1, left: 48, right: 8, height: heightPx - 2,
                        background: done ? "rgba(16, 185, 129, 0.1)" : missed ? "rgba(244, 63, 94, 0.1)" : `${color}15`,
                        borderLeft: `4px solid ${done ? "#10B981" : missed ? "#F43F5E" : color}`,
                        border: `1px solid ${done ? "rgba(16, 185, 129, 0.2)" : missed ? "rgba(244, 63, 94, 0.2)" : "rgba(255,255,255,0.05)"}`,
                        zIndex: 10,
                      }}
                    >
                      <div className="flex items-center gap-2 px-3 h-full">
                        <HabitIcon emoji={habit.emoji} name={habit.name} size={12} noWrapper />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{cleanHabitName(habit.name)}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase">{fmtTime(habit.scheduled_start!)} - {fmtTime(habit.scheduled_end!)}</p>
                        </div>
                        {saving && <Loader2 size={12} className="animate-spin text-slate-500" />}
                        {done && <Check size={14} className="text-emerald-400" strokeWidth={3} />}
                        {missed && <X size={14} className="text-rose-400" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Positive habits ─── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp size={16} className="text-emerald-400" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Rivojlantiruvchi Odatlar</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {unscheduledHabits.length === 0 ? (
            <div className="py-2">
              <EmptyState
                title="Odatlar mavjud emas"
                subtitle="Kun tartibiga kirmagan ijobiy odatlaringiz bu yerda ko'rinadi"
                icon={ClipboardList}
              />
            </div>
          ) : (
            unscheduledHabits.map((habit) => {
              const done = completedIds.has(habit.id);
              const missed = loggedIds.has(habit.id) && !done;
              const saving = savingIds.has(habit.id);
              const currentVal = logValues[habit.id] || 0;
              const target = habit.target_value || 1;
              const isNumeric = target > 1 || !!habit.unit;
              const streak = streaks[habit.id] || 0;

              return (
                <motion.div
                  layout
                  key={habit.id}
                  className={`premium-card flex items-center gap-3 p-3.5 transition-all ${
                    done
                      ? "border-emerald-500/30 bg-emerald-950/20 dark:bg-emerald-950/20 text-emerald-400"
                      : missed
                      ? "border-rose-500/30 bg-rose-950/20 dark:bg-rose-950/20 text-rose-400"
                      : "group"
                  }`}
                  style={{ opacity: dateLocked ? 0.6 : 1 }}
                >
                  {/* Category Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                    done ? "bg-emerald-500/10 text-emerald-400" : missed ? "bg-rose-500/10 text-rose-400" : "bg-primary/10"
                  }`}>
                    <HabitIcon emoji={habit.emoji} name={habit.name} size={24} noWrapper />
                  </div>

                  {/* Title & Reward/Streak Badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{cleanHabitName(habit.name)}</p>
                    </div>
                    {isNumeric && (
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                        {currentVal} / {target} {habit.unit || 'daq'}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {done ? (
                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <CheckCircle2 size={12} /> Bajarildi (+1 Tanga, +5 XP)
                        </span>
                      ) : missed ? (
                        <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                          <X size={12} /> Bajarilmadi
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 text-[10px] font-black text-xp uppercase bg-xp/10 px-1.5 py-0.5 rounded">
                            <Zap size={10} className="fill-xp" /> +5 XP
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-black text-gold uppercase bg-gold/10 px-1.5 py-0.5 rounded">
                            <Coins size={12} className="fill-gold text-amber-400" /> +1
                          </span>
                        </>
                      )}
                      {streak >= 1 && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                          <Flame size={10} fill="currentColor" /> {streak}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Dual Action Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Success (Check) Button */}
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (dateLocked || saving) return;
                        if (isNumeric && !done) setActiveLogHabit(habit);
                        else toggleHabit(habit.id);
                      }}
                      disabled={saving || dateLocked}
                      whileTap={{ scale: 0.85 }}
                      title="Bajarildi"
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        done
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-500"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                      }`}
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                    </motion.button>

                    {/* Failed / Skip (X) Button */}
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (dateLocked || saving) return;
                        markPositiveFailed(habit);
                      }}
                      disabled={saving || dateLocked}
                      whileTap={{ scale: 0.85 }}
                      title="Bajarilmadi"
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        missed
                          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 border border-rose-500"
                          : "bg-rose-500/10 text-rose-400/70 border border-rose-500/20 hover:bg-rose-500 hover:text-white"
                      }`}
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={18} strokeWidth={3} />}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Negative habits ─── */}
      {negativeHabits.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle size={16} className="text-rose-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Cheklovlar / Salbiy Odatlar</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {negativeHabits.length === 0 ? (
              <div className="py-2">
                <EmptyState
                  title="Cheklovlar yo'q"
                  subtitle="Sizda hali zararli odatlarga qarshi kurash maqsadlari belgilanmagan"
                  icon={Shield}
                />
              </div>
            ) : (
              negativeHabits.map((habit) => {
                const isLogged = loggedIds.has(habit.id);
                const isKept = isLogged && completedIds.has(habit.id);
                const isBroke = isLogged && !completedIds.has(habit.id);
                const saving = savingIds.has(habit.id);
                const negStreak = negStreaks[habit.id] || 0;

                return (
                  <motion.div
                    layout
                    key={habit.id}
                    className={`premium-card flex items-center gap-3 p-3.5 transition-all ${
                      isKept
                        ? "border-emerald-500/30 bg-emerald-950/20 dark:bg-emerald-950/20 text-emerald-400"
                        : isBroke
                        ? "border-rose-500/30 bg-rose-950/20 dark:bg-rose-950/20 text-rose-400"
                        : "group"
                    }`}
                    style={{ opacity: dateLocked ? 0.6 : 1 }}
                  >
                    {/* Category Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                      isKept ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-500"
                    }`}>
                      <HabitIcon emoji={habit.emoji} name={habit.name} size={24} noWrapper />
                    </div>

                    {/* Title & Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{cleanHabitName(habit.name)}</p>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                          isKept
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          Cheklov
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        {isKept ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <ShieldCheck size={12} /> HP Saqlandi (+10 Tanga, +15 XP)
                          </span>
                        ) : isBroke ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                            <HeartCrack size={12} /> -15 HP (Buzildi)
                          </span>
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
                        {negStreak >= 1 && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <Shield size={10} className="fill-emerald-400/20" /> {negStreak}
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
                          if (dateLocked || saving) return;
                          markNegativeHabit(habit.id, false);
                        }}
                        disabled={saving || dateLocked}
                        whileTap={{ scale: 0.85 }}
                        title="Bajarildi (Cheklovga amal qilindi)"
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isKept
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-500"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                        }`}
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                      </motion.button>

                      {/* Failed / Breached (X) Button */}
                      <motion.button
                        type="button"
                        onClick={() => {
                          if (dateLocked || saving) return;
                          markNegativeHabit(habit.id, true);
                        }}
                        disabled={saving || dateLocked}
                        whileTap={{ scale: 0.85 }}
                        title="Buzildi"
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isBroke
                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 border border-rose-500"
                            : "bg-rose-500/10 text-rose-400/70 border border-rose-500/20 hover:bg-rose-500 hover:text-white"
                        }`}
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={18} strokeWidth={3} />}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })
            )}
        </div>
      </div>
      )}

      {/* ─── Numeric Metrics ─── */}
      <NumericMetrics inputStyle={inputStyle} profile={profile} logDate={selectedDate} locked={dateLocked} />

      <AnimatePresence>
        {activeLogHabit && (
          <QuickLogModal
            habit={activeLogHabit}
            initialValue={logValues[activeLogHabit.id] || 0}
            onSave={async (val) => handleValueChange(activeLogHabit, val)}
            onClose={() => setActiveLogHabit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NumericMetrics({ inputStyle, profile, logDate, locked }: { inputStyle: React.CSSProperties; profile: Profile; logDate: string; locked: boolean;
}) {
  const { t } = useLang();
  const [natureTime, setNatureTime] = useState(0);
  const [savedNature, setSavedNature] = useState(0);
  const [savingNature, setSavingNature] = useState(false);
  const [socialTime, setSocialTime] = useState(0);
  const [savedSocial, setSavedSocial] = useState(0);
  const [savingSocial, setSavingSocial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHealthLog(profile.id, logDate).then((log) => {
      if (cancelled) return;
      const n = log?.nature_time_minutes ?? 0;
      const s = log?.social_time_minutes ?? 0;
      setNatureTime(n); setSavedNature(n);
      setSocialTime(s); setSavedSocial(s);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile.id, logDate]);

  async function saveMetric(key: HabitMetricKey, value: number, setSaving: (v: boolean) => void, setSaved: (v: number) => void) {
    setSaving(true);
    try {
      await upsertHabitMetric(profile.id, key, logDate, value);
      setSaved(value);
      toast.success(t('log_metrics_saved'));
    } catch (e: any) {
      toast.info("Mahalliy saqlandi");
      setSaved(value);
    } finally {
      setSaving(false);
    }
  }

  const disabled = locked || loading;

  return (
    <div className="p-6 rounded-[2rem] glass" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center gap-2 mb-6">
        <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white">{t('log_metrics')}</h3>
      </div>
      <div className="space-y-10">
        <MetricSlider
          label={t('log_nature_time')} value={natureTime} onChange={setNatureTime}
          max={120} target={60} color="#10B981" unit={t('minutes')} step={5}
          dirty={natureTime !== savedNature} saving={savingNature} disabled={disabled}
          onSave={() => saveMetric('nature_time_minutes', natureTime, setSavingNature, setSavedNature)}
        />
        <MetricSlider
          label={t('log_social_time')} value={socialTime} onChange={setSocialTime}
          max={180} target={60} color="#C084FC" unit={t('minutes')} step={5}
          dirty={socialTime !== savedSocial} saving={savingSocial} disabled={disabled}
          onSave={() => saveMetric('social_time_minutes', socialTime, setSavingSocial, setSavedSocial)}
        />
      </div>
    </div>
  );
}

interface MetricSliderProps {
  label: string; value: number; onChange: (v: number) => void;
  max: number; target: number; color: string; unit: string;
  step?: number; dirty: boolean; saving: boolean; disabled: boolean; onSave: () => void;
}

function MetricSlider({ label, value, onChange, max, target, color, unit, step = 1, dirty, saving, disabled, onSave }: MetricSliderProps) {
  const { t } = useLang();
  const canSave = dirty && !saving && !disabled;

  return (
    <div style={{ opacity: disabled ? 0.6 : 1 }} className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-white text-sm">{label}</span>
        <div className="flex items-center gap-3">
           <span className="text-xs font-mono text-emerald-400 font-black">{value} / {target} {unit.slice(0,3)}</span>
           <button onClick={onSave} disabled={!canSave} className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400 disabled:opacity-30">
             {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
           </button>
        </div>
      </div>
      <input
        type="range" min={0} max={Math.max(max, value)} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10"
        style={{ accentColor: color }}
      />
    </div>
  );
}
