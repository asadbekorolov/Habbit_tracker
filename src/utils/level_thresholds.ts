// "Solo Leveling" uslubidagi daraja jadvali — hozirgi src/utils/levels.ts
// (5 bosqichli, score-asosli) bilan hozircha bog'lanmagan, mustaqil modul.
// Server tomonidagi haqiqat manbai hamon 006_xp_leveling.sql'dagi
// calculate_level(xp) — bu fayl faqat CLIENT UI uchun (progress bar,
// rank belgisi va h.k.). Agar bu jadval production'da ishlatiladigan
// bo'lsa, calculate_level(xp) ham xuddi shu formulaga mos yangilanishi
// SHART, aks holda server va client daraja hisob-kitobi mos kelmay qoladi.

export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export interface LevelThreshold {
  level: number;        // mutlaq daraja, 1..60
  rank: Rank;
  rankLevel: number;    // rank ichidagi daraja, 1..10
  xpRequired: number;   // shu darajaga yetish uchun jami (kumulyativ) XP
  title: string;        // masalan "E-Rank Hunter", "Shadow Monarch"
}

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];
const LEVELS_PER_RANK = 10;

const RANK_TITLES: Record<Rank, string> = {
  E: "Novice Hunter",
  D: "Awakened Hunter",
  C: "Trained Hunter",
  B: "Elite Hunter",
  A: "Elite Knight",
  S: "Shadow Monarch",
};

// Rank ichida XP talabi kvadratik o'sadi (har keyingi daraja oldingisidan
// qimmatroq), ranklar orasida esa qo'shimcha sakrash (multiplier) bo'ladi —
// shu bilan o'yin hissi beriladi: boshida tez, keyin sekinlashadi.
const BASE_XP_PER_LEVEL = 40;
const RANK_MULTIPLIER = 1.6;

function generateThresholds(): LevelThreshold[] {
  const result: LevelThreshold[] = [];
  let cumulative = 0;
  let level = 0;

  RANK_ORDER.forEach((rank, rankIdx) => {
    const rankBase = BASE_XP_PER_LEVEL * Math.pow(RANK_MULTIPLIER, rankIdx);
    for (let rankLevel = 1; rankLevel <= LEVELS_PER_RANK; rankLevel++) {
      level += 1;
      // shu darajaga chiqish uchun kerakli XP (kvadratik o'sish)
      const stepXp = Math.round(rankBase * rankLevel * rankLevel);
      cumulative += level === 1 ? 0 : stepXp;
      result.push({
        level,
        rank,
        rankLevel,
        xpRequired: cumulative,
        title: RANK_TITLES[rank],
      });
    }
  });

  return result;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = generateThresholds();

export function getLevelForXp(xp: number): LevelThreshold {
  let current = LEVEL_THRESHOLDS[0];
  for (const t of LEVEL_THRESHOLDS) {
    if (xp >= t.xpRequired) current = t;
    else break;
  }
  return current;
}

export function getProgressToNextLevel(xp: number): {
  current: LevelThreshold;
  next: LevelThreshold | null;
  progressPct: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
} {
  const current = getLevelForXp(xp);
  const next = LEVEL_THRESHOLDS[current.level] ?? null; // array is 0-indexed, level is 1-indexed
  if (!next) {
    return { current, next: null, progressPct: 100, xpIntoLevel: xp - current.xpRequired, xpForNextLevel: null };
  }
  const span = next.xpRequired - current.xpRequired;
  const xpIntoLevel = xp - current.xpRequired;
  const progressPct = span > 0 ? Math.round((xpIntoLevel / span) * 100) : 100;
  return { current, next, progressPct, xpIntoLevel, xpForNextLevel: span };
}
