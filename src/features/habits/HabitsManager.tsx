import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, CheckCircle2, XCircle, Pencil, Check, X,
  GripVertical, Sparkles, ChevronUp, ChevronDown, TrendingUp, Activity,
  ShieldAlert, Trees, Clock, Shield, ClipboardList,
  Footprints, Dumbbell, Utensils, Droplets, Moon, Target, BookOpen, PenTool, Music, Smartphone, Zap, Sun, Timer, Sunrise, Heart, ArrowRight, Flame, Trophy
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getHabits, addHabit, deleteHabit, updateHabit } from "../../services/db";
import { supabase } from "../../services/supabase";
import { toDateStr } from "../../utils/date";
import { sortByOrder, setHabitOrder } from "../../utils/habitOrder";
import type { Habit, Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { useHabits } from "../../hooks/useHabits";
import { useAddHabit } from "../../hooks/useAddHabit";
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "../../utils/analytics";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";
import { notificationService } from "../../services/notificationService";
import { Bell, BellOff } from "lucide-react";
import { AddHabitModal } from "../../components/AddHabitModal";

interface HabitsManagerProps {
  isDark: boolean;
  profile: Profile;
}

type Tpl = { emoji: string; name: string; metric: "check" | "count" | "time"; target: number; unit: string };

type PackHabit = Tpl & { type: "positive" | "negative" };
const GOAL_PACKS: { id: string; emoji: string; labelKey: string; descKey: string; color: string; habits: PackHabit[] }[] = [
  {
    id: "soghlom", emoji: "Activity", labelKey: "goal_healthy_life", descKey: "goal_healthy_life_desc", color: "#4ADE80",
    habits: [
      { emoji: "Footprints", name: "Yugurish",       metric: "check", target: 1,  unit: "",       type: "positive" },
      { emoji: "Droplets", name: "Suv ichish",      metric: "count", target: 8,  unit: "stakan", type: "positive" },
      { emoji: "Dumbbell", name: "Sport qilish",  metric: "time",  target: 30, unit: "",       type: "positive" },
      { emoji: "Sparkles", name: "Meditatsiya",     metric: "time",  target: 10, unit: "",       type: "positive" },
      { emoji: "Sunrise", name: "Erta turish",     metric: "check", target: 1,  unit: "",       type: "positive" },
      { emoji: "Moon", name: "Erta yotish",     metric: "check", target: 1,  unit: "",       type: "positive" },
    ],
  },
  {
    id: "samarali", emoji: "TrendingUp", labelKey: "goal_productivity", descKey: "goal_productivity_desc", color: "#60A5FA",
    habits: [
      { emoji: "BookOpen", name: "Kitob o'qish",    metric: "count", target: 20, unit: "bet",    type: "positive" },
      { emoji: "Code2", name: "Dasturlash amaliyoti", metric: "time",  target: 30, unit: "",       type: "positive" },
      { emoji: "Target", name: "Ingliz tili",      metric: "time",  target: 20, unit: "",       type: "positive" },
      { emoji: "PenTool", name: "Kundalik yozish", metric: "check", target: 1,  unit: "",       type: "positive" },
      { emoji: "Brain", name: "Podcast tinglash", metric: "time",  target: 20, unit: "",       type: "positive" },
    ],
  },
  {
    id: "stress", emoji: "Sparkles", labelKey: "goal_stress", descKey: "goal_stress_desc", color: "#A78BFA",
    habits: [
      { emoji: "Sparkles", name: "Meditatsiya",     metric: "time",  target: 15, unit: "",       type: "positive" },
      { emoji: "Footprints", name: "Piyoda yurish",   metric: "time",  target: 20, unit: "",       type: "positive" },
      { emoji: "Trees", name: "Tabiatda dam",     metric: "time",  target: 15, unit: "",       type: "positive" },
      { emoji: "Music", name: "Musiqa mashq",     metric: "time",  target: 20, unit: "",       type: "positive" },
      { emoji: "Smartphone", name: "Ijtimoiy tarmoqlar", metric: "time",  target: 30, unit: "",       type: "negative" },
    ],
  },
  {
    id: "detoks", emoji: "ShieldAlert", labelKey: "goal_detox", descKey: "goal_detox_desc", color: "#F87171",
    habits: [
      { emoji: "Smartphone", name: "Ijtimoiy tarmoqlar", metric: "time",  target: 30, unit: "",       type: "negative" },
      { emoji: "Gamepad2", name: "Ortiqcha o'yin",   metric: "time",  target: 60, unit: "",       type: "negative" },
      { emoji: "Coins", name: "Keraksiz xarid",   metric: "check", target: 1,  unit: "",       type: "negative" },
      { emoji: "Moon", name: "Erta yotish",      metric: "check", target: 1,  unit: "",       type: "positive" },
    ],
  },
];

function calculateSingleHabitStats(habit: Habit, logs: { log_date: string; completed: boolean }[]) {
  const completedDaysSet = new Set<string>();
  for (const log of logs) {
    if (log.completed) completedDaysSet.add(log.log_date);
  }

  const today = toDateStr();
  const now = new Date();

  // Current streak
  let streak = 0;
  const startOffset = completedDaysSet.has(today) ? 0 : 1;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    if (completedDaysSet.has(ds)) streak++;
    else break;
  }

  // Best streak
  const sortedDates = Array.from(completedDaysSet).sort();
  let bestStreak = sortedDates.length > 0 ? 1 : 0;
  let cur = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = Math.round((new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000);
    if (diff === 1) {
      cur++;
      if (cur > bestStreak) bestStreak = cur;
    } else {
      cur = 1;
    }
  }

  // 30-day history grid
  const days30: { dateStr: string; label: string; weekday: string; completed: boolean }[] = [];
  const UZ_MONTHS = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
  const UZ_DAYS = ["Ya","Du","Se","Ch","Pa","Ju","Sh"];

  let completed30Count = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const isDone = completedDaysSet.has(ds);
    if (isDone) completed30Count++;
    days30.push({
      dateStr: ds,
      label: `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`,
      weekday: UZ_DAYS[d.getDay()],
      completed: isDone,
    });
  }

  const completionPct = Math.round((completed30Count / 30) * 100);

  return {
    totalCompleted: completedDaysSet.size,
    streak,
    bestStreak: Math.max(bestStreak, streak),
    completionPct,
    days30,
  };
}

