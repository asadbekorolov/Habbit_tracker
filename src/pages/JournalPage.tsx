import { useState } from "react";
import { CheckSquare, HeartPulse } from "lucide-react";
import { HabitsLog } from "../features/habits/HabitsLog";
import { MonthGrid } from "../features/dashboard/MonthGrid";
import { DailyNotes } from "../features/dashboard/DailyNotes";
import { WeeklyReflection } from "../features/dashboard/WeeklyReflection";
import { HealthPage } from "../features/habits/HealthPage";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";

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
  const [journalTab, setJournalTab] = useState<'habits' | 'health'>('habits');
  const [logsView, setLogsView] = useState<"today" | "month" | "notes" | "weekly">("today");

  return (
    <div className="max-w-2xl pb-32">
      {/* Title & View Selector */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap sm:flex-nowrap">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          Kunlik Jurnal
        </h2>
        {journalTab === 'habits' && (
          <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-white/5 overflow-x-auto no-scrollbar shrink-0">
            {(["today", "month", "notes", "weekly"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setLogsView(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
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
        )}
      </div>

      {/* Segmented Switcher UI: [ Odatlar | Salomatlik ] */}
      <div className="w-full p-1 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-1 mb-4 shadow-sm">
        <button
          onClick={() => setJournalTab('habits')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            journalTab === 'habits'
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-400" />
          <span>Odatlar</span>
        </button>
        <button
          onClick={() => setJournalTab('health')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            journalTab === 'health'
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <HeartPulse className="w-4 h-4 text-rose-400" />
          <span>Salomatlik</span>
        </button>
      </div>

      {/* View Routing Logic */}
      {journalTab === 'habits' ? (
        <>
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
        </>
      ) : (
        <HealthPage isDark={isDark} profile={profile} />
      )}
    </div>
  );
}

export default JournalPage;
