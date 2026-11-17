import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Footprints, Moon, Droplets, Smartphone, Check, Loader2, RefreshCw, Save,
  HeartPulse, Flame, Lightbulb, X, Plus, Minus, ChevronDown, ChevronUp, SlidersHorizontal
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { healthSyncService } from "../../services/healthSyncService";

import { getHealthLog, upsertHealthLog } from "../../services/db";
import { habitSyncQueue } from "../../services/habitSyncQueue";
import { useHabitsQuery, useDayLogsQuery, useHealthRangeQuery, queryKeys } from "../../hooks/queries";
import { motion, AnimatePresence } from "framer-motion";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { tashkentTodayAnchor, toDateStr, addDays } from "../../utils/date";
import { HabitIcon } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useHaptics } from "../../hooks/useHaptics";
import { useProfile } from "../../store/UserContext";

interface HealthPageProps {
}

type Metric = "steps" | "water_glasses" | "screen_time_hours" | "sleep_hours" | "calories" | "heart_rate";

const WEEKDAY_LABELS = ['Sh', 'Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju'];

const getCustomDayIndex = (date: Date) => {
  const jsDay = date.getDay();
  return jsDay === 6 ? 0 : jsDay + 1;
};

export function HealthPage({}: HealthPageProps) {
  const profile = useProfile();
  const { t, lang } = useLang();
  const haptics = useHaptics();
  const today = toDateStr();

  const METRICS = [
    {
      key: "steps" as Metric,
      label: t('health_steps_title'),
      icon: Footprints,
      color: "#10B981",
      unit: "qadam",
      goal: 10000,
      max: 25000,
      step: 100,
      habitKeywords: ["qadam", "yurish", "walk", "steps"],
    },
    {
      key: "water_glasses" as Metric,
      label: t('health_water_balance'),
      icon: Droplets,
      color: "#06B6D4",
      unit: "L",
      goal: 2.5,
      max: 5,
      step: 0.1,
      habitKeywords: ["suv", "water", "ichimlik"],
    },
    {
      key: "screen_time_hours" as Metric,
      label: t('health_screen_time'),
      icon: Smartphone,
      color: "#A855F7",
      unit: "soat",
      goal: 4,
      max: 12,
      step: 0.5,
      habitKeywords: ["ekran", "screen", "telefon", "detoks"],
      invertGoal: true,
    },
    {
      key: "sleep_hours" as Metric,
      label: t('health_deep_sleep'),
      icon: Moon,
      color: "#6366F1",
      unit: "soat",
      goal: 8,
      max: 12,
      step: 0.5,
      habitKeywords: ["uyqu", "uxlash", "sleep"],
    },
    {
      key: "calories" as Metric,
      label: t('health_calories'),
      icon: Flame,
      color: "#F59E0B",
      unit: "kkal",
      goal: 2500,
      max: 5000,
      step: 50,
      habitKeywords: [],
    },
    {
      key: "heart_rate" as Metric,
      label: t('health_heart_rate'),
      icon: HeartPulse,
      color: "#F43F5E",
      unit: "BPM",
      goal: 72,
      max: 200,
      step: 1,
      habitKeywords: [],
    },
  ];

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [values, setValues] = useState<Record<Metric, number | null>>({
    steps: 0,
    water_glasses: 0,
    screen_time_hours: 0,
    sleep_hours: null,
    calories: null,
    heart_rate: null,
  });

  const [enteredKeys, setEnteredKeys] = useState<Set<Metric>>(new Set());
  const [touched, setTouched] = useState<Set<Metric>>(new Set());

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoFilling, setAutoFilling] = useState<string | null>(null);

  // ─── Yagona kesh (React Query) ──────────────────────────────────────
  const queryClient = useQueryClient();
  const { data: habitsData } = useHabitsQuery(profile.id);
  const { data: todayLogs } = useDayLogsQuery(profile.id, today);
  const { data: weeklyData } = useHealthRangeQuery(profile.id, addDays(today, -6), today);
  const weekly: any[] = weeklyData || [];
  const refreshWeekly = () => queryClient.invalidateQueries({ queryKey: queryKeys.health(profile.id) });

  const doneIds = useMemo(() => {
    const done = new Set<string>();
    for (const l of todayLogs || []) if (l.completed) done.add(l.habit_id);
    return done;
  }, [todayLogs]);

  // Ko'rsatkichga mos keladigan ijobiy odatlar (masalan "qadam" -> steps).
  const autoFillHabits = useMemo(() => {
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
    return matches;
    // METRICS har renderda qayta yaratiladi, lekin faqat tilga bog'liq.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitsData, lang]);
  const [activeMetric, setActiveMetric] = useState<Metric>("steps");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [tempValue, setTempVal] = useState<number | string>(0);
  useScrollLock(!!editingMetric);

  const activeEditingMetricDef = editingMetric ? METRICS.find(m => m.key === editingMetric) : null;

  const openEditModal = (m: Metric) => {
    haptics.impactLight();
    setEditingMetric(m);
    setTempVal(values[m] ?? (m === 'heart_rate' || m === 'sleep_hours' || m === 'calories' ? '' : 0));
  };

  const saveEditModal = async () => {
    if (!editingMetric) return;
    let finalVal: number | null = null;
    if (editingMetric === 'steps' || editingMetric === 'calories') {
      const parsed = parseInt(String(tempValue), 10);
      finalVal = isNaN(parsed) || parsed < 0 ? null : parsed;
    } else if (editingMetric === 'heart_rate') {
      const parsed = parseInt(String(tempValue), 10);
      finalVal = isNaN(parsed) || parsed <= 0 ? null : parsed;
    } else if (editingMetric === 'water_glasses') {
      finalVal = Math.round((Number(tempValue) || 0) * 10) / 10;
    } else if (editingMetric === 'sleep_hours') {
      const parsed = parseFloat(String(tempValue));
      finalVal = isNaN(parsed) || parsed <= 0 ? null : parsed;
    } else {
      finalVal = Number(tempValue) || 0;
    }

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

    try {
      await upsertHealthLog(profile.id, today, { [editingMetric]: finalVal });
      refreshWeekly();
      toast.success(t('health_value_saved'));
    } catch (e) {
      console.warn("Background health upsert error:", e);
      toast.success(t('health_value_saved_offline'));
    }

    setEditingMetric(null);
  };

  const handleQuickWaterAdd = (delta: number) => {
    haptics.impactLight();
    const current = values.water_glasses || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    const updatedValues = { ...values, water_glasses: nextVal };

    setValues(updatedValues);
    setEnteredKeys((prev) => new Set(prev).add("water_glasses"));
    setTouched((prev) => new Set(prev).add("water_glasses"));

    const todayKey = today;
    localStorage.setItem(`health_metrics_user_${todayKey}`, JSON.stringify({
      ...updatedValues,
      userId: profile.id,
      date: todayKey,
      isManual: true,
      updatedAt: new Date().toISOString()
    }));

    upsertHealthLog(profile.id, today, { water_glasses: nextVal }).catch(() => {});
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
          water_glasses: parsed.water_glasses ?? 0,
          screen_time_hours: parsed.screen_time_hours ?? 0,
          sleep_hours: parsed.sleep_hours ?? null,
          calories: parsed.calories ?? null,
          heart_rate: parsed.heart_rate ?? null,
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
      if (Capacitor.isNativePlatform() && !isManual) {
        try {
          // Faqat Health Connect (qadam va uyqu). Ekran vaqtini Android ilovaga
          // bermaydi (UsageStats native ko'prigi yo'q) — u qo'lda kiritiladi.
          await healthSyncService.syncAndSave(profile.id);
          setLastSynced(new Date());
        } catch (syncErr) {
          console.warn("Background health sync skipped:", syncErr);
        }
      }

      const logData = await getHealthLog(profile.id, today);
      // Health Connect sinxronidan keyin haftalik grafik ham yangilansin.
      refreshWeekly();

      if (logData && !isManual) {
        const nextValues = {
          steps: logData.steps ?? 0,
          water_glasses: logData.water_glasses ?? 0,
          screen_time_hours: logData.screen_time_hours ?? 0,
          sleep_hours: logData.sleep_hours ?? null,
          calories: (logData as any).calories ?? null,
          heart_rate: (logData as any).heart_rate ?? null,
        };
        setValues(nextValues);

        localStorage.setItem(cacheKey, JSON.stringify(nextValues));

        const entered = new Set<Metric>();
        (Object.keys(nextValues) as Metric[]).forEach((k) => {
          if ((logData as any)?.[k] != null) entered.add(k);
        });
        setEnteredKeys(entered);
        setTouched(new Set());
      }

    } catch (e) {
      console.error("Failed to load health data:", e);
    } finally {
      if (!silentSync) setLoading(false);
    }
  }, [profile.id, today]);

  useEffect(() => {
    loadData();

    const onFocus = () => loadData(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  async function handleSaveAll() {
    if (touched.size === 0) return;
    setSaving(true);

    const todayKey = today;
    const updatedAt = new Date().toISOString();

    const sanitizedValues = { ...values };
    setValues(sanitizedValues);

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

    try {
      const payload: Partial<Record<Metric, number | null>> = {};
      touched.forEach((k) => {
        payload[k] = sanitizedValues[k];
      });

      if (Object.keys(payload).length > 0) {
        await upsertHealthLog(profile.id, today, payload as any);
      }

      setTouched(new Set());
      setSaved(true);
      toast.success(t('health_all_saved'));

      refreshWeekly();
    } catch (dbErr) {
      console.warn("Supabase background sync skipped/failed:", dbErr);
      setTouched(new Set());
      setSaved(true);
      toast.info(t('health_value_saved_offline'));
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function handleAutoFill(habit: any, metric: typeof METRICS[0]) {
    if (!enteredKeys.has(metric.key)) return;

    const rawVal = values[metric.key];
    const numericVal = parseFloat(String(rawVal).replace(/[^0-9.]/g, '')) || 0;
    const target = habit.target_value || 1;

    let finalVal = numericVal;
    if (metric.key === 'sleep_hours' && habit.unit === 'daqiqa') {
      finalVal = numericVal * 60;
    }

    const dbVal = Math.round(finalVal);
    const completed = dbVal >= target;

    setAutoFilling(habit.id);
    try {
      // Yagona yo'l — sinxronizatsiya navbati: kesh darhol yangilanadi,
      // header balansi server javobidan olinadi, oflaynda ham yo'qolmaydi.
      habitSyncQueue.enqueue({ habitId: habit.id, userId: profile.id, completed, value: dbVal, date: today });
      toast.success("Odat belgilandi");
    } catch (e: any) {
      toast.error("Odatni saqlashda xatolik");
      console.error(e);
    } finally {
      setAutoFilling(null);
    }
  }

  const activeMetricDef = METRICS.find((m) => m.key === activeMetric)!;
  const currentDayIndex = getCustomDayIndex(tashkentTodayAnchor());

  const weekDaysData = (() => {
    const logMap: Record<string, number | null> = {};
    for (const row of weekly) {
      if (row.log_date) logMap[row.log_date] = row[activeMetric] ?? null;
    }
    if (values[activeMetric] !== undefined && values[activeMetric] !== null) {
      logMap[today] = values[activeMetric];
    }

    const todayDate = tashkentTodayAnchor();
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

  const formatHourMin = (hrsVal: number | null) => {
    if (hrsVal === null || hrsVal === undefined) return "-- soat";
    const totalMinutes = Math.round(hrsVal * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}s ${m}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 size={28} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  const stepsVal = values.steps || 0;
  const stepsPct = Math.min(100, Math.round((stepsVal / 10000) * 100));

  const waterVal = values.water_glasses || 0;
  const waterPct = Math.min(100, Math.round((waterVal / 2.5) * 100));

  const screenVal = values.screen_time_hours || 0;
  const screenPct = Math.min(100, Math.round((screenVal / 4) * 100));

  return (
    <div className="max-w-2xl flex flex-col gap-5 pb-36">
      {/* Header Bar */}
      <PageHeader
        title={t('health_page_title')}
        subtitle={t('health_page_sub')}
        actions={
        <button
          type="button"
          onClick={() => loadData()}
          aria-label={t('health_sync_aria')}
          className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-emerald-400 active:rotate-180 duration-500 transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-4 h-4 stroke-[2]" />
        </button>
        }
      />

      {lastSynced && (
        <div className="flex justify-center -mt-2">
          <span className="text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-400 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Samsung Health · {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Primary Health Trio (Steps, Water Balance, Screen Time) */}
      <div className="space-y-3.5">
        {/* Card 1: Steps (Qadamlar) */}
        <div
          onClick={() => openEditModal("steps")}
          className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-3 relative overflow-hidden group hover:border-slate-700/80 transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Footprints className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {t('health_steps_title')}
              </span>
            </div>

            <span className="font-['Geist_Mono',monospace] font-mono text-xs font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              {stepsPct}%
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-['Geist_Mono',monospace] font-mono text-white tracking-tight">
              {stepsVal.toLocaleString("uz-UZ")}
            </span>
            <span className="text-xs font-['Geist_Mono',monospace] font-mono text-slate-400">
              {t('health_steps_goal')}
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stepsPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            />
          </div>
        </div>

        {/* 2-Column Split: Water Balance & Screen Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 2: Water Balance */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Droplets className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {t('health_water_balance')}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-['Geist_Mono',monospace] font-mono text-white tracking-tight">
                  {waterVal.toFixed(1)}
                </span>
                <span className="text-xs font-['Geist_Mono',monospace] font-mono text-slate-400">
                  / 2.5 L
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-2">
                <div
                  style={{ width: `${waterPct}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all duration-300"
                />
              </div>
            </div>

            {/* Quick Water Increment Buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleQuickWaterAdd(-0.25)}
                aria-label={t('health_decrease_aria')}
                className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => handleQuickWaterAdd(0.25)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-['Geist_Mono',monospace] font-mono text-xs font-bold active:scale-95 transition-all cursor-pointer text-center"
              >
                +0.25 L
              </button>
              <button
                type="button"
                onClick={() => handleQuickWaterAdd(0.5)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-['Geist_Mono',monospace] font-mono text-xs font-bold active:scale-95 transition-all cursor-pointer text-center"
              >
                +0.5 L
              </button>
            </div>
          </div>

          {/* Card 3: Screen Time */}
          <div
            onClick={() => openEditModal("screen_time_hours")}
            className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-slate-700/80 transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {t('health_screen_time')}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                {enteredKeys.has("screen_time_hours") ? (
                  <span className="text-2xl font-bold font-['Geist_Mono',monospace] font-mono text-white tracking-tight">
                    {formatHourMin(screenVal)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    {t('health_screen_not_entered')}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-['Geist_Mono',monospace] font-mono text-slate-400 mt-0.5">
                {t('health_screen_limit')}
              </p>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mt-2">
                <div
                  style={{ width: `${screenPct}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 shadow-[0_0_10px_rgba(168,85,247,0.4)] transition-all duration-300"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-medium pt-1">
              {t('health_screen_manual_hint')}
            </p>
          </div>
        </div>
      </div>

      {/* Progressive Disclosure Toggle for Advanced Sensors */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            haptics.impactLight();
            setShowAdvanced(!showAdvanced);
          }}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 text-xs font-bold text-slate-300 transition-all cursor-pointer shadow-md"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
            <span>{t('health_more_metrics')}</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400 stroke-[2]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 stroke-[2]" />
          )}
        </button>
      </div>

      {/* Advanced Metrics Drawer (Sleep, Calories, Heart Rate / BPM) */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 overflow-hidden"
          >
            {/* Sleep Card */}
            <div
              onClick={() => openEditModal("sleep_hours")}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-lg space-y-2.5 cursor-pointer hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-200">{t('health_deep_sleep')}</span>
              </div>
              <div>
                <span className="text-lg font-bold font-['Geist_Mono',monospace] font-mono text-white">
                  {values.sleep_hours !== null && values.sleep_hours !== undefined
                    ? formatHourMin(values.sleep_hours)
                    : "-- soat"}
                </span>
                <p className="text-[10px] font-['Geist_Mono',monospace] font-mono text-slate-400 mt-0.5">
                  {t('health_sleep_goal')}
                </p>
              </div>
            </div>

            {/* Calories Card */}
            <div
              onClick={() => openEditModal("calories")}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-lg space-y-2.5 cursor-pointer hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-200">{t('health_calories')}</span>
              </div>
              <div>
                <span className="text-lg font-bold font-['Geist_Mono',monospace] font-mono text-white">
                  {values.calories !== null && values.calories !== undefined
                    ? `${values.calories} kkal`
                    : "-- kkal"}
                </span>
                <p className="text-[10px] font-['Geist_Mono',monospace] font-mono text-slate-400 mt-0.5">
                  {t('health_calories_goal')}
                </p>
              </div>
            </div>

            {/* Heart Rate / BPM Card */}
            <div
              onClick={() => openEditModal("heart_rate")}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-lg space-y-2.5 cursor-pointer hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-slate-200">{t('health_heart_rate')}</span>
              </div>
              <div>
                <span className="text-lg font-bold font-['Geist_Mono',monospace] font-mono text-white">
                  {values.heart_rate !== null && values.heart_rate !== undefined
                    ? `${values.heart_rate} BPM`
                    : "-- BPM"}
                </span>
                <p className="text-[10px] font-['Geist_Mono',monospace] font-mono text-slate-400 mt-0.5">
                  {t('health_heart_norm')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button if user manually touched values */}
      {touched.size > 0 && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSaveAll}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 stroke-[2.2]" />}
          <span>{saving ? t('notes_saving') : saved ? t('health_saved_short') : t('health_save_changes')}</span>
        </motion.button>
      )}

      {/* Weekly Visual Chart */}
      <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMetric(m.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeMetric === m.key
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800/40 border border-slate-800/60 text-slate-400 hover:text-white"
              }`}
            >
              <m.icon className="w-3.5 h-3.5 stroke-[2]" /> {m.label}
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
                {day.steps > 0 ? (
                  <span className="text-[10px] text-emerald-400 font-['Geist_Mono',monospace] font-mono mb-1 font-bold">
                    {activeMetric === 'steps'
                      ? (day.steps > 999 ? `${(day.steps / 1000).toFixed(1)}k` : day.steps)
                      : (day.steps % 1 === 0 ? day.steps : day.steps.toFixed(1))}
                  </span>
                ) : (
                  <span className="text-[10px] mb-1 font-mono invisible">0</span>
                )}

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

                <span className={`text-[11px] mt-2 font-medium ${isToday ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-fill Habits Section */}
      {autoFillHabits.length > 0 && (
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex flex-col gap-4 shadow-xl">
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider">{t('health_auto_habits')}</p>
            <p className="text-[11px] mt-0.5 text-slate-400 font-medium">
              {t('health_auto_habits_sub')}
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
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden"
                  style={{
                    background: theme.gradient,
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow
                  }}
                >
                  <theme.icon size={18} color={theme.color} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{habit.name}</p>
                  <p className="text-[10px] font-['Geist_Mono',monospace] font-mono text-slate-400 mt-0.5">
                    {metric.label}: {val !== null ? `${val} ${metric.unit}` : "kiritilmagan"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAutoFill(habit, metric)}
                  disabled={isDone || val === null || isAutoFilling}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all border cursor-pointer"
                  style={{
                    background: isDone ? "rgba(16, 185, 129, 0.15)" : val === null ? "rgba(255,255,255,0.05)" : `${metric.color}20`,
                    color: isDone ? "#10B981" : val === null ? "var(--muted-foreground)" : metric.color,
                    borderColor: isDone ? "rgba(16, 185, 129, 0.3)" : "transparent",
                    opacity: isAutoFilling ? 0.6 : 1,
                  }}
                >
                  {isAutoFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 ${isDone ? 'hidden' : ''}`} />
                      {isDone ? <><Check className="w-3.5 h-3.5 stroke-[3] mr-0.5" /> {t('done')}</> : "Sinxronlash"}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Metric Modal */}
      <AnimatePresence>
        {editingMetric && activeEditingMetricDef && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeEditingMetricDef.label}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingMetric(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 relative z-10 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center border"
                    style={{ background: `${activeEditingMetricDef.color}15`, borderColor: `${activeEditingMetricDef.color}33` }}
                  >
                    <activeEditingMetricDef.icon className="w-5 h-5" style={{ color: activeEditingMetricDef.color }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{activeEditingMetricDef.label}</h3>
                    <p className="text-xs text-slate-400 font-mono">{t('health_edit_value')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  data-modal-close-trigger
                  onClick={() => setEditingMetric(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      value={tempValue === '' || tempValue === null ? '' : tempValue}
                      placeholder={activeEditingMetricDef.key === 'heart_rate' ? t('health_example_ph') : "0"}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setTempVal(inputVal === '' ? '' : parseFloat(inputVal));
                      }}
                      className="bg-transparent border-none outline-none text-4xl font-bold text-white text-center w-48 font-['Geist_Mono',monospace] font-mono placeholder:text-slate-600"
                    />
                    <span className="text-sm font-bold text-slate-400 uppercase font-mono">{activeEditingMetricDef.unit}</span>
                  </div>
                  <div className="h-1 w-16 rounded-full bg-emerald-500/30" />
                </div>

                <div className="space-y-3">
                  <input
                    type="range"
                    min={0}
                    max={activeEditingMetricDef.max}
                    step={activeEditingMetricDef.step}
                    value={typeof tempValue === 'number' ? tempValue : 0}
                    onChange={(e) => setTempVal(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono uppercase">
                    <span>0 {activeEditingMetricDef.unit}</span>
                    <span>{t('health_max')} {activeEditingMetricDef.max} {activeEditingMetricDef.unit}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {activeEditingMetricDef.key === 'heart_rate' && [65, 72, 80, 90].map(v => (
                    <button key={v} type="button" onClick={() => setTempVal(v)} className="px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-mono font-bold text-slate-300 active:scale-95 transition-all cursor-pointer">
                      {v} BPM
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'water_glasses' && [0.25, 0.5, 1].map(v => (
                    <button key={v} type="button" onClick={() => setTempVal(prev => Math.round(((typeof prev === 'number' ? prev : 0) + v) * 10) / 10)} className="px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-mono font-bold text-slate-300 active:scale-95 transition-all cursor-pointer">
                      +{v >= 1 ? `${v}L` : `${v*1000}ml`}
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'steps' && [500, 1000, 5000].map(v => (
                    <button key={v} type="button" onClick={() => setTempVal(prev => (typeof prev === 'number' ? prev : 0) + v)} className="px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-mono font-bold text-slate-300 active:scale-95 transition-all cursor-pointer">
                      +{v.toLocaleString()}
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'sleep_hours' && [0.5, 1, 7.5].map(v => (
                    <button key={v} type="button" onClick={() => setTempVal(v === 7.5 ? 7.5 : Math.round(((typeof tempValue === 'number' ? tempValue : 0) + v) * 10) / 10)} className="px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-mono font-bold text-slate-300 active:scale-95 transition-all cursor-pointer">
                      {v === 7.5 ? t('health_sleep_ph') : v === 1 ? "+1s" : "+30m"}
                    </button>
                  ))}
                  {activeEditingMetricDef.key === 'calories' && [100, 250, 500].map(v => (
                    <button key={v} type="button" onClick={() => setTempVal(prev => (typeof prev === 'number' ? prev : 0) + v)} className="px-3.5 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-mono font-bold text-slate-300 active:scale-95 transition-all cursor-pointer">
                      +{v} {t('health_kcal')}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    data-modal-close-trigger
                    onClick={() => setEditingMetric(null)}
                    className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={saveEditModal}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
