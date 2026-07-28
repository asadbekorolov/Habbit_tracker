import { useState, useEffect } from "react";
import { Gift, Check, Loader2, Lock } from "lucide-react";
import { getTodayQuestClaims, claimDailyQuest } from "../services/db";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";

type QuestContext = { completedToday: number; totalHabits: number; negativeWin: boolean; consistencyWin: boolean };
type Quest = { id: string; titleKey: string; descKey: string; reward: number; met: (c: QuestContext) => boolean };

const BASE_QUESTS: Quest[] = [
  { id: "q_complete_3", titleKey: "quest_complete3_title", descKey: "quest_complete3_desc", reward: 5, met: (c) => c.completedToday >= 3 },
  { id: "q_complete_all", titleKey: "quest_completeall_title", descKey: "quest_completeall_desc", reward: 10, met: (c) => c.totalHabits > 0 && c.completedToday >= c.totalHabits },
];

// "Salbiy odatga qarshi turing" vazifasi salbiy odati umuman yo'q
// foydalanuvchi uchun hech qachon bajarilmaydi (doim qulflangan qolardi) —
// shuning uchun bunday foydalanuvchilarga o'rniga hammaga teng adolatli
// "kecha ham, bugun ham faol bo'lish" vazifasi ko'rsatiladi.
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

export function DailyQuestsCard({ isDark, profile, completedToday, totalHabits, negativeWin, hasNegativeHabits, consistencyWin, onProfileUpdate }: DailyQuestsCardProps) {
  const { t } = useLang();
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTodayQuestClaims(profile.id).then(setClaimedIds).finally(() => setLoaded(true));
  }, [profile.id]);

  const QUESTS: Quest[] = [...BASE_QUESTS, hasNegativeHabits ? NEGATIVE_QUEST : CONSISTENCY_QUEST];
  const ctx: QuestContext = { completedToday, totalHabits, negativeWin, consistencyWin };

  async function handleClaim(questId: string) {
    setClaiming(questId);
    try {
      const newBalance = await claimDailyQuest(profile.id, questId);
      setClaimedIds((prev) => new Set(prev).add(questId));
      onProfileUpdate?.({ ...profile, coins: newBalance });
    } catch {
      // shart hali bajarilmagan yoki allaqachon olingan bo'lishi mumkin — jim o'tkazamiz
    } finally {
      setClaiming(null);
    }
  }

  if (!loaded) return null;
  const allClaimed = QUESTS.every((q) => claimedIds.has(q.id));
  if (allClaimed) return null;

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{
        background: isDark ? "rgba(167,139,250,0.06)" : "rgba(167,139,250,0.05)",
        border: `1px solid ${isDark ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.18)"}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Gift size={16} style={{ color: "#A78BFA" }} />
        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t('quests_title')}</p>
      </div>
      <div className="space-y-2">
        {QUESTS.map((q) => {
          const claimed = claimedIds.has(q.id);
          const met = q.met(ctx);
          const busy = claiming === q.id;
          return (
            <div
              key={q.id}
              className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{t(q.titleKey as any)}</p>
                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t(q.descKey as any)}</p>
              </div>
              {claimed ? (
                <span className="text-[11px] font-semibold flex items-center gap-1 shrink-0" style={{ color: "#4ADE80" }}>
                  <Check size={12} /> {t('shop_purchased')}
                </span>
              ) : met ? (
                <button
                  type="button"
                  onClick={() => handleClaim(q.id)}
                  disabled={busy}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0"
                  style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : `🪙 +${q.reward}`}
                </button>
              ) : (
                <span className="text-[11px] font-bold flex items-center gap-1 shrink-0" style={{ color: "var(--muted-foreground)" }}>
                  <Lock size={11} /> 🪙{q.reward}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
