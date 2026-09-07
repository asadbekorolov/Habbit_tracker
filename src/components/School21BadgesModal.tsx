import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Flame, Crown, Award, Sunrise, Activity, BookOpen,
  Lock, X, Check, Gift, Sparkles, Target, Coins
} from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "../services/supabase";
import { supabase } from "../services/supabase";
import { useUser } from "../store/UserContext";

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond" | "special" | "emerald" | "sapphire";

export interface NativeBadge {
  id: string;
  title: string;
  tier: BadgeTier;
  tierLabel: string;
  description: string;
  icon: any;
  color: string;
  isUnlocked: boolean;
  isClaimed?: boolean;
  progress: { current: number; target: number };
  howToEarn: string;
  reward: { xp: number; coins: number };
}

export type TieredBadge = NativeBadge;

export interface UserStatsForBadges {
  score: number;
  coins?: number;
  bestStreak: number;
  totalCompleted: number;
  activeDays?: number;
  habitsCount?: number;
  earlyBirdCount?: number;
  hasStar?: boolean;
}

export function computeNativeBadges(stats: UserStatsForBadges, claimedBadgeIds: Set<string> = new Set()): NativeBadge[] {
  const { score, bestStreak, totalCompleted, activeDays = 0, earlyBirdCount = 0 } = stats;

  const BADGES_DEF: NativeBadge[] = [
    {
      id: "first_step",
      title: "Birinchi Qadam",
      tier: "bronze",
      tierLabel: "BRONZA NISHON",
      description: "Kamida 1 ta odatni muvaffaqiyatli bajardingiz!",
      icon: Zap,
      color: "#D97706",
      isUnlocked: totalCompleted >= 1,
      isClaimed: claimedBadgeIds.has("first_step"),
      progress: { current: Math.min(totalCompleted, 1), target: 1 },
      howToEarn: "Kamida 1 ta odatni bajaring",
      reward: { xp: 20, coins: 5 },
    },
    {
      id: "consistency_7",
      title: "Intizom Mash'ali",
      tier: "silver",
      tierLabel: "KUMUSH NISHON",
      description: "7 kunlik uzluksiz intizom va ketma-ketlik seriyasiga erishdingiz!",
      icon: Flame,
      color: "#94A3B8",
      isUnlocked: bestStreak >= 7,
      isClaimed: claimedBadgeIds.has("consistency_7"),
      progress: { current: Math.min(bestStreak, 7), target: 7 },
      howToEarn: "7 kunlik ketma-ketlik seriyasini to'plang",
      reward: { xp: 50, coins: 15 },
    },
    {
      id: "consistency_30",
      title: "Temir Iroda",
      tier: "gold",
      tierLabel: "OLTIN NISHON",
      description: "30 kun davomida bukilmas Temir Iroda va barqarorlik ko'rsatdingiz!",
      icon: Crown,
      color: "#F59E0B",
      isUnlocked: bestStreak >= 30,
      isClaimed: claimedBadgeIds.has("consistency_30"),
      progress: { current: Math.min(bestStreak, 30), target: 30 },
      howToEarn: "30 kunlik uzluksiz seriyaga erishing",
      reward: { xp: 150, coins: 50 },
    },
    {
      id: "consistency_100",
      title: "Afsonaviy Barqarorlik",
      tier: "diamond",
      tierLabel: "OLMOS NISHON",
      description: "100 kunlik afsonaviy seriya — intizom va natijaning eng yuqori cho'qqisi!",
      icon: Award,
      color: "#06B6D4",
      isUnlocked: bestStreak >= 100,
      isClaimed: claimedBadgeIds.has("consistency_100"),
      progress: { current: Math.min(bestStreak, 100), target: 100 },
      howToEarn: "100 kunlik ketma-ketlik seriyasini zabt eting",
      reward: { xp: 500, coins: 200 },
    },
    {
      id: "morning_hero",
      title: "Tonggi Qahramon",
      tier: "special",
      tierLabel: "MAXSUS NISHON",
      description: "Ertalab barvaqt uyg'onib, kuningizni mahsuldor va tetik boshladingiz!",
      icon: Sunrise,
      color: "#F43F5E",
      isUnlocked: earlyBirdCount >= 5 || totalCompleted >= 5,
      isClaimed: claimedBadgeIds.has("morning_hero"),
      progress: { current: Math.min(earlyBirdCount || totalCompleted, 5), target: 5 },
      howToEarn: "Ertalab soat 07:00 gacha 5 marta odat belgilang",
      reward: { xp: 75, coins: 25 },
    },
    {
      id: "health_ambassador",
      title: "Salomatlik Elchisi",
      tier: "emerald",
      tierLabel: "ZUMRAD NISHON",
      description: "10 000 qadam va salomatlik ko'rsatkichlarini 7 kun davomida to'liq saqladingiz!",
      icon: Activity,
      color: "#10B981",
      isUnlocked: activeDays >= 7,
      isClaimed: claimedBadgeIds.has("health_ambassador"),
      progress: { current: Math.min(activeDays, 7), target: 7 },
      howToEarn: "7 kun davomida salomatlik va suv balansini saqlang",
      reward: { xp: 100, coins: 30 },
    },
    {
      id: "knowledge_miner",
      title: "Bilim Konchi",
      tier: "sapphire",
      tierLabel: "SAFIR NISHON",
      description: "Kitob mutolaasi va chuqur bilim olish bo'yicha 50 soatlik marrani zabt etdingiz!",
      icon: BookOpen,
      color: "#3B82F6",
      isUnlocked: score >= 500,
      isClaimed: claimedBadgeIds.has("knowledge_miner"),
      progress: { current: Math.min(score, 500), target: 500 },
      howToEarn: "Mutolaa va intellektual odatlarda 500 ball to'plang",
      reward: { xp: 200, coins: 60 },
    },
  ];

  return BADGES_DEF;
}

