import { useState, useEffect, useRef } from "react";
import { Gift, Check, Loader2, Lock, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { soundService } from "../services/soundService";
import { getTodayQuestClaims, claimDailyQuest, reconcileDailyMissions } from "../services/db";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";

type QuestContext = { completedToday: number; totalHabits: number; negativeWin: boolean; consistencyWin: boolean };
type Quest = { id: string; titleKey: string; descKey: string; reward: number; met: (c: QuestContext) => boolean };

const BASE_QUESTS: Quest[] = [
  { id: "q_complete_3", titleKey: "quest_complete3_title", descKey: "quest_complete3_desc", reward: 5, met: (c) => c.completedToday >= 3 },
  { id: "q_complete_all", titleKey: "quest_completeall_title", descKey: "quest_completeall_desc", reward: 10, met: (c) => c.totalHabits > 0 && c.completedToday >= c.totalHabits },
];

const NEGATIVE_QUEST: Quest = { id: "q_negative_win", titleKey: "quest_negwin_title", descKey: "quest_negwin_desc", reward: 5, met: (c) => c.negativeWin };
const CONSISTENCY_QUEST: Quest = { id: "q_consistency", titleKey: "quest_consistency_title", descKey: "quest_consistency_desc", reward: 5, met: (c) => c.consistencyWin };

interface DailyQuestsCardProps {
  isDark: boolean;
  profile: Profile;
  completedToday: number;
  totalHabits: number;
  negativeWin: boolean;
  hasNegativeHabits: boolean;
  consistencyWin: boolean;
  onProfileUpdate?: (p: Profile) => void;
}

export function DailyQuestsCard({
  isDark,
  profile,
  completedToday,
  totalHabits,
  negativeWin,
  hasNegativeHabits,
  consistencyWin,
  onProfileUpdate,
}: DailyQuestsCardProps) {
  const { t } = useLang();
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const isInitialMount = useRef(true);

  const QUESTS: Quest[] = [...BASE_QUESTS, hasNegativeHabits ? NEGATIVE_QUEST : CONSISTENCY_QUEST];
  const ctx: QuestContext = { completedToday, totalHabits, negativeWin, consistencyWin };

  // Initial load of today's quest claims
  useEffect(() => {
    getTodayQuestClaims(profile.id)
      .then(setClaimedIds)
      .finally(() => setLoaded(true));
  }, [profile.id]);

  // Two-way dynamic reward reconciliation effect
  useEffect(() => {
    if (!loaded) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    let totalDeducted = 0;
    let totalGranted = 0;
    const nextClaimed = new Set(claimedIds);
    let stateChanged = false;

    for (const q of QUESTS) {
      const isClaimed = claimedIds.has(q.id);
      const isMet = q.met(ctx);

      if (isMet && !isClaimed) {
        // Condition met -> Auto-claim reward
        nextClaimed.add(q.id);
        totalGranted += q.reward;
        stateChanged = true;
      } else if (!isMet && isClaimed) {
        // Condition invalidated (uncheck or fail) -> Revoke reward
        nextClaimed.delete(q.id);
        totalDeducted += q.reward;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      setClaimedIds(nextClaimed);

      // Deduct or credit coins in local profile balance
      const newCoins = Math.max(0, (profile.coins || 0) + totalGranted - totalDeducted);

      if (onProfileUpdate) {
        onProfileUpdate({ ...profile, coins: newCoins });
      }

      if (totalDeducted > 0) {
        toast.warning(`Vazifa sharti buzildi: ${totalDeducted} tanga qaytarib olindi`);
        if (Capacitor.isNativePlatform()) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
      }

      if (totalGranted > 0) {
        soundService.play("streak_levelup");
        if (Capacitor.isNativePlatform()) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
      }

      // Sync backend daily mission state
      reconcileDailyMissions(profile.id).catch(() => {});
    }
  }, [completedToday, totalHabits, negativeWin, consistencyWin, loaded]);

  async function handleClaim(questId: string) {
    setClaiming(questId);
    try {
      const newBalance = await claimDailyQuest(profile.id, questId);
      setClaimedIds((prev) => new Set(prev).add(questId));
      onProfileUpdate?.({ ...profile, coins: newBalance });

      soundService.play("streak_levelup");
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // Already claimed or not eligible
    } finally {
      setClaiming(null);
    }
  }

  if (!loaded) return null;

  return (
    <div className="premium-card p-6 mb-5 bg-xp/5 border-xp/20 rounded-3xl">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-2xl bg-xp/10 flex items-center justify-center">
          <Gift size={18} className="text-xp" />
        </div>
        <p className="text-sm font-black uppercase tracking-widest text-foreground">{t("quests_title")}</p>
      </div>
      <div className="flex flex-col gap-3">
        {QUESTS.map((q) => {
          const claimed = claimedIds.has(q.id);
          const met = q.met(ctx);
          const busy = claiming === q.id;

          return (
            <div
              key={q.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{t(q.titleKey as any)}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{t(q.descKey as any)}</p>
              </div>
              {claimed ? (
                <span className="text-[11px] font-black uppercase tracking-tighter flex items-center gap-1 shrink-0 text-emerald-400">
                  <Check size={14} strokeWidth={4} /> {t("quest_claimed")}
                </span>
              ) : met ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => handleClaim(q.id)}
                  disabled={busy}
                  className="h-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Coins size={12} className="text-amber-300 fill-amber-300" /> +{q.reward}
                    </span>
                  )}
                </motion.button>
              ) : (
                <span className="text-[11px] font-black flex items-center gap-1.5 shrink-0 opacity-40 uppercase">
                  <Lock size={12} strokeWidth={3} /> <Coins size={12} className="text-amber-500 fill-amber-500" />
                  {q.reward}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
