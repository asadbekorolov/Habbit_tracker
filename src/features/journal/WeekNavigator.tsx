// Kundalik — yagona hafta navigatori: tanlangan kun sarlavhasi, hafta
// almashtirish (< >) va 7 ta kun katagi (hafta kuni, sana, bajarilish foizi).
// Kun bosilsa — tanlanadi va o'sha kunning odatlari ochiladi.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHabitsQuery, useLogsRangeQuery, useDayLogsQuery } from "../../hooks/queries";
import { addDays, getTashkentToday, parseDateStr } from "../../utils/date";
import { DAYS_SHORT, DAYS_FULL, MONTHS_FULL } from "../../utils/i18n";
import { weekDates, weekStartOf } from "../../utils/weekdays";
import { useLang } from "../../store/LangContext";
import { useHaptics } from "../../hooks/useHaptics";

interface WeekNavigatorProps {
  userId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Kun katagi bosilganda (tanlashdan keyin) — o'sha kunning odatlari */
  onOpenDay: (date: string) => void;
}

export function WeekNavigator({ userId, selectedDate, onSelectDate, onOpenDay }: WeekNavigatorProps) {
  const { t, lang } = useLang();
  const haptics = useHaptics();
  const today = getTashkentToday();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(selectedDate));

  // Tanlangan sana boshqa haftaga o'tsa — ko'rinadigan hafta ham ergashadi
  useEffect(() => { setWeekStart(weekStartOf(selectedDate)); }, [selectedDate]);

  const days = weekDates(weekStart);
  const weekEnd = days[6];
  const isCurrentWeek = weekStart === weekStartOf(today);

  const habitsQ = useHabitsQuery(userId);
  const logsQ = useLogsRangeQuery(userId, weekStart, weekEnd < today ? weekEnd : today, { keepPrevious: true });
  const todayQ = useDayLogsQuery(userId, today);

  const positiveIds = useMemo(
    () => new Set((habitsQ.data || []).filter((h) => h.type !== "negative").map((h) => h.id)),
    [habitsQ.data]
  );

  const pctByDate = useMemo(() => {
    const done = new Map<string, Set<string>>();
    const add = (d: string, id: string) => {
      if (!positiveIds.has(id)) return;
      if (!done.has(d)) done.set(d, new Set());
      done.get(d)!.add(id);
    };
    for (const l of logsQ.data || []) if (l.completed && l.log_date !== today) add(l.log_date, l.habit_id);
    for (const l of todayQ.data || []) if (l.completed) add(today, l.habit_id);
    const total = positiveIds.size;
    const out = new Map<string, number>();
    for (const [d, ids] of done) out.set(d, total ? Math.round((Math.min(ids.size, total) / total) * 100) : 0);
    return out;
  }, [logsQ.data, todayQ.data, positiveIds, today]);

  const sel = parseDateStr(selectedDate);
  const title = `${selectedDate === today ? `${t("today")} — ` : ""}${DAYS_FULL[lang][sel.getDay()]}`;
  const subtitle = `${sel.getDate()} ${MONTHS_FULL[lang][sel.getMonth()]}`;

  const shiftWeek = (delta: number) => {
    haptics.impactLight();
    setWeekStart((w) => addDays(w, delta * 7));
  };

  return (
    <section className="rounded-3xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          aria-label={t("journal_prev_week")}
          className="p-2 rounded-xl bg-slate-800/70 text-slate-300 active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{title}</p>
          <p className="text-[11px] font-mono text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          disabled={isCurrentWeek}
          aria-label={t("journal_next_week")}
          className="p-2 rounded-xl bg-slate-800/70 text-slate-300 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isFuture = d > today;
          const isSelected = d === selectedDate;
          const pct = pctByDate.get(d) ?? 0;
          const tone = isFuture
            ? "bg-slate-900/30 border-slate-800/40 text-slate-600"
            : pct === 100
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            : pct > 0
            ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400/90"
            : "bg-slate-800/40 border-slate-800 text-slate-400";
          return (
            <button
              key={d}
              type="button"
              disabled={isFuture}
              aria-pressed={isSelected}
              onClick={() => {
                haptics.impactLight();
                onSelectDate(d);
                onOpenDay(d);
              }}
              className={`rounded-xl border py-2 flex flex-col items-center gap-0.5 transition-all active:scale-95 cursor-pointer disabled:cursor-default ${
                isSelected ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.35)]" : tone
              } ${d === today && !isSelected ? "ring-1 ring-emerald-400/70" : ""}`}
            >
              <span className="text-[10px] font-mono opacity-80">{DAYS_SHORT[lang][parseDateStr(d).getDay()]}</span>
              <span className="text-sm font-mono font-bold leading-none">{+d.slice(8)}</span>
              <span className="text-[9px] font-mono opacity-80">{isFuture ? "—" : `${pct}%`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
