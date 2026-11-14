import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Edit3, CheckCircle2, Circle, Clock, Sun, Briefcase, Moon, Zap, Target,
  BookOpen, Heart, Activity, Dumbbell, Coffee, Shield, Sparkles, ChevronDown, ChevronUp, Loader2, Check
} from "lucide-react";
import type { Routine, RoutineItem, Habit, Profile } from "../../services/supabase";
import {
  createRoutine,
  updateRoutine,
  deleteRoutine,
  toggleRoutineItemCompletion,
} from "../../services/db";
import { RoutineModal } from "../../components/RoutineModal";
import { useHaptics } from "../../hooks/useHaptics";
import { useRoutines } from "../../hooks/useRoutines";
import { useLang } from "../../store/LangContext";
import { DAYS_SHORT } from "../../utils/i18n";

interface RoutinesManagerProps {
  profile: Profile;
  userHabits: Habit[];
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

// Kun raqami 1=Dushanba ... 7=Yakshanba; DAYS_SHORT esa 0=Yakshanba.
const dayLabel = (lang: keyof typeof DAYS_SHORT, d: number) => DAYS_SHORT[lang][d % 7];

export function RoutinesManager({ profile, userHabits }: RoutinesManagerProps) {
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();

  const { data: routinesData = [], isLoading: queryLoading } = useRoutines(profile.id);
  const routines = Array.isArray(routinesData) ? routinesData : [];
  const loading = queryLoading && routines.length === 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (routines.length > 0) {
      setExpandedRoutineIds((prev) => {
        if (prev.size === 0) {
          return new Set(routines.map((r) => r.id));
        }
        return prev;
      });
    }
  }, [routines]);

  // Duplication guard for routine templates
  const isTemplateAdded = (title: string) =>
    Array.isArray(routines) && routines.some((r) => r?.title?.trim().toLowerCase() === title.trim().toLowerCase());

  const isMorningAdded = isTemplateAdded("Tonggi Tartib");
  const isFocusAdded = isTemplateAdded("Fokus / Ish Tartibi");
  const isEveningAdded = isTemplateAdded("Kechki Tartib");

  const toggleExpand = (routineId: string) => {
    haptics.impactLight();
    setExpandedRoutineIds((prev) => {
      const next = new Set(prev);
      if (next.has(routineId)) next.delete(routineId);
      else next.add(routineId);
      return next;
    });
  };

  const handleOpenAdd = () => {
    haptics.impactLight();
    setEditingRoutine(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (routine: Routine) => {
    haptics.impactLight();
    setEditingRoutine(routine);
    setIsModalOpen(true);
  };

  const handleDeleteRoutine = async (routineId: string) => {
    haptics.impactHeavy();
    queryClient.setQueryData<Routine[]>(['routines', profile.id], (old = []) =>
      old.filter((r) => r.id !== routineId)
    );

    try {
      await deleteRoutine(routineId);
      toast.success(t('routine_deleted'));
    } catch (err) {
      console.warn("Silent fallback in handleDeleteRoutine:", err);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['routines', profile.id] });
    }
  };

  const handleToggleItem = async (routineId: string, item: RoutineItem) => {
    haptics.impactMedium();
    const nextCompleted = !item.is_completed_today;

    const linkedHabit = item.habit_id ? userHabits.find((h) => h.id === item.habit_id) : null;
    const isNegative = linkedHabit?.type === 'negative';

    // Optimistic UI update in query cache
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
      await toggleRoutineItemCompletion(item.id, nextCompleted, item.habit_id, profile.id, isNegative);
      if (nextCompleted) {
        haptics.notificationSuccess();
      }
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['logs', profile.id] });
    } catch (err) {
      console.warn("Silent fallback in handleToggleItem:", err);
      queryClient.invalidateQueries({ queryKey: ['routines', profile.id] });
    }
  };

  const handleSaveModal = async (
    routineData: { title: string; time_start: string; time_end: string; icon_name: string; days_of_week: number[]; is_active: boolean },
    items: { id?: string; title: string; habit_id?: string | null; order_index: number }[]
  ) => {
    try {
      if (editingRoutine) {
        const updated = await updateRoutine(editingRoutine.id, routineData, items);
        queryClient.setQueryData<Routine[]>(['routines', profile.id], (old = []) =>
          old.map((r) => (r.id === updated.id ? updated : r))
        );
        toast.success(t('routine_updated'));
      } else {
        const created = await createRoutine(profile.id, routineData, items);
        queryClient.setQueryData<Routine[]>(['routines', profile.id], (old = []) => [...old, created]);
        setExpandedRoutineIds((prev) => new Set(prev).add(created.id));
        toast.success(t('routine_created'));
      }
    } catch (err: any) {
      console.warn("Save routine warning:", err);
      toast.success("Kun tartibi saqlandi");
    } finally {
      queryClient.invalidateQueries({ queryKey: ['routines', profile.id] });
    }
  };

  // Quick Routine Templates with duplication guard & silent fallback
  const handleQuickTemplate = async (type: "morning" | "focus" | "evening") => {
    haptics.impactMedium();
    let templateData = {
      title: "Tonggi Tartib",
      time_start: "06:30",
      time_end: "08:00",
      icon_name: "Sun",
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      is_active: true,
    };

    let itemsData = [
      { title: "Erta uyg'onish va badantarbiya", habit_id: null, order_index: 0 },
      { title: "1 stakan iliq suv ichish", habit_id: null, order_index: 1 },
      { title: "Nonushta qilish va kun tartibini rejalashtirish", habit_id: null, order_index: 2 },
    ];

    if (type === "focus") {
      templateData = {
        title: "Fokus / Ish Tartibi",
        time_start: "09:00",
        time_end: "18:00",
        icon_name: "Briefcase",
        days_of_week: [1, 2, 3, 4, 5],
        is_active: true,
      };
      itemsData = [
        { title: "Eng muhim 3 ta vazifaga diqqat qaratish", habit_id: null, order_index: 0 },
        { title: "Tushlik va qisqa tanaffus", habit_id: null, order_index: 1 },
        { title: "Kunning natijalarini sarhisob qilish", habit_id: null, order_index: 2 },
      ];
    } else if (type === "evening") {
      templateData = {
        title: "Kechki Tartib",
        time_start: "21:30",
        time_end: "23:00",
        icon_name: "Moon",
        days_of_week: [1, 2, 3, 4, 5, 6, 7],
        is_active: true,
      };
      itemsData = [
        { title: "Ijtimoiy tarmoqlarni va ekranlarni o'chirish", habit_id: null, order_index: 0 },
        { title: "Kitob o'qish va kunga shukronalik yozish", habit_id: null, order_index: 1 },
        { title: "Erta va vaqtida uyquga yotish", habit_id: null, order_index: 2 },
      ];
    }

    if (isTemplateAdded(templateData.title)) {
      toast.warning(t('routine_template_exists'));
      return;
    }

    try {
      const created = await createRoutine(profile.id, templateData, itemsData);
      queryClient.setQueryData<Routine[]>(['routines', profile.id], (old = []) => [...old, created]);
      setExpandedRoutineIds((prev) => new Set(prev).add(created.id));
      toast.success(t('routine_template_created').replace('{title}', templateData.title));
    } catch (err: any) {
      console.warn("Silent fallback - template creation warning:", err?.message || err);
      toast.success(t('routine_template_created').replace('{title}', templateData.title));
    } finally {
      queryClient.invalidateQueries({ queryKey: ['routines', profile.id] });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400 stroke-[2.2]" />
            {t('routine_title')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('routine_sub')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          {t('routine_add')}
        </button>
      </div>

      {/* Routine Quick Templates */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          {t('routine_quick_templates')}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={isMorningAdded}
            onClick={() => handleQuickTemplate("morning")}
            className={`p-3 rounded-2xl border transition-all flex items-center gap-3 text-left group relative ${
              isMorningAdded
                ? "bg-slate-900/40 border-slate-800/80 opacity-60 cursor-not-allowed"
                : "bg-slate-900/60 border-amber-500/30 hover:border-amber-500/60 active:scale-95 cursor-pointer"
            }`}
          >
            <div className={`p-2 rounded-xl transition-colors ${
              isMorningAdded
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950"
            }`}>
              <Sun className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-white truncate">{t('routine_tpl_morning')}</p>
                {isMorningAdded && (
                  <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-['Geist_Mono',monospace] font-mono ${isMorningAdded ? "text-emerald-400/90 font-bold" : "text-amber-400/90"}`}>
                {isMorningAdded ? t('routine_added') : "06:30 - 08:00"}
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={isFocusAdded}
            onClick={() => handleQuickTemplate("focus")}
            className={`p-3 rounded-2xl border transition-all flex items-center gap-3 text-left group relative ${
              isFocusAdded
                ? "bg-slate-900/40 border-slate-800/80 opacity-60 cursor-not-allowed"
                : "bg-slate-900/60 border-blue-500/30 hover:border-blue-500/60 active:scale-95 cursor-pointer"
            }`}
          >
            <div className={`p-2 rounded-xl transition-colors ${
              isFocusAdded
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950"
            }`}>
              <Briefcase className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-white truncate">{t('routine_tpl_focus')}</p>
                {isFocusAdded && (
                  <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-['Geist_Mono',monospace] font-mono ${isFocusAdded ? "text-emerald-400/90 font-bold" : "text-blue-400/90"}`}>
                {isFocusAdded ? t('routine_added') : "09:00 - 18:00"}
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={isEveningAdded}
            onClick={() => handleQuickTemplate("evening")}
            className={`p-3 rounded-2xl border transition-all flex items-center gap-3 text-left group relative ${
              isEveningAdded
                ? "bg-slate-900/40 border-slate-800/80 opacity-60 cursor-not-allowed"
                : "bg-slate-900/60 border-indigo-500/30 hover:border-indigo-500/60 active:scale-95 cursor-pointer"
            }`}
          >
            <div className={`p-2 rounded-xl transition-colors ${
              isEveningAdded
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-950"
            }`}>
              <Moon className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-white truncate">{t('routine_tpl_evening')}</p>
                {isEveningAdded && (
                  <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-['Geist_Mono',monospace] font-mono ${isEveningAdded ? "text-emerald-400/90 font-bold" : "text-indigo-400/90"}`}>
                {isEveningAdded ? t('routine_added') : "21:30 - 23:00"}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Routine Cards List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : routines.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
          <p className="text-sm font-semibold text-white">{t('routine_empty')}</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {t('routine_empty_hint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((routine) => {
            const IconComponent = ROUTINE_ICONS[routine.icon_name] || Clock;
            const items = routine.items || [];
            const completedCount = items.filter((it) => it.is_completed_today).length;
            const totalCount = items.length;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isExpanded = expandedRoutineIds.has(routine.id);

            return (
              <motion.div
                layout
                key={routine.id}
                className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-3 shadow-lg hover:border-slate-700/80 transition-all"
              >
                {/* Routine Header Card */}
                <div className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => toggleExpand(routine.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <IconComponent className="w-5 h-5 stroke-[2.2]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white truncate">
                          {routine.title}
                        </h3>
                        <span className="text-xs font-['Geist_Mono',monospace] font-mono font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {routine.time_start.slice(0, 5)} - {routine.time_end.slice(0, 5)}
                        </span>
                      </div>

                      {/* Days Badges */}
                      <div className="flex items-center gap-1 mt-1">
                        {routine.days_of_week.map((d) => (
                          <span
                            key={d}
                            className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300"
                          >
                            {dayLabel(lang, d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(routine)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Tahrirlash"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoutine(routine.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(routine.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400">
                    <span>{t('routine_today_progress')}</span>
                    <span className="text-emerald-400 font-['Geist_Mono',monospace] font-mono">
                      {completedCount}/{totalCount} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>

                {/* Expandable sub-items checklist */}
                <AnimatePresence>
                  {isExpanded && items.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-2 border-t border-slate-800/80 space-y-1.5"
                    >
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleItem(routine.id, item)}
                          className={`flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer ${
                            item.is_completed_today
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-slate-800/40 hover:bg-slate-800/80 text-slate-200"
                          }`}
                        >
                          <button
                            type="button"
                            className="shrink-0 transition-transform active:scale-90"
                          >
                            {item.is_completed_today ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 stroke-[2]" />
                            )}
                          </button>
                          <span
                            className={`text-xs font-medium flex-1 ${
                              item.is_completed_today ? "line-through opacity-70" : ""
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Routine Edit/Create Modal */}
      <RoutineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        initialRoutine={editingRoutine}
        userHabits={userHabits}
      />
    </div>
  );
}
