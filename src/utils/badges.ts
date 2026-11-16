// ─── Nishonlar — YAGONA MANBA ───────────────────────────────────────────────
// Ochilish shartlari serverdagi claim_badge_reward() (047) bilan AYNAN bir xil:
// mukofotni server shu shartlar bo'yicha beradi, shuning uchun ilova ham
// faqat shularni ko'rsatadi va tavsiflar haqiqiy shartni aytadi.
//   first_step         — jami bajarilgan >= 1
//   consistency_N      — eng uzun ketma-ketlik (kamida 1 odat bajarilgan
//                        uzluksiz kunlar) >= N
//   morning_hero       — jami bajarilgan >= 5
//   health_ambassador  — kamida 1 odat bajarilgan kunlar soni >= 7
//   knowledge_miner    — XP (profiles.score) >= 500
// React'siz sof modul — node testlari bilan tekshiriladi.

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'special' | 'emerald' | 'sapphire';
export type BadgeMetric = 'totalCompleted' | 'bestStreak' | 'activeDays' | 'score';

export interface BadgeStats {
  score: number;
  totalCompleted: number;
  activeDays: number;
  bestStreak: number;
}

export interface BadgeDef {
  id: string;
  title: string;
  tier: BadgeTier;
  tierLabel: string;
  /** Ochilgandan keyin ko'rsatiladigan matn */
  description: string;
  /** Qanday ochiladi — haqiqiy shart */
  howToEarn: string;
  color: string;
  metric: BadgeMetric;
  target: number;
  /** Server bilan bir xil (claim_badge_reward VALUES ro'yxati) */
  reward: { xp: number; coins: number };
}

export const BADGE_DEFS: readonly BadgeDef[] = [
  {
    id: 'first_step', title: 'Birinchi Qadam', tier: 'bronze', tierLabel: 'BRONZA NISHON',
    description: 'Birinchi odatingizni bajardingiz!',
    howToEarn: 'Kamida 1 marta odat bajaring',
    color: '#D97706', metric: 'totalCompleted', target: 1, reward: { xp: 20, coins: 5 },
  },
  {
    id: 'morning_hero', title: 'Besh Qadam', tier: 'special', tierLabel: 'MAXSUS NISHON',
    description: 'Jami 5 marta odat bajardingiz!',
    howToEarn: 'Jami 5 marta odat bajaring',
    color: '#F43F5E', metric: 'totalCompleted', target: 5, reward: { xp: 75, coins: 25 },
  },
  {
    id: 'health_ambassador', title: 'Faol Hafta', tier: 'emerald', tierLabel: 'ZUMRAD NISHON',
    description: '7 xil kunda odat bajardingiz!',
    howToEarn: "7 xil kunda kamida 1 tadan odat bajaring (ketma-ket bo'lishi shart emas)",
    color: '#10B981', metric: 'activeDays', target: 7, reward: { xp: 100, coins: 30 },
  },
  {
    id: 'consistency_7', title: "Intizom Mash'ali", tier: 'silver', tierLabel: 'KUMUSH NISHON',
    description: '7 kun ketma-ket har kuni odat bajardingiz!',
    howToEarn: '7 kun ketma-ket har kuni kamida 1 ta odat bajaring',
    color: '#94A3B8', metric: 'bestStreak', target: 7, reward: { xp: 50, coins: 15 },
  },
  {
    id: 'knowledge_miner', title: 'Odat Ustasi', tier: 'sapphire', tierLabel: 'SAFIR NISHON',
    description: "500 XP to'pladingiz!",
    howToEarn: "Jami 500 XP to'plang",
    color: '#3B82F6', metric: 'score', target: 500, reward: { xp: 200, coins: 60 },
  },
  {
    id: 'consistency_30', title: 'Temir Iroda', tier: 'gold', tierLabel: 'OLTIN NISHON',
    description: '30 kun ketma-ket har kuni odat bajardingiz!',
    howToEarn: '30 kun ketma-ket har kuni kamida 1 ta odat bajaring',
    color: '#F59E0B', metric: 'bestStreak', target: 30, reward: { xp: 150, coins: 50 },
  },
  {
    id: 'consistency_100', title: 'Afsonaviy Barqarorlik', tier: 'diamond', tierLabel: 'OLMOS NISHON',
    description: '100 kun ketma-ket har kuni odat bajardingiz!',
    howToEarn: '100 kun ketma-ket har kuni kamida 1 ta odat bajaring',
    color: '#06B6D4', metric: 'bestStreak', target: 100, reward: { xp: 500, coins: 200 },
  },
];

export interface BadgeLog {
  log_date: string;
  completed?: boolean | null;
}

const DAY_MS = 86_400_000;
const dayNum = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / DAY_MS);
};

/**
 * Barcha davrdagi loglardan statistika — server bilan bir xil hisob:
 * barcha turdagi bajarilgan loglar sanaladi.
 */
export function computeBadgeStats(logs: readonly BadgeLog[], score: number): BadgeStats {
  let totalCompleted = 0;
  const days = new Set<string>();
  for (const l of logs) {
    if (l.completed === false) continue;
    totalCompleted++;
    days.add(l.log_date);
  }
  const sorted = [...days].map(dayNum).sort((a, b) => a - b);
  let best = 0;
  let cur = 0;
  for (let i = 0; i < sorted.length; i++) {
    cur = i > 0 && sorted[i] - sorted[i - 1] === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return { score: score || 0, totalCompleted, activeDays: days.size, bestStreak: best };
}

export interface EvaluatedBadge extends BadgeDef {
  isUnlocked: boolean;
  isClaimed: boolean;
  progress: { current: number; target: number };
}

export function evaluateBadges(stats: BadgeStats, claimed: ReadonlySet<string> = new Set()): EvaluatedBadge[] {
  return BADGE_DEFS.map((def) => {
    const value = stats[def.metric] || 0;
    return {
      ...def,
      isUnlocked: value >= def.target,
      isClaimed: claimed.has(def.id),
      progress: { current: Math.min(value, def.target), target: def.target },
    };
  });
}
