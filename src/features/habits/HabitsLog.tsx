import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Check, Flame, Loader2, Lock, Minus, Plus, Save, ChevronLeft, ChevronRight, Snowflake, WifiOff, X } from "lucide-react";
import { getHabits, getLogsForDate, toggleHabitLog, deleteHabitLog, getLast30DaysLogs, getStreakFreezes, getMonthlyFreezeCount, useStreakFreeze, getExtraFreezeCount, FREE_FREEZES_PER_MONTH, isLogDateLocked, computeHabitProgress, checkAndUnlockAchievements, getHealthLog, upsertHabitMetric, type HabitMetricKey } from "../../services/db";
import { sortByOrder } from "../../utils/habitOrder";
import { toDateStr } from "../../utils/date";
import { cacheHabits, getCachedHabits, cacheLogs, getCachedLogs, cacheStreaks, getCachedStreaks, addPendingLog, getPendingLogs, savePendingLogs } from "../../services/offline";
import type { Habit, Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";

const HOUR_H = 64; // px per hour

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
  const dow = d.getDay(); // 0=Sun
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
  isDark: boolean;
  profile: Profile;
  onCompletedChange: (completed: number, total: number) => void;
  onScoreChange?: (delta: number) => void;
  onStreakMilestone?: (name: string, emoji: string, days: number) => void;
}

