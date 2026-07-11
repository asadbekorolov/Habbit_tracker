import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Trophy, Zap, Flame, BarChart2, Loader2, Image, Brain, Sparkles, RefreshCw } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getLast30DaysLogs, getMonthNotes, getMonthHealthLogs, getCoachNote, upsertCoachNote, spendCoinsForAnalysis, refundAnalysisCoins, AI_ANALYSIS_COST } from "../../services/db";
import { getLevel } from "../../utils/levels";
import { toDateStr } from "../../utils/date";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";

interface AnalyticsProps {
  isDark: boolean;
  completedToday: number;
  totalHabits: number;
  profile: Profile;
}

const uzMonths = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

export function Analytics({ isDark, completedToday, totalHabits, profile }: AnalyticsProps) {
  const { t, lang } = useLang();
  const [logs, setLogs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPoster, setDownloadingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [coachGeneratedAt, setCoachGeneratedAt] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");

  const today = toDateStr();

  useEffect(() => {
    const now = new Date();
    Promise.all([
      getLast30DaysLogs(profile.id),
      getMonthNotes(profile.id, now.getFullYear(), now.getMonth() + 1),
      getMonthHealthLogs(profile.id, now.getFullYear(), now.getMonth() + 1),
    ]).then(([logData, noteData, healthData]) => {
      setLogs(logData || []);
      setNotes(noteData || []);
      setHealthLogs(healthData || []);
    }).catch(() => {}).finally(() => setLoading(false));

    getCoachNote(profile.id).then((cached) => {
      if (cached) { setCoachNote(cached.note); setCoachGeneratedAt(cached.generated_at); }
    }).catch(() => {});
  }, [profile.id]);

  // completed count per date (positive habits only)
  const byDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      if (log.completed && log.habits?.type === "positive") {
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

  // Per-habit stats
  const habitStats = useMemo(() => {
    const map: Record<string, { name: string; emoji: string; days: Set<string>; streak: number }> = {};
    const now = new Date();

    for (const log of logs) {
      if (log.completed && log.habits?.type === "positive") {
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

    const result: { emoji: string; title: string; body: string; color: string; bg: string; border: string }[] = [];

    // Mood
    const moodPairs = paired.filter(([, n]) => n.mood != null);
    if (moodPairs.length >= 5) {
      const hi = avgCompletion(moodPairs.filter(([, n]) => n.mood! >= 4));
      const lo = avgCompletion(moodPairs.filter(([, n]) => n.mood! <= 2));
      if (hi !== null && lo !== null && Math.abs(hi - lo) >= 10) {
        const diff = hi - lo;
        result.push({
          emoji: "😊",
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
          emoji: "😴",
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
          emoji: "📱",
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
        if (!log.completed) negMap[id].broken++;
      }
    }
    const negativeHabits = Object.values(negMap).map((n) => ({
      name: n.name,
      loggedDays: n.logged,
      breakRatePct: n.logged > 0 ? Math.round((n.broken / n.logged) * 100) : 0,
    }));

    const weekdayBuckets = Array.from({ length: 7 }, () => ({ occurrences: 0, positiveDone: 0, negativeLogged: 0, negativeBroken: 0 }));
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      weekdayBuckets[d.getDay()].occurrences++;
    }
    for (const log of logs) {
      const wd = new Date(log.log_date + "T00:00:00").getDay();
      const bucket = weekdayBuckets[wd];
      if (log.habits?.type === "positive" && log.completed) bucket.positiveDone++;
      if (log.habits?.type === "negative") {
        bucket.negativeLogged++;
        if (!log.completed) bucket.negativeBroken++;
      }
    }
    const weekdaySummary = weekdayBuckets.map((b, wd) => ({
      weekday: uzWeekdayNames[wd],
      avgHabitsCompleted: b.occurrences > 0 ? Math.round((b.positiveDone / b.occurrences) * 10) / 10 : 0,
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
      positiveHabits: habitStats.slice(0, 8).map((h) => ({ name: h.name, streakDays: h.streak, completionPct: h.pct })),
      negativeHabits,
      avgSleepHours: avg(healthLogs.map((h) => h.sleep_hours).filter((v): v is number => v != null)),
      avgScreenHours: avg(healthLogs.map((h) => h.screen_time_hours).filter((v): v is number => v != null)),
      avgMood: avg(notes.map((n) => n.mood).filter((v): v is number => v != null)),
      weekdaySummary,
      recentNotes,
    };
  }, [logs, notes, healthLogs, habitStats, streak, bestStreak, avgPercent, totalHabits]);

  const canGenerateCoachNote = logs.length >= 5;

  async function handleGenerateCoachNote() {
    if (!canGenerateCoachNote || coachLoading) return;
    setCoachError("");
    // Tangani AI chaqiruvidan OLDIN, atomik spend_coins RPC orqali yechamiz
    // (purchaseCoinItem bilan bir xil naqsh) — shu bilan real API xarajati
    // faqat yetarli balansi bo'lgan foydalanuvchilar uchun sodir bo'ladi.
    const paid = await spendCoinsForAnalysis(profile.id);
    if (!paid) {
      toast.error(t('ai_coach_insufficient_coins'));
      return;
    }
    setCoachLoading(true);
    try {
      const r = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: coachSummary, lang }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error === "not_configured" ? t('ai_coach_not_configured') : t('ai_coach_error'));
      await upsertCoachNote(profile.id, data.note);
      setCoachNote(data.note);
      setCoachGeneratedAt(new Date().toISOString());
    } catch (e: any) {
      // AI chaqiruvi texnik sababdan muvaffaqiyatsiz bo'ldi — tanga abadiy
      // yo'qolmasligi uchun qaytarib beramiz.
      await refundAnalysisCoins(profile.id);
      setCoachError(e?.message || t('ai_coach_error'));
    } finally {
      setCoachLoading(false);
    }
  }

  // Heatmap: 30 days (score 0-5 based on completion %)
  const heatmapData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const ds = toDateStr(d);
      const done = byDate[ds] || 0;
      const score = totalHabits > 0
        ? Math.min(5, Math.round((done / totalHabits) * 5))
        : Math.min(5, done);
      const day = d.getDate();
      const mon = uzMonths[d.getMonth()];
      return { date: `${mon} ${day}`, score, ds };
    });
  }, [byDate, totalHabits]);

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
    if (score === 0) return isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
    const opacity = 0.15 + score * 0.17;
    return `rgba(74,222,128,${opacity})`;
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
      icon: Zap, label: t('analytics_today_done'),
      value: totalHabits > 0 ? `${completedToday}/${totalHabits}` : "—",
      sub: totalHabits > 0 ? `${Math.round((completedToday / totalHabits) * 100)}%` : t('analytics_no_habits'),
      color: "#4ADE80",
    },
    {
      icon: Flame, label: t('analytics_current_streak'),
      value: `${streak} ${t('days')}`,
      sub: streak > 0 ? t('analytics_streak_active') : t('analytics_no_streak'),
      color: "#F97316",
    },
    {
      icon: Trophy, label: t('analytics_best_streak'),
      value: `${bestStreak} ${t('days')}`,
      sub: t('analytics_best_sub'),
      color: "#FBBF24",
    },
    {
      icon: BarChart2, label: t('analytics_avg'),
      value: `${avgPercent}%`,
      sub: t('analytics_this_month').replace('{n}', String(totalMonth)),
      color: "#60A5FA",
    },
  ];

  const handleDownloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloadingPoster(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        backgroundColor: "#0E1117",
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `Traccer_${profile.username}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert(t('analytics_poster_error'));
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDownloadPoster}
          disabled={downloadingPoster}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(74,222,128,0.15) 0%, rgba(167,139,250,0.15) 100%)",
            color: "#4ADE80",
            border: "1px solid rgba(74,222,128,0.3)",
            opacity: downloadingPoster ? 0.7 : 1,
            cursor: downloadingPoster ? "not-allowed" : "pointer",
          }}
        >
          {downloadingPoster ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
          {downloadingPoster ? t('analytics_preparing') : t('analytics_download')}
        </button>
      </div>

      {/* ── HIDDEN POSTER (off-screen, captured by html2canvas) ── */}
      <div
        ref={posterRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: 540,
          height: 540,
          background: "#0E1117",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Background gradient layers */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 20%, rgba(74,222,128,0.12) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 80%, rgba(167,139,250,0.10) 0%, transparent 60%)" }} />

        {/* Content */}
        <div style={{ position: "relative", padding: 40, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>

          {/* Top row: logo + date */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#4ADE80", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#0E1117" }}>T</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#F0F6FC", letterSpacing: -0.3 }}>Traccer</span>
            </div>
            <span style={{ fontSize: 11, color: "#6E7681", fontWeight: 500 }}>{monthName} {now.getFullYear()}</span>
          </div>

          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: profile.avatar_color || "#4ADE80",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: "#0E1117",
              border: "2px solid rgba(74,222,128,0.4)",
              flexShrink: 0,
            }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
                : initials
              }
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#F0F6FC", letterSpacing: -0.5, lineHeight: 1.2 }}>
                {profile.display_name}
              </div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: lv.color,
                  background: `${lv.color}1A`, border: `1px solid ${lv.color}44`,
                  padding: "2px 8px", borderRadius: 20,
                }}>
                  {lv.emoji} Lv.{lv.level} {lv.label}
                </span>
                <span style={{ fontSize: 11, color: "#FBBF24", fontWeight: 600 }}>★ {profile.score || 0}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            {[
              { emoji: "🔥", label: t('analytics_streak_label'), value: `${streak} ${t('days')}`, color: "#F97316" },
              { emoji: "✅", label: `${monthName}da`, value: `${totalMonth} ta`, color: "#4ADE80" },
              { emoji: "📊", label: t('analytics_avg'), value: `${avgPercent}%`, color: "#60A5FA" },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1, borderRadius: 14, padding: "14px 12px", textAlign: "center",
                background: `${s.color}12`, border: `1px solid ${s.color}28`,
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: "#6E7681", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Weekly activity */}
          <div style={{
            flex: 1, borderRadius: 14, padding: "16px 16px 12px",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6E7681", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t('analytics_weekly_activity')}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
              {weeklyData.map((d, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div style={{
                      width: "100%",
                      height: `${Math.max(8, d.pct)}%`,
                      borderRadius: 6,
                      background: d.isToday
                        ? "#4ADE80"
                        : d.pct > 0
                          ? `rgba(74,222,128,${0.3 + d.pct * 0.006})`
                          : "rgba(255,255,255,0.06)",
                      transition: "height 0.3s",
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: d.isToday ? "#4ADE80" : "#6E7681", fontWeight: d.isToday ? 700 : 400 }}>
                    {d.day}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(110,118,129,0.7)", letterSpacing: 0.3 }}>
              habit-tracker-asadbek.vercel.app
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i === 0 ? "#4ADE80" : "rgba(74,222,128,0.3)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div id="analytics-content" className="flex flex-col gap-5 p-1 -m-1 rounded-xl" style={{ background: "transparent" }}>

      {/* KPI Grid */}
      <div style={card}>
        <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--card-foreground)" }}>
          {t('analytics_title')}
        </h3>
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
                className="text-lg font-bold leading-none"
                style={{ color: "var(--card-foreground)", fontFamily: "'Geist Mono', monospace" }}
              >
                {kpi.value}
              </p>
              <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
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
      <div style={card}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--card-foreground)" }}>
              {t('analytics_weekly')}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('analytics_weekly_sub')}
            </p>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: isDark ? "rgba(74,222,128,0.12)" : "#DCFCE7",
              color: "var(--neon-green)",
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
        <div style={card}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm" style={{ color: "var(--card-foreground)" }}>
                {t('analytics_comparison')}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
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
                color: weeklyComparison.diff > 0 ? "#4ADE80" : weeklyComparison.diff < 0 ? "#F87171" : "var(--muted-foreground)",
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

      {/* Heatmap */}
      <div style={card}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--card-foreground)" }}>
              {t('analytics_heatmap')}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t('analytics_heatmap_sub')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {t('analytics_heatmap_low')}
            </span>
            {[0, 1, 2, 3, 4, 5].map((s) => (
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

        <div className="flex flex-wrap gap-1">
          {heatmapData.map((day, i) => (
            <div
              key={i}
              title={`${day.date}: ${day.score > 0 ? byDate[day.ds] + " " + t('done') : t('analytics_not_done_label')}`}
              className="w-5 h-5 rounded-sm cursor-pointer transition-transform hover:scale-125"
              style={{ background: getHeatColor(day.score) }}
            />
          ))}
        </div>

        <div className="flex justify-between mt-3">
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {heatmapData[0]?.date}
          </span>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {t('analytics_heatmap_today')}
          </span>
        </div>
      </div>

      {/* 30 kunlik tendensiya chizig'i */}
      {totalHabits > 0 && (
        <div style={card}>
          <div className="mb-1">
            <h3 className="font-semibold text-sm" style={{ color: "var(--card-foreground)" }}>
              {t('analytics_trend')}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
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

      {/* Per-habit breakdown */}
      {habitStats.length > 0 && (
        <div style={card}>
          <div className="mb-4">
            <h3 className="font-semibold text-sm" style={{ color: "var(--card-foreground)" }}>
              {t('analytics_per_habit')}
            </h3>
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
                      <span className="text-base">{h.emoji}</span>
                      <span className="text-sm font-medium" style={{ color: "var(--card-foreground)" }}>
                        {h.name}
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
          <div className="flex items-center gap-4 mt-4 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            {[
              { color: "#4ADE80", label: t('analytics_strong') },
              { color: "#FBBF24", label: t('analytics_mid') },
              { color: "#F87171", label: t('analytics_weak') },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="rounded-2xl overflow-hidden" style={{ background: isDark ? "rgba(22,27,34,0.9)" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }}>
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
            className="p-4 rounded-2xl"
            style={{ background: isDark ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.25)" }}
          >
            {coachNote ? (
              <>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--foreground)" }}>{coachNote}</p>
                <div
                  className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}
                >
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {coachGeneratedAt ? new Date(coachGeneratedAt).toLocaleDateString() : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateCoachNote}
                    disabled={coachLoading || !canGenerateCoachNote}
                    className="flex items-center gap-1.5 text-[11px] font-semibold"
                    style={{ color: "#A78BFA", opacity: coachLoading ? 0.6 : 1 }}
                  >
                    {coachLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {t('ai_coach_regenerate')} · 🪙{AI_ANALYSIS_COST}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>
                  {canGenerateCoachNote ? t('ai_coach_intro') : t('ai_coach_not_enough_data')}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateCoachNote}
                  disabled={!canGenerateCoachNote || coachLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: canGenerateCoachNote ? "#A78BFA" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                    color: canGenerateCoachNote ? "#0a0a0a" : "var(--muted-foreground)",
                    opacity: coachLoading ? 0.7 : 1,
                  }}
                >
                  {coachLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {coachLoading ? t('ai_coach_generating') : `${t('ai_coach_generate_btn')} · 🪙${AI_ANALYSIS_COST}`}
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
                    <span className="text-xl shrink-0 mt-0.5">{ins.emoji}</span>
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

    </div>
  );
}
