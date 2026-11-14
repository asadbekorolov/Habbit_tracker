// Tahlil (Analytics) — holat va mantiq (UI'dan ajratilgan).
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Flame, BarChart2, Brain, CheckCircle2, Moon, Activity as ActivityIcon, ShieldCheck } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { toPng } from "html-to-image";
import { useNavigate } from "react-router-dom";
import { getHabitCategory } from "../../utils/categoryTheme";
import { getCoachNote, upsertCoachNote, isHabitLogSuccess } from "../../services/db";
import { useHabitsMetaQuery, useLogsRangeQuery, useHealthRangeQuery, useMonthNotesQuery } from "../../hooks/queries";
import { supabase } from "../../services/supabase";
import { requestClaudeHabitAnalysis } from "../../services/aiService";
import { getLevel } from "../../utils/levels";
import { useUser, useProfile } from "../../store/UserContext";
import { tashkentTodayAnchor, toDateStr, addDays, getTashkentToday } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import { AnalyticsProps, uzMonths } from "./analyticsShared";

export function useAnalyticsData({ completedToday, totalHabits, onUserClick, onProfileUpdate }: AnalyticsProps) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { updateCoins, refreshUserProfile } = useUser();
  const profile = useProfile();

  const [downloadingPoster, setDownloadingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement | null>(null);
  const aiCardRef = useRef<HTMLDivElement | null>(null);
  const [timeFilter, setTimeFilter] = useState<'weekly' | 'monthly' | 'yearly' | 'all'>('monthly');
  const [viewMode, setViewMode] = useState<'personal' | 'leaderboard'>('personal');


  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [coachGeneratedAt, setCoachGeneratedAt] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [showPremiumAI, setShowPremiumAI] = useState(false);

  const today = toDateStr();

  const PREMIUM_AI_COST = 200;

  // ─── Ma'lumot oralig'i ─────────────────────────────────────────────
  // "Hammasi" — hisob ochilgan kundan (Toshkent sanasi) bugungacha.
  const createdDay = profile.created_at ? getTashkentToday(new Date(profile.created_at)) : addDays(today, -365);
  const accountStart = createdDay > today ? today : createdDay;
  const rangeFrom = timeFilter === 'weekly' ? addDays(today, -7)
    : timeFilter === 'monthly' ? addDays(today, -30)
    : timeFilter === 'yearly' ? addDays(today, -365)
    : accountStart;

  // Ixcham loglar (habit_id, log_date, completed, value) 1000 qatorlik
  // bo'laklarda; odat nomi/turi alohida yuklangan ro'yxatdan (o'chirilganlari ham).
  const metaQ = useHabitsMetaQuery(profile.id);
  const logsQ = useLogsRangeQuery(profile.id, rangeFrom, today, { keepPrevious: true });
  const healthQ = useHealthRangeQuery(profile.id, rangeFrom, today, { keepPrevious: true });
  const nowAnchor = tashkentTodayAnchor();
  const notesQ = useMonthNotesQuery(profile.id, nowAnchor.getFullYear(), nowAnchor.getMonth() + 1);
  // Heatmap har doim so'nggi 90 kun (tanlangan filtrga bog'liq emas).
  const heatmapLogsQ = useLogsRangeQuery(profile.id, addDays(today, -89), today);

  const habitMeta = useMemo(() => new Map((metaQ.data || []).map((h) => [h.id, h])), [metaQ.data]);
  const attachMeta = (rows: any[] | undefined) =>
    (rows || []).flatMap((l) => {
      const h = habitMeta.get(l.habit_id);
      return h ? [{ ...l, habits: { name: h.name, emoji: h.emoji, type: h.type } }] : [];
    });
  const logs: any[] = useMemo(() => attachMeta(logsQ.data), [logsQ.data, habitMeta]);
  const healthLogs: any[] = healthQ.data || [];
  const notes: any[] = notesQ.data || [];
  const loading = logsQ.isPending || metaQ.isPending;

  useEffect(() => {
    getCoachNote(profile.id).then((cached) => {
      if (cached) { setCoachNote(cached.note); setCoachGeneratedAt(cached.generated_at); }
    }).catch(() => {});
  }, [profile.id]);

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
    const now = tashkentTodayAnchor();
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
    const now = tashkentTodayAnchor();

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
    const now = tashkentTodayAnchor();
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
      // Tanga serverda (api/ai-analysis.ts -> spend_coins_for_ai) yechiladi;
      // AI xato bersa o'sha yerda qaytariladi. Bu yerda faqat UI yangilanadi.

      // AI Generation with Claude API - Deep Telemetry
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
      updateCoins(Math.max(0, liveCoins - PREMIUM_AI_COST));
      refreshUserProfile().catch(() => {});

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

  // Heatmap: 90 days (o'z so'rovi — haftalik filtrda ham 90 kun to'liq)
  const heatmapByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of heatmapLogsQ.data || []) {
      if (isHabitLogSuccess(log) && habitMeta.has(log.habit_id)) {
        map[log.log_date] = (map[log.log_date] || 0) + 1;
      }
    }
    map[today] = completedToday;
    return map;
  }, [heatmapLogsQ.data, habitMeta, completedToday, today]);

  const heatmapData = useMemo(() => {
    const now = tashkentTodayAnchor();
    const daysToShow = 90;
    return Array.from({ length: daysToShow }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (daysToShow - 1 - i));
      const ds = toDateStr(d);
      const done = heatmapByDate[ds] || 0;
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
  }, [heatmapByDate, totalHabits]);

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
      steps += Number(h.steps) || 0;
      sleepHours += Number(h.sleep_hours) || 0;
      waterGlasses += Number(h.water_glasses) || 0;
    });
    return {
      steps: Math.round(steps),
      sleepHours: Math.round(sleepHours * 10) / 10,
      waterGlasses: Math.round(waterGlasses),
    };
  }, [healthLogs]);

  // Weekly trend: last 7 days completion %
  const uzDays = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
  const weeklyData = useMemo(() => {
    const now = tashkentTodayAnchor();
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
    const now = tashkentTodayAnchor();
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
    const now = tashkentTodayAnchor();
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
    background: "rgba(22,27,34,0.85)",
    border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: 12,
    padding: 20,
  };

  const getHeatColor = (score: number) => {
    if (score === 0) return "#1f2937"; // gray-800 or gray-200
    if (score === 1) return "#064e3b"; // emerald-950
    if (score === 2) return "#065f46"; // emerald-800
    if (score === 3) return "#059669"; // emerald-600
    return "#34d399"; // emerald-400
  };

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
      icon: CheckCircle2, label: "Jami Bajarilgan Odatlar",
      value: `${totalMonth} ta`,
      sub: "Oylik jami bajarilish",
      color: "#3B82F6",
    },
    {
      icon: BarChart2, label: "Odatlar Taqsimoti",
      value: `${totalHabits} ta odat`,
      sub: "Faol kuzatuvdagi odatlar",
      color: "#A855F7",
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
          text: "IDROK ilovasida mening yangi marralarim! 🔥",
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
  const now = tashkentTodayAnchor();
  const monthName = uzMonths[now.getMonth()];

  return {
    completedToday,
    totalHabits,
    onUserClick,
    onProfileUpdate,
    t,
    lang,
    navigate,
    updateCoins,
    refreshUserProfile,
    profile,
    downloadingPoster,
    setDownloadingPoster,
    posterRef,
    aiCardRef,
    timeFilter,
    setTimeFilter,
    viewMode,
    setViewMode,
    coachNote,
    setCoachNote,
    coachGeneratedAt,
    setCoachGeneratedAt,
    coachLoading,
    setCoachLoading,
    coachError,
    setCoachError,
    showPremiumAI,
    setShowPremiumAI,
    today,
    PREMIUM_AI_COST,
    createdDay,
    accountStart,
    rangeFrom,
    metaQ,
    logsQ,
    healthQ,
    nowAnchor,
    notesQ,
    heatmapLogsQ,
    habitMeta,
    attachMeta,
    logs,
    healthLogs,
    notes,
    loading,
    byDate,
    streak,
    bestStreak,
    totalMonth,
    avgPercent,
    habitStats,
    insights,
    uzWeekdayNames,
    coachSummary,
    canGenerateCoachNote,
    scrollToAICard,
    handleAIAnalysisFlow,
    handleGenerateCoachNote,
    handlePremiumAI,
    heatmapByDate,
    heatmapData,
    categoryBalance,
    totalMetrics,
    uzDays,
    weeklyData,
    weeklyComparison,
    trendData,
    card,
    getHeatColor,
    kpis,
    handleNativeShare,
    shareAnalytics,
    lv,
    initials,
    now,
    monthName,
  };
}

export type AnalyticsData = ReturnType<typeof useAnalyticsData>;