export function HabitsManager({ isDark, profile }: HabitsManagerProps) {
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: habitsData, isLoading: queryLoading } = useHabits(profile.id);
  const addHabitMutation = useAddHabit();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Individual Habit Analytics Modal State
  const [analyticsHabit, setAnalyticsHabit] = useState<Habit | null>(null);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [showGoalPack, setShowGoalPack] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [checkedPack, setCheckedPack] = useState<Set<number>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const card = {
    background: isDark ? "rgba(22,27,34,0.95)" : "#ffffff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 24,
    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.03)",
    padding: 24,
  };

  useEffect(() => {
    if (habitsData) {
      setHabits(sortByOrder(habitsData, profile.id));
      setLoading(false);
    } else if (queryLoading) {
      setLoading(true);
    }
  }, [habitsData, queryLoading, profile.id]);

  useEffect(() => {
    if (!analyticsHabit) {
      setHabitLogs([]);
      return;
    }
    setLogsLoading(true);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const startDate = toDateStr(fromDate);

    supabase
      .from('habit_logs')
      .select('log_date, completed, value')
      .eq('habit_id', analyticsHabit.id)
      .gte('log_date', startDate)
      .then(({ data }) => {
        setHabitLogs(data || []);
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [analyticsHabit]);

  const analyticsStats = useMemo(() => {
    if (!analyticsHabit) return null;
    return calculateSingleHabitStats(analyticsHabit, habitLogs);
  }, [analyticsHabit, habitLogs]);

  async function handleBulkAdd() {
    const goal = GOAL_PACKS.find((g) => g.id === selectedGoal);
    if (!goal) return;
    const toAdd = goal.habits.filter((_, i) => checkedPack.has(i));
    if (toAdd.length === 0) return;
    setBulkAdding(true);
    setAddError("");
    try {
      for (const h of toAdd) {
        const targetVal = h.metric === "check" ? 1 : h.target;
        const unitVal = h.metric === "time" ? "daqiqa" : h.metric === "count" ? h.unit : "";
        const habit = await addHabit(profile.id, h.name, h.emoji, h.type, targetVal, unitVal);
        setHabits((prev) => {
          const next = [...prev, habit];
          setHabitOrder(profile.id, next.map((x) => x.id));
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
      setShowGoalPack(false);
      setSelectedGoal(null);
      setCheckedPack(new Set());
    } catch (e: any) {
      setAddError(e?.message || t('habits_add_error'));
    }
    finally { setBulkAdding(false); }
  }

  async function handleDelete(habitId: string) {
    try {
      await deleteHabit(habitId);
      await notificationService.cancelHabitReminder(habitId);
      localStorage.removeItem(`reminder_${habitId}`);
      setHabits((prev) => {
        const next = prev.filter((h) => h.id !== habitId);
        setHabitOrder(profile.id, next.map((h) => h.id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
    } catch (e) { console.error(e); }
  }

  function startEditing(h: Habit) {
    setEditingId(h.id);
    setShowForm(true);
  }

  // Drag handlers
  function handleDragStart(habitId: string) { setDragId(habitId); }

  function handleDragOver(e: React.DragEvent, habitId: string) {
    e.preventDefault();
    if (habitId !== dragId) setDragOverId(habitId);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setHabits((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((h) => h.id === dragId);
      const toIdx   = arr.findIndex((h) => h.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      setHabitOrder(profile.id, arr.map((h) => h.id));
      return arr;
    });
    setDragId(null); setDragOverId(null);
  }

  function handleDragEnd() { setDragId(null); setDragOverId(null); }

  function moveHabit(habitId: string, direction: -1 | 1) {
    setHabits((prev) => {
      const habit = prev.find((h) => h.id === habitId);
      if (!habit) return prev;
      const sameType = prev.filter((h) => h.type === habit.type);
      const idx = sameType.findIndex((h) => h.id === habitId);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= sameType.length) return prev;
      const swapHabit = sameType[swapIdx];
      const arr = [...prev];
      const i1 = arr.findIndex((h) => h.id === habit.id);
      const i2 = arr.findIndex((h) => h.id === swapHabit.id);
      [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
      setHabitOrder(profile.id, arr.map((h) => h.id));
      return arr;
    });
  }

  const positiveHabits = habits.filter((h) => h.type === "positive");
  const negativeHabits = habits.filter((h) => h.type === "negative");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  const dragProps = { onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, onDragEnd: handleDragEnd, dragId, dragOverId, onMove: moveHabit };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="flex items-center justify-between gap-2 mb-1">
        {/* Left: Title & Subtitle */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Odatlarni Boshqarish</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Qo'shish, tahrirlash va tartibga solish</p>
        </div>

        {/* Right: Actions Group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Paket Button */}
          <button
            onClick={() => { setShowGoalPack(true); setSelectedGoal(null); setCheckedPack(new Set()); setAddError(""); }}
            className="px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Paket</span>
          </button>

          {/* Primary Habit Creation CTA */}
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 dark:text-white text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Yangi odat</span>
          </button>
        </div>
      </div>

      <AddHabitModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); }}
        onAdd={async (habitData) => {
          if (editingId) {
            const updates: any = {
              name: habitData.name,
              emoji: habitData.emoji,
              type: habitData.type,
              description: habitData.description,
              target_value: habitData.target_value,
              unit: habitData.unit,
              scheduled_start: habitData.scheduledStart || null,
              scheduled_end: habitData.scheduledEnd || null
            };
            const updated = await updateHabit(editingId, updates);
            setHabits((prev) => prev.map((h) => (h.id === editingId ? { ...h, ...updated } : h)));

            if (habitData.reminder) {
              localStorage.setItem(`reminder_${editingId}`, habitData.reminder);
              await notificationService.initNotifications();
              await notificationService.scheduleHabitReminder(editingId, habitData.name, habitData.reminder);
            } else {
              localStorage.removeItem(`reminder_${editingId}`);
              await notificationService.cancelHabitReminder(editingId);
            }
          } else {
            const habit = await addHabitMutation.mutateAsync({
              userId: profile.id,
              ...habitData
            });
            trackEvent('habit_created', { type: habitData.type }, profile.id);
            if (habitData.reminder) {
              localStorage.setItem(`reminder_${habit.id}`, habitData.reminder);
              await notificationService.initNotifications();
              await notificationService.scheduleHabitReminder(habit.id, habitData.name, habitData.reminder);
            }
          }
          queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
        }}
        isDark={isDark}
        initialData={editingId ? habits.find(h => h.id === editingId) : undefined}
      />

      {/* Individual Habit Analytics Modal */}
      {analyticsHabit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setAnalyticsHabit(null)}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden p-6"
            style={{
              background: isDark ? "#0D1117" : "#FFFFFF",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <HabitIcon emoji={analyticsHabit.emoji} name={analyticsHabit.name} size={24} />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {cleanHabitName(analyticsHabit.name)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      analyticsHabit.type === 'positive'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {analyticsHabit.type === 'positive' ? 'Ijobiy · Rivojlantiruvchi' : 'Salbiy · Cheklov'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAnalyticsHabit(null)}
                data-modal-close-trigger
                aria-label="Close"
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {logsLoading || !analyticsStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* 2x2 Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Jami Bajarilgan */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2 text-emerald-500">
                      <CheckCircle2 size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Jami Bajarilgan</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {analyticsStats.totalCompleted} <span className="text-xs font-normal text-slate-400">kun</span>
                    </p>
                  </div>

                  {/* Joriy Streak */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2 text-orange-500">
                      <Flame size={16} className="fill-orange-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Joriy Seriya</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {analyticsStats.streak} <span className="text-xs font-normal text-slate-400">kun 🔥</span>
                    </p>
                  </div>

                  {/* Record Streak */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                      <Trophy size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Eng Yaxshi Rekord</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {analyticsStats.bestStreak} <span className="text-xs font-normal text-slate-400">kun 🏆</span>
                    </p>
                  </div>

                  {/* Completion Pct */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2 text-cyan-500">
                      <TrendingUp size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Oylik Intizom</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {analyticsStats.completionPct}%
                    </p>
                  </div>
                </div>

                {/* 30-Day Mini Heatmap / History Grid */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      30 Kunlik Tarix va Natijalar
                    </span>
                    <span className="text-xs font-mono text-emerald-500 font-bold">
                      {analyticsStats.completionPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-10 gap-2">
                    {analyticsStats.days30.map((d, idx) => (
                      <motion.div
                        key={idx}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toast(`${d.label} (${d.weekday}): ${d.completed ? 'Bajarildi ✓' : 'Bajarilmadi'}`)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                          d.completed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                            : 'bg-slate-200/50 dark:bg-white/5 text-slate-400 border border-transparent'
                        }`}
                      >
                        {d.completed ? (
                          <Check size={12} strokeWidth={3} className="text-emerald-400" />
                        ) : (
                          <span className="text-[9px] font-bold">{d.weekday}</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Habit Configuration Summary */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Odat Parametrlari</p>
                  {analyticsHabit.target_value && (
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Maqsad:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {analyticsHabit.target_value} {analyticsHabit.unit || 'daqiqa'}
                      </span>
                    </div>
                  )}
                  {analyticsHabit.scheduled_start && (
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Vaqt oralig'i:</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">
                        {analyticsHabit.scheduled_start.slice(0, 5)} {analyticsHabit.scheduled_end ? `— ${analyticsHabit.scheduled_end.slice(0, 5)}` : ''}
                      </span>
                    </div>
                  )}
                  {analyticsHabit.description && (
                    <div className="pt-2 border-t border-slate-200 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {analyticsHabit.description}
                    </div>
                  )}
                </div>

                {/* Edit & Close Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const h = analyticsHabit;
                      setAnalyticsHabit(null);
                      startEditing(h);
                    }}
                    className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
                  >
                    <Pencil size={14} />
                    <span>Tahrirlash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsHabit(null)}
                    className="py-3 px-5 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold text-xs active:scale-95 transition-all"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Goal Pack Modal */}
      {showGoalPack && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setShowGoalPack(false); setSelectedGoal(null); }}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ background: isDark ? "#161B22" : "#fff", maxHeight: "85vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                {selectedGoal && (
                  <button type="button" onClick={() => setSelectedGoal(null)}
                    className="p-1.5 rounded-lg mr-1"
                    style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}>
                    <X size={15} style={{ color: "var(--foreground)" }} />
                  </button>
                )}
                <div className="flex-1">
                  <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {selectedGoal ? t(GOAL_PACKS.find((g) => g.id === selectedGoal)?.labelKey as any) : t('habits_bundle_title')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {selectedGoal ? t(GOAL_PACKS.find((g) => g.id === selectedGoal)?.descKey as any) : t('habits_bundle_sub')}
                  </p>
                </div>
                <button type="button" onClick={() => { setShowGoalPack(false); setSelectedGoal(null); }}
                  className="p-1.5 rounded-lg"
                  style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}>
                  <X size={15} style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>

              {!selectedGoal ? (
                <div className="grid grid-cols-2 gap-3">
                  {GOAL_PACKS.map((g) => (
                    <button key={g.id} type="button"
                      onClick={() => {
                        setSelectedGoal(g.id);
                        setCheckedPack(new Set(g.habits.map((_, i) => i)));
                      }}
                      className="flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all"
                      style={{
                        background: isDark ? `${g.color}12` : `${g.color}18`,
                        border: `1px solid ${g.color}30`,
                      }}>
                      <HabitIcon emoji={g.emoji} size={28} noWrapper color={g.color} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t(g.labelKey as any)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t(g.descKey as any)}</p>
                        <p className="text-[10px] mt-1.5 font-semibold" style={{ color: g.color }}>
                          {g.habits.length} ta odat
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {(() => {
                    const goal = GOAL_PACKS.find((g) => g.id === selectedGoal)!;
                    return (
                      <div className="flex flex-col gap-2">
                        {goal.habits.map((h, i) => {
                          const checked = checkedPack.has(i);
                          return (
                            <button key={i} type="button"
                              onClick={() => setCheckedPack((prev) => {
                                const next = new Set(prev);
                                checked ? next.delete(i) : next.add(i);
                                return next;
                              })}
                              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                              style={{
                                background: checked
                                  ? isDark ? `${goal.color}12` : `${goal.color}10`
                                  : isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                                border: `1px solid ${checked ? `${goal.color}35` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                              }}>
                              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                style={{ background: checked ? goal.color : isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB" }}>
                                {checked && <Check size={12} style={{ color: "#0E1117" }} />}
                              </div>
                              <HabitIcon emoji={h.emoji} size={20} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{h.name}</p>
                                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                                  {h.metric === "check" ? t('habits_yesno_label')
                                    : h.metric === "time" ? `${h.target} daqiqa`
                                    : `${h.target} ${h.unit}`}
                                  {h.type === "negative" && <span className="ml-1.5 px-1 rounded text-[10px]" style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}>{t('habits_restriction_badge')}</span>}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                        {addError && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>⚠ {addError}</p>}
                        <button type="button"
                          onClick={handleBulkAdd}
                          disabled={bulkAdding || checkedPack.size === 0}
                          className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                          style={{
                            background: checkedPack.size === 0 ? "rgba(74,222,128,0.3)" : "var(--neon-green)",
                            color: "#0E1117",
                            opacity: bulkAdding ? 0.7 : 1,
                          }}>
                          {bulkAdding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                          {bulkAdding ? t('habits_bulk_adding') : `${checkedPack.size} ${t('habits_bulk_add_btn')}`}
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Positive habits */}
      <div style={card}>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={16} style={{ color: "var(--neon-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('habits_positive_section')}</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", color: "var(--neon-green)" }}>
            {positiveHabits.length} ta
          </span>
        </div>
        {positiveHabits.length === 0
          ? <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('habits_no_positive')}</p>
          : (
            <div className="space-y-2">
              {positiveHabits.map((h) => (
                <HabitRow key={h.id} habit={h} isDark={isDark}
                  onStartEdit={startEditing} onDelete={handleDelete}
                  onSelectAnalytics={setAnalyticsHabit}
                  accentColor="rgba(74,222,128" rowBg={isDark ? "rgba(74,222,128,0.04)" : "#F0FDF4"} rowBorder="rgba(74,222,128,0.1)"
                  {...dragProps} />
              ))}
            </div>
          )
        }
      </div>

      {/* Negative habits */}
      <div style={{ ...card, border: `1px solid ${isDark ? "rgba(248,113,113,0.12)" : "rgba(248,113,113,0.2)"}` }}>
        <div className="flex items-center gap-2 mb-4">
          <XCircle size={16} style={{ color: "var(--coral-red)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('habits_negative_section')}</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2", color: "var(--coral-red)" }}>
            {negativeHabits.length} ta
          </span>
        </div>
        {negativeHabits.length === 0
          ? <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('habits_no_negative')}</p>
          : (
            <div className="space-y-2">
              {negativeHabits.map((h) => (
                <HabitRow key={h.id} habit={h} isDark={isDark}
                  onStartEdit={startEditing} onDelete={handleDelete}
                  onSelectAnalytics={setAnalyticsHabit}
                  accentColor="rgba(248,113,113" rowBg={isDark ? "rgba(248,113,113,0.04)" : "#FFF5F5"} rowBorder="rgba(248,113,113,0.1)"
                  {...dragProps} />
              ))}
            </div>
          )
        }
      </div>

      {/* Unified CTA Button to Journal - Vibrant Emerald Hero */}
      <button
        type="button"
        onClick={() => navigate('/journal')}
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
            {habits.length} ta odat
          </span>
          <ArrowRight className="w-4 h-4 text-white stroke-[2.5] shrink-0" />
        </div>
      </button>
    </div>
  );
}

interface HabitRowProps {
  habit: Habit;
  isDark: boolean;
  onStartEdit: (h: Habit) => void;
  onDelete: (id: string) => void;
  onSelectAnalytics: (h: Habit) => void;
  accentColor: string;
  rowBg: string;
  rowBorder: string;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  dragId: string | null;
  dragOverId: string | null;
  onMove: (habitId: string, direction: -1 | 1) => void;
}

function HabitRow({
  habit, isDark,
  onStartEdit, onDelete, onSelectAnalytics,
  accentColor, rowBg, rowBorder, onDragStart, onDragOver, onDrop, onDragEnd, dragId, dragOverId, onMove,
}: HabitRowProps) {
  const { t } = useLang();
  const isDragging = dragId === habit.id;
  const isDragOver = dragOverId === habit.id;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(habit.id)}
      onDragOver={(e) => onDragOver(e, habit.id)}
      onDrop={(e) => onDrop(e, habit.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelectAnalytics(habit)}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl group transition-all relative overflow-hidden cursor-pointer active:scale-[0.99]"
      style={{
        background: rowBg,
        border: `1px solid ${isDragOver ? `${accentColor},0.5)` : rowBorder}`,
        opacity: isDragging ? 0.4 : 1,
        transform: isDragOver ? "scale(1.01)" : "scale(1)",
        boxShadow: isDragOver ? `0 0 0 2px ${accentColor},0.3)` : "none",
      }}
    >
      {/* Card Accent Glow */}
      <div className="absolute left-0 top-0 bottom-0 w-1 opacity-20" style={{ background: getCategoryTheme(getHabitCategory(habit.name, habit.emoji)).color }} />

      {/* Sleek single grip icon for reordering */}
      <GripVertical size={16} className="text-slate-400 dark:text-slate-600 opacity-50 hover:opacity-100 shrink-0 cursor-grab mr-0.5" />

      <HabitIcon emoji={habit.emoji} name={habit.name} size={20} />

      {/* Vertical 2-row layout: Title and Target Subtext split */}
      <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
        <h4 className="text-slate-900 dark:text-white font-medium text-sm leading-tight line-clamp-2">
          {cleanHabitName(habit.name)}
        </h4>
        {((habit.target_value && (habit.target_value > 1 || habit.unit)) || habit.scheduled_start) && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {habit.target_value && (habit.target_value > 1 || habit.unit) ? (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                {habit.target_value} {habit.unit || 'daqiqa'}
              </span>
            ) : null}
            {habit.scheduled_start && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 inline-flex bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                <Clock size={10} /> {habit.scheduled_start.slice(0, 5)}{habit.scheduled_end ? ` — ${habit.scheduled_end.slice(0, 5)}` : ""}
              </span>
            )}
          </div>
        )}
        {habit.description && (
          <p className="text-xs mt-0.5 truncate text-slate-500 dark:text-slate-400">{habit.description}</p>
        )}
      </div>

      {/* Compact Action Controls */}
      <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-80 md:group-hover:opacity-100 transition-all">
        <button
          type="button"
          aria-label={t('edit')}
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit(habit);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          aria-label={t('delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(habit.id);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
