import { useState, useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, PlusCircle, SlidersHorizontal, Clock, ShieldAlert, ChevronDown, ClipboardList } from "lucide-react";
import { getTashkentToday } from "../../utils/date";
import { isMeasurable } from "../../utils/habitMetrics";
import type { Habit, Profile } from "../../services/supabase";
import { useProfile } from "../../store/UserContext";
import { useLang } from "../../store/LangContext";
import { useHabitDay } from "../../hooks/useHabitDay";
import { useHabitMutations, type HabitFormData } from "../../hooks/useHabitMutations";
import { DisciplineProgressBar } from "./components/DisciplineProgressBar";
import { ActiveRoutinePill } from "./components/ActiveRoutinePill";
import { TipCard } from "./components/TipCard";
import { HabitItem } from "../habits/components/HabitItem";
import { QuickLogModal } from "../../components/QuickLogModal";
import { EmptyState } from "../../components/EmptyState";
// Modallar faqat kerak bo'lganda yuklanadi — asosiy bundle'dan chiqarilgan.
const HabitDetailModal = lazy(() => import("../habits/HabitDetailModal").then((m) => ({ default: m.HabitDetailModal })));
const AddHabitModal = lazy(() => import("../../components/AddHabitModal").then((m) => ({ default: m.AddHabitModal })));

export interface DashboardProps {
  completedToday?: number;
  totalHabits?: number;
  onNavigate?: (tab: string) => void;
  onCompletedChange?: (completed: number, total: number) => void;
  onUserClick?: (userId: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}

export function Dashboard({ onNavigate, onCompletedChange, onProfileUpdate }: DashboardProps) {
  const profile = useProfile();
  const { t } = useLang();
  const today = getTashkentToday();
  const day = useHabitDay(profile.id, today);
  const { create } = useHabitMutations(profile.id);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [valueHabit, setValueHabit] = useState<Habit | null>(null);
  const [negativeOpen, setNegativeOpen] = useState(true);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  const positive = day.positive;
  const completedCount = positive.filter((h) => day.entryOf(h.id).status === "done").length;
  const totalCount = positive.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (day.isLoading) return;
    onCompletedChange?.(completedCount, totalCount);
  }, [day.isLoading, completedCount, totalCount]);

  // Doiracha: oddiy odat — darhol; o'lchanadigan (bajarilmagan) — qiymat oynasi
  const handleCheck = (habit: Habit) => {
    if (isMeasurable(habit) && day.entryOf(habit.id).status !== "done") {
      if (day.locked) return day.toggleDone(habit);
      setValueHabit(habit);
    } else {
      day.toggleDone(habit);
    }
  };

  const handleAddNewHabit = async (habitData: HabitFormData) => {
    try {
      await create({ ...habitData, emoji: habitData.emoji || "Sparkles", type: habitData.type || "positive" });
    } catch (e) {
      console.error("Failed to add habit to DB:", e);
    }
    setIsAddModalOpen(false);
  };

  const keptNegative = day.negative.filter((h) => day.entryOf(h.id).status === "done").length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-80 bg-emerald-500/5 blur-[120px] pointer-events-none z-0" />

      <main className="relative z-10 max-w-md mx-auto px-4 pt-2 space-y-4">
        <DisciplineProgressBar completedCount={completedCount} totalCount={totalCount} percentage={progressPercent} />

        <ActiveRoutinePill userId={profile.id} onNavigate={onNavigate} />

        <TipCard userId={profile.id} onNavigate={onNavigate} />

        {/* Bugungi rivojlantiruvchi odatlar */}
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">{t("dash_today_tasks")}</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {t("dash_tasks_count").replace("{n}", String(totalCount))}
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen((v) => !v)}
                  aria-label={t("dash_add_habit_aria")}
                  aria-haspopup="menu"
                  aria-expanded={plusMenuOpen}
                  className={`p-1.5 rounded-xl border active:scale-95 transition-all cursor-pointer ${plusMenuOpen ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"}`}
                >
                  <Plus className={`w-4 h-4 stroke-[2.5] transition-transform ${plusMenuOpen ? "rotate-45" : ""}`} />
                </button>
                <AnimatePresence>
                  {plusMenuOpen && (
                    <>
                      {/* Tashqariga bosish yoki Android "Orqaga" — menyuni yopadi */}
                      <button
                        type="button"
                        aria-label={t("close")}
                        data-modal-close-trigger
                        onClick={() => setPlusMenuOpen(false)}
                        className="fixed inset-0 z-40 cursor-default"
                      />
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-1.5"
                      >
                        {[
                          { icon: PlusCircle, label: t("plus_new_habit"), run: () => setIsAddModalOpen(true) },
                          { icon: SlidersHorizontal, label: t("plus_manage"), run: () => onNavigate?.("habits") },
                          { icon: Clock, label: t("plus_routine"), run: () => onNavigate?.("habits?section=routines") },
                        ].map(({ icon: Icon, label, run }) => (
                          <button
                            key={label}
                            type="button"
                            role="menuitem"
                            onClick={() => { setPlusMenuOpen(false); run(); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-200 hover:bg-slate-800/80 active:bg-slate-800 cursor-pointer"
                          >
                            <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {!day.isLoading && positive.length === 0 && day.negative.length === 0 ? (
            <EmptyState title={t("dash_no_habits")} subtitle={t("dash_no_habits_sub")} icon={ClipboardList} />
          ) : (
            <div className="space-y-2.5">
              {positive.map((habit) => (
                <HabitItem
                  key={habit.id}
                  habit={habit}
                  entry={day.entryOf(habit.id)}
                  streak={day.streaks[habit.id] ?? 0}
                  onCheck={handleCheck}
                  onOpen={setDetailHabit}
                />
              ))}
            </div>
          )}
        </section>

        {/* Zararli odatlar — yig'iladigan bo'lim */}
        {day.negative.length > 0 && (
          <section className="rounded-2xl border border-rose-500/20 bg-rose-950/10">
            <button
              type="button"
              onClick={() => setNegativeOpen((v) => !v)}
              aria-expanded={negativeOpen}
              className="w-full flex items-center justify-between gap-2 p-3.5 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-sm font-semibold text-slate-200">{t("dash_negative_section")}</span>
                <span className="font-mono text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  {keptNegative}/{day.negative.length}
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${negativeOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {negativeOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2.5">
                    <p className="text-[11px] text-slate-400 px-1">{t("dash_negative_hint")}</p>
                    {day.negative.map((habit) => (
                      <HabitItem
                        key={habit.id}
                        habit={habit}
                        entry={day.entryOf(habit.id)}
                        streak={day.streaks[habit.id] ?? 0}
                        onCheck={(h) => day.toggleDone(h)}
                        onFail={(h) => day.toggleFail(h)}
                        onOpen={setDetailHabit}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </main>

      <AnimatePresence>
        {valueHabit && (
          <QuickLogModal
            habit={valueHabit}
            initialValue={day.entryOf(valueHabit.id).value}
            onSave={async (v) => { day.setValue(valueHabit, v); }}
            onClose={() => setValueHabit(null)}
          />
        )}
      </AnimatePresence>

      {detailHabit && (
        <Suspense fallback={null}>
          <HabitDetailModal habit={detailHabit} userId={profile.id} onClose={() => setDetailHabit(null)} />
        </Suspense>
      )}

      {isAddModalOpen && (
        <Suspense fallback={null}>
          <AddHabitModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={handleAddNewHabit} />
        </Suspense>
      )}
    </div>
  );
}
