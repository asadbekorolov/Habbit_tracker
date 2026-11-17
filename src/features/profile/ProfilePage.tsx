import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLang } from "../../store/LangContext";
import { useUser, useProfile } from "../../store/UserContext";
import {
  Settings, Coins, Zap, Trophy, Loader2, Award,
  Crown, ChevronRight, Star, Flame, Target, Sparkles, X, CheckCircle2, ShoppingBag,
  Lock, Check, MessageSquarePlus, Send, ExternalLink, BookOpen, HelpCircle, Activity, Edit3,
  Users, HeartPulse, ListChecks, Clock, ShieldAlert
} from "lucide-react";
import { HabitIcon } from "../../components/HabitIcon";
import {
  getProfileById, getFollowCounts, isStarActive, cleanupExpiredFrame
} from "../../services/db";
import { useHabitsQuery, useMyRankQuery } from "../../hooks/queries";
import { useBadgeStats } from "../../hooks/useBadges";
import { CharacterVideo } from "../../components/CharacterVideo";
import { useIsSiteAdmin } from "../../hooks/useIsSiteAdmin";
import { CoinShopModal } from "./CoinShopModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { GuideModal } from "./components/GuideModal";
import { BiometricsOnboardingModal } from "../../components/BiometricsOnboardingModal";
import { MiniPipAvatar } from "../../components/MiniPipAvatar";
import { getLevel } from "../../utils/levels";
import { getUsernameGlowStyle } from "../../utils/cosmetics";
import type { Profile } from "../../services/supabase";
import { UserBadge } from "../../components/UserBadge";
import { AvatarFrame } from "../../components/AvatarFrame";
import { School21BadgesModal, getBadgeCardStyle, computeNativeBadges } from "../../components/School21BadgesModal";
import { motion, AnimatePresence } from "framer-motion";

type Lang = "uz" | "ru" | "en";

