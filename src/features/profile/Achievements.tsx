import { useState, useEffect, useMemo } from "react";
import { useLang } from "../../store/LangContext";
import { Loader2, Award } from "lucide-react";
import { HabitIcon } from "../../components/HabitIcon";
import { getProfileById } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { getLevel } from "../../utils/levels";
import { School21BadgesModal, computeNativeBadges } from "../../components/School21BadgesModal";
import { useBadgeStats } from "../../hooks/useBadges";
import { useProfile } from "../../store/UserContext";

interface AchievementsProps {
}

export function Achievements({}: AchievementsProps) {
  const profile = useProfile();
  const { t } = useLang();
  const [freshScore, setFreshScore] = useState<number | null>(null);

  useEffect(() => {
    getProfileById(profile.id)
      .then((p) => setFreshScore(p?.score ?? 0))
      .catch(() => {});
  }, [profile.id]);

  const [showSchool21Modal, setShowSchool21Modal] = useState(false);

  const score = freshScore !== null ? freshScore : (profile.score ?? 0);
  // Nishonlar — yagona manba (Profil va "Barcha nishonlar" oynasi bilan bir xil)
  const { stats: statsForBadges, unlockedCount: unlockedTieredCount, total: badgesTotal, isLoading: loading } = useBadgeStats(profile.id, score);
  const tieredBadges = useMemo(() => computeNativeBadges(statsForBadges), [statsForBadges]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>;
  }

  const lv = getLevel(score);
  const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5", "level_6", "level_7", "level_8", "level_9", "level_10"] as const;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('ach_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>O'z natijalaringizni kuzating va yangi marralarni zabt eting</p>
        </div>
        <button
          onClick={() => setShowSchool21Modal(true)}
          className="text-xs px-3.5 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-sm"
          style={{ background: "rgba(74,222,128,0.15)", color: "var(--neon-green)", fontFamily: "'Geist Mono', monospace" }}
        >
          <Award size={14} /> Nishonlar ({unlockedTieredCount}/{badgesTotal})
        </button>
      </div>

      {/* Level card */}
      <div
        className="p-5 rounded-2xl mb-6"
        style={{
          background: "rgba(22,27,34,0.85)",
          border: `1px solid ${lv.color}33`,
          boxShadow: `0 0 24px ${lv.color}12`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl overflow-hidden"
              style={{ background: `${lv.color}18`, border: `2px solid ${lv.color}44` }}
            >
              <HabitIcon emoji={lv.icon} size={32} noWrapper color={lv.color} />
            </div>
            <div>
              <p className="text-[11px] font-medium mb-0.5" style={{ color: "var(--muted-foreground)" }}>
                {t('ach_current_level')}
              </p>
              <p className="text-xl font-bold leading-none" style={{ color: lv.color }}>
                Lv.{lv.level} — {t(LEVEL_LABELS[lv.level] as any)}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {score} {t('pp_points')}
              </p>
            </div>
          </div>

          {/* All 10 levels */}
          <div className="hidden sm:flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvNum) => {
              const iconNames = ["Zap", "Zap", "Activity", "Flame", "Target", "Zap", "Brain", "Trophy", "Star", "Crown"];
              const active = lv.level >= lvNum;
              return (
                <div
                  key={lvNum}
                  className="flex flex-col items-center gap-0.5"
                  title={t(LEVEL_LABELS[lvNum] as any)}
                >
                  <div style={{ opacity: active ? 1 : 0.25 }}>
                    <HabitIcon emoji={iconNames[lvNum - 1]} size={18} noWrapper color={active ? lv.color : "var(--muted-foreground)"} />
                  </div>
                  <span className="text-[9px]" style={{ color: active ? lv.color : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {lvNum}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {lv.next !== null ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t('ach_next_level').replace('{n}', String(lv.level + 1)).replace('{name}', t(LEVEL_LABELS[lv.level + 1] as any))}
              </span>
              <span className="text-xs font-bold" style={{ color: lv.color, fontFamily: "'Geist Mono', monospace" }}>
                {score} / {lv.next}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${lv.progress}%`, background: lv.color, boxShadow: `0 0 8px ${lv.color}66` }}
              />
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>
              {lv.next - score} {t('ach_points_left')}
            </p>
          </>
        ) : (
          <div className="text-center py-1">
            <p className="text-sm font-bold" style={{ color: lv.color }}>{t('ach_max_level')}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {tieredBadges.map(badge => {
          const Icon = badge.icon;
          return (
            <button
              type="button"
              key={badge.id}
              onClick={() => setShowSchool21Modal(true)}
              className={`p-5 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer ${badge.isUnlocked ? "opacity-100" : "opacity-40 grayscale hover:grayscale-0"}`}
              style={{ background: "rgba(22,27,34,0.85)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors" style={{ background: badge.isUnlocked ? `${badge.color}25` : "#30363D", border: `2px solid ${badge.isUnlocked ? badge.color : "transparent"}` }}>
                <Icon size={24} style={{ color: badge.isUnlocked ? badge.color : "#8B949E" }} />
              </div>
              <h3 className="text-sm font-bold mb-1 leading-tight" style={{ color: "var(--foreground)" }}>{badge.title}</h3>
              <p className="text-[10px] leading-tight mt-1" style={{ color: "var(--muted-foreground)" }}>
                {badge.isUnlocked ? badge.description : badge.howToEarn}
              </p>
              {!badge.isUnlocked && (
                <p className="text-[10px] font-mono mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                  {badge.progress.current}/{badge.progress.target}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* School 21 Tiered Badges Modal */}
      <School21BadgesModal
        isOpen={showSchool21Modal}
        onClose={() => setShowSchool21Modal(false)}
        profile={profile}
        stats={statsForBadges}
      />
    </div>
  )
}