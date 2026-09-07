import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Trophy, Zap, Flame, BarChart2, Loader2, Image as ImageIcon, Brain, Sparkles, RefreshCw, RotateCw, BarChart3, CheckCircle2, AlertCircle, TrendingUp, Calendar, BookOpen, Droplets, Dumbbell, Moon, SlidersHorizontal, ChevronRight, ClipboardList, Shield, Bell, Activity as ActivityIcon, ShieldCheck, Footprints, Clock, Coins, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { toPng } from "html-to-image";
import { useNavigate } from "react-router-dom";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../utils/categoryTheme";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getLogsByRange, getHealthLogsByRange, getMonthNotes, getCoachNote, upsertCoachNote, isHabitLogSuccess, getCached } from "../../services/db";
import { supabase } from "../../services/supabase";
import { requestClaudeHabitAnalysis } from "../../services/aiService";
import { getLevel } from "../../utils/levels";
import { useUser } from "../../store/UserContext";
import { toDateStr } from "../../utils/date";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";

import { GlobalLeaderboardPage } from "../leaderboard/GlobalLeaderboardPage";

interface AnalyticsProps {
  isDark: boolean;
  completedToday: number;
  totalHabits: number;
  profile: Profile;
  onUserClick?: (userId: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}

const uzMonths = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

export function Analytics({ isDark, completedToday, totalHabits, profile: propsProfile, onUserClick, onProfileUpdate }: AnalyticsProps) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { profile: contextProfile, updateCoins, refreshUserProfile } = useUser();
  const profile = contextProfile || propsProfile;

