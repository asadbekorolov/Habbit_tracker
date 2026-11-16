import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ChevronDown, ChevronUp, CalendarPlus, Sun, Briefcase, Moon, Zap, Target,
  BookOpen, Heart, Activity, Dumbbell, Coffee, Shield, CheckCircle2,
} from "lucide-react";
import { useRoutines } from "../../../hooks/useRoutines";
import { getTashkentIsoWeekday, getTashkentTimeHM } from "../../../utils/date";
import { buildRoutineSchedule, type ScheduledRoutine } from "../../../utils/routineSchedule";

// RoutineModal'dagi icon_name qiymatlari bilan bir xil
const ROUTINE_ICONS: Record<string, React.ElementType> = {
  Sun, Briefcase, Moon, Zap, Clock, Target, BookOpen, Heart, Activity, Dumbbell, Coffee, Shield,
};

export interface ActiveRoutinePillProps {
  userId: string;
  /** "Kun tartibi tuzish" — odatlar boshqaruvi sahifasiga o'tkazadi */
  onNavigate?: (tab: string) => void;
}

/** Toshkent vaqti va hafta kuni; har 30 soniyada yangilanadi. */
function useTashkentClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return { hm: getTashkentTimeHM(now), weekday: getTashkentIsoWeekday(now) };
}

const timeSlot = (s: ScheduledRoutine) => `${s.start} - ${s.end}`;

export function ActiveRoutinePill({ userId, onNavigate }: ActiveRoutinePillProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: routines, isLoading } = useRoutines(userId);
  const { hm, weekday } = useTashkentClock();

  const schedule = useMemo(
    () => buildRoutineSchedule(routines || [], hm, weekday),
    [routines, hm, weekday]
  );

  if (isLoading && !routines) return null;

  // Bugun uchun tartib yo'q — ixcham taklif
  if (schedule.items.length === 0) {
    const hasAny = (routines || []).length > 0;
    return (
      <button
        type="button"
        onClick={() => onNavigate?.("habits")}
        className="w-full flex items-center justify-between gap-3 rounded-2xl bg-slate-900/50 border border-dashed border-slate-700/80 p-3.5 text-left cursor-pointer active:scale-[0.99] transition-all"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400 truncate">
            {hasAny ? "Bugun uchun kun tartibi yo'q" : "Kun tartibi hali tuzilmagan"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-emerald-400">
          <CalendarPlus className="w-4 h-4" />
          Kun tartibi tuzish
        </span>
      </button>
    );
  }

  const head = schedule.current ?? schedule.next;
  const badge = schedule.current
    ? { text: "HOZIR FAOL", cls: "bg-emerald-950/60 border-emerald-500/30 text-emerald-400" }
    : schedule.next
    ? { text: "KEYINGI", cls: "bg-slate-800/60 border-slate-600/40 text-slate-300" }
    : { text: "YAKUNLANDI", cls: "bg-slate-800/60 border-slate-600/40 text-slate-400" };

  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl p-3.5 transition-all shadow-lg">
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Clock className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.2]" />
          {head ? (
            <>
              <span className="text-xs font-mono text-slate-400 shrink-0">{timeSlot(head)}</span>
              <span className="text-xs font-medium text-slate-200 truncate">{head.routine.title}</span>
            </>
          ) : (
            <span className="text-xs font-medium text-slate-300 truncate">Bugungi kun tartibi tugadi</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium tracking-wide uppercase ${badge.cls}`}>
            {badge.text}
          </span>
          <button
            type="button"
            aria-label="Kun tartibini ko'rsatish"
            className="p-0.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 stroke-[2]" /> : <ChevronDown className="w-4 h-4 stroke-[2]" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3 pt-3 border-t border-slate-800/60 space-y-2"
          >
            {schedule.items.map((s) => {
              const StepIcon = ROUTINE_ICONS[s.routine.icon_name] || Clock;
              const isActive = s.status === "active";
              const isCompleted = s.status === "completed";
              return (
                <div
                  key={s.routine.id}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-medium"
                      : isCompleted
                      ? "bg-slate-900/30 border-slate-800/40 text-slate-500"
                      : "bg-slate-900/20 border-slate-800/30 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500/70" />
                    ) : (
                      <StepIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                    )}
                    <span className={`truncate ${isCompleted ? "line-through" : ""}`}>{s.routine.title}</span>
                  </div>
                  <span className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-slate-400">
                    {s.total > 0 && <span className="text-emerald-400/80">{s.done}/{s.total}</span>}
                    {timeSlot(s)}
                  </span>
                </div>
              );
            })}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("habits")}
                className="w-full text-center text-[11px] font-semibold text-emerald-400/90 pt-1 cursor-pointer"
              >
                Kun tartibini tahrirlash
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
