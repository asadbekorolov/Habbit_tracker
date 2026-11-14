import { useState } from "react";
import { HabitsLog } from "../features/habits/HabitsLog";
import { MonthGrid } from "../features/dashboard/MonthGrid";
import { DailyNotes } from "../features/dashboard/DailyNotes";
import { WeeklyReflection } from "../features/dashboard/WeeklyReflection";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";
import { MiniPipAvatar } from "../components/MiniPipAvatar";

interface JournalPageProps {
  isDark: boolean;
  profile: Profile;
  onCompletedChange: (completed: number, total: number) => void;
  onScoreChange?: (delta: number) => void;
  onStreakMilestone?: (name: string, emoji: string, days: number) => void;
}

export function JournalPage({
  isDark,
  profile,
  onCompletedChange,
  onScoreChange,
  onStreakMilestone,
}: JournalPageProps) {
  const { t } = useLang();
  const [logsView, setLogsView] = useState<"today" | "month" | "notes" | "weekly">("today");

  return (
    <div className="max-w-2xl pb-32">
      {/* Title & View Selector with Mini-PIP Avatar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-3">
          <MiniPipAvatar profile={profile} />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            Kunlik Jurnal
          </h2>
        </div>
        <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-white/5 overflow-x-auto no-scrollbar shrink-0">
          {(["today", "month", "notes", "weekly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setLogsView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                background: logsView === v ? (isDark ? "rgba(255,255,255,0.1)" : "#fff") : "transparent",
                color: logsView === v ? (isDark ? "var(--foreground)" : "#16A34A") : (isDark ? "var(--muted-foreground)" : "#64748B"),
                boxShadow: logsView === v ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {{ today: t('logs_tab_today'), month: t('month'), notes: t('logs_tab_notes'), weekly: t('logs_tab_weekly') }[v] ?? v}
            </button>
          ))}
        </div>
      </div>

      {/* View Routing Logic */}
      {logsView === "today" ? (
        <HabitsLog
          isDark={isDark}
          profile={profile}
          onCompletedChange={onCompletedChange}
          onScoreChange={onScoreChange}
          onStreakMilestone={onStreakMilestone}
        />
      ) : logsView === "month" ? (
        <MonthGrid isDark={isDark} profile={profile} />
      ) : logsView === "notes" ? (
        <DailyNotes isDark={isDark} profile={profile} />
      ) : (
        <WeeklyReflection isDark={isDark} profile={profile} />
      )}
    </div>
  );
}

export default JournalPage;