export const computeTieredBadges = computeNativeBadges;

export interface School21BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  profile?: Profile;
  stats: UserStatsForBadges;
}

export type BadgesModalProps = School21BadgesModalProps;

// Helper function for Tier styling
export function getBadgeCardStyle(tier: BadgeTier, isUnlocked: boolean) {
  if (!isUnlocked) {
    return "bg-slate-900/60 border-slate-800/80 text-slate-500 opacity-70";
  }

  switch (tier) {
    case "bronze":
      return "bg-amber-950/30 border-amber-600/40 text-amber-500 shadow-md shadow-amber-950/20 hover:border-amber-500";
    case "silver":
      return "bg-slate-800/80 border-slate-400/40 text-slate-300 shadow-md shadow-slate-900/30 hover:border-slate-300";
    case "gold":
      return "bg-yellow-500/15 border-yellow-400/50 text-yellow-400 shadow-lg shadow-yellow-500/20 hover:border-yellow-300";
    case "diamond":
      return "bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-lg shadow-cyan-500/25 hover:border-cyan-300 animate-pulse";
    case "emerald":
      return "bg-emerald-500/15 border-emerald-400/50 text-emerald-400 shadow-lg shadow-emerald-500/20 hover:border-emerald-300";
    case "special":
      return "bg-rose-500/15 border-rose-400/50 text-rose-300 shadow-lg shadow-rose-500/20 hover:border-rose-300";
    case "sapphire":
      return "bg-blue-500/15 border-blue-400/50 text-blue-300 shadow-lg shadow-blue-500/20 hover:border-blue-300";
    default:
      return "bg-slate-800 border-slate-700 text-slate-200";
  }
}

