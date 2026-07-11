import { useState, useEffect, useCallback } from "react";
import { Footprints, Moon, Droplets, Smartphone, Check, Loader2, RefreshCw, Save } from "lucide-react";
import { getHealthLog, upsertHealthLog, getWeeklyHealthLogs, getHabits, toggleHabitLog, getTodayLogs } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { toDateStr } from "../../utils/date";

interface HealthPageProps {
  isDark: boolean;
  profile: Profile;
}

type Metric = "steps" | "sleep_hours" | "water_glasses" | "screen_time_hours";

const UZ_DAYS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

export function HealthPage({ isDark, profile }: HealthPageProps) {
  const { t, lang } = useLang();
  const today = toDateStr();

  const METRICS = [
    {
      key: "steps" as Metric,
      label: t('health_steps'),
      icon: Footprints,
      color: "#4ADE80",
      bg: "rgba(74,222,128,0.1)",
      border: "rgba(74,222,128,0.2)",
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
      color: "#A78BFA",
      bg: "rgba(167,139,250,0.1)",
      border: "rgba(167,139,250,0.2)",
      unit: t('health_sleep_unit'),
      goal: 8,
      max: 12,
      step: 0.5,
      habitKeywords: ["uyqu", "uxlash", "sleep"],
    },
    {
      key: "water_glasses" as Metric,
      label: t('health_water'),
      icon: Droplets,
      color: "#60A5FA",
      bg: "rgba(96,165,250,0.1)",
      border: "rgba(96,165,250,0.2)",
      unit: t('health_water_unit'),
      goal: 8,
      max: 15,
      step: 1,
      habitKeywords: ["suv", "water", "ichimlik"],
    },
    {
      key: "screen_time_hours" as Metric,
      label: t('health_screen'),
      icon: Smartphone,
      color: "#F97316",
      bg: "rgba(249,115,22,0.1)",
      border: "rgba(249,115,22,0.2)",
      unit: t('health_screen_unit'),
      goal: 4,
      max: 12,
      step: 0.5,
      habitKeywords: ["ekran", "screen", "telefon", "detoks"],
      invertGoal: true,
    },
  ];

  // Barcha 4ta ko'rsatkich birga tahrirlanadi (draft), DB'ga faqat pastdagi
  // umumiy "Saqlash" tugmasi bosilganda, va faqat shu safar tegilgan
  // (touched) maydonlar yuboriladi — boshqa qiymatlarni tasodifan
  // 0/null bilan bosib yubormaslik uchun.
  const [values, setValues] = useState<Record<Metric, number>>({
    steps: 0, sleep_hours: 0, water_glasses: 0, screen_time_hours: 0,
  });
  const [enteredKeys, setEnteredKeys] = useState<Set<Metric>>(new Set());
  const [touched, setTouched] = useState<Set<Metric>>(new Set());
  const [weekly, setWeekly] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoFillHabits, setAutoFillHabits] = useState<{ habit: any; metric: typeof METRICS[0] }[]>([]);
  const [autoFilling, setAutoFilling] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [activeMetric, setActiveMetric] = useState<Metric>("steps");
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logData, weeklyData, habitsData, todayLogsData] = await Promise.all([
        getHealthLog(profile.id, today),
        getWeeklyHealthLogs(profile.id),
        getHabits(profile.id),
        getTodayLogs(profile.id),
      ]);

      setValues({
        steps: logData?.steps ?? 0,
        sleep_hours: logData?.sleep_hours ?? 0,
        water_glasses: logData?.water_glasses ?? 0,
        screen_time_hours: logData?.screen_time_hours ?? 0,
      });
      const entered = new Set<Metric>();
      (["steps", "sleep_hours", "water_glasses", "screen_time_hours"] as Metric[]).forEach((k) => {
        if (logData?.[k] != null) entered.add(k);
      });
      setEnteredKeys(entered);
      setTouched(new Set());

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
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile.id, today]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleMetricChange(key: Metric, raw: number) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setEnteredKeys((prev) => new Set(prev).add(key));
    setTouched((prev) => new Set(prev).add(key));
    setSaved(false);
  }

  async function handleSaveAll() {
    if (touched.size === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload: Partial<Record<Metric, number>> = {};
      touched.forEach((k) => { payload[k] = values[k]; });
      await upsertHealthLog(profile.id, today, payload);
      setTouched(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const updated = await getWeeklyHealthLogs(profile.id);
      setWeekly(updated);
    } catch (e: any) {
      setSaveError(e?.message || t('health_save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoFill(habit: any, metric: typeof METRICS[0]) {
    if (!enteredKeys.has(metric.key)) return;
    const val = values[metric.key];
    setAutoFilling(habit.id);
    setSaveError("");
    try {
      const isDone = doneIds.has(habit.id);
      if (!isDone) {
        await toggleHabitLog(habit.id, profile.id, true, val, false);
        setDoneIds((prev) => new Set([...prev, habit.id]));
      }
    } catch (e: any) {
      setSaveError(e?.message || t('health_save_error'));
    } finally {
      setAutoFilling(null);
    }
  }

  const card: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 20,
  };

  const activeMetricDef = METRICS.find((m) => m.key === activeMetric)!;

  const weeklyForActive = (() => {
    const map: Record<string, number | null> = {};
    for (const row of weekly) map[row.log_date] = row[activeMetric] ?? null;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      days.push({ day: UZ_DAYS[d.getDay()], date: ds, val: map[ds] ?? null, isToday: ds === today });
    }
    return days;
  })();

  const maxVal = Math.max(...weeklyForActive.map((d) => d.val ?? 0), activeMetricDef.goal, 1);

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
    <div className="max-w-2xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('health_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {new Date().toLocaleDateString({ uz: "uz-UZ", ru: "ru-RU", en: "en-US" }[lang], { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={loadData}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: "var(--muted-foreground)" }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Metrics grid — barchasi bir vaqtda tahrirlanadi, DB'ga yozilmaydi
          toki pastdagi umumiy "Saqlash" tugmasi bosilmaguncha */}
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((metric) => {
          const isEntered = enteredKeys.has(metric.key);
          const val = isEntered ? values[metric.key] : null;
          const status = getStatus(val, metric);
          const pct = val !== null ? Math.min(1, val / metric.goal) : 0;
          const isTouched = touched.has(metric.key);

          return (
            <div
              key={metric.key}
              className="p-4 rounded-2xl transition-all"
              style={{
                ...card,
                border: isTouched ? `1px solid ${metric.border.replace("0.2", "0.5")}` : card.border,
              }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: metric.bg }}
                >
                  <metric.icon size={16} style={{ color: metric.color }} />
                </div>
                {status && (
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {status.emoji}
                  </span>
                )}
              </div>

              <p
                className="text-xl font-bold leading-none"
                style={{ color: val !== null ? metric.color : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}
              >
                {formatVal(val, metric)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                {metric.label} · {t('health_goal_label')} {formatVal(metric.goal, metric)} {metric.unit}
              </p>

              <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct * 100}%`, background: metric.color, opacity: metric.invertGoal ? (pct <= 1 ? 1 : 0.4) : 1 }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={metric.max}
                step={metric.step}
                value={values[metric.key]}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  const v = metric.key === "steps" || metric.key === "water_glasses" ? Math.round(raw) : raw;
                  handleMetricChange(metric.key, v);
                }}
                className="w-full mt-3"
                style={{ accentColor: metric.color }}
              />
            </div>
          );
        })}
      </div>

      {/* Persistent save — DB'ga yozish faqat shu tugma bosilganda, faqat
          tegilgan (touched) ko'rsatkichlar yuboriladi */}
      <button
        onClick={handleSaveAll}
        disabled={saving || touched.size === 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: saved
            ? isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7"
            : touched.size > 0 ? "#4ADE80" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
          color: saved ? "#4ADE80" : touched.size > 0 ? "#0a0a0a" : "var(--muted-foreground)",
          border: saved ? "1px solid rgba(74,222,128,0.4)" : "none",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? t('notes_saving') : saved ? t('notes_saved') : t('save')}
      </button>
      {saveError && (
        <p className="text-xs text-center" style={{ color: "var(--coral-red)" }}>⚠ {saveError}</p>
      )}

      {/* Weekly chart */}
      <div className="p-5 rounded-2xl" style={card}>
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                background: activeMetric === m.key ? m.bg : "transparent",
                color: activeMetric === m.key ? m.color : "var(--muted-foreground)",
                border: `1px solid ${activeMetric === m.key ? m.border : "transparent"}`,
              }}
            >
              <m.icon size={11} /> {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-1.5" style={{ height: 80 }}>
          {weeklyForActive.map((d, i) => {
            const pct = d.val !== null ? (d.val / maxVal) : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span
                  className="text-[9px]"
                  style={{ color: d.val !== null ? activeMetricDef.color : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace", minHeight: 12 }}
                >
                  {d.val !== null ? (activeMetricDef.key === "steps" ? (d.val >= 1000 ? `${(d.val / 1000).toFixed(1)}k` : d.val) : d.val) : ""}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: 52 }}>
                  <div
                    className="w-full rounded-t-md transition-all duration-500"
                    style={{
                      height: `${Math.max(pct * 100, d.val !== null ? 8 : 0)}%`,
                      background: d.val !== null
                        ? activeMetricDef.color
                        : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                      opacity: d.val !== null && !d.isToday ? 0.45 : 1,
                    }}
                  />
                </div>
                <span
                  className="text-[9px]"
                  style={{ color: d.isToday ? activeMetricDef.color : "var(--muted-foreground)" }}
                >
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-fill habits */}
      {autoFillHabits.length > 0 && (
        <div className="p-4 rounded-2xl flex flex-col gap-3" style={card}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('health_autofill_heading')}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('health_autofill')}
            </p>
          </div>
          {autoFillHabits.map(({ habit, metric }) => {
            const val = enteredKeys.has(metric.key) ? values[metric.key] : null;
            const isDone = doneIds.has(habit.id);
            const isAutoFilling = autoFilling === habit.id;
            return (
              <div
                key={habit.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: metric.bg }}
                >
                  {habit.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{habit.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {metric.label}: {val !== null ? `${formatVal(val, metric)} ${metric.unit}` : t('health_not_entered')}
                  </p>
                </div>
                <button
                  onClick={() => handleAutoFill(habit, metric)}
                  disabled={isDone || val === null || isAutoFilling}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0"
                  style={{
                    background: isDone ? "rgba(74,222,128,0.1)" : val === null ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)") : metric.bg,
                    color: isDone ? "#4ADE80" : val === null ? "var(--muted-foreground)" : metric.color,
                    border: `1px solid ${isDone ? "rgba(74,222,128,0.2)" : "transparent"}`,
                    opacity: isAutoFilling ? 0.6 : 1,
                  }}
                >
                  {isAutoFilling ? <Loader2 size={11} className="animate-spin" /> : isDone ? <><Check size={11} /> {t('done')}</> : t('health_fill')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tips */}
      <div className="p-4 rounded-2xl" style={{ ...card, background: isDark ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.04)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "#A78BFA" }}>{t('health_tips')}</p>
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
  );
}
