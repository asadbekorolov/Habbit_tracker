import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Footprints, Moon, Droplets, Smartphone, Check, Loader2, RefreshCw, Save, Activity, Heart, Flame, Lightbulb, X, Plus } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { healthSyncService } from "../../services/healthSyncService";
import { screenTimeService } from "../../services/screenTimeService";
import { getHealthLog, upsertHealthLog, getWeeklyHealthLogs, getHabits, toggleHabitLog, getTodayLogs } from "../../services/db";
import { motion, AnimatePresence } from "framer-motion";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { toDateStr } from "../../utils/date";
import { HabitIcon } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";

interface HealthPageProps {
  isDark: boolean;
  profile: Profile;
}

type Metric = "steps" | "sleep_hours" | "water_glasses" | "screen_time_hours" | "heart_rate" | "calories";

const WEEKDAY_LABELS = ['Sh', 'Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju'];

// Saturday = 0, Sunday = 1, Monday = 2, Tuesday = 3, Wednesday = 4, Thursday = 5, Friday = 6
const getCustomDayIndex = (date: Date) => {
  const jsDay = date.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
  return jsDay === 6 ? 0 : jsDay + 1;
};

export function HealthPage({ isDark, profile }: HealthPageProps) {
  const { t, lang } = useLang();
  const today = toDateStr();

  const METRICS = [
    {
      key: "heart_rate" as Metric,
      label: "Yurak urishi",
      icon: Heart,
      color: "#F43F5E", // rose-500
      unit: "BPM",
      goal: 72,
      max: 200,
      step: 1,
      habitKeywords: [],
    },
    {
      key: "steps" as Metric,
      label: t('health_steps'),
      icon: Footprints,
      color: "#10B981", // emerald-500
      unit: t('health_steps_unit'),
      goal: 10000,
      max: 25000,
      step: 100,
      habitKeywords: ["qadam", "yurish", "walk", "steps"],
    },
    {
      key: "sleep_hours" as Metric,
      label: t('health_sleep'),
      icon: Moon,
      color: "#818CF8", // indigo-400
      unit: "Chuqur uyqu",
      goal: 8,
      max: 12,
      step: 0.5,
      habitKeywords: ["uyqu", "uxlash", "sleep"],
    },
    {
      key: "water_glasses" as Metric,
      label: "Suv balansi",
      icon: Droplets,
      color: "#22D3EE", // cyan-400
      unit: "litr",
      goal: 3,
      max: 5,
      step: 0.1,
      habitKeywords: ["suv", "water", "ichimlik"],
    },
    {
      key: "calories" as Metric,
      label: "Kaloriyalar",
      icon: Flame,
      color: "#F59E0B", // amber-500
      unit: "kkal",
      goal: 2500,
      max: 5000,
      step: 50,
      habitKeywords: [],
    },
    {
      key: "screen_time_hours" as Metric,
      label: t('health_screen'),
      icon: Smartphone,
      color: "#A855F7", // purple-400
      unit: t('health_screen_unit'),
      goal: 4,
      max: 12,
      step: 0.5,
      habitKeywords: ["ekran", "screen", "telefon", "detoks"],
      invertGoal: true,
    },
  ];

  const [values, setValues] = useState<Record<Metric, number | null>>({
    steps: 0, sleep_hours: 0, water_glasses: 0, screen_time_hours: 0, heart_rate: null, calories: 0,
  });
  const [enteredKeys, setEnteredKeys] = useState<Set<Metric>>(new Set());
  const [touched, setTouched] = useState<Set<Metric>>(new Set());
  const [weekly, setWeekly] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoFillHabits, setAutoFillHabits] = useState<{ habit: any; metric: typeof METRICS[0] }[]>([]);
  const [autoFilling, setAutoFilling] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [activeMetric, setActiveMetric] = useState<Metric>("steps");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [tempValue, setTempVal] = useState<number | string>(0);

  const activeEditingMetricDef = editingMetric ? METRICS.find(m => m.key === editingMetric) : null;

  const openEditModal = (m: Metric) => {
    setEditingMetric(m);
    setTempVal(values[m] ?? (m === 'heart_rate' ? '' : 0));
  };

  const saveEditModal = async () => {
    if (!editingMetric) return;
    let finalVal: number | null = null;
    if (editingMetric === 'steps' || editingMetric === 'calories') {
      finalVal = parseInt(String(tempValue), 10) || 0;
    } else if (editingMetric === 'heart_rate') {
      const parsed = parseInt(String(tempValue), 10);
      finalVal = isNaN(parsed) || parsed <= 0 ? null : parsed;
    } else if (editingMetric === 'water_glasses') {
      finalVal = Math.round(Number(tempValue) * 10) / 10 || 0;
    } else {
      finalVal = Number(tempValue) || 0;
    }

    // 1. Instant local persistence
    const updatedValues = { ...values, [editingMetric]: finalVal };
    const todayKey = today;
    const userPayload = {
      ...updatedValues,
      userId: profile.id,
      date: todayKey,
      isManual: true,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(`health_metrics_user_${todayKey}`, JSON.stringify(userPayload));
    localStorage.setItem(`health_metrics_${todayKey}`, JSON.stringify(updatedValues));

    setValues(updatedValues);
    if (finalVal !== null) {
      setEnteredKeys((prev) => new Set(prev).add(editingMetric));
    }
    setTouched((prev) => new Set(prev).add(editingMetric));

    // 2. Background DB Upsert
    try {
      const supportedColumns = ["steps", "sleep_hours", "water_glasses", "screen_time_hours", "calories", "heart_rate"];
      if (supportedColumns.includes(editingMetric)) {
        await upsertHealthLog(profile.id, today, { [editingMetric]: finalVal });
        const updated = await getWeeklyHealthLogs(profile.id);
        setWeekly(updated);
        toast.success(t('log_metrics_saved'));
      }
    } catch (e) {
      console.warn("Modal save background error:", e);
      toast.success(t('log_metrics_saved'));
    }

    setEditingMetric(null);
  };

  const loadData = useCallback(async (silentSync = false) => {
    if (!silentSync) setLoading(true);

    const todayKey = today;
    const userKey = `health_metrics_user_${todayKey}`;
    const cacheKey = `health_metrics_${todayKey}`;

    const savedManual = localStorage.getItem(userKey);
    const cached = savedManual || localStorage.getItem(cacheKey);

    let isManual = !!savedManual;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const nextValues = {
          steps: parsed.steps ?? 0,
          sleep_hours: parsed.sleep_hours ?? (parsed.sleepMinutes ? parsed.sleepMinutes / 60 : 0),
          water_glasses: parsed.water_glasses ?? (parsed.waterLiters ? parsed.waterLiters * 4 : 0),
          screen_time_hours: parsed.screen_time_hours ?? (parsed.screenTimeMinutes ? parsed.screenTimeMinutes / 60 : 0),
          heart_rate: parsed.heart_rate ?? parsed.heartRate ?? null,
          calories: parsed.calories ?? 0,
        };

        setValues(nextValues);
        const entered = new Set<Metric>();
        (Object.keys(nextValues) as Metric[]).forEach((k) => {
          if (nextValues[k] != null) entered.add(k);
        });
        setEnteredKeys(entered);

        if (parsed.isManual) isManual = true;
      } catch (e) {
        console.warn("Failed to parse health cache", e);
      }
    }

    try {
      // 2. ONLY sync if not manual-saved today
      if (Capacitor.isNativePlatform() && !isManual) {
        try {
          await Promise.all([
            healthSyncService.syncAndSave(profile.id),
            (async () => {
              const st = await screenTimeService.getTodayScreenTime();
              await upsertHealthLog(profile.id, today, { screen_time_hours: st.hours + st.minutes / 60 });
            })()
          ]);
          setLastSynced(new Date());
        } catch (syncErr) {
          console.warn("Background health sync skipped:", syncErr);
        }
      }

      const [logData, weeklyData, habitsData, todayLogsData] = await Promise.all([
        getHealthLog(profile.id, today),
        getWeeklyHealthLogs(profile.id),
        getHabits(profile.id),
        getTodayLogs(profile.id),
      ]);

      // If we don't have manual local data, use DB data
      if (logData && !isManual) {
        const nextValues = {
          steps: logData.steps ?? 0,
          sleep_hours: logData.sleep_hours ?? 0,
          water_glasses: logData.water_glasses ?? 0,
          screen_time_hours: logData.screen_time_hours ?? 0,
          heart_rate: (logData as any).heart_rate ?? null,
          calories: (logData as any).calories ?? 0,
        };
        setValues(nextValues);

        // Update cache
        localStorage.setItem(cacheKey, JSON.stringify(nextValues));

        const entered = new Set<Metric>();
        (Object.keys(nextValues) as Metric[]).forEach((k) => {
          if ((logData as any)?.[k] != null) entered.add(k);
        });
        setEnteredKeys(entered);
        setTouched(new Set());
      }


      setWeekly(weeklyData);

      const done = new Set<string>();
      for (const l of todayLogsData || []) {
        if (l.completed) done.add(l.habit_id);
      }
      setDoneIds(done);

      const matches: { habit: any; metric: typeof METRICS[0] }[] = [];
      for (const habit of (habitsData || []).filter((h: any) => h.type === "positive" && h.is_active)) {
        const nameLower = habit.name.toLowerCase();
        for (const metric of METRICS) {
          if (metric.habitKeywords.some((kw) => nameLower.includes(kw))) {
            matches.push({ habit, metric });
            break;
          }
        }
      }
      setAutoFillHabits(matches);
    } catch (e) {
      console.error("Failed to load health data from Supabase:", e);
    } finally {
      if (!silentSync) setLoading(false);
    }
  }, [profile.id, today]);

  async function handleRequestScreenTime() {
    await screenTimeService.requestPermission();
    // In a real app, this might show an alert before redirecting
  }

  useEffect(() => {
    loadData();

    // Auto-refresh when window regains focus (e.g. user returns from Health app)
    const onFocus = () => loadData(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  function handleMetricChange(key: Metric, raw: number) {
    const nextValues = { ...values, [key]: raw };
    setValues(nextValues);
    setEnteredKeys((prev) => new Set(prev).add(key));
    setTouched((prev) => new Set(prev).add(key));
    setSaved(false);

    // 1. ALWAYS persist to LocalStorage first (instant & fail-proof)
    const todayKey = today;
    try {
      localStorage.setItem(`health_metrics_${todayKey}`, JSON.stringify(nextValues));
    } catch (e) {
      console.warn("Failed to update local cache", e);
    }
  }

  async function handleSaveAll() {
    if (touched.size === 0) return;
    setSaving(true);

    const todayKey = today;
    const updatedAt = new Date().toISOString();

    const sanitizedValues = { ...values };
    if (sanitizedValues.steps !== undefined) {
      sanitizedValues.steps = parseInt(String(sanitizedValues.steps), 10) || 0;
    }
    if (sanitizedValues.calories !== undefined) {
      sanitizedValues.calories = parseInt(String(sanitizedValues.calories), 10) || 0;
    }
    if (sanitizedValues.heart_rate !== undefined && sanitizedValues.heart_rate !== null) {
      const parsed = parseInt(String(sanitizedValues.heart_rate), 10);
      sanitizedValues.heart_rate = isNaN(parsed) || parsed <= 0 ? null : parsed;
    }

    setValues(sanitizedValues);

    // 1. Double-check persistence to LocalStorage (Instant manual priority)
    try {
      const userPayload = {
        ...sanitizedValues,
        userId: profile.id,
        date: todayKey,
        isManual: true,
        updatedAt
      };
      localStorage.setItem(`health_metrics_user_${todayKey}`, JSON.stringify(userPayload));
      localStorage.setItem(`health_metrics_${todayKey}`, JSON.stringify(sanitizedValues));
    } catch (storageErr) {
      console.warn("LocalStorage save error:", storageErr);
    }

    // 2. Attempt Supabase sync gracefully without throwing user-facing red alerts
    try {
      const payload: Partial<Record<Metric, number>> = {};
      const supportedColumns = ["steps", "sleep_hours", "water_glasses", "screen_time_hours", "calories", "heart_rate"];

      touched.forEach((k) => {
        if (supportedColumns.includes(k)) {
          payload[k] = k === 'steps' || k === 'calories' || k === 'heart_rate'
            ? (parseInt(String(sanitizedValues[k]), 10) || 0)
            : sanitizedValues[k];
        }
      });

      if (Object.keys(payload).length > 0) {
        // Background sync with timeout
        const syncPromise = upsertHealthLog(profile.id, today, payload as any);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), 8000)
        );

        await Promise.race([syncPromise, timeoutPromise]);
      }

      setTouched(new Set());
      setSaved(true);
      toast.success(t('log_metrics_saved'));

      const updated = await getWeeklyHealthLogs(profile.id);
      setWeekly(updated);
    } catch (dbErr) {
      console.warn("Supabase background sync skipped/failed:", dbErr);
      // Still treat as saved to unblock the UI since it's in LocalStorage
      setTouched(new Set());
      setSaved(true);
      toast.info("Ma'lumotlar saqlandi (offline)");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function handleAutoFill(habit: any, metric: typeof METRICS[0]) {
    if (!enteredKeys.has(metric.key)) return;

    // 1. Sanitize and parse health value
    const rawVal = values[metric.key];
    const numericVal = parseFloat(String(rawVal).replace(/[^0-9.]/g, '')) || 0;

    const target = habit.target_value || 1;

    // 2. Normalize units (e.g. sleep hours to minutes if habit is in minutes)
    let finalVal = numericVal;
    if (metric.key === 'sleep_hours' && habit.unit === 'daqiqa') {
      finalVal = numericVal * 60;
    }

    // 3. Strict target comparison
    const dbVal = Math.round(finalVal);
    const completed = dbVal >= target;

    setAutoFilling(habit.id);
    try {
      const isDone = doneIds.has(habit.id);

      // 4. Persistence & Global State Mutate
      await toggleHabitLog(habit.id, profile.id, completed, dbVal, isDone);

      if (completed) {
        setDoneIds((prev) => new Set([...prev, habit.id]));
      } else {
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.delete(habit.id);
          return next;
        });
      }
      toast.success(t('log_metrics_saved'));
    } catch (e: any) {
      toast.error(t('health_save_error'));
      console.error(e);
    } finally {
      setAutoFilling(null);
    }
  }

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.95)" : "#ffffff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 24,
    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.03)",
  };

  const activeMetricDef = METRICS.find((m) => m.key === activeMetric)!;

  const currentDayIndex = getCustomDayIndex(new Date());

  const weekDaysData = (() => {
    const logMap: Record<string, number | null> = {};
    for (const row of weekly) {
      if (row.log_date) logMap[row.log_date] = row[activeMetric] ?? null;
    }
    if (values[activeMetric] !== undefined && values[activeMetric] !== null) {
      const curVal = activeMetric === 'steps' || activeMetric === 'calories' || activeMetric === 'heart_rate'
        ? (parseInt(String(values[activeMetric]), 10) || 0)
        : values[activeMetric];
      logMap[today] = curVal;
    }

    const todayDate = new Date();
    return WEEKDAY_LABELS.map((label, idx) => {
      const offsetDays = idx - currentDayIndex;
      const d = new Date(todayDate);
      d.setDate(d.getDate() + offsetDays);
      const dateStr = toDateStr(d);
      const stepsVal = logMap[dateStr] ?? (dateStr === today ? values[activeMetric] : 0);

      return {
        label,
        steps: stepsVal ?? 0,
        date: dateStr,
        isToday: idx === currentDayIndex,
      };
    });
  })();

  function formatVal(v: number | null, metric: typeof METRICS[0]) {
    if (v === null) return "—";
    if (metric.key === "steps") return v.toLocaleString("uz-UZ");
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  }

  function getStatus(v: number | null, metric: typeof METRICS[0]) {
    if (v === null) return null;
    const pct = v / metric.goal;
    if (metric.invertGoal) {
      if (v <= metric.goal) return { emoji: "✅", label: t('health_good') };
      if (v <= metric.goal * 1.25) return { emoji: "⚠️", label: t('health_bit_much') };
      return { emoji: "🔴", label: t('health_too_much') };
    }
    if (pct >= 1) return { emoji: "✅", label: t('health_goal_reached') };
    if (pct >= 0.7) return { emoji: "🔥", label: t('health_almost') };
    return { emoji: "💪", label: t('health_keep_going') };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl flex flex-col gap-6 pb-[calc(env(safe-area-inset-bottom,20px)+110px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t('health_title')}</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-1 uppercase tracking-widest">
              {new Date().toLocaleDateString({ uz: "uz-UZ", ru: "ru-RU", en: "en-US" }[lang], { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <button
            onClick={() => loadData()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center glass border-white/10 active:rotate-180 duration-500 transition-all hover:bg-white/5"
          >
            <RefreshCw size={18} className="text-slate-400" />
          </button>
        </div>

        {lastSynced && (
          <div className="flex justify-center -mt-3">
              <span className="text-[10px] font-bold opacity-80 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full flex items-center gap-2 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 Samsung Health bilan sinxronlandi · {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
          </div>
        )}

        {/* Metrics grid — Refined Apple Health Minimal Style */}
        <div className="grid grid-cols-2 gap-4 px-1">
          {METRICS.map((metric) => {
            const isEntered = enteredKeys.has(metric.key);
            const val = isEntered ? values[metric.key] : (metric.key === 'heart_rate' ? values.heart_rate : 0);
            const isTouched = touched.has(metric.key);
            const pct = val ? Math.min(1, val / metric.goal) : 0;
            const theme = getCategoryTheme(getHabitCategory(metric.label, ''));

            return (
              <motion.div
                layout
                key={metric.key}
                onClick={() => openEditModal(metric.key)}
                className="bg-white dark:bg-[#161B22]/60 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-2xl group relative overflow-hidden h-44 cursor-pointer active:scale-[0.98]"
                style={{
                  borderColor: isTouched ? `${metric.color}44` : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                }}
              >
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md dark:shadow-lg transition-transform group-hover:scale-110 duration-300 relative overflow-hidden"
                    style={{ background: `${metric.color}15`, border: `1px solid ${metric.color}33` }}
                  >
                    <div className="absolute inset-0 bg-white/5" />
                    <metric.icon className="w-5 h-5" style={{ color: metric.color }} strokeWidth={2.5} />
                  </div>
                  {metric.key === 'heart_rate' && (
                    val ? (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                        Barqaror
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                        Bugun kiritilmagan
                      </span>
                    )
                  )}
                </div>

                <div className="space-y-1 relative z-10">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Geist Mono', monospace" }}>
                      {metric.key === 'heart_rate'
                        ? (val ? `${val}` : '--')
                        : metric.key === 'steps'
                        ? (val || 0).toLocaleString()
                        : (metric.key === 'sleep_hours'
                            ? `${Math.floor(val || 0)}s ${Math.round(((val || 0) % 1) * 60)}d`
                            : (metric.key === 'screen_time_hours'
                                ? `${Math.floor(val || 0)}s ${Math.round(((val || 0) % 1) * 60)}d`
                                : (val || 0))
                          )
                      }
                    </span>
                    {metric.key !== 'screen_time_hours' && metric.key !== 'sleep_hours' && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {metric.unit}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 opacity-80 dark:opacity-60">
                    {metric.key === 'sleep_hours' ? 'CHUQUR UYQU' :
                     metric.key === 'screen_time_hours' ? 'EKRAN VAQTI' :
                     metric.label}
                  </p>
                </div>

                {/* READ-ONLY static progress bar */}
                <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative z-10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, pct * 100)}%` }}
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      background: metric.color,
                      boxShadow: `0 0 10px ${metric.color}44`,
                      opacity: metric.invertGoal ? (pct > 1 ? 0.4 : 1) : 1
                    }}
                  />
                </div>

                {/* Subtle background glow */}
                <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none"
                  style={{ background: metric.color }} />
              </motion.div>
            );
          })}
        </div>

        {/* Persistent save */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSaveAll}
          disabled={saving || touched.size === 0}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all shadow-xl"
          style={{
            background: saved
              ? "rgba(16, 185, 129, 0.2)"
              : touched.size > 0 ? "linear-gradient(135deg, #10B981, #06B6D4)" : "rgba(255,255,255,0.05)",
            color: saved ? "#10B981" : touched.size > 0 ? "#000" : "var(--muted-foreground)",
            border: saved ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255,255,255,0.1)",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? t('notes_saving') : saved ? t('notes_saved') : t('save')}
        </motion.button>

        {/* Weekly chart */}
        <div className="p-6 rounded-[2rem] bg-white dark:bg-[#161B22]/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl">
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-all"
                style={{
                  background: activeMetric === m.key ? `${m.color}15` : "transparent",
                  color: activeMetric === m.key ? m.color : isDark ? "var(--muted-foreground)" : "#64748B",
                  border: `1px solid ${activeMetric === m.key ? `${m.color}30` : "transparent"}`,
                }}
              >
                <m.icon size={12} /> {m.label}
              </button>
            ))}
          </div>

          <div className="h-36 flex items-end justify-between gap-2 pt-4 pb-1 px-2">
            {weekDaysData.map((day, idx) => {
              const maxGoal = activeMetricDef.goal || 10000;
              const heightPercent = day.steps ? Math.min(100, Math.max(8, Math.round((day.steps / maxGoal) * 100))) : 0;
              const isToday = idx === currentDayIndex;

              return (
                <div key={day.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                  {/* Step Count Tooltip / Value on top */}
                  {day.steps > 0 ? (
                    <span className="text-[10px] text-emerald-400 font-mono mb-1 font-bold">
                      {activeMetric === 'steps'
                        ? (day.steps > 999 ? `${(day.steps / 1000).toFixed(1)}k` : day.steps)
                        : (day.steps % 1 === 0 ? day.steps : day.steps.toFixed(1))}
                    </span>
                  ) : (
                    <span className="text-[10px] mb-1 font-mono invisible">0</span>
                  )}

                  {/* Bar Pill */}
                  <div className="w-full max-w-[20px] bg-slate-800/80 rounded-full flex items-end overflow-hidden h-24">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-full transition-all duration-500 ${
                        isToday
                          ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                          : 'bg-slate-700'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <span className={`text-[11px] mt-2 font-medium ${isToday ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auto-fill habits */}
        {autoFillHabits.length > 0 && (
          <div className="p-5 rounded-[2.5rem] bg-white dark:bg-[#161B22]/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 flex flex-col gap-4 shadow-sm dark:shadow-2xl">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">{t('health_autofill_heading')}</p>
              <p className="text-[11px] mt-1 text-slate-500 font-medium">
                {t('health_autofill')}
              </p>
            </div>
            {autoFillHabits.map(({ habit, metric }) => {
              const val = enteredKeys.has(metric.key) ? values[metric.key] : null;
              const isDone = doneIds.has(habit.id);
              const isAutoFilling = autoFilling === habit.id;
              const cat = getHabitCategory(habit.name, habit.emoji);
              const theme = getCategoryTheme(cat);

              return (
                <div
                  key={habit.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05]"
                >
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
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{habit.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {metric.label}: {val !== null ? `${formatVal(val, metric)} ${metric.unit}` : t('health_not_entered')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAutoFill(habit, metric)}
                    disabled={isDone || val === null || isAutoFilling}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 transition-all active:scale-95 border"
                    style={{
                      background: isDone ? "rgba(16, 185, 129, 0.15)" : val === null ? "rgba(255,255,255,0.05)" : `${metric.color}20`,
                      color: isDone ? "#10B981" : val === null ? "var(--muted-foreground)" : metric.color,
                      borderColor: isDone ? "rgba(16, 185, 129, 0.3)" : "transparent",
                      opacity: isAutoFilling ? 0.6 : 1,
                    }}
                  >
                    {isAutoFilling ? <Loader2 size={12} className="animate-spin" /> : (
                      <>
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isDone ? 'hidden' : ''}`} />
                        {isDone ? <><Check size={12} strokeWidth={3} className="mr-1" /> {t('done')}</> : "Sinxronlash"}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips */}
        <div className="p-4 rounded-2xl" style={{ ...card, background: isDark ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.04)" }}>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#A78BFA" }}>
            <Lightbulb size={14} className="text-amber-400" />
            {t('health_tips')}
          </p>
          <ul className="flex flex-col gap-1.5">
            {[
              t('health_tip1'),
              t('health_tip2'),
              t('health_tip3'),
              t('health_tip4'),
            ].map((tip, i) => (
              <li key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                <span style={{ color: "#A78BFA", flexShrink: 0 }}>·</span> {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Edit Metric Modal */}
      <AnimatePresence>
        {editingMetric && activeEditingMetricDef && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingMetric(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full sm:max-w-md bg-[#0D1117] border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${activeEditingMetricDef.color}15`, border: `1px solid ${activeEditingMetricDef.color}33` }}>
                    <activeEditingMetricDef.icon size={20} style={{ color: activeEditingMetricDef.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{activeEditingMetricDef.label}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">{t('edit_short')}</p>
                  </div>
                </div>
                <button onClick={() => setEditingMetric(null)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Large Numeric Input */}
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      value={tempValue === '' || tempValue === null ? '' : tempValue}
                      placeholder={activeEditingMetricDef.key === 'heart_rate' ? "Masalan: 75" : "0"}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setTempVal(inputVal === '' ? '' : parseFloat(inputVal));
                      }}
                      className="bg-transparent border-none outline-none text-5xl font-black text-white text-center w-48 placeholder:text-slate-600"
                      style={{ fontFamily: "'Geist Mono', monospace" }}
                    />
                    <span className="text-lg font-bold text-slate-500 uppercase">{activeEditingMetricDef.unit}</span>
                  </div>
                  <div className="h-1 w-20 rounded-full bg-emerald-500/20" />
                </div>

                {/* Slider */}
                <div className="space-y-4">
                  <input
                    type="range"
                    min={0}
                    max={activeEditingMetricDef.max}
                    step={activeEditingMetricDef.step}
                    value={typeof tempValue === 'number' ? tempValue : 0}
                    onChange={(e) => setTempVal(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-2 bg-white/5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 font-mono uppercase tracking-widest">
                    <span>0 {activeEditingMetricDef.unit}</span>
                    <span>Max: {activeEditingMetricDef.max} {activeEditingMetricDef.unit}</span>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {activeEditingMetricDef.key === 'heart_rate' && [65, 72, 80, 90].map(v => (
                    <button key={v} onClick={() => setTempVal(v)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-300 active:scale-95 transition-all">
                      {v} BPM
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'water_glasses' && [0.25, 0.5, 1].map(v => (
                    <button key={v} onClick={() => setTempVal(prev => (typeof prev === 'number' ? prev : 0) + v)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-300 active:scale-95 transition-all">
                      +{v >= 1 ? `${v}L` : `${v*1000}ml`}
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'steps' && [500, 1000, 5000].map(v => (
                    <button key={v} onClick={() => setTempVal(prev => (typeof prev === 'number' ? prev : 0) + v)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-300 active:scale-95 transition-all">
                      +{v.toLocaleString()}
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'sleep_hours' && [0.5, 1, 7.5].map(v => (
                    <button key={v} onClick={() => setTempVal(v === 7.5 ? 7.5 : (typeof tempValue === 'number' ? tempValue : 0) + v)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-300 active:scale-95 transition-all">
                      {v === 7.5 ? "7s 30d" : v === 1 ? "+1s" : "+30m"}
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'calories' && [100, 250, 500].map(v => (
                    <button key={v} onClick={() => setTempVal(prev => (typeof prev === 'number' ? prev : 0) + v)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-300 active:scale-95 transition-all">
                      +{v} kkal
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingMetric(null)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold text-sm active:scale-95 transition-all"
                  >
                    {t('cancel_short')}
                  </button>
                  <button
                    onClick={saveEditModal}
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
