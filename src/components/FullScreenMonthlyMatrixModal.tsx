import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, CalendarDays, CheckCircle2, XCircle, Circle } from "lucide-react";
import { HabitIcon, cleanHabitName } from "./HabitIcon";
import { useScrollLock } from "../hooks/useScrollLock";
import { useHaptics } from "../hooks/useHaptics";
import { MONTHS_FULL, DAYS_SHORT } from "../utils/i18n";
import { useLang } from "../store/LangContext";

interface FullScreenMonthlyMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isCurrentMonth: boolean;
  habits: any[];
  logs: { habit_id: string; log_date: string; completed: boolean }[];
  today: string;
}

export function FullScreenMonthlyMatrixModal({
  isOpen,
  onClose,
  year,
  month,
  onPrevMonth,
  onNextMonth,
  isCurrentMonth,
  habits,
  logs,
  today,
}: FullScreenMonthlyMatrixModalProps) {
  const { lang } = useLang();
  const haptics = useHaptics();

  useScrollLock(isOpen);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const daysInMonth = new Date(year, month, 0).getDate();

  const statusMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const l of logs) m.set(`${l.habit_id}_${l.log_date}`, l.completed);
    return m;
  }, [logs]);

  const isFutureDay = (day: number) => {
    const d = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return d > today;
  };

  const isToday = (day: number) => {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` === today;
  };

  const dayPercent = (day: number) => {
    if (habits.length === 0) return 0;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const done = habits.filter((h) => statusMap.get(`${h.id}_${dateStr}`) === true).length;
    return Math.round((done / habits.length) * 100);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Oylik Ko'rsatkichlar Matritsasi"
        className="fixed inset-0 z-50 bg-[#090d16]/98 backdrop-blur-xl flex flex-col p-4 touch-none overscroll-contain"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full flex flex-col space-y-3 max-w-6xl mx-auto"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-2 py-1 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <CalendarDays className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide leading-tight">
                  Oylik Ko'rsatkichlar Matritsasi
                </h2>
                <p className="text-xs text-slate-400 font-['Geist_Mono',monospace] font-mono mt-0.5">
                  {MONTHS_FULL[lang][month - 1]} {year} · {habits.length} TA ODAT
                </p>
              </div>
            </div>

            {/* Month Navigation & Close Button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    haptics.impactLight();
                    onPrevMonth();
                  }}
                  aria-label="Oldingi oy"
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-['Geist_Mono',monospace] font-mono font-bold text-white px-2">
                  {MONTHS_FULL[lang][month - 1].slice(0, 3)} {year}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    haptics.impactLight();
                    onNextMonth();
                  }}
                  disabled={isCurrentMonth}
                  aria-label="Keyingi oy"
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                data-modal-close-trigger
                aria-label="Yopish"
                onClick={() => {
                  haptics.impactLight();
                  onClose();
                }}
                className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <X className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Freeze Panes & Micro-squircle Grid Table */}
          <div className="flex-1 overflow-auto rounded-2xl border border-slate-800/80 bg-slate-900/40 p-2 overscroll-contain touch-pan-x touch-pan-y shadow-inner relative">
            <table className="w-full border-collapse text-xs select-none">
              <thead>
                <tr>
                  {/* Sticky Top-Left Intersection Column */}
                  <th className="sticky top-0 left-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-r border-slate-800/80 p-2 text-center text-[10px] font-['Geist_Mono',monospace] font-mono font-bold text-slate-400 w-12 shrink-0">
                    Kun
                  </th>

                  {/* Habit Headers */}
                  {habits.map((h) => (
                    <th
                      key={h.id}
                      className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 py-2 px-1 w-9 text-center min-w-[36px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <HabitIcon emoji={h.emoji} name={h.name} size={16} noWrapper />
                        <span
                          className="text-[9px] text-slate-400 max-w-[48px] truncate block mx-auto font-sans leading-none"
                          title={cleanHabitName(h.name)}
                        >
                          {cleanHabitName(h.name)}
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* Sticky Top-Right Percent Column Header */}
                  <th className="sticky top-0 right-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-l border-slate-800/80 p-2 text-center text-[10px] font-['Geist_Mono',monospace] font-mono font-bold text-slate-400 w-10 shrink-0">
                    %
                  </th>
                </tr>
              </thead>

              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const future = isFutureDay(day);
                  const todayRow = isToday(day);
                  const pct = dayPercent(day);
                  const dayOfWeek = new Date(dateStr).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <tr
                      key={day}
                      className={`transition-colors ${
                        todayRow ? "bg-emerald-950/30 border-y border-emerald-500/30" : ""
                      }`}
                    >
                      {/* Sticky Date Column (1 to 31 in Geist Mono) */}
                      <td className="sticky left-0 z-20 bg-slate-950/95 backdrop-blur-md border-r border-slate-800/80 py-1.5 px-1 text-center font-['Geist_Mono',monospace] font-mono text-xs w-12 shrink-0">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`font-bold font-mono text-xs ${
                              todayRow
                                ? "text-emerald-400"
                                : isWeekend
                                ? "text-rose-400"
                                : "text-slate-300"
                            }`}
                          >
                            {day}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 uppercase">
                            {DAYS_SHORT[lang][dayOfWeek]}
                          </span>
                        </div>
                      </td>

                      {/* Habit Cells: Compact Micro-squircles */}
                      {habits.map((h) => {
                        const status = statusMap.get(`${h.id}_${dateStr}`);

                        let cellStyle = "bg-slate-800/40 border border-slate-800/60";
                        if (future) {
                          cellStyle = "bg-transparent border-transparent opacity-30";
                        } else if (status === true) {
                          cellStyle = "bg-emerald-500/90 text-slate-950 font-bold shadow-sm";
                        } else if (status === false) {
                          cellStyle = "bg-rose-500/80 text-white font-bold";
                        } else if (todayRow) {
                          cellStyle = "bg-slate-800/40 border border-dashed border-emerald-500/50";
                        }

                        return (
                          <td key={h.id} className="p-0.5 text-center min-w-[36px]">
                            <div
                              className={`w-8 h-7 rounded-lg mx-auto gap-1 transition-all flex items-center justify-center ${cellStyle}`}
                            />
                          </td>
                        );
                      })}

                      {/* Sticky Percent Column */}
                      <td className="sticky right-0 z-20 bg-slate-950/95 backdrop-blur-md border-l border-slate-800/80 px-1.5 py-1 text-right font-['Geist_Mono',monospace] font-mono text-[10px] font-bold w-10 shrink-0">
                        {!future && habits.length > 0 ? (
                          <span
                            className={
                              pct === 100
                                ? "text-emerald-400 font-bold"
                                : pct >= 50
                                ? "text-slate-200"
                                : pct > 0
                                ? "text-rose-400"
                                : "text-slate-600"
                            }
                          >
                            {pct > 0 ? `${pct}%` : "—"}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Legend Bar */}
          <div className="flex items-center gap-x-5 gap-y-2 pt-1 px-2 flex-wrap text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
              <span>Bajarildi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-400 stroke-[2.2]" />
              <span>Bajarilmadi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="w-4 h-4 text-slate-600 stroke-[2.2]" />
              <span>Kutilmoqda</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-md border border-dashed border-emerald-500/80 bg-emerald-950/40 shrink-0" />
              <span>Bugungi kun</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
