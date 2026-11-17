// Kundalik — yengil sahifa: yagona hafta navigatori (kun bosilsa — o'sha
// kunning odatlari), tanlangan kunning eslatmasi va kayfiyati, haftalik sarhisob.
// Bugungi odatlar ro'yxati — Bosh sahifada; to'liq oylik matritsa — Tahlilda.
import { useState, lazy, Suspense } from "react";
import type { Habit } from "../services/supabase";
import { DailyNotes } from "../features/dashboard/DailyNotes";
import { WeeklyReflection } from "../features/dashboard/WeeklyReflection";
import { WeekNavigator } from "../features/journal/WeekNavigator";
import { getTashkentToday } from "../utils/date";
import { DayHabitsSheet } from "../features/habits/DayHabitsSheet";
import { useLang } from "../store/LangContext";
import { MiniPipAvatar } from "../components/MiniPipAvatar";
import { useProfile } from "../store/UserContext";

const HabitDetailModal = lazy(() => import("../features/habits/HabitDetailModal").then((m) => ({ default: m.HabitDetailModal })));

interface JournalPageProps {
  onCompletedChange?: (completed: number, total: number) => void;
  onScoreChange?: (delta: number) => void;
  onStreakMilestone?: (name: string, emoji: string, days: number) => void;
}

export function JournalPage(_props: JournalPageProps) {
  const profile = useProfile();
  const { t } = useLang();
  // Hafta navigatorida tanlangan kun (eslatma shu kunga tegishli)
  const [activeDate, setActiveDate] = useState(() => getTashkentToday());
  // Odatlar oynasi ochiq bo'lgan kun
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  return (
    <div className="max-w-2xl pb-32 space-y-4">
      <div className="flex items-center gap-3">
        <MiniPipAvatar profile={profile} />
        <h2 className="text-xl font-bold text-white">{t("journal_title")}</h2>
      </div>

      <WeekNavigator
        userId={profile.id}
        selectedDate={activeDate}
        onSelectDate={setActiveDate}
        onOpenDay={setSelectedDate}
      />

      <section aria-label={t("journal_notes_section")}>
        <DailyNotes profile={profile} date={activeDate} />
      </section>

      <section aria-label={t("journal_weekly_section")}>
        <WeeklyReflection profile={profile} />
      </section>

      {selectedDate && (
        <DayHabitsSheet profile={profile} date={selectedDate} onClose={() => setSelectedDate(null)} onOpenHabit={setDetailHabit} />
      )}

      {detailHabit && (
        <Suspense fallback={null}>
          <HabitDetailModal habit={detailHabit} userId={profile.id} onClose={() => setDetailHabit(null)} />
        </Suspense>
      )}
    </div>
  );
}

export default JournalPage;
