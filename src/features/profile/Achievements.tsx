import { useState, useEffect, useMemo } from "react";
import { useLang } from "../../store/LangContext";
import { Flame, Star, Zap, Loader2, Target, Crown, Sunrise, Ban } from "lucide-react";
import { getLast30DaysLogs, getProfileById, getAchievements, type Achievement } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { getLevel } from "../../utils/levels";

// check_and_unlock_achievements (013_achievements_i18n_keys.sql) barqaror
// achievement_key qaytaradi — matn (sarlavha/tavsif) butunlay client i18n
// orqali (ach_<key>_title / ach_<key>_desc), ikon/rang esa faqat taqdim
// etish uchun shu yerda saqlanadi (DB'dagi `icon` ustuni hozircha
// ishlatilmaydi — bu Lucide komponent kerak, DB emoji emas).
const SERVER_BADGE_META: Record<string, { icon: typeof Flame; color: string }> = {
  iron_will: { icon: Flame, color: "#EF4444" },
  early_bird: { icon: Sunrise, color: "#FBBF24" },
  negative_killer: { icon: Ban, color: "#4ADE80" },
};

const SERVER_ACHIEVEMENT_KEYS = ["iron_will", "early_bird", "negative_killer"] as const;

interface AchievementsProps {
  isDark: boolean;
  profile: Profile;
}

export function Achievements({ isDark, profile }: AchievementsProps) {
  const { t } = useLang();
  const [logs, setLogs] = useState<any[]>([]);
  const [freshScore, setFreshScore] = useState<number | null>(null);
  const [serverAchievements, setServerAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getLast30DaysLogs(profile.id),
      getProfileById(profile.id),
      getAchievements(profile.id),
    ]).then(([logsData, freshProfile, ach]) => {
      setLogs(logsData || []);
      setFreshScore(freshProfile.score ?? 0);
      setServerAchievements(ach || []);
    }).finally(() => setLoading(false));
  }, [profile.id]);

  const completionByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      if (log.completed && log.habits?.type === "positive") {
        map[log.log_date] = (map[log.log_date] || 0) + 1;
      }
    }
    return map;
  }, [logs]);

  const bestStreak = useMemo(() => {
    const dates = Object.keys(completionByDate).filter(d => completionByDate[d] > 0).sort();
    if (dates.length === 0) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
      if (diff === 1) { cur++; if (cur > best) best = cur; }
      else cur = 1;
    }
    return best;
  }, [completionByDate]);

  const score = freshScore !== null ? freshScore : (profile.score ?? 0);
  const totalCompleted = Object.values(completionByDate).reduce((a, b) => a + b, 0);

  const BADGES = [
    { id: "first_step", title: t('ach_badge_first_step_title'), desc: t('ach_badge_first_step_desc'), icon: Zap, color: "#FBBF24", unlocked: totalCompleted >= 1 },
    { id: "consistency_7", title: t('ach_badge_consistency7_title'), desc: t('ach_badge_consistency7_desc'), icon: Flame, color: "#F97316", unlocked: bestStreak >= 7 },
    { id: "consistency_30", title: t('ach_badge_consistency30_title'), desc: t('ach_badge_consistency30_desc'), icon: Flame, color: "#EF4444", unlocked: bestStreak >= 30 },
    { id: "score_100", title: t('ach_badge_score100_title'), desc: t('ach_badge_score100_desc'), icon: Star, color: "#3B82F6", unlocked: score >= 100 },
    { id: "score_500", title: t('level_5'), desc: t('ach_badge_score500_desc'), icon: Crown, color: "#8B5CF6", unlocked: score >= 500 },
    { id: "habit_100", title: t('ach_badge_habit100_title'), desc: t('ach_badge_habit100_desc'), icon: Target, color: "#EC4899", unlocked: totalCompleted >= 100 },
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>;
  }

  const unlockedCount = BADGES.filter(b => b.unlocked).length;
  const lv = getLevel(score);
  const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5"] as const;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('ach_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('ach_subtitle')}</p>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-full font-bold" style={{ background: isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7", color: "var(--neon-green)", fontFamily: "'Geist Mono', monospace" }}>
          {unlockedCount} / {BADGES.length} {t('ach_unlocked_suffix')}
        </div>
      </div>

      {/* Level card */}
      <div
        className="p-5 rounded-2xl mb-6"
        style={{
          background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
          border: `1px solid ${lv.color}33`,
          boxShadow: `0 0 24px ${lv.color}12`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: `${lv.color}18`, border: `2px solid ${lv.color}44` }}
            >
              {lv.emoji}
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

          {/* All 5 levels */}
          <div className="hidden sm:flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((lvNum) => {
              const icons = ["🌱", "⚡", "🔥", "💎", "👑"];
              const active = lv.level >= lvNum;
              return (
                <div
                  key={lvNum}
                  className="flex flex-col items-center gap-0.5"
                  title={t(LEVEL_LABELS[lvNum] as any)}
                >
                  <span style={{ fontSize: 18, opacity: active ? 1 : 0.25 }}>{icons[lvNum - 1]}</span>
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
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
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
        {BADGES.map(badge => {
          const Icon = badge.icon;
          return (
            <div key={badge.id} className={`p-5 rounded-2xl flex flex-col items-center text-center transition-all ${badge.unlocked ? 'opacity-100' : 'opacity-40 grayscale hover:grayscale-0'}`} style={{ background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}` }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors" style={{ background: badge.unlocked ? `${badge.color}25` : (isDark ? '#30363D' : '#F3F4F6'), border: `2px solid ${badge.unlocked ? badge.color : 'transparent'}` }}>
                <Icon size={24} style={{ color: badge.unlocked ? badge.color : (isDark ? '#8B949E' : '#9CA3AF') }} />
              </div>
              <h3 className="text-sm font-bold mb-1 leading-tight" style={{ color: "var(--foreground)" }}>{badge.title}</h3>
              <p className="text-[10px] leading-tight mt-1" style={{ color: "var(--muted-foreground)" }}>{badge.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Server-verified achievements (013_achievements_i18n_keys.sql) —
          check_and_unlock_achievements RPC orqali, faqat haqiqiy log
          tarixidan tasdiqlanadi (client threshold emas). Matn to'liq
          i18n orqali — DB faqat achievement_key saqlaydi. */}
      <div className="mt-8">
        <div className="mb-4">
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('ach_server_section_title')}</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('ach_server_section_sub')}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {SERVER_ACHIEVEMENT_KEYS.map((key) => {
            const unlocked = serverAchievements.find((a) => a.achievement_key === key);
            const meta = SERVER_BADGE_META[key];
            const Icon = meta.icon;
            const title = t(`ach_${key}_title` as any);
            const desc = t(`ach_${key}_desc` as any);
            return (
              <div key={key} className={`p-5 rounded-2xl flex flex-col items-center text-center transition-all ${unlocked ? 'opacity-100' : 'opacity-40 grayscale hover:grayscale-0'}`} style={{ background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}` }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors" style={{ background: unlocked ? `${meta.color}25` : (isDark ? '#30363D' : '#F3F4F6'), border: `2px solid ${unlocked ? meta.color : 'transparent'}` }}>
                  <Icon size={24} style={{ color: unlocked ? meta.color : (isDark ? '#8B949E' : '#9CA3AF') }} />
                </div>
                <h3 className="text-sm font-bold mb-1 leading-tight" style={{ color: "var(--foreground)" }}>{title}</h3>
                <p className="text-[10px] leading-tight mt-1" style={{ color: "var(--muted-foreground)" }}>{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}