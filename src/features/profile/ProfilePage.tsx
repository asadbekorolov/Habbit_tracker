import { useState, useEffect, useMemo } from "react";
import { useLang } from "../../store/LangContext";
import { useUser } from "../../store/UserContext";
import {
  Settings, Coins, Zap, Trophy, Loader2, Award,
  Crown, ChevronRight, Star, Flame, Target, Sparkles, X, CheckCircle2, ShoppingBag,
  Lock, Check
} from "lucide-react";
import { HabitIcon } from "../../components/HabitIcon";
import {
  getLast30DaysLogs, getHabits, getUserRank, getAllTimeLogs,
  getProfileById, getFollowCounts, isStarActive, cleanupExpiredFrame, getCached
} from "../../services/db";
import { CoinShopModal } from "./CoinShopModal";
import { getLevel } from "../../utils/levels";
import { getUsernameGlowStyle } from "../../utils/cosmetics";
import type { Profile } from "../../services/supabase";
import { UserBadge } from "../../components/UserBadge";
import { AvatarFrame } from "../../components/AvatarFrame";
import { School21BadgesModal, computeTieredBadges, getBadgeCardStyle } from "../../components/School21BadgesModal";
import { motion, AnimatePresence } from "framer-motion";

type Lang = "uz" | "ru" | "en";

interface ProfilePageProps {
  isDark: boolean;
  profile: Profile;
  onNavigate: (tab: string) => void;
  onUserClick?: (userId: string) => void;
  onLogout: () => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onProfileUpdate?: (p: Profile) => void;
}

const BADGE_DEFS = [
  { id: "first_step",    titleKey: "ach_badge_first_step_title", descKey: "ach_badge_first_step_desc", icon: Zap,    color: "#FBBF24", check: (_s: number, _str: number, total: number) => total >= 1 },
  { id: "consistency_7", titleKey: "ach_badge_consistency7_title", descKey: "ach_badge_consistency7_desc", icon: Flame,  color: "#F97316", check: (_s: number, str: number) => str >= 7 },
  { id: "consistency_30",titleKey: "ach_badge_consistency30_title", descKey: "ach_badge_consistency30_desc", icon: Flame,  color: "#EF4444", check: (_s: number, str: number) => str >= 30 },
  { id: "score_100",     titleKey: "ach_badge_score100_title", descKey: "ach_badge_score100_desc", icon: Star,   color: "#3B82F6", check: (s: number) => s >= 100 },
  { id: "score_500",     titleKey: "ach_badge_score500_title", descKey: "ach_badge_score500_desc", icon: Crown,  color: "#8B5CF6", check: (s: number) => s >= 500 },
  { id: "habit_100",     titleKey: "ach_badge_habit100_title", descKey: "ach_badge_habit100_desc", icon: Target, color: "#EC4899", check: (_s: number, _str: number, total: number) => total >= 100 },
] as const;