export function School21BadgesModal({ isOpen, onClose, profile: propsProfile, stats }: School21BadgesModalProps) {
  const { profile: contextProfile, setProfile, updateCoins } = useUser();
  const profile = contextProfile || propsProfile;

  const [selectedBadge, setSelectedBadge] = useState<NativeBadge | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<boolean>(false);

  useEffect(() => {
    if (!profile) return;
    try {
      const raw = localStorage.getItem(`claimed_badges_${profile.id}`);
      if (raw) {
        setClaimedIds(new Set(JSON.parse(raw)));
      }
    } catch {}
  }, [profile?.id]);

  if (!isOpen) return null;

  const badges = computeNativeBadges(stats, claimedIds);
  const totalUnlocked = badges.filter((b) => b.isUnlocked).length;

  async function handleClaimReward(badge: NativeBadge) {
    if (!profile || !badge.isUnlocked || claimedIds.has(badge.id)) return;
    setClaiming(true);

    try {
      const nextCoins = (profile.coins || 0) + badge.reward.coins;
      const nextScore = (profile.score || 0) + badge.reward.xp;

      // Update Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ coins: nextCoins, score: nextScore })
        .eq('id', profile.id);

      if (error) throw error;

      // Local State & Persistence
      const nextClaimed = new Set(claimedIds).add(badge.id);
      setClaimedIds(nextClaimed);
      localStorage.setItem(`claimed_badges_${profile.id}`, JSON.stringify(Array.from(nextClaimed)));

      updateCoins(nextCoins);
      setProfile({ ...profile, coins: nextCoins, score: nextScore });

      toast.success(`${badge.title} mukofoti olindi! +${badge.reward.xp} XP, +${badge.reward.coins} Tanga 🪙`, {
        duration: 4000,
      });

      setSelectedBadge(null);
    } catch (e: any) {
      toast.error(e?.message || "Mukofotni olishda xatolik yuz berdi.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <AnimatePresence>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          className="w-full max-w-xl rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Modal Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
                <Award size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white">
                  Barcha Nishonlar
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Erishilgan marralar va nishonlar to'plami ({totalUnlocked}/{badges.length})
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              data-modal-close-trigger
              aria-label="Close"
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Badges Body - Modern Vertical Stack List */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            {badges.map((badge) => {
              const Icon = badge.icon;
              const cardStyle = getBadgeCardStyle(badge.tier, badge.isUnlocked);

              return (
                <motion.div
                  key={badge.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedBadge(badge)}
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3.5 cursor-pointer transition-all ${cardStyle}`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Left Badge Icon */}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md relative"
                      style={{
                        background: badge.isUnlocked ? `${badge.color}25` : "rgba(255,255,255,0.05)",
                        border: `2px solid ${badge.isUnlocked ? badge.color : "rgba(255,255,255,0.1)"}`,
                        boxShadow: badge.isUnlocked ? `0 0 16px ${badge.color}35` : "none",
                      }}
                    >
                      {badge.isUnlocked ? (
                        <Icon size={24} style={{ color: badge.color }} />
                      ) : (
                        <Lock size={18} className="text-slate-500" />
                      )}
                    </div>

                    {/* Center Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/10 text-amber-400">
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

                      <h3 className="text-sm font-bold text-white truncate">{badge.title}</h3>
                      <p className="text-xs text-slate-400 leading-snug mt-0.5">
                        {badge.isUnlocked ? badge.description : badge.howToEarn}
                      </p>

                      {/* In-Card Progress Bar for Locked Badges */}
                      {!badge.isUnlocked && (
                        <div className="mt-3 pt-2 border-t border-white/5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] text-slate-500 font-medium">Jarayon</span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold">
                              {badge.progress.current}/{badge.progress.target}
                            </span>
                          </div>
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

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black active:scale-95 transition-all shadow-md"
            >
              Yopish
            </button>
          </div>
        </motion.div>
      </div>

      {/* Interactive Badge Detail Inspection Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="w-full max-w-sm rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl relative overflow-hidden text-center"
            >
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 p-2 rounded-2xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>

              {/* Animated Particle Glow Effect */}
              <div
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-40 animate-pulse"
                style={{ background: selectedBadge.color }}
              />

              <div className="flex flex-col items-center text-center mt-2 relative z-10">
                {/* Large Icon Circle */}
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-3 shadow-2xl relative"
                  style={{
                    background: selectedBadge.isUnlocked ? `${selectedBadge.color}25` : "rgba(255,255,255,0.05)",
                    border: `3px solid ${selectedBadge.isUnlocked ? selectedBadge.color : "rgba(255,255,255,0.15)"}`,
                    boxShadow: selectedBadge.isUnlocked ? `0 0 35px ${selectedBadge.color}60` : "none",
                  }}
                >
                  {selectedBadge.isUnlocked ? (
                    <selectedBadge.icon size={38} style={{ color: selectedBadge.color }} />
                  ) : (
                    <Lock size={30} className="text-slate-500" />
                  )}
                </div>

                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-amber-400 mb-2">
                  {selectedBadge.tierLabel}
                </span>

                <h3 className="text-lg font-black text-white mb-2">{selectedBadge.title}</h3>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed mb-5 px-2">
                  {selectedBadge.description}
                </p>

                {/* Progress Bar Track */}
                <div className="w-full text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 mb-5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Target size={14} className="text-emerald-400" /> Erishish sharti
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {selectedBadge.progress.current} / {selectedBadge.progress.target}
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          100,
                          Math.round((selectedBadge.progress.current / selectedBadge.progress.target) * 100)
                        )}%`,
                      }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      transition={{ duration: 0.8 }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">
                    {selectedBadge.howToEarn}
                  </p>
                </div>

                {/* Reward Section */}
                <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 border border-amber-500/20 mb-5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-amber-400" /> Mukofot:
                  </span>
                  <span className="text-xs font-black text-amber-400 font-mono">
                    +{selectedBadge.reward.xp} XP, +{selectedBadge.reward.coins} Tanga 🪙
                  </span>
                </div>

                {/* Claim / Close Button */}
                {selectedBadge.isUnlocked ? (
                  claimedIds.has(selectedBadge.id) ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-2xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/30 opacity-80"
                    >
                      <Check className="w-4 h-4" /> Mukofot qabul qilingan ✓
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={claiming}
                      onClick={() => handleClaimReward(selectedBadge)}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{claiming ? "Qabul qilinmoqda..." : "Qabul qilish (+Mukofot)"}</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedBadge(null)}
                    className="w-full py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all"
                  >
                    Tushundim
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

export const BadgesModal = School21BadgesModal;
