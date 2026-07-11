import { useState, useEffect, useMemo, useRef } from "react";
import { Flame, Trophy, ArrowRight, Loader2, CalendarDays, CheckCircle2, Check, Lightbulb, TrendingUp, AlertTriangle, Search, X, Shield } from "lucide-react";
import { getLast30DaysLogs, getHabits, getTodayLogs, toggleHabitLog, searchUsers, getStreakFreezes, computeHabitProgress } from "../../services/db";
import { sortByOrder } from "../../utils/habitOrder";
import { getLevel } from "../../utils/levels";
import { toDateStr } from "../../utils/date";
import { supabase } from "../../services/supabase";
import type { Habit, Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { DAYS_SHORT } from "../../utils/i18n";

interface DashboardProps {
  isDark: boolean;
  profile: Profile;
  completedToday: number;
  totalHabits: number;
  onNavigate: (tab: string) => void;
  onCompletedChange?: (completed: number, total: number) => void;
  onUserClick?: (userId: string) => void;
}

export function Dashboard({ isDark, profile, completedToday, totalHabits, onNavigate, onCompletedChange, onUserClick }: DashboardProps) {
  const { t, lang } = useLang();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick habit toggle state
  const [todayHabits, setTodayHabits] = useState<Habit[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // Salbiy odatlar endi shu vidjetda ham ko'rsatiladi — HabitsLog.tsx'dagi
  // uch-holatli naqsh bilan bir xil: loggedIds (bugun bir marta belgilangan)
  // + completedIds (belgilanganlar orasida "buzilgan" bo'lganlari). Kutilmoqda
  // = loggedIds'da yo'q; Saqlanib qoldi = loggedIds'da bor-yu completedIds'da
  // yo'q; Buzildi = ikkalasida ham bor.
  const [negativeHabits, setNegativeHabits] = useState<Habit[]>([]);
  const [negLoggedIds, setNegLoggedIds] = useState<Set<string>>(new Set());
  const [negBrokeIds, setNegBrokeIds] = useState<Set<string>>(new Set());

  // Streak freeze — faqat o'qish uchun (joriy seriya hisobi va "muzlatilgan"
  // belgisi shu yerda kerak). Muzlatish AMALI faqat Jurnal (HabitsLog)da —
  // yagona manba, ikkala joyda alohida-alohida hisoblanmasin va sinxrondan
  // chiqib ketmasin.
  const [freezeDates, setFreezeDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [profile.id]);

  async function loadData() {
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

      const done = new Set<string>();
      const logged = new Set<string>();
      for (const l of todayLogsData || []) {
        logged.add(l.habit_id);
        if (l.completed) done.add(l.habit_id);
      }
      setDoneIds(done);
      setNegLoggedIds(logged);
      setNegBrokeIds(done);

      const progress = computeHabitProgress(sorted, todayLogsData || []);
      onCompletedChange?.(progress.completed, progress.total);

      setFreezeDates(new Set(freezeDatesData || []));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Search effect with debounce
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

  // Close search dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Header foizi uchun yagona hisoblash yo'li — db.ts'dagi computeHabitProgress
  // bilan bir xil (App.tsx/HabitsLog.tsx ham shuni ishlatadi), shu sababli uch
  // joy hech qachon bir-biridan ajralib qolmaydi.
  function reportProgress(nextDone: Set<string>, nextNegLogged: Set<string>, nextNegBroke: Set<string>) {
    const allHabits = [...todayHabits, ...negativeHabits];
    const posLogs = Array.from(nextDone).map((id) => ({ habit_id: id, completed: true }));
    const negLogs = Array.from(nextNegLogged).map((id) => ({ habit_id: id, completed: nextNegBroke.has(id) }));
    const { completed, total } = computeHabitProgress(allHabits, [...posLogs, ...negLogs]);
    onCompletedChange?.(completed, total);
  }

  async function handleQuickToggle(habit: Habit) {
    const wasDone = doneIds.has(habit.id);
    const nowDone = !wasDone;
    // For numeric habits: mark as fully completed (target_value) or 0
    const value = nowDone ? (habit.target_value || 1) : 0;

    const nextDone = new Set(doneIds);
    if (nowDone) nextDone.add(habit.id); else nextDone.delete(habit.id);
    setDoneIds(nextDone);
    reportProgress(nextDone, negLoggedIds, negBrokeIds);
    setSavingIds((prev) => new Set(prev).add(habit.id));

    try {
      await toggleHabitLog(habit.id, profile.id, nowDone, value, wasDone);
    } catch {
      setDoneIds(doneIds);
      reportProgress(doneIds, negLoggedIds, negBrokeIds);
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(habit.id); return n; });
    }
  }

  // Salbiy odat uchun uch-holatli belgi — HabitsLog.tsx'dagi markNegativeHabit
  // bilan bir xil naqsh: qayta bossa neytral ("Kutilmoqda")ga qaytaradi.
  async function handleQuickToggleNegative(habitId: string, broke: boolean) {
    const alreadyLogged = negLoggedIds.has(habitId);
    const alreadyBroke = negBrokeIds.has(habitId);
    const alreadyKept = alreadyLogged && !alreadyBroke;
    const sameState = (broke && alreadyBroke) || (!broke && alreadyKept);
    setSavingIds((prev) => new Set(prev).add(habitId));
    try {
      if (sameState) {
        await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('user_id', profile.id).eq('log_date', today);
        const nextLogged = new Set(negLoggedIds); nextLogged.delete(habitId);
        const nextBroke = new Set(negBrokeIds); nextBroke.delete(habitId);
        setNegLoggedIds(nextLogged);
        setNegBrokeIds(nextBroke);
        reportProgress(doneIds, nextLogged, nextBroke);
      } else {
        await toggleHabitLog(habitId, profile.id, broke, broke ? 1 : 0, alreadyBroke);
        const nextLogged = new Set(negLoggedIds); nextLogged.add(habitId);
        const nextBroke = new Set(negBrokeIds);
        if (broke) nextBroke.add(habitId); else nextBroke.delete(habitId);
        setNegLoggedIds(nextLogged);
        setNegBrokeIds(nextBroke);
        reportProgress(doneIds, nextLogged, nextBroke);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIds((prev) => { const n = new Set(prev); n.delete(habitId); return n; });
    }
  }

  const today = toDateStr();

  const completionByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      if (log.completed && log.habits?.type === "positive") {
        map[log.log_date] = (map[log.log_date] || 0) + 1;
      }
    }
    map[today] = completedToday;
    return map;
  }, [logs, completedToday, today]);

  const currentStreak = useMemo(() => {
    const now = new Date();
    let count = 0;
    const todayDone = (completionByDate[today] || 0) > 0 || freezeDates.has(today);
    const startOffset = todayDone ? 0 : 1;
    for (let i = startOffset; i < 31; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      if ((completionByDate[ds] || 0) > 0 || freezeDates.has(ds)) count++;
      else break;
    }
    return count;
  }, [completionByDate, freezeDates, today]);

  const bestStreak = useMemo(() => {
    const dates = Object.keys(completionByDate)
      .filter((d) => completionByDate[d] > 0)
      .sort();
    if (dates.length === 0) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round(
        (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000
      );
      if (diff === 1) { cur++; if (cur > best) best = cur; }
      else cur = 1;
    }
    return best;
  }, [completionByDate]);

  const totalMonth = useMemo(
    () => Object.values(completionByDate).reduce((s, v) => s + v, 0),
    [completionByDate]
  );

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

  const todayPercent = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
  const remaining = totalHabits - completedToday;
  const maxWeekly = Math.max(...weeklyData.map((d) => d.completed), totalHabits, 1);

  // Smart insights: per-habit streak & miss analysis
  type Insight = { type: "warning" | "tip" | "cheer"; text: string; emoji: string };
  const insights = useMemo((): Insight[] => {
    if (todayHabits.length === 0 || logs.length === 0) return [];

    const result: Insight[] = [];
    const now = new Date();

    for (const habit of todayHabits) {
      const habitLogs = logs.filter((l) => l.habit_id === habit.id && l.completed);
      const doneDates = new Set(habitLogs.map((l) => l.log_date as string));

      // calculate current streak for this habit
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = toDateStr(d);
        // skip today if not done yet
        if (i === 0 && !doneIds.has(habit.id)) continue;
        if (doneDates.has(ds)) streak++;
        else if (i > 0) break;
      }

      // days missed (not counting today)
      let missedDays = 0;
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = toDateStr(d);
        if (!doneDates.has(ds)) missedDays++;
        else break;
      }

      const notDoneToday = !doneIds.has(habit.id);

      // streak at risk: has streak ≥3 but not done today
      if (streak >= 3 && notDoneToday) {
        result.push({
          type: "warning",
          text: `${habit.emoji} ${habit.name} — ${streak} kunlik seriangiz xavf ostida!`,
          emoji: "🔥",
        });
      }
      // missed 3+ days
      else if (missedDays >= 3 && notDoneToday) {
        result.push({
          type: "tip",
          text: `${habit.emoji} ${habit.name} ${missedDays} kun bajarilmadi — bugun qayta boshlang!`,
          emoji: "⚠️",
        });
      }
      // near 7-day badge
      else if (streak === 6 && notDoneToday) {
        result.push({
          type: "cheer",
          text: `${habit.emoji} ${habit.name} — bugun bajarsangiz 7 kunlik nishon!`,
          emoji: "🎯",
        });
      }
    }

    // limit to 3 most relevant
    return result.slice(0, 3);
  }, [todayHabits, logs, doneIds]);

  const card = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">

      {/* Search */}
      <div ref={searchRef} style={{ position: "relative" }}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{
            background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
            border: `1px solid ${searchFocused ? "rgba(74,222,128,0.4)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)"}`,
            transition: "border-color 0.15s",
          }}>
          <Search size={15} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('dash_search_placeholder')}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--foreground)", fontSize: 13,
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

        {/* Results dropdown */}
        {searchFocused && searchQuery.trim() && (
          <div className="absolute left-0 right-0 mt-1 rounded-2xl overflow-hidden z-40"
            style={{
              background: isDark ? "#161B22" : "#fff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}>
            {searchResults.length === 0 && !searchLoading ? (
              <div className="px-4 py-5 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t('dash_search_empty').replace('{q}', searchQuery)}
              </div>
            ) : (
              searchResults.map((user) => {
                const lv = getLevel(user.score || 0);
                const initials = user.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <button key={user.id} type="button"
                    onClick={() => { onUserClick?.(user.id); setSearchFocused(false); setSearchQuery(""); setSearchResults([]); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: user.avatar_color || "#4ADE80", color: "#0E1117" }}>
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{user.display_name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{user.username}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${lv.color}18`, color: lv.color, border: `1px solid ${lv.color}33` }}>
                      {lv.emoji} Lv.{lv.level}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Hero */}
      <div
        className="p-6 rounded-2xl flex flex-col gap-5"
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(22,27,34,0.9) 60%)"
            : "linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(255,255,255,0.95) 60%)",
          border: `1px solid ${isDark ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.2)"}`,
          borderRadius: 16,
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
          {totalHabits === 0 ? (
            <>
              <p className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
                {t('dash_welcome')}
              </p>
              <p className="text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
                {t('dash_no_habits_sub')}
              </p>
              <button
                onClick={() => onNavigate("habits")}
                className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{
                  background: "rgba(74,222,128,0.15)",
                  color: "var(--neon-green)",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {t('dash_add_habit')} <ArrowRight size={14} />
              </button>
            </>
          ) : completedToday === totalHabits ? (
            <>
              <p className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
                {t('dash_all_done')}
              </p>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t('dash_all_done_sub').replace('{n}', String(totalHabits))}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
                {completedToday > 0 ? t('dash_keep_going') : t('dash_start_day')}
              </p>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                <span style={{ color: "#4ADE80", fontWeight: 600 }}>{completedToday} {t('pieces')}</span> {t('dash_completed')}
                {remaining > 0 && (
                  <>, <span style={{ color: "var(--coral-red)", fontWeight: 600 }}>{remaining} {t('pieces')}</span> {t('dash_left')}</>
                )}
              </p>
            </>
          )}
        </div>

        {totalHabits > 0 && (
          <button
            onClick={() => onNavigate("logs")}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--neon-green)",
              color: "#0E1117",
              boxShadow: "0 0 20px rgba(74,222,128,0.3)",
            }}
          >
            {t('dash_journal')} <ArrowRight size={15} />
          </button>
        )}
        </div>

        {/* Progress Bar (Ustunli Grafik) */}
        {totalHabits > 0 && (
          <div className="w-full pt-1">
            <div className="flex items-end justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                {t('dash_goal_progress')}
              </span>
              <span className="text-sm font-bold" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
                {todayPercent}%
              </span>
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden"
              style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${todayPercent}%`,
                  background: "#4ADE80",
                  boxShadow: "0 0 10px rgba(74,222,128,0.5)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-2">
          {insights.map((ins, i) => {
            const isWarning = ins.type === "warning";
            const isCheer = ins.type === "cheer";
            const bg = isWarning
              ? isDark ? "rgba(249,115,22,0.08)" : "#FFF7ED"
              : isCheer
              ? isDark ? "rgba(74,222,128,0.07)" : "#F0FDF4"
              : isDark ? "rgba(251,191,36,0.07)" : "#FFFBEB";
            const border = isWarning
              ? "rgba(249,115,22,0.25)"
              : isCheer
              ? "rgba(74,222,128,0.25)"
              : "rgba(251,191,36,0.25)";
            const Icon = isWarning ? AlertTriangle : isCheer ? TrendingUp : Lightbulb;
            const iconColor = isWarning ? "#F97316" : isCheer ? "#4ADE80" : "#FBBF24";
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Icon size={15} style={{ color: iconColor, flexShrink: 0 }} />
                <p className="text-xs font-medium leading-snug" style={{ color: "var(--foreground)" }}>
                  {ins.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick habit toggle — endi musbat VA salbiy odatlar */}
      {(todayHabits.length > 0 || negativeHabits.length > 0) && (
        <div className="p-4 rounded-2xl" style={card}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t('dash_today_habits')}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7",
                color: "var(--neon-green)",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {Array.from(doneIds).filter(id => todayHabits.some(h => h.id === id)).length
                + negativeHabits.filter(h => negLoggedIds.has(h.id) && !negBrokeIds.has(h.id)).length}
              /{todayHabits.length + negativeHabits.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {todayHabits.map((habit) => {
              const done = doneIds.has(habit.id);
              const saving = savingIds.has(habit.id);
              const isNumeric = (habit.target_value || 1) > 1 || !!habit.unit;
              return (
                <button
                  key={habit.id}
                  onClick={() => !saving && handleQuickToggle(habit)}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: done
                      ? isDark ? "rgba(74,222,128,0.1)" : "#F0FDF4"
                      : isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                    border: `1px solid ${done
                      ? "rgba(74,222,128,0.25)"
                      : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                    cursor: saving ? "default" : "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: done ? "var(--neon-green)" : "transparent",
                      border: `2px solid ${done ? "var(--neon-green)" : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                    }}
                  >
                    {saving
                      ? <Loader2 size={10} className="animate-spin" style={{ color: done ? "#000" : "var(--muted-foreground)" }} />
                      : done ? <Check size={11} className="text-black" strokeWidth={3} /> : null}
                  </div>
                  <span className="text-base shrink-0">{habit.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block"
                      style={{ color: done ? "var(--neon-green)" : "var(--foreground)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.8 : 1 }}>
                      {habit.name}
                    </span>
                    {isNumeric && (
                      <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                        {habit.target_value || 1} {habit.unit || t('pieces')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Salbiy odatlar — Saqlanib qoldi (✔ yashil) / Buzildi (✘ qizil) */}
          {negativeHabits.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-4 mb-2">
                <Shield size={12} style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  {t('log_negative_section')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {negativeHabits.map((habit) => {
                  const logged = negLoggedIds.has(habit.id);
                  const broke = negBrokeIds.has(habit.id);
                  const kept = logged && !broke;
                  const saving = savingIds.has(habit.id);
                  return (
                    <div
                      key={habit.id}
                      onClick={() => !saving && handleQuickToggleNegative(habit.id, false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: kept
                          ? isDark ? "rgba(74,222,128,0.1)" : "#F0FDF4"
                          : broke
                            ? isDark ? "rgba(248,113,113,0.1)" : "#FFF5F5"
                            : isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                        border: `1px solid ${kept
                          ? "rgba(74,222,128,0.25)"
                          : broke
                            ? "rgba(248,113,113,0.25)"
                            : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                        cursor: saving ? "default" : "pointer",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: kept ? "var(--neon-green)" : broke ? "#F87171" : "transparent",
                          border: `2px solid ${kept ? "var(--neon-green)" : broke ? "#F87171" : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                        }}
                      >
                        {saving
                          ? <Loader2 size={10} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                          : kept ? <Check size={11} className="text-black" strokeWidth={3} />
                          : broke ? <X size={11} className="text-black" strokeWidth={3} /> : null}
                      </div>
                      <span className="text-base shrink-0">{habit.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block"
                          style={{
                            color: kept ? "var(--neon-green)" : broke ? "#F87171" : "var(--foreground)",
                            textDecoration: broke ? "line-through" : "none",
                            opacity: kept || broke ? 0.8 : 1,
                          }}>
                          {habit.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={t('log_break_btn')}
                        onClick={(e) => { e.stopPropagation(); if (!saving) handleQuickToggleNegative(habit.id, true); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: broke ? "rgba(248,113,113,0.2)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                          color: broke ? "#F87171" : "var(--muted-foreground)",
                          border: `1px solid ${broke ? "rgba(248,113,113,0.35)" : "transparent"}`,
                        }}
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Flame, label: t('dash_streak_label'), value: `${currentStreak} ${t('days')}`, color: "#F97316", bg: "rgba(249,115,22,0.12)" },
          { icon: Trophy, label: t('dash_best_streak'), value: `${bestStreak} ${t('days')}`, color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
          { icon: CheckCircle2, label: t('dash_this_month'), value: `${totalMonth} ${t('pieces')}`, color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-2xl" style={card}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: stat.bg }}
            >
              <stat.icon size={18} style={{ color: stat.color }} />
            </div>
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}
            >
              {stat.value}
            </p>
            <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Streak Freeze banner — o'zi muzlatmaydi, faqat Jurnalga yo'naltiradi.
          Muzlatish amalining yagona manbai HabitsLog (Jurnal) hisoblanadi. */}
      {currentStreak > 0 && !freezeDates.has(today) && completedToday < totalHabits && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{
            background: "rgba(147,197,253,0.08)",
            border: "1px solid rgba(147,197,253,0.2)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: "rgba(147,197,253,0.12)" }}
          >
            🛡️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#93C5FD" }}>
              {`${currentStreak} ${t('dash_freeze_at_risk')}`}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('dash_freeze_goto_journal')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("logs")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
            style={{
              background: "rgba(147,197,253,0.15)",
              border: "1px solid rgba(147,197,253,0.3)",
              color: "#93C5FD",
            }}
          >
            {t('dash_freeze_btn')} <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Streak frozen today badge */}
      {freezeDates.has(today) && (
        <div
          className="flex items-center gap-2.5 p-3.5 rounded-2xl"
          style={{
            background: "rgba(147,197,253,0.06)",
            border: "1px solid rgba(147,197,253,0.15)",
          }}
        >
          <span className="text-lg">🛡️</span>
          <p className="text-xs" style={{ color: "#93C5FD" }}>
            {t('dash_frozen_badge').replace('{n}', String(currentStreak))}
          </p>
        </div>
      )}

      {/* Weekly bar chart */}
      <div className="p-5 rounded-2xl" style={card}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
              {t('dash_weekly_result')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('dash_weekly_sub')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays size={13} style={{ color: "var(--muted-foreground)" }} />
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}
            >
              {new Date().toLocaleString("default", { month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="flex items-end gap-2" style={{ height: 100 }}>
          {weeklyData.map((d, i) => {
            const pct = (d.completed / maxWeekly) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span
                  className="text-[10px]"
                  style={{
                    color: d.isToday ? "#4ADE80" : "var(--muted-foreground)",
                    fontFamily: "'Geist Mono', monospace",
                    minHeight: 14,
                  }}
                >
                  {d.completed > 0 ? d.completed : ""}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: 68 }}>
                  <div
                    className="w-full rounded-t-md transition-all duration-500"
                    style={{
                      height: d.completed > 0 ? `${Math.max(pct, 8)}%` : "3px",
                      background: d.isToday
                        ? "#4ADE80"
                        : d.completed > 0
                        ? isDark ? "rgba(74,222,128,0.35)" : "rgba(74,222,128,0.5)"
                        : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
                      boxShadow: d.isToday ? "0 0 10px rgba(74,222,128,0.4)" : "none",
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-medium"
                  style={{
                    color: d.isToday ? "#4ADE80" : "var(--muted-foreground)",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