export function ProfilePage({ isDark, profile: propsProfile, onNavigate, lang, onProfileUpdate }: ProfilePageProps) {
  const { t } = useLang();
  const { profile: contextProfile } = useUser();
  const profile = contextProfile || propsProfile;

  const [logs30, setLogs30] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [rank, setRank] = useState(0);
  const [freshScore, setFreshScore] = useState<number | null>(null);
  const [freshCoins, setFreshCoins] = useState(profile.coins || 0);
  const [starExpiresAt, setStarExpiresAt] = useState<string | null>(profile.star_expires_at ?? null);
  const [showShop, setShowShop] = useState(false);
  const [showAllBadgesModal, setShowAllBadgesModal] = useState(false);
  const initialCached = getCached<any[]>(`logs_range_${profile.id}_30`);
  const [loading, setLoading] = useState(!initialCached);

  useEffect(() => {
    const cached = getCached<any[]>(`logs_range_${profile.id}_30`);
    if (!cached) setLoading(true);

    Promise.all([
      getLast30DaysLogs(profile.id),
      getAllTimeLogs(profile.id),
      getHabits(profile.id),
      getUserRank(profile.id),
      getProfileById(profile.id),
      cleanupExpiredFrame(profile.id),
    ]).then(([l30, lAll, h, r, freshProfile, effectiveFrame]) => {
      setLogs30(l30 || []);
      setAllLogs(lAll || []);
      setHabits(h || []);
      setRank(r);
      if (freshProfile) {
        setFreshScore(freshProfile.score ?? 0);
        setFreshCoins(freshProfile.coins ?? 0);
        setStarExpiresAt(freshProfile.star_expires_at ?? null);
        if (effectiveFrame !== (profile.active_frame ?? null)) {
          onProfileUpdate?.({ ...freshProfile, active_frame: effectiveFrame });
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [profile.id]);

  const score = freshScore !== null ? freshScore : (profile.score || 0);
  const lv = getLevel(score);
  const totalCompleted = allLogs.filter((l: any) => l.habits?.type === "positive").length;

  const bestStreak = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const l of logs30) {
      if (l.completed && l.habits?.type === "positive") {
        byDate[l.log_date] = (byDate[l.log_date] || 0) + 1;
      }
    }
    const dates = Object.keys(byDate).filter((d) => byDate[d] > 0).sort();
    if (!dates.length) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
      if (diff === 1) { cur++; if (cur > best) best = cur; } else cur = 1;
    }
    return best;
  }, [logs30]);

  const unlockedBadges = BADGE_DEFS.filter((b) => b.check(score, bestStreak, totalCompleted));

  const activeDays = useMemo(() => new Set(allLogs.map((l: any) => l.log_date)).size, [allLogs]);

  const statsForBadges = useMemo(() => ({
    score,
    coins: freshCoins,
    bestStreak,
    totalCompleted,
    activeDays,
    habitsCount: habits.length,
    hasStar: isStarActive({ has_star: true, star_expires_at: starExpiresAt }),
  }), [score, freshCoins, bestStreak, totalCompleted, activeDays, habits.length, starExpiresAt]);

  const tieredBadges = useMemo(() => computeTieredBadges(statsForBadges), [statsForBadges]);
  const unlockedTieredCount = tieredBadges.filter(b => b.isUnlocked).length;

  const memberSince = useMemo(() => {
    const d = new Date(profile.created_at);
    const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }, [profile.created_at]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Profile Header & Character Showcase */}
      <div className="premium-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center relative z-10">
          <div className="relative mb-4">
            <AvatarFrame frameId={profile.active_frame} radius={52}>
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-primary/20 shadow-xl bg-card">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-primary/10 text-primary">
                    {(profile.display_name || profile.full_name || 'A')[0].toUpperCase()}
                  </div>
                )}
              </div>
            </AvatarFrame>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-card border-2 border-border flex items-center justify-center shadow-lg">
              <HabitIcon emoji={lv.icon} size={20} noWrapper />
            </div>
          </div>

          <h2 className="text-2xl font-black mb-1 flex items-center gap-2 justify-center" style={profile?.username_glow ? getUsernameGlowStyle(isDark) : {}}>
            {profile?.display_name || profile?.full_name || 'Foydalanuvchi'}
            <UserBadge active={isStarActive({ has_star: true, star_expires_at: starExpiresAt })} size={20} />
          </h2>
          <p className="text-sm font-bold text-muted-foreground mb-4">@{profile?.username || 'user'}</p>

          {/* Dedicated Character/Avatar Showcase Stats */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-2xl bg-xp/10 border border-xp/20 text-xp text-xs font-bold flex items-center gap-2 shadow-sm">
              <Zap size={15} className="fill-xp" /> Lv.{lv.level} · {lv.label}
            </div>
            {rank > 0 && (
              <div className="px-3.5 py-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold flex items-center gap-2 shadow-sm">
                <Trophy size={15} /> #{rank} Reyting
              </div>
            )}
            <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-2 shadow-sm">
              <Award size={15} className="text-amber-400" /> Nishonlar: {unlockedTieredCount}/{tieredBadges.length} ta
            </div>
          </div>
        </div>
      </div>

      {/* Redesigned Clean Shop CTA Card */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setShowShop(true);
          onNavigate('store');
        }}
        className="w-full my-1 p-4 rounded-2xl bg-slate-900/80 dark:bg-slate-900/80 bg-white/80 backdrop-blur-md border border-amber-500/20 hover:border-amber-500/30 shadow-md cursor-pointer transition-all flex items-center justify-between gap-3 group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
              Odatlar Do'koni
            </h3>
            <p className="text-xs text-slate-400">Noyob ramkalar va bonuslar</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-amber-400 font-bold font-mono text-xs bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            <span>🪙</span>
            <span>{freshCoins || profile.coins || 0}</span>
          </div>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-amber-400 transition-colors" />
        </div>
      </motion.div>

      <div className="flex items-center justify-between mb-1 px-1">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Nishonlar</h3>
        <button onClick={() => onNavigate("settings")} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-primary transition-all">
          <Settings size={18} />
        </button>
      </div>

      {/* Badges Section */}
      <div className="premium-card p-5">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
               <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                 <Award size={20} className="text-amber-400" />
               </div>
               <div>
                 <h3 className="text-sm font-black uppercase tracking-wider text-white">Mening Nishonlarim</h3>
                 <p className="text-[11px] text-slate-400 font-medium">Erishilgan marralar va nishonlar to'plami</p>
               </div>
            </div>
            <button
              onClick={() => setShowAllBadgesModal(true)}
              className="text-xs font-bold text-amber-400 flex items-center gap-1 hover:underline bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 transition-all hover:bg-amber-500/20"
            >
              Nishonlar ({unlockedTieredCount}/{tieredBadges.length} ta) <ChevronRight size={14} />
            </button>
         </div>

         <div className="space-y-3">
           {tieredBadges.slice(0, 4).map((badge) => {
             const Icon = badge.icon;
             const cardStyle = getBadgeCardStyle(badge.tier, badge.isUnlocked);

             return (
               <motion.div
                 key={badge.id}
                 whileHover={{ scale: 1.01 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => setShowAllBadgesModal(true)}
                 className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${cardStyle}`}
               >
                 <div className="flex items-start gap-3.5 min-w-0 flex-1">
                   <div
                     className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm relative"
                     style={{
                       background: badge.isUnlocked ? `${badge.color}25` : "rgba(255,255,255,0.05)",
                       border: `2px solid ${badge.isUnlocked ? badge.color : "rgba(255,255,255,0.1)"}`,
                     }}
                   >
                     {badge.isUnlocked ? (
                       <Icon size={22} style={{ color: badge.color }} />
                     ) : (
                       <Lock size={16} className="text-slate-500" />
                     )}
                   </div>

                   <div className="min-w-0 flex-1">
                     <div className="flex items-center justify-between gap-2 mb-1">
                       <span className="text-[9px] font-black uppercase text-amber-400">
                         {badge.tierLabel}
                       </span>
                       {badge.isUnlocked ? (
                         <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                           <Check size={11} /> Bajarildi
                         </span>
                       ) : (
                         <span className="text-[10px] font-mono font-bold text-slate-400">
                           {badge.progress.current}/{badge.progress.target}
                         </span>
                       )}
                     </div>

                     <h4 className="text-xs font-bold text-white truncate">{badge.title}</h4>
                     <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                       {badge.isUnlocked ? badge.description : badge.howToEarn}
                     </p>

                     {!badge.isUnlocked && (
                       <div className="mt-2">
                         <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
                           <div
                             className="bg-emerald-500 h-full rounded-full transition-all"
                             style={{ width: `${Math.min(100, Math.round((badge.progress.current / badge.progress.target) * 100))}%` }}
                           />
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               </motion.div>
             );
           })}
         </div>
      </div>

      {/* Account Info */}
      <div className="premium-card p-5">
        <h3 className="text-sm font-black uppercase tracking-widest mb-4 opacity-50">Hisob Ma'lumotlari</h3>
        <div className="space-y-3">
          {[
            { label: 'Ro\'yxatdan o\'tgan sana', value: memberSince },
            { label: 'Faol odatlar', value: `${habits.filter((h: any) => h.is_active !== false).length} ta` },
            { label: 'Maxfiylik', value: profile.profile_private ? 'Yopiq profil' : 'Ochiq profil' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
              <span className="text-sm font-black">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shop Modal */}
      {showShop && (
        <CoinShopModal
          isDark={isDark}
          profile={profile}
          coins={freshCoins}
          onClose={() => setShowShop(false)}
          onCoinsChange={(n) => setFreshCoins(n)}
          onStarPurchased={(newExpiresAt) => setStarExpiresAt(newExpiresAt)}
          onProfileUpdate={onProfileUpdate}
        />
      )}

      {/* School 21 Tiered Badges Modal */}
      <School21BadgesModal
        isOpen={showAllBadgesModal}
        onClose={() => setShowAllBadgesModal(false)}
        isDark={isDark}
        profile={profile}
        stats={statsForBadges}
      />
    </div>
  );
}
