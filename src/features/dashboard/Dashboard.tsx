import React, { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { soundService } from "../../services/soundService";
import { toDateStr } from "../../utils/date";
import { habitSyncQueue } from "../../services/habitSyncQueue";
import { useHabitsQuery, useDayLogsQuery } from "../../hooks/queries";
import { useAddHabit } from "../../hooks/useAddHabit";
import type { Habit, Profile } from "../../services/supabase";
import { AddHabitModal } from "../../components/AddHabitModal";
import { DisciplineProgressBar } from "./components/DisciplineProgressBar";
import { ActiveRoutinePill } from "./components/ActiveRoutinePill";
import { HeroCharacterStage } from "./components/HeroCharacterStage";
import { HabitItem } from "../habits/components/HabitItem";

// Fallback initial habits for offline/demo state (100% Uzbek titles, Lucide SVG icon names only)
const DEFAULT_HABITS: Habit[] = [
  {
    id: "demo-1",
    user_id: "demo",
    name: "Dasturlash va kod tahlili",
    emoji: "Code",
    streak_count: 14,
    created_at: new Date().toISOString(),
    type: "positive"
  },
  {
    id: "demo-2",
    user_id: "demo",
    name: "Kitob mutolaasi (20 bet)",
    emoji: "BookOpen",
    streak_count: 21,
    created_at: new Date().toISOString(),
    type: "positive"
  },
  {
    id: "demo-3",
    user_id: "demo",
    name: "Ertalabki trenirovka",
    emoji: "Dumbbell",
    streak_count: 8,
    created_at: new Date().toISOString(),
    type: "positive"
  },
  {
    id: "demo-4",
    user_id: "demo",
    name: "2 litr suv ichish",
    emoji: "Droplets",
    streak_count: 5,
    created_at: new Date().toISOString(),
    type: "positive"
  },
  {
    id: "demo-5",
    user_id: "demo",
    name: "Kunlik meditatsiya",
    emoji: "Sparkles",
    streak_count: 30,
    created_at: new Date().toISOString(),
    type: "positive"
  },
  {
    id: "demo-6",
    user_id: "demo",
    name: "Ingliz tili lug'ati (15 so'z)",
    emoji: "Brain",
    streak_count: 12,
    created_at: new Date().toISOString(),
    type: "positive"
  }
];

export interface DashboardProps {
  isDark?: boolean;
  profile?: Profile;
  completedToday?: number;
  totalHabits?: number;
  onNavigate?: (tab: string) => void;
  onCompletedChange?: (completed: number, total: number) => void;
  onUserClick?: (userId: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}

export function Dashboard({
  isDark = true,
  profile: propsProfile,
  onNavigate,
  onCompletedChange,
  onProfileUpdate
}: DashboardProps) {
  const profile: Profile = propsProfile || {
    id: "user-1",
    username: "asadbek",
    display_name: "Asadbek",
    avatar_url: "",
    score: 350,
    coins: 120,
    height_cm: 175,
    weight_kg: 70,
    created_at: new Date().toISOString()
  };

  // Demo rejim faqat tizimga kirilmaganda (profil yo'q) — haqiqiy
  // foydalanuvchida demo odatlar ko'rsatilmaydi (ular serverda yo'q).
  const isDemo = !propsProfile || profile.id === "user-1";
  const today = toDateStr();
  const { data: habitsData } = useHabitsQuery(isDemo ? null : profile.id);
  // Kunlik loglar keshi navbatdagi (hali yuborilmagan) belgilarni ham o'z
  // ichiga oladi va har bosishda darhol yangilanadi — alohida holat kerak emas.
  const { data: todayLogs } = useDayLogsQuery(isDemo ? null : profile.id, today);
  const addHabitMutation = useAddHabit();

  const [demoDoneIds, setDemoDoneIds] = useState<Set<string>>(new Set(["demo-2", "demo-3"]));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const habits: Habit[] = useMemo(
    () => (isDemo ? DEFAULT_HABITS : (habitsData || []).filter((h: Habit) => h.type !== "negative")),
    [isDemo, habitsData]
  );

  const doneIds: Set<string> = useMemo(() => {
    if (isDemo) return demoDoneIds;
    const set = new Set<string>();
    for (const log of todayLogs || []) if (log.completed) set.add(log.habit_id);
    return set;
  }, [isDemo, demoDoneIds, todayLogs]);

  useEffect(() => {
    if (isDemo || !habitsData || !todayLogs) return;
    const visible = new Set(habits.map((h) => h.id));
    onCompletedChange?.([...doneIds].filter((id) => visible.has(id)).length, habits.length);
  }, [isDemo, habitsData, todayLogs, habits, doneIds]);

  // Handle instant 0ms optimistic UI toggle
  const handleToggleHabit = (habitId: string) => {
    const isCurrentlyDone = doneIds.has(habitId);
    if (!isCurrentlyDone) soundService.play("task_complete");

    if (isDemo) {
      const next = new Set(demoDoneIds);
      if (isCurrentlyDone) next.delete(habitId); else next.add(habitId);
      setDemoDoneIds(next);
      onCompletedChange?.(next.size, habits.length);
      return;
    }

    // Navbat kunlik loglar keshini darhol yangilaydi (optimistik); server
    // rad etsa — kesh serverdan qayta yuklanadi.
    const isCompleted = !isCurrentlyDone;
    habitSyncQueue.enqueue({
      habitId,
      userId: profile.id,
      completed: isCompleted,
      value: isCompleted ? 1 : 0,
      date: today,
    });
  };

  const handleAddNewHabit = async (habitData: any) => {
    if (!isDemo) {
      try {
        await addHabitMutation.mutateAsync({
          userId: profile.id,
          name: habitData.name,
          emoji: habitData.emoji || "Sparkles",
          type: habitData.type || "positive",
          target_value: habitData.target_value,
          unit: habitData.unit,
          scheduledStart: habitData.scheduledStart,
          scheduledEnd: habitData.scheduledEnd,
          description: habitData.description,
        });
      } catch (e) {
        console.error("Failed to add habit to DB:", e);
      }
    }
    setIsAddModalOpen(false);
  };

  const completedCount = doneIds.size;
  const totalCount = habits.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextPendingHabit = habits.find((h) => !doneIds.has(h.id));

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 relative pb-28">
      {/* Background ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-80 bg-emerald-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Main Container with Safe Bottom Spacing pb-28 */}
      <main className="relative z-10 max-w-md mx-auto px-4 pt-2 space-y-4 pb-28">
        {/* 1. Anthropometric Hero Character Stage */}
        <HeroCharacterStage
          profile={profile}
          activeHabitName={nextPendingHabit?.name}
          completedCount={completedCount}
          onProfileUpdate={onProfileUpdate}
        />

        {/* 2. Discipline Indicator (Bugungi intizom) */}
        <DisciplineProgressBar
          completedCount={completedCount}
          totalCount={totalCount}
          percentage={progressPercent}
        />

        {/* 3. Active Routine Pill (Collapsible Capsule) */}
        <ActiveRoutinePill />

        {/* 4. Streamlined Habit Rows (Bugungi vazifalar) */}
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide">
              Bugungi vazifalar
            </h2>
            <div className="flex items-center gap-2">
              <span className="font-['Geist_Mono',monospace] font-mono text-xs font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {totalCount} ta vazifa
              </span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                aria-label="Odat qo'shish"
                className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                isDone={doneIds.has(habit.id)}
                onToggle={handleToggleHabit}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Quick Add Habit Modal */}
      {isAddModalOpen && (
        <AddHabitModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddNewHabit}
          isDark={isDark}
        />
      )}
    </div>
  );
}
