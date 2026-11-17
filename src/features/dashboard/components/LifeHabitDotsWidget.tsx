// "Kun va odatlar" vidjeti: 24 nuqta (o'tgan soatlar) + bugungi odatlar
// nuqtalari. Ixcham, ko'zni charchatmaydigan squircle karta.
import { useEffect, useState } from "react";
import { Hourglass, CheckCircle2 } from "lucide-react";
import { useLang } from "../../../store/LangContext";
import { dayElapsed, habitDots } from "../../../utils/lifeDots";

export function LifeHabitDotsWidget({ done, total }: { done: number; total: number }) {
  const { t } = useLang();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const day = dayElapsed(now);
  const dots = habitDots(done, total);
  const habitPct = total ? Math.round((Math.min(done, total) / total) * 100) : 0;

  return (
    <section className="rounded-3xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-3.5 backdrop-blur-xl">
      {/* Kun jarayoni */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Hourglass className="w-3.5 h-3.5 text-emerald-400" /> {t("widget_day")}
          </span>
          <span className="font-mono text-xs font-bold text-slate-200">{day.pct}%</span>
        </div>
        <div className="grid grid-cols-12 gap-1.5" aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              className={`h-2 rounded-full transition-colors ${
                h < day.hoursPassed
                  ? "bg-emerald-500/80"
                  : h === day.currentHour
                  ? "bg-emerald-500/30 ring-1 ring-emerald-400/60"
                  : "bg-slate-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bugungi odatlar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {t("widget_habits")}
          </span>
          <span className="font-mono text-xs font-bold text-slate-200">
            {total ? `${Math.min(done, total)} / ${total} • ${habitPct}%` : "—"}
          </span>
        </div>
        {total > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-hidden="true">
            {dots.map((on, i) => (
              <span
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-colors ${on ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]" : "bg-slate-800"}`}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">{t("widget_no_habits")}</p>
        )}
      </div>
    </section>
  );
}