  const [logs, setLogs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [downloadingPoster, setDownloadingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement | null>(null);
  const aiCardRef = useRef<HTMLDivElement | null>(null);
  const [timeFilter, setTimeFilter] = useState<'weekly' | 'monthly' | 'yearly' | 'all'>('monthly');
  const [viewMode, setViewMode] = useState<'personal' | 'leaderboard'>('personal');

  const rangeDays = timeFilter === 'weekly' ? 7 : timeFilter === 'monthly' ? 30 : timeFilter === 'yearly' ? 365 : 1000;
  const initialCached = getCached<any[]>(`logs_range_${profile.id}_${rangeDays}`);
  const [loading, setLoading] = useState(!initialCached);

  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [coachGeneratedAt, setCoachGeneratedAt] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [showPremiumAI, setShowPremiumAI] = useState(false);

  const today = toDateStr();

  const PREMIUM_AI_COST = 200;

  useEffect(() => {
    const rangeDays = timeFilter === 'weekly' ? 7 : timeFilter === 'monthly' ? 30 : timeFilter === 'yearly' ? 365 : 1000;
    const now = new Date();

    const cached = getCached<any[]>(`logs_range_${profile.id}_${rangeDays}`);
    if (!cached) setLoading(true);

    Promise.all([
      getLogsByRange(profile.id, rangeDays),
      getHealthLogsByRange(profile.id, rangeDays),
      getMonthNotes(profile.id, now.getFullYear(), now.getMonth() + 1),
    ]).then(([logData, healthData, noteData]) => {
      setLogs(logData || []);
      setHealthLogs(healthData || []);
      setNotes(noteData || []);
    }).catch(() => {}).finally(() => setLoading(false));

    getCoachNote(profile.id).then((cached) => {
      if (cached) { setCoachNote(cached.note); setCoachGeneratedAt(cached.generated_at); }
    }).catch(() => {});
  }, [profile.id, timeFilter]);

  // completed=true is the single success source for every habit type:
  // positive done and negative kept/resisted are both green/success.
  const byDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      if (isHabitLogSuccess(log)) {
        map[log.log_date] = (map[log.log_date] || 0) + 1;
      }
    }
    map[today] = completedToday;
    return map;
  }, [logs, completedToday, today]);

  // Current streak
  const streak = useMemo(() => {
    const now = new Date();
    let count = 0;
    const startOffset = (byDate[today] || 0) > 0 ? 0 : 1;
    for (let i = startOffset; i < 31; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      if ((byDate[ds] || 0) > 0) count++;
      else break;
    }
    return count;
  }, [byDate, today]);

  // Best streak
  const bestStreak = useMemo(() => {
    const dates = Object.keys(byDate).filter((d) => byDate[d] > 0).sort();
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
  }, [byDate]);

  // Total completed this month
  const totalMonth = useMemo(
    () => Object.values(byDate).reduce((s, v) => s + v, 0),
    [byDate]
  );

  // Average daily completion %
  const avgPercent = useMemo(() => {
    if (totalHabits === 0) return 0;
    const days = Object.values(byDate).filter((v) => v > 0);
    if (days.length === 0) return 0;
    const sum = days.reduce((s, v) => s + Math.min(v / totalHabits, 1), 0);
    return Math.round((sum / days.length) * 100);
  }, [byDate, totalHabits]);

  // Per-habit success stats
  const habitStats = useMemo(() => {
    const map: Record<string, { name: string; emoji: string; days: Set<string>; streak: number }> = {};
    const now = new Date();

    for (const log of logs) {
      if (isHabitLogSuccess(log)) {
        const id = log.habit_id;
        if (!map[id]) {
          map[id] = { name: log.habits.name, emoji: log.habits.emoji, days: new Set(), streak: 0 };
        }
        map[id].days.add(log.log_date);
      }
    }

    // Calculate streak per habit
    for (const id of Object.keys(map)) {
      const h = map[id];
      let s = 0;
      const startOffset = h.days.has(today) ? 0 : 1;
      for (let i = startOffset; i < 31; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = toDateStr(d);
        if (h.days.has(ds)) s++;
        else break;
      }
      h.streak = s;
    }

    return Object.entries(map)
      .map(([id, h]) => ({
        id,
        name: h.name,
        emoji: h.emoji,
        completedDays: h.days.size,
        pct: Math.round((h.days.size / 30) * 100),
        streak: h.streak,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [logs, today]);

  // AI Insights: note metrics vs habit completion
  const insights = useMemo(() => {
    // Uyqu/ekran vaqti health_logs'dan (yagona manba — DailyNotes/HealthPage
    // ikkalasi ham shu jadvalga yozadi), kayfiyat esa hamon daily_notes'dan.
    const noteMap: Record<string, { mood?: number; sleep?: number; screen?: number }> = {};
    for (const n of notes) {
      noteMap[n.note_date] = { ...noteMap[n.note_date], mood: n.mood };
    }
    for (const h of healthLogs) {
      noteMap[h.log_date] = { ...noteMap[h.log_date], sleep: h.sleep_hours ?? undefined, screen: h.screen_time_hours ?? undefined };
    }
    const paired = Object.entries(noteMap).filter(([date]) => byDate[date] !== undefined);
    if (paired.length < 5) return [];

    function avgCompletion(days: [string, any][]) {
      if (days.length === 0) return null;
      const sum = days.reduce((s, [d]) => s + (totalHabits > 0 ? Math.min((byDate[d] || 0) / totalHabits, 1) : 0), 0);
      return Math.round((sum / days.length) * 100);
    }

    const result: { icon: any; title: string; body: string; color: string; bg: string; border: string }[] = [];

    // Mood
    const moodPairs = paired.filter(([, n]) => n.mood != null);
    if (moodPairs.length >= 5) {
      const hi = avgCompletion(moodPairs.filter(([, n]) => n.mood! >= 4));
      const lo = avgCompletion(moodPairs.filter(([, n]) => n.mood! <= 2));
      if (hi !== null && lo !== null && Math.abs(hi - lo) >= 10) {
        const diff = hi - lo;
        result.push({
          icon: Brain,
          title: t('analytics_mood_habits'),
          body: diff > 0
            ? t('ai_mood_high').replace('{n}', String(diff))
            : t('ai_mood_low').replace('{n}', String(Math.abs(diff))),
          color: "#4ADE80", bg: "rgba(74,222,128,0.07)", border: "rgba(74,222,128,0.2)",
        });
      }
    }

    // Sleep
    const sleepPairs = paired.filter(([, n]) => n.sleep != null);
    if (sleepPairs.length >= 5) {
      const hi = avgCompletion(sleepPairs.filter(([, n]) => n.sleep! >= 7));
      const lo = avgCompletion(sleepPairs.filter(([, n]) => n.sleep! <= 5));
      if (hi !== null && lo !== null && Math.abs(hi - lo) >= 10) {
        const diff = hi - lo;
        result.push({
          icon: Moon,
          title: t('analytics_sleep_habits'),
          body: diff > 0
            ? t('ai_sleep_high').replace('{n}', String(diff))
            : t('ai_sleep_low').replace('{n}', String(Math.abs(diff))),
          color: "#93C5FD", bg: "rgba(147,197,253,0.07)", border: "rgba(147,197,253,0.2)",
        });
      }
    }

    // Screen time
    const screenPairs = paired.filter(([, n]) => n.screen != null);
    if (screenPairs.length >= 5) {
      const hi = avgCompletion(screenPairs.filter(([, n]) => n.screen! >= 4));
      const lo = avgCompletion(screenPairs.filter(([, n]) => n.screen! <= 2));
      if (hi !== null && lo !== null && Math.abs(hi - lo) >= 10) {
        const diff = lo - hi; // low screen = better
        result.push({
          icon: ActivityIcon,
          title: t('analytics_screen_habits'),
          body: diff > 0
            ? t('ai_screen_high').replace('{n}', String(diff))
            : t('ai_screen_low'),
          color: "#F97316", bg: "rgba(249,115,22,0.07)", border: "rgba(249,115,22,0.2)",
        });
      }
    }

    return result;
  }, [notes, byDate, totalHabits]);

  // AI Coach — compact, non-raw summary sent to api/ai-coach.ts. Keeps the
  // prompt small/cheap and avoids over-sharing full log history; the model
  // is instructed to only reference patterns actually present in this data.
  const uzWeekdayNames = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const coachSummary = useMemo(() => {
    function avg(arr: number[]): number | null {
      return arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;
    }

    const negMap: Record<string, { name: string; logged: number; broken: number }> = {};
    for (const log of logs) {
      if (log.habits?.type === "negative") {
        const id = log.habit_id;
        if (!negMap[id]) negMap[id] = { name: log.habits.name, logged: 0, broken: 0 };
        negMap[id].logged++;
        if (!isHabitLogSuccess(log)) negMap[id].broken++;
      }
    }
    const negativeHabits = Object.values(negMap).map((n) => ({
      name: n.name,
      loggedDays: n.logged,
      breakRatePct: n.logged > 0 ? Math.round((n.broken / n.logged) * 100) : 0,
    }));

    const weekdayBuckets = Array.from({ length: 7 }, () => ({ occurrences: 0, successCount: 0, negativeLogged: 0, negativeBroken: 0 }));
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      weekdayBuckets[d.getDay()].occurrences++;
    }
    for (const log of logs) {
      const wd = new Date(log.log_date + "T00:00:00").getDay();
      const bucket = weekdayBuckets[wd];
      if (isHabitLogSuccess(log)) bucket.successCount++;
      if (log.habits?.type === "negative") {
        bucket.negativeLogged++;
        if (!isHabitLogSuccess(log)) bucket.negativeBroken++;
      }
    }
    const weekdaySummary = weekdayBuckets.map((b, wd) => ({
      weekday: uzWeekdayNames[wd],
      avgHabitsCompleted: b.occurrences > 0 ? Math.round((b.successCount / b.occurrences) * 10) / 10 : 0,
      negativeBreakRatePct: b.negativeLogged > 0 ? Math.round((b.negativeBroken / b.negativeLogged) * 100) : null,
    }));

    const recentNotes = [...notes]
      .filter((n) => n.content && n.content.trim().length > 0)
      .sort((a, b) => b.note_date.localeCompare(a.note_date))
      .slice(0, 5)
      .map((n) => ({ date: n.note_date, mood: n.mood ?? null, text: String(n.content).slice(0, 150) }));

    return {
      currentStreakDays: streak,
      bestStreakDays: bestStreak,
      avgCompletionPct: avgPercent,
      totalHabitsTracked: totalHabits,
      habitSuccessStats: habitStats.slice(0, 8).map((h) => ({ name: h.name, streakDays: h.streak, completionPct: h.pct })),
      negativeHabits,
      avgSleepHours: avg(healthLogs.map((h) => h.sleep_hours).filter((v): v is number => v != null)),
      avgScreenHours: avg(healthLogs.map((h) => h.screen_time_hours).filter((v): v is number => v != null)),
      avgMood: avg(notes.map((n) => n.mood).filter((v): v is number => v != null)),
      weekdaySummary,
      recentNotes,
    };
  }, [logs, notes, healthLogs, habitStats, streak, bestStreak, avgPercent, totalHabits]);

  const canGenerateCoachNote = logs.length >= 5;

  const scrollToAICard = () => {
    setTimeout(() => {
      const card = document.getElementById('ai-tahlil-card');
      if (card) {
        // 1. Direct scrollIntoView
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // 2. Fallback for inner scrollable parent containers
        const scrollParent = card.closest('.overflow-y-auto') || document.querySelector('main') || document.documentElement;
        if (scrollParent) {
          const topPos = card.offsetTop - 80;
          scrollParent.scrollTo({ top: topPos, behavior: 'smooth' });
        }
      }
    }, 150);
  };

  async function handleAIAnalysisFlow(isUpdate = false) {
    // 1. Refresh profile to get the most recent coin balance
    await refreshUserProfile();

    const { data: freshData } = await supabase.from('profiles').select('coins').eq('id', profile.id).single();
    const liveCoins = freshData?.coins ?? profile.coins ?? 0;

    if (liveCoins < PREMIUM_AI_COST) {
      toast.error(`Tangalar yetarli emas! Sizda ${liveCoins} ta tanga bor. AI tahlil uchun ${PREMIUM_AI_COST} ta tanga kerak.`);
      return;
    }

    // IMMEDIATELY close modal and set loading state for the bottom card
    setShowPremiumAI(false);
    setCoachLoading(true);
    setCoachError("");

    scrollToAICard();

    try {
      const nextCoins = liveCoins - PREMIUM_AI_COST;

      // 1. Deduct coins and update cloud sync (Supabase)
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ coins: nextCoins })
        .eq('id', profile.id);

      if (updateErr) throw updateErr;

      // 2. Update global state immediately
      updateCoins(nextCoins);

      // 3. AI Generation with Claude API - Deep Telemetry
      const habitDataSummary = habitStats.map(h => {
        return `Odat: "${h.name}" | 30 kunlik bajarilish: ${h.completedDays}/30 (${h.pct}%) | Streak: ${h.streak} kun | Holat: ${h.pct >= 70 ? 'Kuchli' : h.pct < 30 ? 'Zaif' : "O'rtacha"}`;
      }).join('\n');

      const avgCalories = healthLogs.length > 0
        ? Math.round(healthLogs.reduce((acc, curr) => acc + (curr.calories || 0), 0) / healthLogs.length)
        : 0;

      const telemetryPayload = `
FOYDALANUVCHI PROFILI:
- Ism: ${profile.display_name}
- Daraja (Level): ${lv.level}
- Umumiy Intizom ko'rsatkichi: ${avgPercent}%
- So'nggi 7 kunlik faoliyat: ${weeklyComparison.thisTotal} ta bajarilgan odat
- O'rtacha Uyqu: ${coachSummary.avgSleepHours || '6'} soat
- O'rtacha Kaloriya: ${avgCalories} kkal
- O'rtacha Qadamlar: ${Math.round(totalMetrics.steps / (healthLogs.length || 1))} qadam

ODATLAR TELEMETRIYASI (Barcha faoliyat):
${habitDataSummary}
`;

      const analysisText = await requestClaudeHabitAnalysis(telemetryPayload);

      // 4. Save and Update local state + LocalStorage cache
      await upsertCoachNote(profile.id, analysisText);
      localStorage.setItem('latest_ai_analysis', JSON.stringify({
        text: analysisText,
        date: new Date().toISOString()
      }));

      setCoachNote(analysisText);
      setCoachGeneratedAt(new Date().toISOString());

      toast.success(isUpdate ? "Tahlil yangilandi!" : "AI Tahlil muvaffaqiyatli yakunlandi!");
    } catch (e: any) {
      setCoachError(e?.message || t('ai_coach_error'));
      toast.error(e?.message || "Xatolik yuz berdi.");
    } finally {
      setCoachLoading(false);
    }
  }

  async function handleGenerateCoachNote() {
    await handleAIAnalysisFlow(true);
  }

  async function handlePremiumAI() {
    await handleAIAnalysisFlow(false);
  }

  // Heatmap: 90 days
  const heatmapData = useMemo(() => {
    const now = new Date();
    const daysToShow = 90;
    return Array.from({ length: daysToShow }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (daysToShow - 1 - i));
      const ds = toDateStr(d);
      const done = byDate[ds] || 0;
      const rate = totalHabits > 0 ? (done / totalHabits) : 0;

      let score = 0;
      if (rate > 0 && rate <= 0.25) score = 1;
      else if (rate > 0.25 && rate <= 0.50) score = 2;
      else if (rate > 0.50 && rate <= 0.75) score = 3;
      else if (rate > 0.75) score = 4;

      const day = d.getDate();
      const mon = uzMonths[d.getMonth()];
      return { date: `${mon} ${day}`, score, ds, done, rate: Math.round(rate * 100) };
    });
  }, [byDate, totalHabits]);

  // Category Balance
  const categoryBalance = useMemo(() => {
    const categories: Record<string, number> = {
      'Rivojlanish': 0,
      'Sog\'lik': 0,
      'Ruhiyat': 0,
      'Mehnat': 0
    };
    logs.forEach(log => {
      if (isHabitLogSuccess(log)) {
        const cat = getHabitCategory(log.habits.name, log.habits.emoji || "");
        if (categories[cat] !== undefined) categories[cat]++;
        else categories['Rivojlanish']++; // Default
      }
    });
    return categories;
  }, [logs]);

  // Jami Sarflangan Vaqt & Qadamlar
  const totalMetrics = useMemo(() => {
    let steps = 0;
    let sleepHours = 0;
    let waterGlasses = 0;
    healthLogs.forEach(h => {
      steps += h.steps || 0;
      sleepHours += h.sleep_hours || 0;
      waterGlasses += h.water_glasses || 0;
    });
    return { steps, sleepHours, waterGlasses };
  }, [healthLogs]);

  // Weekly trend: last 7 days completion %
  const uzDays = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
  const weeklyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const ds = toDateStr(d);
      const done = byDate[ds] || 0;
      const pct = totalHabits > 0 ? Math.round((Math.min(done, totalHabits) / totalHabits) * 100) : 0;
      return { day: uzDays[d.getDay()], pct, done, isToday: ds === today };
    });
  }, [byDate, totalHabits, today]);

  // Weekly comparison: bu 7 kun vs oldingi 7 kun
  const weeklyComparison = useMemo(() => {
    const now = new Date();
    let thisTotal = 0, prevTotal = 0, thisDays = 0, prevDays = 0;
    const thisBars: number[] = [], prevBars: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const done = byDate[toDateStr(d)] || 0;
      thisTotal += done; if (done > 0) thisDays++;
      thisBars.push(totalHabits > 0 ? Math.round((Math.min(done, totalHabits) / totalHabits) * 100) : 0);
    }
    for (let i = 13; i >= 7; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const done = byDate[toDateStr(d)] || 0;
      prevTotal += done; if (done > 0) prevDays++;
      prevBars.push(totalHabits > 0 ? Math.round((Math.min(done, totalHabits) / totalHabits) * 100) : 0);
    }

    const diff = thisTotal - prevTotal;
    const pct = prevTotal > 0
      ? Math.round(Math.abs(diff / prevTotal) * 100)
      : thisTotal > 0 ? 100 : 0;
    return { thisTotal, prevTotal, diff, pct, thisDays, prevDays, thisBars, prevBars };
  }, [byDate, totalHabits]);

  // 30 kunlik tendensiya: kunlik bajarilish % + 7 kunlik siljigan o'rtacha
  // (izchillikni chiziq sifatida ko'rsatish uchun — heatmap panjarasi
  // trend yo'nalishini yaxshi ko'rsatmaydi).
  const trendData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const ds = toDateStr(d);
      const done = byDate[ds] || 0;
      const pct = totalHabits > 0 ? Math.round((Math.min(done, totalHabits) / totalHabits) * 100) : 0;
      return { label: `${d.getDate()} ${uzMonths[d.getMonth()]}`, pct };
    });
    return days.map((d, i) => {
      const win = days.slice(Math.max(0, i - 6), i + 1);
      const avg = Math.round(win.reduce((s, w) => s + w.pct, 0) / win.length);
      return { ...d, avg };
    });
  }, [byDate, totalHabits]);

  const card = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 12,
    padding: 20,
  };

  const getHeatColor = (score: number) => {
    if (score === 0) return isDark ? "#1f2937" : "#e5e7eb"; // gray-800 or gray-200
    if (score === 1) return "#064e3b"; // emerald-950
    if (score === 2) return "#065f46"; // emerald-800
    if (score === 3) return "#059669"; // emerald-600
    return "#34d399"; // emerald-400
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  const kpis = [
    {
      icon: ShieldCheck, label: "Intizom ko'rsatkichi",
      value: `${avgPercent}%`,
      sub: totalHabits > 0 ? `${completedToday}/${totalHabits} bugun` : t('analytics_no_habits'),
      color: "#10B981",
    },
    {
      icon: Flame, label: "Joriy & Rekord Streak",
      value: `${streak} / ${bestStreak}`,
      sub: "Kunlik izchillik",
      color: "#F97316",
    },
    {
      icon: Moon, label: "Jami Uyqu vaqti",
      value: `${totalMetrics.sleepHours} soat`,
      sub: "Tahlil qilingan davr",
      color: "#818cf8",
    },
    {
      icon: Footprints, label: "Jami Qadamlar",
      value: totalMetrics.steps.toLocaleString(),
      sub: "Harakat ko'rsatkichi",
      color: "#22d3ee",
    },
  ];

  const handleNativeShare = async (dataUrl: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `tahlil_${Date.now()}.png`;
        const base64Content = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Content,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Mening Oylik Intizom Tahlilim',
          text: "Tracker ilovasida mening yangi marralarim! 🔥",
          url: writeResult.uri,
          dialogTitle: 'Tahlilni ulashish',
        });
        toast.success("Tahlil ulashish uchun tayyorlandi!");
      } catch (nativeErr: any) {
        console.error("Capacitor Native Share Error:", nativeErr);
        const link = document.createElement("a");
        link.download = "tahlil.png";
        link.href = dataUrl;
        link.click();
        toast.success("Tahlil rasmi yuklab olindi!");
      }
    } else {
      const link = document.createElement("a");
      link.download = "tahlil.png";
      link.href = dataUrl;
      link.click();
      toast.success("Tahlil rasmi yuklab olindi!");
    }
  };

  const shareAnalytics = async () => {
    if (!posterRef.current || downloadingPoster) return;
    setDownloadingPoster(true);
    try {
      if (!posterRef.current) throw new Error("Poster DOM reference not found");

      // Small delay to ensure styles and layouts are settled
      await new Promise((r) => setTimeout(r, 150));

      const base64Data = await Promise.race([
        toPng(posterRef.current, {
          pixelRatio: 2,
          cacheBust: true,
          skipFonts: true,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Poster tayyorlash vaqti tugadi (timeout)")), 5000)
        ),
      ]);

      await handleNativeShare(base64Data);
    } catch (err: any) {
      console.error("Share error:", err);
      toast.error(`Tahlil tayyorlashda xatolik: ${err?.message || "Noma'lum xato"}`);
    } finally {
      setDownloadingPoster(false);
    }
  };

  const lv = getLevel(profile.score || 0);
  const initials = profile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const now = new Date();
  const monthName = uzMonths[now.getMonth()];

  return (
    <div className="flex flex-col gap-5">
      {/* View Mode Toggle */}
      <div className="flex justify-center mb-4">
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 w-full">
          <button
            onClick={() => setViewMode('personal')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'personal'
                ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <BarChart3 size={14} className="text-emerald-500 dark:text-emerald-400" />
            Shaxsiy Tahlil
          </button>
          <button
            onClick={() => setViewMode('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'leaderboard'
                ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Trophy size={14} className="text-amber-500 dark:text-amber-400" />
            Global Reyting
          </button>
        </div>
      </div>

      {showPremiumAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <motion.div
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="w-full max-w-md p-6 rounded-3xl bg-[#161B22] border border-amber-500/30 shadow-2xl"
           >
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-3 rounded-2xl bg-amber-500/20">
                    <Sparkles className="w-6 h-6 text-amber-400" />
                 </div>
                 <div>
                    <h2 className="text-lg font-bold text-white">Premium AI Tahlil</h2>
                    <p className="text-xs text-slate-400">Shaxsiy murabbiyingizdan chuqur tahlil</p>
                 </div>
              </div>

              <div className="space-y-4 mb-6">
                 <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-300 leading-relaxed">
                       Ushbu tahlil sizning:
                       <br />• <b>Eng kuchsiz odatlaringiz</b> va ularni tuzatish yo'llari
                       <br />• <b>Eng mahsuldor vaqtlaringiz</b> tahlili
                       <br />• <b>Psixologik tavsiyalar</b> va motivatsiyani oshirish
                       <br />ni o'z ichiga oladi.
                    </p>
                 </div>
                 <div className="flex justify-between items-center px-1">
                    <span className="text-xs text-slate-500">Narxi:</span>
                    <div className="flex items-center gap-1">
                       <span className="text-sm font-black text-amber-400">200</span>
                       <Coins className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                 </div>
              </div>

              <div className="flex gap-3">
                 <button
                   onClick={() => setShowPremiumAI(false)}
                   className="flex-1 py-3 rounded-2xl bg-white/5 text-slate-400 text-sm font-bold active:scale-95 transition-all"
                 >
                    Bekor qilish
                 </button>
                 <button
                   onClick={handlePremiumAI}
                   disabled={coachLoading}
                   className="flex-1 py-3 rounded-2xl bg-amber-500 text-black text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                    {coachLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tasdiqlash"}
                 </button>
              </div>
           </motion.div>
        </div>
      )}

      {viewMode === 'leaderboard' ? (
        <GlobalLeaderboardPage isDark={isDark} profile={profile} onUserClick={onUserClick} />
      ) : (
        <>
          {/* Time Filter Pills */}
          <div className="flex justify-center mb-2">
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
              {[
                { id: 'weekly', label: 'Haftalik' },
                { id: 'monthly', label: 'Oylik' },
                { id: 'yearly', label: 'Yillik' },
                { id: 'all', label: 'Hammasi' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    timeFilter === f.id
                      ? "bg-white dark:bg-white/10 text-emerald-500 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Full-width Share CTA Banner */}
          <button
            type="button"
            onClick={shareAnalytics}
            disabled={downloadingPoster}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm my-3 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {downloadingPoster ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Share2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{downloadingPoster ? "Tahlil tayyorlanmoqda..." : "Tahlilni ulashish"}</span>
          </button>

      {/* ── HIGH-IMPACT 9:16 SOCIAL SHARE CARD TEMPLATE (1080x1920 @ 2x) ── */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
        }}
      >
        <div
          ref={posterRef}
          className="w-[540px] h-[960px] bg-[#0a0f1d] text-white p-8 flex flex-col justify-between relative overflow-hidden font-sans"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Blurred Orb Backgrounds */}
          <div className="absolute top-10 -left-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-20 -right-20 w-80 h-80 bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

          {/* Top Header */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-black uppercase tracking-widest shadow-sm">
                <Zap size={14} className="fill-emerald-400" />
                <span>TRACKER · INTIZOM VA STATISTIKA</span>
              </div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {monthName} {now.getFullYear()}
              </span>
            </div>

            {/* User Identity */}
            <div className="flex items-center gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold text-2xl shrink-0 shadow-lg">
                {(profile.display_name || "A")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black truncate leading-snug">{profile.display_name}</h2>
                <p className="text-xs font-semibold text-slate-400 mb-1.5">@{profile.username}</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  Lv.{lv.level} · {lv.label}
                </span>
              </div>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 relative z-10 my-auto">
            {/* Stat Card 1: Intizom Foizi */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 to-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <ShieldCheck size={22} />
              </div>
              <div>
                <span className="text-4xl font-black text-emerald-400 tracking-tight leading-none block mb-1">
                  {avgPercent}%
                </span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Oylik Barqarorlik</p>
              </div>
            </div>

            {/* Stat Card 2: Maksimal Streak */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 to-amber-950/20 border border-amber-500/30 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Flame size={22} className="fill-amber-400" />
              </div>
              <div>
                <span className="text-4xl font-black text-amber-400 tracking-tight leading-none block mb-1">
                  {bestStreak} Kun
                </span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Uzluksiz Seriya</p>
              </div>
            </div>

            {/* Stat Card 3: Bajarilgan Odatlar */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-indigo-950/20 border border-indigo-500/30 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                <Trophy size={22} />
              </div>
              <div>
                <span className="text-4xl font-black text-indigo-400 tracking-tight leading-none block mb-1">
                  {totalMonth}+
                </span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bajarilgan Odatlar</p>
              </div>
            </div>

            {/* Stat Card 4: Faollik & Salomatlik */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/15 to-cyan-950/20 border border-cyan-500/30 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <Footprints size={22} />
              </div>
              <div>
                <span className="text-2xl font-black text-cyan-400 tracking-tight leading-none block mb-1">
                  {totalMetrics.steps.toLocaleString()}
                </span>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Qadam / {totalMetrics.sleepHours}s Uyqu</p>
              </div>
            </div>
          </div>

          {/* Sparkline / Trend Dot Matrix */}
          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                30 Kunlik Faollik Tendensiyasi
              </span>
              <span className="text-xs font-black text-emerald-400">{avgPercent}% O'rtacha</span>
            </div>
            <div className="grid grid-cols-10 gap-2">
              {heatmapData.slice(-30).map((d, idx) => (
                <div
                  key={idx}
                  className="h-6 rounded-lg transition-all"
                  style={{
                    background: getHeatColor(d.score),
                    boxShadow: d.score > 2 ? "0 0 8px rgba(74,222,128,0.3)" : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer Watermark */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-black text-xs">
                T
              </div>
              <span className="text-xs font-bold text-slate-300">tracker.app</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 italic">
              Kichik odatlar, buyuk natijalar ✨
            </span>
          </div>
        </div>
      </div>

      <div id="analytics-content" className="flex flex-col gap-5 p-1 -m-1 rounded-xl" style={{ background: "transparent" }}>

      {/* KPI Grid */}
      <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-emerald-400/10">
            <BarChart3 size={16} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            {t('analytics_title')}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl p-3.5"
              style={{
                background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5"
                style={{ background: `${kpi.color}20` }}
              >
                <kpi.icon size={14} style={{ color: kpi.color }} />
              </div>
              <p
                className="text-lg font-bold leading-none text-slate-900 dark:text-white"
                style={{ fontFamily: "'Geist Mono', monospace" }}
              >
                {kpi.value}
              </p>
              <p className="text-[11px] mt-1.5 font-medium text-slate-500 dark:text-slate-400">
                {kpi.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: kpi.color, fontFamily: "'Geist Mono', monospace" }}>
                {kpi.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly completion chart */}
      <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-400/10">
              <TrendingUp size={16} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                {t('analytics_weekly')}
              </h3>
              <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                {t('analytics_weekly_sub')}
              </p>
            </div>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: isDark ? "rgba(74,222,128,0.12)" : "#DCFCE7",
              color: isDark ? "var(--neon-green)" : "#16A34A",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {weeklyData.find((d) => d.isToday)?.pct ?? 0}% {t('analytics_today_label')}
          </span>
        </div>

        {totalHabits === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
            {t('analytics_no_habits')}
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2" style={{ height: 96 }}>
              {weeklyData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span
                    className="text-[10px]"
                    style={{
                      color: d.isToday ? "#4ADE80" : "var(--muted-foreground)",
                      fontFamily: "'Geist Mono', monospace",
                      minHeight: 14,
                    }}
                  >
                    {d.pct > 0 ? `${d.pct}%` : ""}
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: 64 }}>
                    <div
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{
                        height: d.pct > 0 ? `${Math.max(d.pct, 6)}%` : "3px",
                        background: d.isToday
                          ? "#4ADE80"
                          : d.pct > 0
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
              ))}
            </div>
            {/* Target line label */}
            <div className="flex items-center justify-end mt-3 gap-1.5">
              <div className="w-4 h-px border-t border-dashed" style={{ borderColor: "rgba(74,222,128,0.4)" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                100% = {totalHabits} ta odat
              </span>
            </div>
          </>
        )}
      </div>

      {/* Weekly Comparison */}
      {totalHabits > 0 && (
        <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                {t('analytics_comparison')}
              </h3>
              <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                {t('analytics_comparison_sub')}
              </p>
            </div>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: weeklyComparison.diff > 0
                  ? "rgba(74,222,128,0.12)"
                  : weeklyComparison.diff < 0
                  ? "rgba(248,113,113,0.12)"
                  : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                color: weeklyComparison.diff > 0 ? "#16A34A" : weeklyComparison.diff < 0 ? "#DC2626" : "#64748B",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {weeklyComparison.diff > 0 ? `↑ +${weeklyComparison.pct}%` : weeklyComparison.diff < 0 ? `↓ ${weeklyComparison.pct}%` : "= O'zgarishsiz"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Bu hafta */}
            <div
              className="p-4 rounded-xl"
              style={{
                background: isDark ? "rgba(74,222,128,0.06)" : "#F0FDF4",
                border: "1px solid rgba(74,222,128,0.18)",
              }}
            >
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#4ADE80" }}>{t('analytics_this_7')}</p>
              <p className="text-3xl font-bold leading-none" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
                {weeklyComparison.thisTotal}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>{t('done')}</p>
              <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--muted-foreground)" }}>
                {weeklyComparison.thisDays}/7 faol kun
              </p>
            </div>
            {/* Oldingi hafta */}
            <div
              className="p-4 rounded-xl"
              style={{
                background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
              }}
            >
              <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>{t('analytics_prev_7')}</p>
              <p className="text-3xl font-bold leading-none" style={{ color: "var(--card-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {weeklyComparison.prevTotal}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>{t('done')}</p>
              <p className="text-[10px] mt-2 font-medium" style={{ color: "var(--muted-foreground)" }}>
                {weeklyComparison.prevDays}/7 faol kun
              </p>
            </div>
          </div>

          {/* Bar comparison: 7 pairs */}
          <div>
            <div className="flex items-end gap-1" style={{ height: 56 }}>
              {weeklyComparison.thisBars.map((thisPct, i) => {
                const prevPct = weeklyComparison.prevBars[i];
                const maxPct = Math.max(thisPct, prevPct, 1);
                return (
                  <div key={i} className="flex-1 flex items-end gap-px" style={{ height: "100%" }}>
                    <div className="flex-1 rounded-t-sm transition-all duration-500"
                      style={{
                        height: `${Math.max((prevPct / maxPct) * 100, prevPct > 0 ? 6 : 0)}%`,
                        background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                      }}
                    />
                    <div className="flex-1 rounded-t-sm transition-all duration-500"
                      style={{
                        height: `${Math.max((thisPct / maxPct) * 100, thisPct > 0 ? 6 : 0)}%`,
                        background: thisPct >= prevPct ? "#4ADE80" : "#F87171",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }} />
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_prev_week')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4ADE80" }} />
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('reflect_this_week')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Advice Card */}
      <div id="ai-tahlil-card" className="rounded-2xl p-5 mb-5 relative overflow-hidden group border border-amber-500/20"
           style={{ background: isDark ? "linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)" : "#fffbeb" }}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/20 shrink-0">
             <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
             <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">AI Intellektual Tahlil</h3>
             <p className="text-[11px] text-amber-800 dark:text-amber-200/60 leading-relaxed mb-4">
                Zaif odatlaringizni aniqlang va AI murabbiyidan shaxsiy tavsiyalar oling.
             </p>
             <button
               onClick={() => setShowPremiumAI(true)}
               className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all active:scale-95 flex items-center gap-2"
             >
                AI Tahlilni Boshlash (200 <Coins className="w-3.5 h-3.5 fill-current" />)
             </button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-400/10">
              <Calendar size={16} className="text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Faollik Matritsasi
              </h3>
              <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                So'nggi 90 kunlik izchillik
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {t('analytics_heatmap_low')}
            </span>
            {[0, 1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: getHeatColor(s) }}
              />
            ))}
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {t('analytics_heatmap_high')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(14px,1fr))] gap-1.5">
          {heatmapData.map((day, i) => (
            <motion.div
              key={i}
              whileTap={{ scale: 0.9 }}
              onClick={() => toast(`${day.date}: ${day.done} ta bajarildi (${day.rate}%)`)}
              className="aspect-square rounded-sm cursor-pointer"
              style={{ background: getHeatColor(day.score) }}
            />
          ))}
        </div>

        <div className="flex justify-between mt-3">
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {heatmapData[0]?.date}
          </span>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            Bugun
          </span>
        </div>
      </div>

      {/* 30 kunlik tendensiya chizig'i */}
      {totalHabits > 0 && (
        <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
          <div className="mb-1">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              {t('analytics_trend')}
            </h3>
            <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
              {t('analytics_trend_sub')}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-3 mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4ADE80" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_trend_daily')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 rounded-sm" style={{ background: "#60A5FA" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_trend_avg7')}</span>
            </div>
          </div>
          <div style={{ height: 180, marginLeft: -12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: isDark ? "#8B949E" : "#6B7280" }}
                  interval={4}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tick={{ fontSize: 9, fill: isDark ? "#8B949E" : "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: isDark ? "#161B22" : "#ffffff",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: isDark ? "#8B949E" : "#6B7280" }}
                  formatter={(value: number, name: string) => [`${value}%`, name === "pct" ? t('analytics_trend_daily') : t('analytics_trend_avg7')]}
                />
                <Area type="monotone" dataKey="pct" stroke="#4ADE80" strokeWidth={2} fill="#4ADE80" fillOpacity={0.12} />
                <Line type="monotone" dataKey="avg" stroke="#60A5FA" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Balance */}
      <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-purple-400/10">
            <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            Yo'nalishlar balansi
          </h3>
        </div>
        <div className="space-y-4">
          {Object.entries(categoryBalance).map(([cat, val]) => {
            const max = Math.max(...Object.values(categoryBalance), 1);
            const pct = Math.round((val / max) * 100);
            return (
              <div key={cat}>
                <div className="flex justify-between text-[11px] mb-1 font-medium">
                  <span className="text-slate-500 dark:text-muted-foreground">{cat}</span>
                  <span className="text-slate-900 dark:text-foreground">{val} ta</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${pct}%` }}
                     className="h-full bg-purple-500 rounded-full"
                   />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-habit breakdown */}
      {habitStats.length > 0 && (
        <div style={{ ...card, background: isDark ? "rgba(22,27,34,0.85)" : "#fff" }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                {t('analytics_per_habit')}
              </h3>
              <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                {t('analytics_per_habit_sub')}
              </p>
            </div>

            <button
              onClick={() => navigate('/habits')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold active:scale-95 transition-all shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span>Boshqarish</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-1" />
            </button>
          </div>

          <div className="mb-6">
            {/* Highlights */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-amber-400/5 border border-amber-400/10">
                <div className="flex items-center gap-2 mb-2">
                   <Trophy size={14} className="text-amber-600 dark:text-amber-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 opacity-60">Eng yaxshi</span>
                </div>
                <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{cleanHabitName(habitStats[0].name)}</p>
                <p className="text-[10px] mt-1 text-amber-600 dark:text-amber-400 font-black" style={{ fontFamily: "'Geist Mono', monospace" }}>{habitStats[0].pct}% muvaffaqiyat</p>
              </div>
              <div className="p-3 rounded-2xl bg-rose-400/5 border border-rose-400/10">
                <div className="flex items-center gap-2 mb-2">
                   <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 opacity-60">E'tibor talab</span>
                </div>
                <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{cleanHabitName(habitStats[habitStats.length-1].name)}</p>
                <p className="text-[10px] mt-1 text-rose-600 dark:text-rose-400 font-black" style={{ fontFamily: "'Geist Mono', monospace" }}>{habitStats[habitStats.length-1].pct}% muvaffaqiyat</p>
              </div>
            </div>

            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('analytics_per_habit_sub')}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {habitStats.map((h) => {
              const isStrong = h.pct >= 70;
              const isWeak = h.pct < 30;
              const barColor = isStrong ? "#4ADE80" : isWeak ? "#F87171" : "#FBBF24";
              return (
                <div key={h.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <HabitIcon emoji={h.emoji} name={h.name} />
                      <span className="text-sm font-medium text-slate-900 dark:text-card-foreground">
                        {cleanHabitName(h.name)}
                      </span>
                      {h.streak > 1 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{
                            background: "rgba(249,115,22,0.12)",
                            color: "#F97316",
                            fontFamily: "'Geist Mono', monospace",
                          }}
                        >
                          🔥 {h.streak}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs"
                        style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}
                      >
                        {h.completedDays}/30 {t('days')}
                      </span>
                      <span
                        className="text-xs font-bold w-10 text-right"
                        style={{ color: barColor, fontFamily: "'Geist Mono', monospace" }}
                      >
                        {h.pct}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${h.pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t flex-wrap" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            {[
              { color: "#16A34A", label: t('analytics_strong') },
              { color: "#D97706", label: t('analytics_mid') },
              { color: "#DC2626", label: t('analytics_weak') },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-slate-500 dark:text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div
        ref={aiCardRef}
        id="ai-tahlil-card-detail"
        className="rounded-2xl overflow-hidden transition-all duration-500"
        style={{
          background: isDark ? "rgba(22,27,34,0.9)" : "#fff",
          border: coachLoading ? "1px solid rgba(251,191,36,0.5)" : `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
          boxShadow: coachLoading ? "0 0 30px rgba(251,191,36,0.15)" : "none"
        }}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)" }}>
            <Brain size={15} style={{ color: "#A78BFA" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('analytics_ai')}</p>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('analytics_ai_sub')}</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* AI Coach Note — real LLM call, generated on demand and cached in ai_coach_notes */}
          <div
            className={`p-4 rounded-2xl relative transition-all duration-500 ${coachLoading ? 'animate-pulse' : ''}`}
            style={{
              background: isDark ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.06)",
              border: coachLoading ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(167,139,250,0.25)"
            }}
          >
            {coachLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                 <Sparkles className="w-8 h-8 text-amber-400 animate-spin mb-4" />
                 <p className="text-sm font-bold text-amber-400 uppercase tracking-widest text-center">
                   AI murabbiy sizning barcha ko'rsatkichlaringizni chuqur tahlil qilmoqda...
                 </p>
              </div>
            )}
            {!coachLoading && coachNote ? (
              <>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--foreground)" }}>{coachNote}</p>
                <div
                  className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}` }}
                >
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {coachGeneratedAt ? new Date(coachGeneratedAt).toLocaleDateString() : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateCoachNote}
                    disabled={coachLoading}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-400"
                    style={{ opacity: coachLoading ? 0.6 : 1 }}
                  >
                    {coachLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                    <span>Yangilash</span>
                    <Coins className="w-3.5 h-3.5 text-amber-400 ml-1" />
                    <span>{PREMIUM_AI_COST}</span>
                  </button>
                </div>
              </>
            ) : !coachLoading && (
              <div className="text-center py-2">
                <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>
                  {canGenerateCoachNote ? t('ai_coach_intro') : t('ai_coach_not_enough_data')}
                </p>
                <button
                  type="button"
                  onClick={handlePremiumAI}
                  disabled={!canGenerateCoachNote || coachLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: canGenerateCoachNote ? "#A78BFA" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                    color: canGenerateCoachNote ? "#0a0a0a" : "var(--muted-foreground)",
                    opacity: coachLoading ? 0.7 : 1,
                  }}
                >
                  {coachLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {coachLoading ? t('ai_coach_generating') : `${t('ai_coach_generate_btn')} · ${PREMIUM_AI_COST}`}
                  {!coachLoading && <Coins className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
              </div>
            )}
            {coachError && (
              <p className="text-[11px] text-center mt-2" style={{ color: "var(--coral-red)" }}>⚠ {coachError}</p>
            )}
          </div>

          {/* Existing lightweight, instant client-side correlations (mood/sleep/screen) */}
          {insights.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide px-1" style={{ color: "var(--muted-foreground)" }}>
                {t('analytics_ai_patterns_heading')}
              </p>
              {insights.map((ins, i) => (
                <div key={i} className="p-4 rounded-2xl" style={{ background: ins.bg, border: `1px solid ${ins.border}` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ins.color}15` }}>
                       <ins.icon size={18} style={{ color: ins.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: ins.color }}>{ins.title}</p>
                      <p className="text-[12px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{ins.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      </div>

        </>
      )}
    </div>
  );
}
