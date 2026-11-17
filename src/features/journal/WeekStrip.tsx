// Kundalik — yengil kun tanlagich: so'nggi 7 kun. Kun bosilsa o'sha kunning
// odatlari ochiladi (to'liq oylik matritsa — Tahlil sahifasida).
import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { useHabitsQuery, useLogsRangeQuery, useDayLogsQuery } from "../../hooks/queries";
import { addDays, getTashkentToday, parseDateStr } from "../../utils/date";
import { DAYS_SHORT } from "../../utils/i18n";
import { useLang } from "../../store/LangContext";
import { useHaptics } from "../../hooks/useHaptics";

export function WeekStrip({ userId, onSelectDate }: { userId: string; onSelectDate: (date: string) => void }) {
  const { t, lang } = useLang();
  const haptics = useHaptics();
  const today = getTashkentToday();
  const from = addDays(today, -6);

  const habitsQ = useHabitsQuery(userId);
  const logsQ = useLogsRangeQuery(userId, from, today);
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

  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CalendarDays className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-100">{t("journal_week_title")}</h3>
          <p className="text-[11px] text-slate-400 truncate">{t("journal_calendar_hint")}</p>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const pct = pctByDate.get(d) ?? 0;
          const isToday = d === today;
          const cls =
            pct === 100
              ? "bg-emerald-500 border-emerald-400 text-slate-950"
              : pct >= 50
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              : pct > 0
              ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400/80"
              : "bg-slate-800/40 border-slate-800 text-slate-400";
          return (
            <button
              key={d}
              type="button"
              onClick={() => { haptics.impactLight(); onSelectDate(d); }}
              className={`rounded-xl border py-2 flex flex-col items-center gap-0.5 font-mono transition-all active:scale-95 cursor-pointer ${cls} ${isToday ? "ring-2 ring-emerald-400" : ""}`}
            >
              <span className="text-[10px] opacity-80">{DAYS_SHORT[lang][parseDateStr(d).getDay()]}</span>
              <span className="text-sm font-bold leading-none">{+d.slice(8)}</span>
              <span className="text-[9px] opacity-80">{pct}%</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