export function HabitsLog({ isDark, profile, onCompletedChange, onScoreChange, onStreakMilestone }: HabitsLogProps) {
  const { t } = useLang();
  const [positiveHabits, setPositiveHabits] = useState<Habit[]>([]);
  const [negativeHabits, setNegativeHabits] = useState<Habit[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [logValues, setLogValues] = useState<Record<string, number>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [negStreaks, setNegStreaks] = useState<Record<string, number>>({});
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(() => toDateStr());
  const [loading, setLoading] = useState(true);
  const [freezeDates, setFreezeDates] = useState<Set<string>>(new Set());
  const [monthlyFreezeCount, setMonthlyFreezeCount] = useState(0);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeError, setFreezeError] = useState("");
  const [streakAtRisk, setStreakAtRisk] = useState(false);
  const [extraFreezeCount, setExtraFreezeCount] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fromCache, setFromCache] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);

  const today = toDateStr();
  const isToday = selectedDate === today;
  const dateLocked = isLogDateLocked(selectedDate);

  useEffect(() => { loadData(selectedDate); }, [profile.id, selectedDate]);

  useEffect(() => {
    setPendingCount(getPendingLogs(profile.id).length);
    function handleOnline() {
      setIsOffline(false);
      flushPendingLogs();
    }
    function handleOffline() { setIsOffline(true); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [profile.id]);

  async function flushPendingLogs() {
    const pending = getPendingLogs(profile.id);
    if (pending.length === 0) return;
    const failed: typeof pending = [];
    for (const log of pending) {
      try {
        await toggleHabitLog(log.habitId, log.userId, log.completed, log.value, log.prevCompleted, log.isNegative, log.date);
      } catch {
        // Muvaffaqiyatsiz bo'lganini navbatda qoldiramiz — aks holda tarmoq
        // xatosi bilan foydalanuvchining oflayn belgilagan odati butunlay
        // yo'qolib ketardi (sinxronlanmagan holda ham "tozalab" tashlanardi)
        failed.push(log);
      }
    }
    savePendingLogs(profile.id, failed);
    setPendingCount(failed.length);
    if (failed.length > 0) setSyncError(t('log_sync_error').replace('{n}', String(failed.length)));
    else setSyncError("");
    loadData(selectedDate);
  }

  // Scroll to current hour on load
  useEffect(() => {
    if (!loading && timelineRef.current) {
      const now = new Date();
      const scrollTo = Math.max(0, (now.getHours() - 1) * HOUR_H);
      timelineRef.current.scrollTop = scrollTo;
    }
  }, [loading]);

  async function loadData(date: string) {
    setLoading(true);
    try {
      const [habitsData, logsData, historyData, freezeDatesData, freezeCount, extraFreeze] = await Promise.all([
        getHabits(profile.id),
        getLogsForDate(profile.id, date),
        getLast30DaysLogs(profile.id),
        getStreakFreezes(profile.id),
        getMonthlyFreezeCount(profile.id),
        getExtraFreezeCount(profile.id),
      ]);
      setFreezeDates(new Set(freezeDatesData));
      setMonthlyFreezeCount(freezeCount);
      setExtraFreezeCount(extraFreeze);

      const sorted = sortByOrder(habitsData || [], profile.id);
      const posHabits = sorted.filter((h: Habit) => h.type === "positive");
      const negHabits = sorted.filter((h: Habit) => h.type === "negative");
      setPositiveHabits(posHabits);
      setNegativeHabits(negHabits);

      const completed = new Set<string>();
      const logged = new Set<string>();
      const values: Record<string, number> = {};
      for (const log of logsData || []) {
        logged.add(log.habit_id);
        if (log.completed) completed.add(log.habit_id);
        values[log.habit_id] = log.value || (log.completed ? 1 : 0);
      }
      setCompletedIds(completed);
      setLoggedIds(logged);
      setLogValues(values);

      if (isToday) {
        const { completed: doneCount, total } = computeHabitProgress([...posHabits, ...negHabits], logsData || []);
        onCompletedChange(doneCount, total);
      }

      const todayStr = toDateStr();
      const byHabit: Record<string, Set<string>> = {};
      for (const log of historyData || []) {
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
      const now = new Date();
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

      // Negative habit streaks: count consecutive "kept" days (completed=false, but log exists)
      const negHabitIds = new Set(sorted.filter((h: Habit) => h.type === "negative").map((h: Habit) => h.id));
      const negByHabit: Record<string, Set<string>> = {};
      for (const log of historyData || []) {
        if (negHabitIds.has(log.habit_id) && !log.completed) {
          if (!negByHabit[log.habit_id]) negByHabit[log.habit_id] = new Set();
          negByHabit[log.habit_id].add(log.log_date);
        }
      }
      for (const log of logsData || []) {
        if (negHabitIds.has(log.habit_id) && !log.completed) {
          if (!negByHabit[log.habit_id]) negByHabit[log.habit_id] = new Set();
          negByHabit[log.habit_id].add(date);
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

      cacheHabits(profile.id, habitsData || []);
      cacheLogs(profile.id, date, logsData || []);
      cacheStreaks(profile.id, newStreaks);
      setFromCache(false);

      // Streak at risk: any habit had completions but missed yesterday
      const yesterdayStr = toDateStr(new Date(now.getTime() - 86400000));
      const atRisk = Object.entries(byHabit).some(([, days]) =>
        days.size > 0 && !days.has(yesterdayStr) && !freezeSet.has(yesterdayStr)
      );
      setStreakAtRisk(atRisk);
    } catch (e) {
      const cachedHabits = getCachedHabits(profile.id);
      if (cachedHabits) {
        const sorted = sortByOrder(cachedHabits, profile.id);
        const posHabits = sorted.filter((h: Habit) => h.type === "positive");
        const negHabits = sorted.filter((h: Habit) => h.type === "negative");
        setPositiveHabits(posHabits);
        setNegativeHabits(negHabits);
        const cachedLogs = getCachedLogs(profile.id, date) || [];
        const completed = new Set<string>();
        const logged = new Set<string>();
        const values: Record<string, number> = {};
        for (const log of cachedLogs) {
          logged.add(log.habit_id);
          if (log.completed) completed.add(log.habit_id);
          values[log.habit_id] = log.value || (log.completed ? 1 : 0);
        }
        setCompletedIds(completed);
        setLoggedIds(logged);
        setLogValues(values);
        if (date === toDateStr()) {
          const { completed: doneCount, total } = computeHabitProgress([...posHabits, ...negHabits], cachedLogs);
          onCompletedChange(doneCount, total);
        }
        setStreaks(getCachedStreaks(profile.id));
        setFromCache(true);
      }
      console.error(e);
    }
    finally { setLoading(false); }
  }

  // Header foizi (completedToday/totalHabits) uchun yagona hisoblash yo'li —
  // db.ts'dagi computeHabitProgress bilan bir xil (App.tsx/Dashboard.tsx ham
  // shuni ishlatadi), shuning uchun uch joy hech qachon bir-biridan
  // ajralib qolmaydi.
  function reportProgress(nextCompleted: Set<string>, nextLogged: Set<string>) {
    const allHabits = [...positiveHabits, ...negativeHabits];
    const logs = Array.from(nextLogged).map((id) => ({ habit_id: id, completed: nextCompleted.has(id) }));
    const { completed, total } = computeHabitProgress(allHabits, logs);
    onCompletedChange(completed, total);
  }

  // Har bir muvaffaqiyatli log yozuvidan keyin chaqiriladi (fire-and-forget —
  // natija /achievements sahifasida keyingi tashrifda ko'rinadi, shu yerda
  // toast ko'rsatilmaydi, asosiy oqimni bloklamaydi/sekinlashtirmaydi).
  function triggerAchievementCheck() {
    checkAndUnlockAchievements(profile.id).catch(() => {});
  }

  async function toggleHabit(habitId: string, isNegative = false) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const wasDone = completedIds.has(habitId);
    const wasLogged = loggedIds.has(habitId);
    const newState = !wasDone;
    // Belgi (check)ni yana bosish endi "Bajarilmadi (X)"ga emas, "Kutilmoqda"
    // holatiga qaytaradi (qator o'chiriladi) — "Bajarilmadi" holati faqat
    // maxsus X tugmasi orqali ataylab belgilanadi (pastdagi markHabitMissed).
    const resetting = wasDone && !newState;

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
    setSavingIds(p => new Set(p).add(habitId));
    if (!navigator.onLine) {
      addPendingLog(profile.id, { habitId, userId: profile.id, date: selectedDate, completed: newState, value: newState ? 1 : 0, prevCompleted: wasDone, isNegative });
      const count = getPendingLogs(profile.id).length;
      setPendingCount(count);
      const existing = getCachedLogs(profile.id, selectedDate) || [];
      const updated = existing.filter((l: any) => l.habit_id !== habitId);
      updated.push({ habit_id: habitId, completed: newState, value: newState ? 1 : 0, log_date: selectedDate });
      cacheLogs(profile.id, selectedDate, updated);
      setSavingIds(p => { const n = new Set(p); n.delete(habitId); return n; });
      return;
    }
    try {
      if (resetting) {
        await deleteHabitLog(habitId, profile.id, selectedDate);
      } else {
        await toggleHabitLog(habitId, profile.id, newState, newState ? 1 : 0, wasDone, isNegative, selectedDate);
        if (newState) triggerAchievementCheck();
      }
    } catch {
      // completedIds/loggedIds bu yerda hali asl (mutatsiyagacha bo'lgan)
      // qiymatlar — chunki closure ular ustiga yozilmagan, faqat state
      // yangilangan. Xatoda shunchaki asl holatga qaytaramiz.
      setCompletedIds(completedIds);
      setLoggedIds(loggedIds);
      if (!isNegative) reportProgress(completedIds, loggedIds);
    } finally {
      setSavingIds(p => { const n = new Set(p); n.delete(habitId); return n; });
    }
  }

  // Musbat odat uchun ataylab "Bajarilmadi (X)" belgisi — markNegativeHabit
  // bilan bir xil naqsh: qayta bossa neytral ("Kutilmoqda")ga qaytaradi.
  async function markHabitMissed(habitId: string) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const wasDone = completedIds.has(habitId);
    const wasLogged = loggedIds.has(habitId);
    const alreadyMissed = wasLogged && !wasDone;
    setSavingIds(p => new Set(p).add(habitId));
    try {
      if (alreadyMissed) {
        await deleteHabitLog(habitId, profile.id, selectedDate);
        const nextLogged = new Set(loggedIds);
        nextLogged.delete(habitId);
        setLoggedIds(nextLogged);
        reportProgress(completedIds, nextLogged);
      } else {
        await toggleHabitLog(habitId, profile.id, false, 0, wasDone, false, selectedDate);
        const nextLogged = new Set(loggedIds);
        nextLogged.add(habitId);
        let nextCompleted = completedIds;
        if (wasDone) {
          nextCompleted = new Set(completedIds);
          nextCompleted.delete(habitId);
          setCompletedIds(nextCompleted);
          onScoreChange?.(-1);
          setStreaks(p => ({ ...p, [habitId]: Math.max(0, (p[habitId] || 1) - 1) }));
        }
        setLoggedIds(nextLogged);
        reportProgress(nextCompleted, nextLogged);
      }
    } catch (e) { console.error(e); }
    finally { setSavingIds(p => { const n = new Set(p); n.delete(habitId); return n; }); }
  }

  async function handleValueChange(habit: Habit, newValue: number) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const target = habit.target_value || 1;
    const completed = newValue >= target;
    const prevCompleted = completedIds.has(habit.id);
    setLogValues(p => ({ ...p, [habit.id]: newValue }));
    const nextCompleted = new Set(completedIds);
    if (completed) nextCompleted.add(habit.id); else nextCompleted.delete(habit.id);
    setCompletedIds(nextCompleted);
    if (habit.type === "positive") reportProgress(nextCompleted, loggedIds);
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
    setSavingIds(p => new Set(p).add(habit.id));
    if (!navigator.onLine) {
      addPendingLog(profile.id, { habitId: habit.id, userId: profile.id, date: selectedDate, completed, value: newValue, prevCompleted, isNegative: false });
      const count = getPendingLogs(profile.id).length;
      setPendingCount(count);
      const existing = getCachedLogs(profile.id, selectedDate) || [];
      const updated = existing.filter((l: any) => l.habit_id !== habit.id);
      updated.push({ habit_id: habit.id, completed, value: newValue, log_date: selectedDate });
      cacheLogs(profile.id, selectedDate, updated);
      setSavingIds(p => { const n = new Set(p); n.delete(habit.id); return n; });
      return;
    }
    try {
      await toggleHabitLog(habit.id, profile.id, completed, newValue, prevCompleted, false, selectedDate);
      if (completed) triggerAchievementCheck();
    } catch { /* revert handled by reload */ }
    finally { setSavingIds(p => { const n = new Set(p); n.delete(habit.id); return n; }); }
  }

  async function markNegativeHabit(habitId: string, broke: boolean) {
    if (dateLocked) { toast.error(t('log_locked_error')); return; }
    const alreadyLogged = loggedIds.has(habitId);
    const alreadyBroke = completedIds.has(habitId);
    const alreadyKept = alreadyLogged && !alreadyBroke;
    const sameState = (broke && alreadyBroke) || (!broke && alreadyKept);
    setSavingIds(p => new Set(p).add(habitId));
    try {
      if (sameState) {
        await deleteHabitLog(habitId, profile.id, selectedDate);
        const nextLogged = new Set(loggedIds); nextLogged.delete(habitId);
        const nextCompleted = new Set(completedIds); nextCompleted.delete(habitId);
        setLoggedIds(nextLogged);
        setCompletedIds(nextCompleted);
        reportProgress(nextCompleted, nextLogged);
      } else {
        await toggleHabitLog(habitId, profile.id, broke, broke ? 1 : 0, alreadyBroke, true, selectedDate);
        if (!broke) triggerAchievementCheck();
        const nextLogged = new Set(loggedIds); nextLogged.add(habitId);
        const nextCompleted = new Set(completedIds);
        if (broke) nextCompleted.add(habitId); else nextCompleted.delete(habitId);
        setLoggedIds(nextLogged);
        setCompletedIds(nextCompleted);
        reportProgress(nextCompleted, nextLogged);
      }
    } catch (e) { console.error(e); }
    finally { setSavingIds(p => { const n = new Set(p); n.delete(habitId); return n; }); }
  }

  async function handleFreeze() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toDateStr(yesterday);
    if (freezeDates.has(yStr) || monthlyFreezeCount >= maxFreeze) return;
    setFreezeLoading(true);
    setFreezeError("");
    try {
      await useStreakFreeze(profile.id, yStr);
      setFreezeDates(prev => new Set([...prev, yStr]));
      setMonthlyFreezeCount(c => c + 1);
      // Streaklarni haqiqiy log + freeze ma'lumotlaridan qayta hisoblaymiz —
      // hammasiga bab-baravar +1 qilish faqat kechagi kuni uzilgan streaklarni
      // to'g'ri, allaqachon davom etayotganlarini esa noto'g'ri oshirib yuborardi
      await loadData(selectedDate);
    } catch (e: any) {
      setFreezeError(e?.message || t('err_loading'));
    }
    setFreezeLoading(false);
  }

  function formatTime(minutes: number) {
    if (minutes < 60) return t('time_fmt_minutes').replace('{n}', String(minutes));
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m > 0
      ? t('time_fmt_hours_minutes').replace('{h}', String(h)).replace('{m}', String(m))
      : t('time_fmt_hours').replace('{h}', String(h));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  const maxFreeze = FREE_FREEZES_PER_MONTH + extraFreezeCount;

  // Split habits: scheduled vs unscheduled
  const scheduledHabits = positiveHabits.filter(h => h.scheduled_start && h.scheduled_end);
  const unscheduledHabits = positiveHabits.filter(h => !h.scheduled_start || !h.scheduled_end);

  // Sahifadagi asosiy progress-bar — computeHabitProgress bilan bir xil
  // (musbat + salbiy), header'dagi foiz bilan mos kelishi uchun. Avval
  // faqat musbat odatlarni hisoblardi, salbiy-odat-only kunlarda butunlay
  // yashirinib qolardi.
  const { completed: unifiedCompleted, total: unifiedTotal } = computeHabitProgress(
    [...positiveHabits, ...negativeHabits],
    Array.from(loggedIds).map((id) => ({ habit_id: id, completed: completedIds.has(id) }))
  );

  // Date label
  const selDateObj = new Date(selectedDate + "T00:00:00");
  const weekDays = getWeekDays(selectedDate);

  const card = {
    background: isDark ? "rgba(22,27,34,0.9)" : "#fff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  // Current time position
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTopPx = (currentMinutes / 60) * HOUR_H;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ─── Weekly Header ─── */}
      <div style={{ ...card, padding: "10px 12px" }}>
        {/* Month + year */}
        <div className="text-center mb-2">
          <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
            {selDateObj.getFullYear()} — {UZ_MONTHS[selDateObj.getMonth()]}
          </span>
        </div>
        <div className="flex gap-1">
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
                className="flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all"
                style={{
                  background: isSel
                    ? "var(--neon-green)"
                    : isTod
                    ? isDark ? "rgba(74,222,128,0.12)" : "#F0FDF4"
                    : "transparent",
                  opacity: isFuture ? 0.3 : 1,
                  cursor: isFuture ? "default" : "pointer",
                }}
              >
                <span className="text-[10px] font-medium" style={{ color: isSel ? "#0E1117" : "var(--muted-foreground)" }}>
                  {UZ_DAYS_SHORT[d.getDay()]}
                </span>
                <span
                  className="text-sm font-bold mt-0.5"
                  style={{ color: isSel ? "#0E1117" : isTod ? "var(--neon-green)" : "var(--foreground)" }}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        {/* Week navigation */}
        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate + "T00:00:00");
              d.setDate(d.getDate() - 7);
              const minDate = new Date(); minDate.setDate(minDate.getDate() - 30);
              if (d >= minDate) setSelectedDate(toDateStr(d));
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ color: "var(--muted-foreground)", background: isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6" }}
          >
            <ChevronLeft size={13} /> {t('prev_week')}
          </button>
          {selectedDate !== today && (
            <button type="button" onClick={() => setSelectedDate(today)} className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>
              {t('today_arrow')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate + "T00:00:00");
              d.setDate(d.getDate() + 7);
              if (toDateStr(d) <= today) setSelectedDate(toDateStr(d));
            }}
            disabled={toDateStr(weekDays[6]) >= today}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{
              color: "var(--muted-foreground)",
              background: isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6",
              opacity: toDateStr(weekDays[6]) >= today ? 0.3 : 1,
            }}
          >
            {t('next_week')} <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ─── Progress bar ─── */}
      {unifiedTotal > 0 && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round((unifiedCompleted / unifiedTotal) * 100)}%`, background: "var(--neon-green)" }}
            />
          </div>
          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--neon-green)", fontFamily: "'Geist Mono', monospace" }}>
            {unifiedCompleted}/{unifiedTotal}
          </span>
        </div>
      )}

      {/* ─── Locked Day Banner ─── */}
      {dateLocked && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
          <Lock size={16} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <p className="text-xs flex-1" style={{ color: "var(--muted-foreground)" }}>
            {t('log_locked_banner')}
          </p>
        </div>
      )}

      {/* ─── Offline Banner ─── */}
      {isOffline && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
          <WifiOff size={16} style={{ color: "#FBBF24", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "#FBBF24" }}>
              {t('offline')}{pendingCount > 0 ? ` — ${pendingCount} ${t('log_offline_pending')}` : ""}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('log_offline_hint')}
            </p>
          </div>
          {fromCache && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg shrink-0"
              style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>
              {t('log_cache')}
            </span>
          )}
        </div>
      )}

      {/* ─── Sinxronlash xatosi (internet qaytdi, lekin ba'zi o'zgarishlar
          saqlanmadi) ─── */}
      {!isOffline && syncError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <WifiOff size={16} style={{ color: "var(--coral-red)", flexShrink: 0 }} />
          <p className="text-xs flex-1" style={{ color: "var(--coral-red)" }}>{syncError}</p>
          <button onClick={flushPendingLogs} className="text-xs underline shrink-0" style={{ color: "var(--coral-red)" }}>
            {t('retry')}
          </button>
        </div>
      )}

      {/* ─── Streak Freeze Banner ─── */}
      {isToday && streakAtRisk && monthlyFreezeCount < maxFreeze && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: isDark ? "rgba(147,197,253,0.08)" : "rgba(147,197,253,0.12)", border: "1px solid rgba(147,197,253,0.25)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(147,197,253,0.15)" }}>
            <Snowflake size={18} style={{ color: "#93C5FD" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "#93C5FD" }}>{t('log_freeze_risk')}</p>
            <p className="text-[11px] mt-0.5" style={{ color: freezeError ? "var(--coral-red)" : "var(--muted-foreground)" }}>
              {freezeError || t('log_freeze_hint').replace('{n}', String(maxFreeze - monthlyFreezeCount))}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFreeze}
            disabled={freezeLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(147,197,253,0.2)", color: "#93C5FD", border: "1px solid rgba(147,197,253,0.35)" }}
          >
            {freezeLoading ? <Loader2 size={13} className="animate-spin" /> : <Snowflake size={13} />}
            {t('log_freeze_btn')}
          </button>
        </div>
      )}

      {/* ─── Freeze used today indicator ─── */}
      {isToday && (() => {
        const yStr = toDateStr(new Date(Date.now() - 86400000));
        return freezeDates.has(yStr);
      })() && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
          style={{ background: isDark ? "rgba(147,197,253,0.06)" : "rgba(147,197,253,0.08)", border: "1px solid rgba(147,197,253,0.2)" }}>
          <Snowflake size={14} style={{ color: "#93C5FD" }} />
          <p className="text-xs font-medium" style={{ color: "#93C5FD" }}>
            ❄️ {t('log_frozen')}
          </p>
          <span className="ml-auto text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {maxFreeze - monthlyFreezeCount} {t('log_left')}
          </span>
        </div>
      )}

      {/* ─── Timeline ─── */}
      <div style={card}>
        <div
          ref={timelineRef}
          className="overflow-y-auto"
          style={{ maxHeight: "60vh", position: "relative" }}
        >
          {/* Empty message */}
          {scheduledHabits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: "var(--muted-foreground)" }}>
              <span className="text-3xl">📅</span>
              <p className="text-sm text-center">{t('dash_no_scheduled')}</p>
              <p className="text-xs text-center opacity-70">{t('dash_schedule_hint')}</p>
            </div>
          )}

          {scheduledHabits.length > 0 && (
            <div className="relative" style={{ height: 24 * HOUR_H }}>
              {/* Hour lines */}
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="absolute flex w-full"
                  style={{ top: h * HOUR_H, left: 0, right: 0 }}
                >
                  <span
                    className="text-[10px] text-right shrink-0 select-none"
                    style={{ width: 40, paddingRight: 8, color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace", lineHeight: "1" }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                  <div
                    className="flex-1"
                    style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}
                  />
                </div>
              ))}

              {/* Current time line */}
              {isToday && (
                <div className="absolute flex items-center" style={{ top: currentTopPx, left: 0, right: 0, zIndex: 20 }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ marginLeft: 34, background: "#F87171" }} />
                  <div className="flex-1 h-px" style={{ background: "#F87171", opacity: 0.7 }} />
                </div>
              )}

              {/* Habit blocks */}
              {scheduledHabits.map((habit, idx) => {
                const startMin = toMin(habit.scheduled_start!);
                const endMin = toMin(habit.scheduled_end!);
                const durationMin = Math.max(endMin - startMin, 15);
                const topPx = (startMin / 60) * HOUR_H;
                const heightPx = Math.max((durationMin / 60) * HOUR_H, 36);
                const done = completedIds.has(habit.id);
                const logged = loggedIds.has(habit.id);
                const missed = logged && !done;
                const saving = savingIds.has(habit.id);
                const color = blockColor(idx);
                const isNumeric = (habit.target_value || 1) > 1;
                // Kun qulflangan bo'lsa (ertasi kuni soat 09:00 o'tgan) —
                // hatto allaqachon belgilangan yozuv bo'lsa ham endi
                // o'zgartirib bo'lmaydi, bloq "qulflangan" holatida
                // ko'rsatiladi (server yozuvi yaratilmaydi/o'chirilmaydi,
                // faqat UI interaktivligi cheklanadi — haqiqiy tekshiruv
                // db.ts'dagi toggleHabitLog/deleteHabitLog ichida).
                const loggable = !dateLocked;
                const canToggle = loggable && !saving && !isNumeric;

                return (
                  <button
                    type="button"
                    key={habit.id}
                    onClick={() => canToggle && toggleHabit(habit.id)}
                    disabled={!canToggle}
                    className="absolute rounded-xl overflow-hidden transition-all duration-200 text-left"
                    style={{
                      top: topPx + 1,
                      left: 44,
                      right: 8,
                      height: heightPx - 2,
                      background: done
                        ? isDark ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.2)"
                        : missed
                          ? isDark ? "rgba(248,113,113,0.15)" : "rgba(248,113,113,0.18)"
                          : `${color}CC`,
                      borderLeft: `3px solid ${done ? "var(--neon-green)" : missed ? "#F87171" : color}`,
                      opacity: done ? 0.75 : !loggable ? 0.4 : 1,
                      cursor: canToggle ? "pointer" : "default",
                      zIndex: 10,
                    }}
                  >
                    <div className="flex items-start gap-1.5 px-2 py-1.5 h-full">
                      {saving ? (
                        <Loader2 size={11} className="animate-spin shrink-0 mt-0.5" style={{ color: done ? "var(--neon-green)" : "#fff" }} />
                      ) : done ? (
                        <Check size={11} className="shrink-0 mt-0.5" style={{ color: "var(--neon-green)" }} strokeWidth={3} />
                      ) : missed ? (
                        <X size={11} className="shrink-0 mt-0.5" style={{ color: "#F87171" }} strokeWidth={3} />
                      ) : (
                        <span className="text-xs shrink-0 leading-none mt-0.5">{habit.emoji}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-semibold truncate leading-tight"
                          style={{
                            color: done ? "var(--neon-green)" : missed ? "#F87171" : "#fff",
                            textDecoration: done || missed ? "line-through" : "none",
                          }}
                        >
                          {habit.name}
                        </p>
                        {heightPx >= 36 && (
                          <p className="text-[10px] leading-none mt-0.5 opacity-80" style={{ color: done ? "var(--neon-green)" : missed ? "#F87171" : "#fff" }}>
                            {fmtTime(habit.scheduled_start!)} — {fmtTime(habit.scheduled_end!)}
                          </p>
                        )}
                      </div>
                      {(streaks[habit.id] || 0) >= 2 && !done && (
                        <span className="text-[9px] font-bold shrink-0 flex items-center gap-0.5" style={{ color: "#FCD34D" }}>
                          <Flame size={9} fill="#FCD34D" />{streaks[habit.id]}
                        </span>
                      )}
                      {!isNumeric && loggable && !saving && (
                        <button
                          type="button"
                          aria-label={t('log_break_btn')}
                          onClick={(e) => { e.stopPropagation(); markHabitMissed(habit.id); }}
                          className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            background: missed ? "rgba(248,113,113,0.35)" : "rgba(255,255,255,0.18)",
                            color: missed ? "#F87171" : "#fff",
                          }}
                        >
                          <X size={9} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Unscheduled positive habits ─── */}
      {unscheduledHabits.length > 0 && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-3 px-4 pt-4">
            <span className="text-sm">📋</span>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('unscheduled')}</h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6", color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {unscheduledHabits.length} ta
            </span>
          </div>
          <div className="flex flex-col gap-2 px-3 pb-3">
            {unscheduledHabits.map((habit) => {
              const done = completedIds.has(habit.id);
              const logged = loggedIds.has(habit.id);
              const missed = logged && !done;
              const saving = savingIds.has(habit.id);
              const isNumeric = (habit.target_value || 1) > 1;
              const isTime = habit.unit === "daqiqa";
              const currentVal = logValues[habit.id] || 0;
              const target = habit.target_value || 1;
              const step = isTime ? 5 : 1;
              const pct = Math.min(Math.round((currentVal / target) * 100), 100);
              const streak = streaks[habit.id] || 0;

              if (isNumeric) {
                return (
                  <div key={habit.id} className="px-3 py-2.5 rounded-xl" style={{
                    background: done ? isDark ? "rgba(74,222,128,0.07)" : "#F0FDF4" : isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                    border: `1px solid ${done ? "rgba(74,222,128,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                    opacity: saving ? 0.7 : dateLocked ? 0.5 : 1,
                  }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{habit.emoji}</span>
                      <span className="flex-1 text-xs font-medium" style={{ color: done ? "var(--neon-green)" : "var(--foreground)" }}>{habit.name}</span>
                      {streak >= 2 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.12)", color: "#F97316", fontFamily: "'Geist Mono', monospace" }}>
                          <Flame size={9} fill="#F97316" /> {streak}
                        </span>
                      )}
                      <span className="text-[10px] font-medium" style={{ color: done ? "#4ADE80" : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {isTime ? `${formatTime(currentVal)}/${formatTime(target)}` : `${currentVal}/${target}${habit.unit ? ` ${habit.unit}` : ""}`}
                      </span>
                    </div>
                    {dateLocked ? (
                      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                        <Lock size={10} /> {t('log_locked_badge')}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#4ADE80" }} />
                        </div>
                        <button type="button" aria-label={t('log_decrease')} onClick={() => !saving && handleValueChange(habit, Math.max(0, currentVal - step))} disabled={saving || currentVal === 0}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold"
                          style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB", color: "var(--foreground)", opacity: currentVal === 0 ? 0.3 : 1 }}>
                          −
                        </button>
                        <button type="button" aria-label={t('log_increase')} onClick={() => !saving && handleValueChange(habit, currentVal + step)} disabled={saving}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold"
                          style={{ background: done ? "#4ADE80" : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB", color: done ? "#000" : "var(--foreground)" }}>
                          {saving ? <Loader2 size={10} className="animate-spin" /> : "+"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button type="button" key={habit.id} onClick={() => !saving && !dateLocked && toggleHabit(habit.id)} disabled={saving || dateLocked}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: done ? isDark ? "rgba(74,222,128,0.07)" : "#F0FDF4" : missed ? isDark ? "rgba(248,113,113,0.07)" : "#FFF5F5" : isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                    border: `1px solid ${done ? "rgba(74,222,128,0.2)" : missed ? "rgba(248,113,113,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                    opacity: saving ? 0.7 : dateLocked ? 0.5 : 1,
                    cursor: saving || dateLocked ? "default" : "pointer",
                  }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: done ? "var(--neon-green)" : missed ? "#F87171" : "transparent",
                      border: `2px solid ${done ? "var(--neon-green)" : missed ? "#F87171" : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                    }}>
                    {saving ? <Loader2 size={10} className="animate-spin" style={{ color: done ? "#000" : "var(--muted-foreground)" }} />
                      : done ? <Check size={11} className="text-black" strokeWidth={3} />
                      : missed ? <X size={11} className="text-black" strokeWidth={3} /> : null}
                  </div>
                  <span className="text-base">{habit.emoji}</span>
                  <span className="flex-1 text-xs font-medium" style={{ color: done ? "var(--neon-green)" : missed ? "#F87171" : "var(--foreground)", textDecoration: done || missed ? "line-through" : "none", opacity: done || missed ? 0.8 : 1 }}>
                    {habit.name}
                  </span>
                  {streak >= 2 && !missed && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: "rgba(249,115,22,0.12)", color: "#F97316", fontFamily: "'Geist Mono', monospace" }}>
                      <Flame size={9} fill="#F97316" /> {streak}
                    </span>
                  )}
                  {dateLocked ? (
                    <Lock size={13} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  ) : (
                  <button
                    type="button"
                    aria-label={t('log_break_btn')}
                    onClick={(e) => { e.stopPropagation(); if (!saving) markHabitMissed(habit.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: missed ? "rgba(248,113,113,0.2)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      color: missed ? "#F87171" : "var(--muted-foreground)",
                      border: `1px solid ${missed ? "rgba(248,113,113,0.35)" : "transparent"}`,
                    }}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Negative habits ─── */}
      {negativeHabits.length > 0 && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-3 px-4 pt-4">
            <span className="text-sm">🛡️</span>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('log_negative_section')}</h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6", color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {negativeHabits.length} ta
            </span>
          </div>
          <div className="flex flex-col gap-2 px-3 pb-3">
            {negativeHabits.map((habit) => {
              const isLogged = loggedIds.has(habit.id);
              const isBroke = completedIds.has(habit.id);
              const isKept = isLogged && !isBroke;
              const saving = savingIds.has(habit.id);
              const negStreak = negStreaks[habit.id] || 0;
              return (
                <button
                  type="button"
                  key={habit.id}
                  onClick={() => !saving && !dateLocked && markNegativeHabit(habit.id, false)}
                  disabled={saving || dateLocked}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: isKept ? (isDark ? "rgba(74,222,128,0.07)" : "#F0FDF4") : isBroke ? (isDark ? "rgba(248,113,113,0.07)" : "#FFF5F5") : (isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB"),
                    border: `1px solid ${isKept ? "rgba(74,222,128,0.2)" : isBroke ? "rgba(248,113,113,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                    opacity: saving ? 0.7 : dateLocked ? 0.5 : 1,
                    cursor: saving || dateLocked ? "default" : "pointer",
                    width: "100%",
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: isKept ? "var(--neon-green)" : isBroke ? "#F87171" : "transparent",
                      border: `2px solid ${isKept ? "var(--neon-green)" : isBroke ? "#F87171" : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                    }}
                  >
                    {saving
                      ? <Loader2 size={10} className="animate-spin" style={{ color: isKept ? "#000" : "var(--muted-foreground)" }} />
                      : isKept ? <Check size={11} className="text-black" strokeWidth={3} />
                      : isBroke ? <X size={11} className="text-black" strokeWidth={3} />
                      : null}
                  </div>

                  <span className="text-base">{habit.emoji}</span>
                  <span
                    className="flex-1 text-xs font-medium"
                    style={{
                      color: isKept ? "var(--neon-green)" : isBroke ? "#F87171" : "var(--foreground)",
                      textDecoration: isBroke ? "line-through" : "none",
                      opacity: isBroke ? 0.75 : 1,
                    }}
                  >
                    {habit.name}
                  </span>

                  {negStreak >= 2 && !isBroke && (
                    <span
                      className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0"
                      style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}
                    >
                      🛡️ {negStreak}
                    </span>
                  )}

                  {dateLocked ? (
                    <Lock size={13} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  ) : (
                  <button
                    type="button"
                    aria-label={t('log_break_btn')}
                    onClick={(e) => { e.stopPropagation(); if (!saving) markNegativeHabit(habit.id, true); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: isBroke ? "rgba(248,113,113,0.2)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                      color: isBroke ? "#F87171" : "var(--muted-foreground)",
                      border: `1px solid ${isBroke ? "rgba(248,113,113,0.35)" : "transparent"}`,
                    }}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Numeric Metrics ─── */}
      <NumericMetrics isDark={isDark} inputStyle={inputStyle} profile={profile} logDate={selectedDate} locked={dateLocked} />
    </div>
  );
}

function NumericMetrics({ isDark, inputStyle, profile, logDate, locked }: {
  isDark: boolean; inputStyle: React.CSSProperties; profile: Profile; logDate: string; locked: boolean;
}) {
  const { t } = useLang();
  // "value" — slaydirda ko'rsatilayotgan (hali saqlanmagan bo'lishi mumkin)
  // qiymat; "saved" — serverdagi oxirgi tasdiqlangan qiymat. Ikkisi farq
  // qilsa ("dirty"), Saqlash tugmasi yonadi — slayder harakati endi
  // avtomatik DB yozuvini qo'zg'atmaydi.
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
      toast.error(e?.message || t('log_metrics_save_error'));
    } finally {
      setSaving(false);
    }
  }

  const disabled = locked || loading;

  return (
    <div style={{
      background: isDark ? "rgba(22,27,34,0.9)" : "#fff",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
      borderRadius: 14,
      padding: "16px",
    }}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('log_metrics')}</h3>
        {locked && (
          <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            <Lock size={10} /> {t('log_locked_badge')}
          </span>
        )}
      </div>
      <div className="space-y-5">
        <MetricSlider
          label={t('log_nature_time')} emoji="🌿" value={natureTime} onChange={setNatureTime}
          max={120} target={60} color="var(--neon-green)" isDark={isDark} unit={t('minutes')} step={5} inputStyle={inputStyle}
          dirty={natureTime !== savedNature} saving={savingNature} disabled={disabled}
          onSave={() => saveMetric('nature_time_minutes', natureTime, setSavingNature, setSavedNature)}
        />
        <MetricSlider
          label={t('log_social_time')} emoji="📱" value={socialTime} onChange={setSocialTime}
          max={180} target={60} color="var(--coral-red)" isDark={isDark} unit={t('minutes')} invertProgress step={5} inputStyle={inputStyle}
          dirty={socialTime !== savedSocial} saving={savingSocial} disabled={disabled}
          onSave={() => saveMetric('social_time_minutes', socialTime, setSavingSocial, setSavedSocial)}
        />
      </div>
    </div>
  );
}

interface MetricSliderProps {
  label: string; emoji: string; value: number; onChange: (v: number) => void;
  max: number; target: number; color: string; isDark: boolean; unit: string;
  invertProgress?: boolean; step?: number; inputStyle: React.CSSProperties;
  dirty: boolean; saving: boolean; disabled: boolean; onSave: () => void;
}

function MetricSlider({ label, emoji, value, onChange, max, target, color, isDark, unit, invertProgress, step = 1, dirty, saving, disabled, onSave }: MetricSliderProps) {
  const { t } = useLang();
  const progress = Math.min((value / max) * 100, 100);
  const isGood = invertProgress ? value <= target : value >= target;
  const adjust = (delta: number) => onChange(Math.max(0, value + delta));
  const canSave = dirty && !saving && !disabled;

  return (
    <div style={{ opacity: disabled ? 0.6 : 1 }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-y-1.5">
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label={t('log_decrease')} onClick={() => adjust(-step)} disabled={disabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
            <Minus size={12} />
          </button>
          <span className="text-sm font-bold w-16 text-center" style={{ color, fontFamily: "'Geist Mono', monospace" }}>
            {value} {unit}
          </span>
          <button type="button" aria-label={t('log_increase')} onClick={() => adjust(step)} disabled={disabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
            <Plus size={12} />
          </button>
          <button type="button" onClick={onSave} disabled={!canSave}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg shrink-0"
            style={{
              background: canSave ? "var(--neon-green)" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              color: canSave ? "#0E1117" : "var(--muted-foreground)",
              opacity: saving ? 0.7 : 1,
              cursor: canSave ? "pointer" : "default",
            }}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            {t('log_metrics_save_btn')}
          </button>
        </div>
      </div>
      <input
        type="range" aria-label={label} min={0} max={Math.max(max, value)} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} ${progress}%, ${isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"} ${progress}%)`, accentColor: color }}
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>0</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ background: isGood ? isDark ? "rgba(74,222,128,0.12)" : "#DCFCE7" : isDark ? "rgba(248,113,113,0.12)" : "#FEE2E2", color: isGood ? "var(--neon-green)" : "var(--coral-red)", fontFamily: "'Geist Mono', monospace" }}>
          {isGood ? "✓" : "⚠"} Target: {target}{unit}
        </span>
        <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>{Math.max(max, value)}</span>
      </div>
    </div>
  );
}
