// Odat hafta kunlarini tanlash: Du..Ya squircle tugmalari + tayyor tanlovlar.
import { CalendarDays } from "lucide-react";
import { useLang } from "../store/LangContext";
import { DAYS_SHORT } from "../utils/i18n";
import { EVERY_DAY, WORK_DAYS, WEEKEND, detectPreset, toggleDay, type DaysPreset } from "../utils/weekdays";

// ISO (1 = Du) -> DAYS_SHORT indeksi (0 = Ya)
const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];
const toShortIdx = (iso: number) => iso % 7;

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const { t, lang } = useLang();
  const preset = detectPreset(value);
  const presets: { id: DaysPreset; label: string; days: readonly number[] }[] = [
    { id: "every", label: t("days_every"), days: EVERY_DAY },
    { id: "work", label: t("days_work"), days: WORK_DAYS },
    { id: "weekend", label: t("days_weekend"), days: WEEKEND },
  ];

  return (
    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
          <CalendarDays size={16} />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{t("days_title")}</p>
          <p className="text-[10px] text-slate-500">{t("days_hint")}</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange([...p.days])}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
              preset === p.id
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-transparent border-slate-700 text-slate-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t("days_title")}>
        {ISO_DAYS.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleDay(value, d))}
              className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all active:scale-95 cursor-pointer ${
                on
                  ? "bg-emerald-500 border-emerald-400 text-slate-950"
                  : "bg-slate-800/50 border-slate-700 text-slate-400"
              }`}
            >
              {DAYS_SHORT[lang][toShortIdx(d)]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
