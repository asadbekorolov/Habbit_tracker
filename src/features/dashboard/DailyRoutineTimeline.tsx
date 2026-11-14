import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, Circle, Sparkles, Sun, Briefcase, Moon, Zap, Target,
  BookOpen, Heart, Activity, Dumbbell, Coffee, Shield, ChevronDown, Edit3
} from "lucide-react";
import type { Routine, RoutineItem, Profile } from "../../services/supabase";
import { toggleRoutineItemCompletion } from "../../services/db";
import { useHaptics } from "../../hooks/useHaptics";
import { useRoutines } from "../../hooks/useRoutines";

interface DailyRoutineTimelineProps {
  profile: Profile;
  isDark: boolean;
  onNavigate?: (tab: string) => void;
}

const ROUTINE_ICONS: Record<string, React.ElementType> = {
  Sun,
  Briefcase,
  Moon,
  Zap,
  Clock,
  Target,
  BookOpen,
  Heart,
  Activity,
  Dumbbell,
  Coffee,
  Shield,
};

export function DailyRoutineTimeline({ profile, isDark, onNavigate }: DailyRoutineTimelineProps) {
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const { data: routines = [], isLoading: loading } = useRoutines(profile.id);
  const [isRoutinesCollapsed, setIsRoutinesCollapsed] = useState(false);

  const now = new Date();
  const currentDayIso = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon .. 7=Sun
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;

  // Filter routines scheduled for today
  const todayRoutines = routines
    .filter((r) => r.is_active && r.days_of_week && r.days_of_week.includes(currentDayIso))
    .sort((a, b) => a.time_start.localeCompare(b.time_start));

  console.log('[DEBUG ROUTINES] DailyRoutineTimeline render:', {
    profileId: profile.id,
    currentDayIso,
    totalRoutines: routines.length,
    todayRoutinesLength: todayRoutines.length,
    routines,
    todayRoutines,
  });

  // Calculate completion for all today's items
  let totalItemsToday = 0;
  let completedItemsToday = 0;

  for (const r of todayRoutines) {
    for (const item of r.items || []) {
      totalItemsToday++;
      if (item.is_completed_today) completedItemsToday++;
    }
  }

  const isAllCompleted = totalItemsToday > 0 && completedItemsToday === totalItemsToday;

  const handleToggleItem = async (routineId: string, item: RoutineItem) => {
    haptics.impactMedium();
    const nextCompleted = !item.is_completed_today;

    // Optimistic cache update
    queryClient.setQueryData<Routine[]>(['routines', profile.id], (old = []) =>
      old.map((r) => {
        if (r.id !== routineId) return r;
        const updatedItems = (r.items || []).map((it) =>
          it.id === item.id ? { ...it, is_completed_today: nextCompleted } : it
        );
        return { ...r, items: updatedItems };
      })
    );

    try {
      await toggleRoutineItemCompletion(item.id, nextCompleted, item.habit_id, profile.id);
      if (nextCompleted) haptics.notificationSuccess();
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['logs', profile.id] });
    } catch (err) {
      console.error("Error toggling routine item:", err);
      queryClient.invalidateQueries({ queryKey: ['routines', profile.id] });
    }
  };

  if (loading || todayRoutines.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-4 sm:p-5 shadow-xl space-y-3.5 relative overflow-hidden"
    >
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Clock className="w-4 h-4 stroke-[2.2]" />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="text-sm font-bold text-white tracking-tight shrink-0">
              Kun Tartibi
            </h3>

            {/* Subtle Progress Pill */}
            {totalItemsToday > 0 && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 shrink-0">
                {completedItemsToday}/{totalItemsToday} bajarildi
              </span>
            )}
          </div>
        </div>

        {/* Actions & Accordion Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isAllCompleted ? (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>To'liq bajarildi!</span>
            </div>
          ) : null}

          {onNavigate && (
            <button
              type="button"
              onClick={() => {
                haptics.impactLight();
                onNavigate("habits");
              }}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Tahrirlash</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              haptics.impactLight();
              setIsRoutinesCollapsed(!isRoutinesCollapsed);
            }}
            aria-label="Kun tartibini yig'ish yoki ochish"
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <motion.div
              animate={{ rotate: isRoutinesCollapsed ? 0 : 180 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      <AnimatePresence>
        {!isRoutinesCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="space-y-3 pt-1 overflow-hidden"
          >
            {todayRoutines.map((routine) => {
              const IconComponent = ROUTINE_ICONS[routine.icon_name] || Clock;
              const startStr = routine.time_start.slice(0, 5);
              const endStr = routine.time_end.slice(0, 5);
              const isActive = currentTimeStr >= startStr && currentTimeStr <= endStr;
              const items = routine.items || [];
              const completedCount = items.filter((it) => it.is_completed_today).length;
              const totalCount = items.length;

              return (
                <div
                  key={routine.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isActive
                      ? "border-emerald-500/40 bg-emerald-950/20 shadow-md shadow-emerald-500/10"
                      : "bg-slate-900/60 border-slate-800/80"
                  }`}
                >
                  {/* Routine Info Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`p-1.5 rounded-xl shrink-0 ${
                          isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5 stroke-[2.2]" />
                      </div>
                      <h4 className="text-xs font-bold text-white truncate">
                        {routine.title}
                      </h4>
                      {isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          Ayni Paytda Faol
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-slate-400">
                        {startStr} - {endStr}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {completedCount}/{totalCount}
                      </span>
                    </div>
                  </div>

                  {/* Sub-items Checklist */}
                  {items.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleItem(routine.id, item)}
                          className={`flex items-center justify-between py-2 px-3 rounded-xl transition-all cursor-pointer ${
                            item.is_completed_today
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800/60 text-slate-200"
                          }`}
                        >
                          <span
                            className={`text-xs font-medium flex-1 pr-2 ${
                              item.is_completed_today ? "line-through opacity-70" : ""
                            }`}
                          >
                            {item.title}
                          </span>

                          {/* Compact Squircle Check Action Button */}
                          <button
                            type="button"
                            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              item.is_completed_today
                                ? "bg-emerald-500 text-slate-950 shadow-sm"
                                : "bg-slate-800/80 text-slate-400 hover:text-white"
                            }`}
                          >
                            {item.is_completed_today ? (
                              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <Circle className="w-4 h-4 stroke-[2]" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