interface ProfilePageProps {
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

export function ProfilePage({ onNavigate, lang, onProfileUpdate }: ProfilePageProps) {
  const { t } = useLang();
    const profile = useProfile();
  const isAdmin = useIsSiteAdmin();

  // ─── Yagona kesh (React Query) ──────────────────────────────────────
  const habitsQ = useHabitsQuery(profile.id);
  const rankQ = useMyRankQuery(profile.id, 'monthly');
  const habits: any[] = habitsQ.data || [];
  const rank = rankQ.data || 0;
  const [freshScore, setFreshScore] = useState<number | null>(null);
  const [freshCoins, setFreshCoins] = useState(profile.coins || 0);
  const [starExpiresAt, setStarExpiresAt] = useState<string | null>(profile.star_expires_at ?? null);
  const [showShop, setShowShop] = useState(false);
  const [showAllBadgesModal, setShowAllBadgesModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  // Sozlamalardagi "Shaxsiy parametrlarni tahrirlash" -> /profile?edit=params
  const [searchParams] = useSearchParams();
  const [showBiometricsModal, setShowBiometricsModal] = useState(() => searchParams.get("edit") === "params");
  // Kesh bo'lsa darhol ko'rsatamiz; birinchi marta — asosiy ma'lumot kelguncha.
  const loading = habitsQ.isPending;

  useEffect(() => {
    Promise.all([
      getProfileById(profile.id),
      cleanupExpiredFrame(profile.id),
    ]).then(([freshProfile, effectiveFrame]) => {
      if (freshProfile) {
        setFreshScore(freshProfile.score ?? 0);
        setFreshCoins(freshProfile.coins ?? 0);
        setStarExpiresAt(freshProfile.star_expires_at ?? null);
        if (effectiveFrame !== (profile.active_frame ?? null)) {
          onProfileUpdate?.({ ...freshProfile, active_frame: effectiveFrame });
        }
      }
    }).catch(() => {});
  }, [profile.id]);

  const score = freshScore !== null ? freshScore : (profile.score || 0);
  const lv = getLevel(score);
  // Nishonlar — yagona manba (barcha davr loglari, server sharti bilan bir xil)
  const { stats: statsForBadges, unlockedCount: unlockedTieredCount } = useBadgeStats(profile.id, score);
  const tieredBadges = useMemo(() => computeNativeBadges(statsForBadges), [statsForBadges]);

  const memberSince = useMemo(() => {
    const d = new Date(profile.created_at);
    const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }, [profile.created_at]);

  const heightCm = profile.height_cm || 175;
  const weightKg = profile.weight_kg || 70;
  const heightM = heightCm / 100;
  const bmi = (weightKg / (heightM * heightM)).toFixed(1);

  const age = useMemo(() => {
    if (!profile.birth_date) return null;
    const birth = new Date(profile.birth_date);
    const now = new Date();
    if (isNaN(birth.getTime())) return null;

    let computedAge = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      computedAge--;
    }
    return computedAge >= 0 && computedAge <= 120 ? computedAge : null;
  }, [profile.birth_date]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-36 font-sans">
      {/* Profile Header & Character Showcase */}
      <div className="premium-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2 relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Shaxsiy profil</span>
          <MiniPipAvatar profile={profile} onClick={() => setShowBiometricsModal(true)} />
        </div>

        {/* Personaj (vaqtinchalik video) — avatar uning ustiga chiqib turadi */}
        <div className="relative -mx-6 h-52 overflow-hidden bg-[#cdad84]">
          <CharacterVideo position="50% 38%" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f141e] to-transparent pointer-events-none" />
        </div>

        <div className="flex flex-col items-center text-center relative z-10 -mt-12">
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

          <h2 className="text-2xl font-black mb-1 flex items-center gap-2 justify-center" style={profile?.username_glow ? getUsernameGlowStyle() : {}}>
            {profile?.display_name || profile?.full_name || 'Foydalanuvchi'}
            <UserBadge active={isStarActive({ has_star: true, star_expires_at: starExpiresAt })} size={20} />
          </h2>
          <p className="text-sm font-bold text-muted-foreground mb-4">@{profile?.username || 'user'}</p>

          {/* Dedicated Character/Avatar Showcase Stats */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="px-3.5 py-1.5 rounded-2xl bg-xp/10 border border-xp/20 text-xp text-xs font-bold flex items-center gap-2 shadow-sm">
              <Zap size={15} className="fill-xp" /> LVL {lv.level} · {lv.label}
            </div>
            {rank > 0 && (
              <div className="px-3.5 py-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold flex items-center gap-2 shadow-sm">
                <Trophy size={15} /> #{rank} Reyting
              </div>
            )}
            <button type="button" onClick={() => setShowAllBadgesModal(true)} className="px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer active:scale-95">
              <Award size={15} className="text-amber-400" /> {t("sec_badges")}: {unlockedTieredCount}/{tieredBadges.length} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Barcha bo'limlar: dock'da yo'q hamma sahifalar bitta joyda */}
      <section aria-label={t("sec_all_title")} className="-mt-2 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">{t("sec_all_title")}</h3>
        <nav className="grid grid-cols-4 gap-2">
          {([
            { id: "habits", label: t("sec_habits"), icon: ListChecks },
            { id: "habits?section=routines", label: t("sec_routine"), icon: Clock },
            { id: "groups", label: t("sec_groups"), icon: Users },
            { id: "health", label: t("sec_health"), icon: HeartPulse },
            { id: "leaderboard", label: t("sec_leaderboard"), icon: Trophy },
            { id: "store", label: t("sec_store"), icon: ShoppingBag },
            { id: "achievements", label: t("sec_badges"), icon: Award },
            { id: "settings", label: t("sec_settings"), icon: Settings },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 active:scale-95 transition-all cursor-pointer"
            >
              <Icon size={19} className="text-emerald-400" />
              <span className="text-[10px] font-semibold leading-tight text-center px-0.5">{label}</span>
            </button>
          ))}
        </nav>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onNavigate("admin")}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <ShieldAlert size={18} /> {t("sec_admin")}
            </span>
            <ChevronRight size={16} />
          </button>
        )}
      </section>

      {/* Anthropometrics / Biometrics Card */}
      <div
        onClick={() => setShowBiometricsModal(true)}
        className="premium-card p-5 cursor-pointer hover:border-emerald-500/30 transition-all active:scale-[0.99] group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white group-hover:text-emerald-400 transition-colors">
                Shaxsiy parametrlar
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {heightCm} sm • {weightKg} kg {age !== null ? `• ${age} yosh` : ''} (BMI: {bmi})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBiometricsModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Edit3 size={13} /> Tahrirlash
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <span className="text-[10px] font-['Geist_Mono',monospace] font-mono uppercase text-slate-400 block mb-0.5">Bo'y</span>
            <p className="text-sm font-bold font-['Geist_Mono',monospace] font-mono text-emerald-400">{heightCm} sm</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <span className="text-[10px] font-['Geist_Mono',monospace] font-mono uppercase text-slate-400 block mb-0.5">Vazn</span>
            <p className="text-sm font-bold font-['Geist_Mono',monospace] font-mono text-emerald-400">{weightKg} kg</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <span className="text-[10px] font-['Geist_Mono',monospace] font-mono uppercase text-slate-400 block mb-0.5">
              BMI
            </span>
            <p className="text-sm font-bold font-['Geist_Mono',monospace] font-mono text-emerald-400">{bmi}</p>
          </div>
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

      {/* Help & Support Section */}
      <div className="premium-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Yordam va Aloqa</h3>
            <p className="text-[11px] text-slate-400 font-medium">Qo'llab-quvvatlash va fikr-mulohazalar</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Row 1: Feedback */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFeedbackModal(true)}
            className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <MessageSquarePlus size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                  Fikr va taklif bildirish
                </h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Muammo yoki takliflaringizni yuboring
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
          </motion.div>

          {/* Row 2: Support */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.open('https://t.me/tracker_support_bot', '_blank')}
            className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <Send size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                  Biz bilan bog'lanish
                </h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Telegram qo'llab-quvvatlash xizmati
                </p>
              </div>
            </div>
            <ExternalLink size={16} className="text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
          </motion.div>

          {/* Row 3: Guide */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowGuideModal(true)}
            className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <BookOpen size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                  Qo'llanma va FAQ
                </h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  XP, tangalar va Health Connect haqida
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-500 group-hover:text-purple-400 transition-colors shrink-0" />
          </motion.div>
        </div>
      </div>

      {/* Biometrics Onboarding / Edit Modal */}
      {showBiometricsModal && (
        <BiometricsOnboardingModal
          isOpen={showBiometricsModal}
          onClose={() => setShowBiometricsModal(false)}
          profile={profile}
          onProfileUpdate={onProfileUpdate}
          allowDismiss={true}
        />
      )}

      {/* Shop Modal */}
      {showShop && (
        <CoinShopModal
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
        profile={profile}
        stats={statsForBadges}
      />

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          profile={profile}
        />
      )}

      {/* Guide & FAQ Modal */}
      {showGuideModal && (
        <GuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
        />
      )}
    </div>
  );
}
