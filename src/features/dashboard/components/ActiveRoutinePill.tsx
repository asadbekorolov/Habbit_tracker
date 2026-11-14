import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronDown, ChevronUp, Code, BookOpen, Dumbbell, Sparkles } from "lucide-react";

export interface RoutineStep {
  id: string;
  timeSlot: string;
  title: string;
  icon: React.ElementType;
  status: "completed" | "active" | "upcoming";
}

const DEFAULT_ROUTINES: RoutineStep[] = [
  { id: "r1", timeSlot: "07:00 - 08:00", title: "Ertalabki trenirovka va dush", icon: Dumbbell, status: "completed" },
  { id: "r2", timeSlot: "10:00 - 12:00", title: "Dasturlash va kod tahlili", icon: Code, status: "active" },
  { id: "r3", timeSlot: "15:00 - 16:00", title: "Kitob mutolaasi (20 bet)", icon: BookOpen, status: "upcoming" },
  { id: "r4", timeSlot: "21:30 - 22:00", title: "Kunlik sarhisob va meditatsiya", icon: Sparkles, status: "upcoming" }
];

export interface ActiveRoutinePillProps {
  routines?: RoutineStep[];
}

export function ActiveRoutinePill({ routines = DEFAULT_ROUTINES }: ActiveRoutinePillProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Find active routine or default to second item
  const activeRoutine = routines.find((r) => r.status === "active") || routines[1] || routines[0];

  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl p-3.5 transition-all shadow-lg">
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        {/* Left: Active Routine Capsule */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Clock className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.2]" />
          <span className="text-xs font-['Geist_Mono',monospace] font-mono text-slate-400 shrink-0">
            {activeRoutine.timeSlot}
          </span>
          <span className="text-xs font-medium text-slate-200 truncate">
            {activeRoutine.title}
          </span>
        </div>

        {/* Right: Active Status Badge + Toggle Chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-['Geist_Mono',monospace] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-medium tracking-wide uppercase">
            HOZIR FAOL
          </span>
          <button
            type="button"
            aria-label="Tartib ro'yxatini ko'rsatish"
            className="p-0.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 stroke-[2]" />
            ) : (
              <ChevronDown className="w-4 h-4 stroke-[2]" />
            )}
          </button>
        </div>
      </div>

      {/* Hidden routine timeline slots revealed only when toggle clicked */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3 pt-3 border-t border-slate-800/60 space-y-2"
          >
            {routines.map((step) => {
              const StepIcon = step.icon;
              const isActive = step.status === "active";
              const isCompleted = step.status === "completed";

              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-medium"
                      : isCompleted
                      ? "bg-slate-900/30 border-slate-800/40 text-slate-400 line-through"
                      : "bg-slate-900/20 border-slate-800/30 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StepIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                    <span className="truncate">{step.title}</span>
                  </div>
                  <span className="font-['Geist_Mono',monospace] font-mono text-[10px] text-slate-400 shrink-0">
                    {step.timeSlot}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
