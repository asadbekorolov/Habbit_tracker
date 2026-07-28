// Daraja narxi (necha ball kerak) = round(level^1.5 * 100) — eksponensial
// egri chiziq, shuning uchun har keyingi daraja avvalgisidan sezilarli
// ko'proq harakat talab qiladi. 10-daraja — maksimal (undan keyingi daraja
// yo'q). Bu jadval server-side calculate_level() SQL funksiyasi bilan bir
// xil bo'lishi kerak (supabase/migrations/024_level_curve_v2.sql).
const LEVEL_THRESHOLDS = [0, 283, 520, 800, 1118, 1470, 1852, 2263, 2700, 3162];

const LEVEL_META = [
  { label: "Yangi", emoji: "🌱", color: "#4ADE80" },
  { label: "Izlanuvchi", emoji: "⚡", color: "#FBBF24" },
  { label: "Qat'iyatli", emoji: "💪", color: "#FB923C" },
  { label: "Barqaror", emoji: "🔥", color: "#F97316" },
  { label: "Mohir", emoji: "🎯", color: "#F472B6" },
  { label: "Usta", emoji: "💎", color: "#3B82F6" },
  { label: "Ekspert", emoji: "🧠", color: "#06B6D4" },
  { label: "Chempion", emoji: "🏆", color: "#A78BFA" },
  { label: "Afsonaviy", emoji: "⭐", color: "#8B5CF6" },
  { label: "Titan", emoji: "👑", color: "#FDE047" },
];

export function getLevel(score: number): {
  level: number; label: string; emoji: string; color: string;
  next: number | null; progress: number; prevThreshold: number;
} {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  const meta = LEVEL_META[level - 1];
  const prevThreshold = LEVEL_THRESHOLDS[level - 1];
  const isMax = level === LEVEL_THRESHOLDS.length;
  const next = isMax ? null : LEVEL_THRESHOLDS[level];
  const progress = isMax ? 100 : Math.round(((score - prevThreshold) / (next! - prevThreshold)) * 100);
  return { level, label: meta.label, emoji: meta.emoji, color: meta.color, next, progress, prevThreshold };
}
