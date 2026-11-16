import { useMemo } from 'react';
import { useAllTimeLogsQuery } from './queries';
import { computeBadgeStats, evaluateBadges, type BadgeStats } from '../utils/badges';

/**
 * Nishonlar uchun statistika — barcha davrdagi loglardan (server
 * claim_badge_reward bilan bir xil hisob). Profil, Nishonlar sahifasi va
 * "Barcha nishonlar" oynasi shu bitta manbadan foydalanadi.
 */
export function useBadgeStats(uid: string | null | undefined, score: number) {
  const logsQ = useAllTimeLogsQuery(uid);
  const stats: BadgeStats = useMemo(
    () => computeBadgeStats(logsQ.data || [], score),
    [logsQ.data, score]
  );
  const badges = useMemo(() => evaluateBadges(stats), [stats]);
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  return { stats, badges, unlockedCount, total: badges.length, isLoading: logsQ.isPending };
}
