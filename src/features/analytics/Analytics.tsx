import { Trophy, Loader2, BarChart3, Share2 } from "lucide-react";
import { MiniPipAvatar } from "../../components/MiniPipAvatar";
import { GlobalLeaderboardPage } from "../leaderboard/GlobalLeaderboardPage";
import { AnalyticsProps } from "./analyticsShared";
import { useAnalyticsData } from "./useAnalyticsData";
import { PremiumAiModal } from "./components/PremiumAiModal";
import { SharePoster } from "./components/SharePoster";
import { KpiGrid } from "./components/KpiGrid";
import { WeeklyChart } from "./components/WeeklyChart";
import { WeeklyComparison } from "./components/WeeklyComparison";
import { AiAdviceCard } from "./components/AiAdviceCard";
import { Heatmap } from "./components/Heatmap";
import { TrendLine } from "./components/TrendLine";
import { CategoryBalance } from "./components/CategoryBalance";
import { HabitBreakdown } from "./components/HabitBreakdown";
import { AiInsights } from "./components/AiInsights";

export function Analytics(props: AnalyticsProps) {
  const s = useAnalyticsData(props);
  const { totalHabits, onUserClick, onProfileUpdate, profile, downloadingPoster, timeFilter, setTimeFilter, viewMode, setViewMode, showPremiumAI, logs, loading, habitStats, shareAnalytics } = s;


  if (loading && logs.length === 0) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-slate-800/40 rounded-2xl w-full" />
          <div className="h-24 bg-slate-800/40 rounded-2xl w-full" />
        </div>
        <div className="h-52 bg-slate-800/40 rounded-3xl w-full" />
        <div className="h-40 bg-slate-800/40 rounded-3xl w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header Bar with Mini-PIP Avatar & View Mode Toggle */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <MiniPipAvatar profile={profile} onProfileUpdate={onProfileUpdate} />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tahlil</h2>
        </div>
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shrink-0">
          <button
            onClick={() => setViewMode('personal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'personal'
                ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <BarChart3 size={14} className="text-emerald-500 dark:text-emerald-400" />
            Shaxsiy
          </button>
          <button
            onClick={() => setViewMode('leaderboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'leaderboard'
                ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Trophy size={14} className="text-amber-500 dark:text-amber-400" />
            Reyting
          </button>
        </div>
      </div>

      {showPremiumAI && <PremiumAiModal s={s} />}

      {viewMode === 'leaderboard' ? (
        <GlobalLeaderboardPage onUserClick={onUserClick} />
      ) : (
        <>
          {/* Time Filter Pills */}
          <div className="flex justify-center mb-2">
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
              {[
                { id: 'weekly', label: 'Haftalik' },
                { id: 'monthly', label: 'Oylik' },
                { id: 'yearly', label: 'Yillik' },
                { id: 'all', label: 'Hammasi' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    timeFilter === f.id
                      ? "bg-white dark:bg-white/10 text-emerald-500 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Full-width Share CTA Banner */}
          <button
            type="button"
            onClick={shareAnalytics}
            disabled={downloadingPoster}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm my-3 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {downloadingPoster ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Share2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{downloadingPoster ? "Tahlil tayyorlanmoqda..." : "Tahlilni ulashish"}</span>
          </button>

      {/* ── HIGH-IMPACT 9:16 SOCIAL SHARE CARD TEMPLATE (1080x1920 @ 2x) ── */}
      <SharePoster s={s} />

      <div id="analytics-content" className="flex flex-col gap-5 p-1 -m-1 rounded-xl" style={{ background: "transparent" }}>

      {/* KPI Grid */}
      <KpiGrid s={s} />

      {/* Weekly completion chart */}
      <WeeklyChart s={s} />

      {/* Weekly Comparison */}
      {totalHabits > 0 && <WeeklyComparison s={s} />}

      {/* AI Advice Card */}
      <AiAdviceCard s={s} />

      {/* Heatmap */}
      <Heatmap s={s} />

      {/* 30 kunlik tendensiya chizig'i */}
      {totalHabits > 0 && <TrendLine s={s} />}

      {/* Category Balance */}
      <CategoryBalance s={s} />

      {/* Per-habit breakdown */}
      {habitStats.length > 0 && <HabitBreakdown s={s} />}

      {/* AI Insights */}
      <AiInsights s={s} />

      </div>

        </>
      )}
    </div>
  );
}
