import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2, NotebookText } from "lucide-react";
import { getHabits, getMonthLogs, getMonthNotes } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { toDateStr } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import { MONTHS_FULL, DAYS_SHORT, DAYS_FULL } from "../../utils/i18n";

const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

interface MonthGridProps {
  isDark: boolean;
  profile: Profile;
}

export function MonthGrid({ isDark, profile }: MonthGridProps) {
  const { t, lang } = useLang();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [habits, setHabits] = useState<any[]>([]);
  const [logs, setLogs] = useState<{ habit_id: string; log_date: string; completed: boolean }[]>([]);
  const [notes, setNotes] = useState<{ note_date: string; content: string; mood: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = toDateStr(now);

  useEffect(() => {
    load();
  }, [profile.id, year, month]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [habitsData, logsData, notesData] = await Promise.all([
        getHabits(profile.id),
        getMonthLogs(profile.id, year, month),
        getMonthNotes(profile.id, year, month),
      ]);
      setHabits(habitsData || []);
      setLogs(logsData || []);
      setNotes(((notesData || []) as any[]).filter((n) => n.content && n.content.trim().length > 0));
    } catch {
      setError(t('err_loading'));
    }
    finally { setLoading(false); }
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  // "habitId_date" -> completed (true = good outcome: Done/Avoided,
  // false = bad outcome: Missed/Broken). Row absence = no data (pending).
  // completed:true always means "good" for both habit types since
  // toggleHabit/markHabitMissed (positive) and markNegativeHabit
  // (negative) share the exact same completed-boolean semantics.
  const statusMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const l of logs) m.set(`${l.habit_id}_${l.log_date}`, l.completed);
    return m;
  }, [logs]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const canGoNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
    if (!canGoNext) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFutureDay = (day: number) => {
    const d = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return d > today;
  };
  const isToday = (day: number) => {
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` === today;
  };

  // Completion % per day
  const dayPercent = (day: number) => {
    if (habits.length === 0) return 0;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const done = habits.filter(h => statusMap.get(`${h.id}_${dateStr}`) === true).length;
    return Math.round((done / habits.length) * 100);
  };

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date)),
    [notes]
  );

  const cardStyle: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-sm" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>
        <button onClick={load} className="text-xs underline" style={{ color: "var(--muted-foreground)" }}>
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
    <div style={cardStyle} className="p-5">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}
        >
          <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {MONTHS_FULL[lang][month - 1]} {year}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {habits.length} {t('month_positive_habits')}
          </p>
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg"
          style={{
            background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
            opacity: isCurrentMonth ? 0.3 : 1,
          }}
        >
          <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <span className="text-3xl">🌱</span>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {t('month_empty')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: habits.length * 36 + 80 }}>
            <thead>
              <tr>
                {/* Day header */}
                <th
                  className="text-left pb-2 pr-2"
                  style={{ width: 44, fontSize: 10, color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}
                >
                  {t('month_day_col')}
                </th>
                {/* Habit headers */}
                {habits.map((h) => (
                  <th key={h.id} className="pb-2" style={{ width: 32 }}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span style={{ fontSize: 14 }}>{h.emoji}</span>
                      <span
                        className="text-center leading-tight"
                        style={{
                          fontSize: 9,
                          color: "var(--muted-foreground)",
                          maxWidth: 32,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                          fontFamily: "'Geist Mono', monospace",
                        }}
                        title={h.name}
                      >
                        {h.name.slice(0, 5)}
                      </span>
                    </div>
                  </th>
                ))}
                {/* % header */}
                <th
                  className="pb-2 pl-2 text-right"
                  style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}
                >
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const future = isFutureDay(day);
                const todayRow = isToday(day);
                const pct = dayPercent(day);
                const dayOfWeek = new Date(dateStr).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <tr
                    key={day}
                    style={{
                      background: todayRow
                        ? isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.05)"
                        : "transparent",
                    }}
                  >
                    {/* Day number */}
                    <td className="py-0.5 pr-2">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-xs font-medium"
                          style={{
                            fontFamily: "'Geist Mono', monospace",
                            color: todayRow ? "#4ADE80" : isWeekend ? (isDark ? "rgba(248,113,113,0.7)" : "#EF4444") : "var(--muted-foreground)",
                            minWidth: 18,
                          }}
                        >
                          {day}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            color: "var(--muted-foreground)",
                            opacity: 0.5,
                            fontFamily: "'Geist Mono', monospace",
                          }}
                        >
                          {DAYS_SHORT[lang][dayOfWeek]}
                        </span>
                      </div>
                    </td>

                    {/* Habit cells — status is undefined (no row: pending),
                        true (green: Done/Avoided) or false (red: Missed/Broken) */}
                    {habits.map((h) => {
                      const status = statusMap.get(`${h.id}_${dateStr}`);
                      return (
                        <td key={h.id} className="py-0.5" style={{ textAlign: "center" }}>
                          <div
                            className="w-6 h-6 rounded mx-auto"
                            style={{
                              background: future
                                ? "transparent"
                                : status === true
                                ? "#4ADE80"
                                : status === false
                                ? "#F87171"
                                : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)",
                              border: todayRow && status === undefined && !future
                                ? "1px dashed rgba(74,222,128,0.4)"
                                : status !== undefined
                                ? "none"
                                : future
                                ? "none"
                                : `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"}`,
                            }}
                          />
                        </td>
                      );
                    })}

                    {/* Percent */}
                    <td className="py-0.5 pl-2 text-right">
                      {!future && habits.length > 0 && (
                        <span
                          className="text-[10px] font-medium"
                          style={{
                            fontFamily: "'Geist Mono', monospace",
                            color: pct === 100
                              ? "#4ADE80"
                              : pct >= 50
                              ? isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"
                              : pct > 0
                              ? isDark ? "rgba(248,113,113,0.6)" : "#EF4444"
                              : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                          }}
                        >
                          {pct > 0 ? `${pct}%` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded" style={{ background: "#4ADE80" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('done')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded" style={{ background: "#F87171" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('month_broken')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('month_not_done')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded" style={{ background: "transparent", border: "1px dashed rgba(74,222,128,0.4)" }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('today')}</span>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Monthly journal notes — scrollable, read-only summary of every
        daily_notes entry with content in the selected month */}
    <div style={cardStyle} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <NotebookText size={16} style={{ color: "#A78BFA" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {t('month_journal_title')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {sortedNotes.length} {t('month_journal_count')}
          </p>
        </div>
      </div>

      {sortedNotes.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
          {t('month_journal_empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 420 }}>
          {sortedNotes.map((n) => {
            const d = new Date(n.note_date + "T00:00:00");
            return (
              <div
                key={n.note_date}
                className="p-3.5 rounded-xl"
                style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {d.getDate()} {MONTHS_FULL[lang][d.getMonth()].slice(0, 3)} · {DAYS_FULL[lang][d.getDay()]}
                  </span>
                  {n.mood != null && <span style={{ fontSize: 16 }}>{MOOD_EMOJI[n.mood]}</span>}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted-foreground)" }}>
                  {n.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
