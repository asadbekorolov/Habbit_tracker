// Kundalik — tarix va yozuvlar: oy matritsasi (kun bosilsa o'sha kunning
// odatlari), kunlik eslatma va kayfiyat, haftalik sarhisob, oylik tahlil.
// Bugungi odatlar ro'yxati faqat Bosh sahifada (takror yo'q).
import { useState } from "react";
import { MonthGrid } from "../features/dashboard/MonthGrid";
import { DailyNotes } from "../features/dashboard/DailyNotes";
import { WeeklyReflection } from "../features/dashboard/WeeklyReflection";
import { JournalCalendar } from "../features/journal/JournalCalendar";
import { DayHabitsSheet } from "../features/journal/DayHabitsSheet";
import { useLang } from "../store/LangContext";
import { MiniPipAvatar } from "../components/MiniPipAvatar";
import { useProfile } from "../store/UserContext";

interface JournalPageProps {
  onCompletedChange?: (completed: number, total: number) => void;
  onScoreChange?: (delta: number) => void;
  onStreakMilestone?: (name: string, emoji: string, days: number) => void;
}

export function JournalPage(_props: JournalPageProps) {
  const profile = useProfile();
  const { t } = useLang();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <div className="max-w-2xl pb-32 space-y-4">
      <div className="flex items-center gap-3">
        <MiniPipAvatar profile={profile} />
        <h2 className="text-xl font-bold text-white">{t("journal_title")}</h2>
      </div>

      <JournalCalendar userId={profile.id} onSelectDate={setSelectedDate} />

      <section aria-label={t("journal_notes_section")}>
        <DailyNotes profile={profile} />
      </section>

      <section aria-label={t("journal_weekly_section")}>
        <WeeklyReflection profile={profile} />
      </section>

      <section aria-label={t("journal_month_section")}>
        <MonthGrid profile={profile} />
      </section>

      {selectedDate && (
        <DayHabitsSheet profile={profile} date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  );
}

export default JournalPage;
