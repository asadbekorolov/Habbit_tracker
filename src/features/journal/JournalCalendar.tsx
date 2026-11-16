// Kundalik — Oy matritsasi: har kunning bajarilish foizi; kun bosilsa
// o'sha kunning odatlari (DayHabitsSheet) ochiladi.
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useHabitsQuery, useLogsRangeQuery, useDayLogsQuery } from "../../hooks/queries";
import { addDays, getTashkentToday } from "../../utils/date";
import { MONTHS_FULL, DAYS_SHORT } from "../../utils/i18n";
import { useLang } from "../../store/LangContext";
import { useHaptics } from "../../hooks/useHaptics";

interface JournalCalendarProps {
  userId: string;
  onSelectDate: (date: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
// Dushanbadan boshlanadigan hafta: DAYS_SHORT 0 = yakshanba
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function JournalCalendar({ userId, onSelectDate }: JournalCalendarProps) {
  const { t, lang } = useLang();
  const haptics = useHaptics();
  const today = getTashkentToday();
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) }));

  const first = `${ym.y}-${pad(ym.m)}-01`;
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const last = `${ym.y}-${pad(ym.m)}-${pad(daysInMonth)}`;
  const isCurrentMonth = today.slice(0, 7) === first.slice(0, 7);

  const habitsQ = useHabitsQuery(userId);
  const logsQ = useLogsRangeQuery(userId, first, last < today ? last : today, { keepPrevious: true });
  const todayQ = useDayLogsQuery(userId, today);

  const positiveIds = useMemo(
    () => new Set((habitsQ.data || []).filter((h) => h.type !== "negative").map((h) => h.id)),
    [habitsQ.data]
  );

  // Kun -> bajarilgan ijobiy odatlar soni (bugun — darhol yangilanadigan kunlik keshdan)
  const doneByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (d: string, id: string) => {
      if (!positiveIds.has(id)) return;
      if (!map.has(d)) map.set(d, new Set());
      map.get(d)!.add(id);
    };
    for (const l of logsQ.data || []) if (l.completed && l.log_date !== today) add(l.log_date, l.habit_id);
    if (isCurrentMonth) for (const l of todayQ.data || []) if (l.completed) add(today, l.habit_id);
    return map;
  }, [logsQ.data, todayQ.data, positiveIds, today, isCurrentMonth]);

  const lead = (new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  const total = positiveIds.size;

  const shiftMonth = (delta: number) => {
    haptics.impactLight();
    setYm(({ y, m }) => {
      const idx = y * 12 + (m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });
  };

  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100">{t("journal_calendar_title")}</h3>
            <p className="text-[11px] text-slate-400 truncate">{t("journal_calendar_hint")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="prev" className="p-1.5 rounded-lg bg-slate-800/70 text-slate-300 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-slate-200 w-24 text-center">
            {MONTHS_FULL[lang][ym.m - 1]} {ym.y}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            aria-label="next"
            className="p-1.5 rounded-lg bg-slate-800/70 text-slate-300 cursor-pointer disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {MON_FIRST.map((d) => (
          <span key={d} className="text-center text-[10px] font-mono text-slate-500">{DAYS_SHORT[lang][d]}</span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const isFuture = date > today;
          const done = doneByDate.get(date)?.size ?? 0;
          const pct = total ? Math.round((Math.min(done, total) / total) * 100) : 0;
          const cls = isFuture
            ? "bg-slate-900/30 border-slate-800/40 text-slate-600"
            : pct === 100
            ? "bg-emerald-500 border-emerald-400 text-slate-950 font-bold"
            : pct >= 50
            ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
            : pct > 0
            ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400/80"
            : "bg-slate-800/40 border-slate-800 text-slate-400";
          return (
            <button
              key={date}
              type="button"
              onClick={() => {
                if (isFuture) { toast.info(t("journal_future_day")); return; }
                haptics.impactLight();
                onSelectDate(date);
              }}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center font-mono transition-all active:scale-95 cursor-pointer ${cls} ${date === today ? "ring-2 ring-emerald-400" : ""}`}
            >
              <span className="text-xs leading-none">{+date.slice(8)}</span>
              {!isFuture && total > 0 && <span className="text-[8px] leading-none mt-0.5 opacity-80">{pct}%</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
