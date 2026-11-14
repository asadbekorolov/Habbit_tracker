import { useState, useMemo } from "react";
import { Loader2, NotebookText, Maximize2, CalendarDays, AlertCircle } from "lucide-react";
import { HabitIcon } from "../../components/HabitIcon";
import { useHabitsQuery, useLogsRangeQuery, useMonthNotesQuery } from "../../hooks/queries";
import type { Profile } from "../../services/supabase";
import { tashkentTodayAnchor, toDateStr } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import { MONTHS_FULL, DAYS_SHORT, DAYS_FULL } from "../../utils/i18n";
import { FullScreenMonthlyMatrixModal } from "../../components/FullScreenMonthlyMatrixModal";
import { useHaptics } from "../../hooks/useHaptics";

const MOOD_MAP: Record<number, string> = {
  1: "MoodTerrible",
  2: "MoodBad",
  3: "MoodNormal",
  4: "MoodGood",
  5: "MoodExcellent",
};

interface MonthGridProps {
  isDark: boolean;
  profile: Profile;
}

export function MonthGrid({ isDark, profile }: MonthGridProps) {
  const { t, lang } = useLang();
  const haptics = useHaptics();

  const now = tashkentTodayAnchor();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const today = toDateStr(now);

  // Oy oralig'i: 1-kundan oxirgi kungacha (React Query keshi orqali).
  const monthFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthTo = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const habitsQ = useHabitsQuery(profile.id);
  const logsQ = useLogsRangeQuery(profile.id, monthFrom, monthTo);
  const notesQ = useMonthNotesQuery(profile.id, year, month);

  const habits: any[] = habitsQ.data || [];
  const logs: { habit_id: string; log_date: string; completed: boolean }[] = logsQ.data || [];
  const notes: { note_date: string; content: string; mood: number | null }[] = useMemo(
    () => ((notesQ.data || []) as any[]).filter((n) => n.content && n.content.trim().length > 0),
    [notesQ.data]
  );
  const loading = habitsQ.isPending || logsQ.isPending || notesQ.isPending;
  const error = (habitsQ.isError && !habitsQ.data) || (logsQ.isError && !logsQ.data)
    ? (t("err_loading") || "Ma'lumotlarni yuklashda xatolik yuz berdi")
    : "";

  // Map "habitId_date" -> completed status
  const statusMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const l of logs) m.set(`${l.habit_id}_${l.log_date}`, l.completed);
    return m;
  }, [logs]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    const canGoNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
    if (!canGoNext) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // Last 7 days preview calculation for compact summary card
  const last7Days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = toDateStr(d);
      const dayLabel = DAYS_SHORT[lang][d.getDay()];
      const isFuture = dateStr > today;
      const isToday = dateStr === today;

      let percent = 0;
      if (habits.length > 0) {
        const done = habits.filter((h) => statusMap.get(`${h.id}_${dateStr}`) === true).length;
        percent = Math.round((done / habits.length) * 100);
      }

      result.push({
        dateStr,
        dayLabel,
        isFuture,
        isToday,
        percent,
      });
    }
    return result;
  }, [habits, statusMap, today, lang]);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date)),
    [notes]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={22} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
        <button type="button" onClick={() => { habitsQ.refetch(); logsQ.refetch(); notesQ.refetch(); }} className="text-xs text-slate-400 underline cursor-pointer">
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Inline Compact Preview in "Oy" Tab */}
      <div
        onClick={() => {
          haptics.impactLight();
          setIsModalOpen(true);
        }}
        className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 mb-4 backdrop-blur-xl shadow-xl space-y-3.5 hover:border-slate-700/80 transition-all cursor-pointer relative overflow-hidden group"
      >
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Header: "Oylik tahlil" on left, total active habits count on right in Geist Mono */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <CalendarDays className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 tracking-wide">
              Oylik tahlil
            </h3>
          </div>

          <div className="font-['Geist_Mono',monospace] font-mono text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wide">
            {habits.length} TA ODAT
          </div>
        </div>

        {/* Horizontal completion summary + "Oynani ochish" button featuring Lucide Maximize2 */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
          <div className="text-xs text-slate-400 font-medium truncate">
            {MONTHS_FULL[lang][month - 1]} {year} ko'rsatkichlari
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.impactLight();
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Oynani ochish</span>
          </button>
        </div>

        {/* Mini 7-Day Completion Summary Row */}
        {habits.length > 0 && (
          <div className="grid grid-cols-7 gap-1.5 pt-1">
            {last7Days.map((d) => {
              const pct = d.percent;
              return (
                <div key={d.dateStr} className="flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-['Geist_Mono',monospace] font-mono ${d.isToday ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
                    {d.dayLabel}
                  </span>
                  <div
                    className={`w-full h-7 rounded-lg flex items-center justify-center font-['Geist_Mono',monospace] font-mono text-[10px] font-bold transition-all ${
                      d.isFuture
                        ? "bg-slate-900/30 border border-slate-800/40 text-slate-600"
                        : pct === 100
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : pct >= 50
                        ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
                        : pct > 0
                        ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                        : "bg-slate-800/40 border border-slate-800/70 text-slate-500"
                    }`}
                  >
                    {!d.isFuture ? `${pct}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-Screen Monthly Matrix Modal */}
      <FullScreenMonthlyMatrixModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        year={year}
        month={month}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        isCurrentMonth={isCurrentMonth}
        habits={habits}
        logs={logs}
        today={today}
      />

      {/* Monthly Notes Summary Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800/80">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            <NotebookText className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 tracking-wide">
              {t("month_journal_title") || "Oy davomidagi qaydlar"}
            </h4>
            <p className="text-[11px] font-['Geist_Mono',monospace] font-mono text-slate-400">
              {sortedNotes.length} TA QAYD
            </p>
          </div>
        </div>

        {sortedNotes.length === 0 ? (
          <p className="text-xs text-center py-6 text-slate-500 font-medium">
            Bu oy uchun hech qanday qaydlar mavjud emas
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
            {sortedNotes.map((n) => {
              const d = new Date(n.note_date + "T00:00:00");
              return (
                <div
                  key={n.note_date}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-['Geist_Mono',monospace] font-mono font-bold text-emerald-400">
                      {d.getDate()} {MONTHS_FULL[lang][d.getMonth()].slice(0, 3)} · {DAYS_FULL[lang][d.getDay()]}
                    </span>
                    {n.mood != null && (
                      <HabitIcon emoji={MOOD_MAP[n.mood]} size={16} noWrapper />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
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
