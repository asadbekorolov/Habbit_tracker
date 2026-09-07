export const getXPForLevel = (level: number): number => {
  if (level <= 1) return 0;
  // Exponential curve: Level 1->2: 324XP, Level 2->3: 649XP, Level 3->4: 1055XP, Level 4->5: 1543XP
  return Math.floor(100 * Math.pow(level, 1.7));
};

export const getLevelFromXP = (totalXP: number): {
  level: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressPercent: number;
  baseXP: number;
  targetXP: number;
} => {
  let level = 1;
  while (totalXP >= getXPForLevel(level + 1)) {
    level++;
  }
  const baseXP = getXPForLevel(level);
  const targetXP = getXPForLevel(level + 1);
  const currentLevelXP = totalXP - baseXP;
  const nextLevelXP = targetXP - baseXP;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentLevelXP / nextLevelXP) * 100)));

  return { level, currentLevelXP, nextLevelXP, progressPercent, baseXP, targetXP };
};

const LEVEL_META = [
  { label: "Yangi", icon: "Zap", color: "#4ADE80" },
  { label: "Izlanuvchi", icon: "Zap", color: "#FBBF24" },
  { label: "Qat'iyatli", icon: "Activity", color: "#FB923C" },
  { label: "Barqaror", icon: "Flame", color: "#F97316" },
  { label: "Mohir", icon: "Target", color: "#F472B6" },
  { label: "Usta", icon: "Zap", color: "#3B82F6" },
  { label: "Ekspert", icon: "Brain", color: "#06B6D4" },
  { label: "Chempion", icon: "Trophy", color: "#A78BFA" },
  { label: "Afsonaviy", icon: "Star", color: "#8B5CF6" },
  { label: "Titan", icon: "Crown", color: "#FDE047" },
];

export function getLevel(score: number): {
  level: number;
  label: string;
  icon: string;
  color: string;
  next: number | null;
  progress: number;
  prevThreshold: number;
  currentLevelXP: number;
  nextLevelXP: number;
} {
  const { level, currentLevelXP, nextLevelXP, progressPercent, targetXP, baseXP } = getLevelFromXP(score || 0);
  const metaIndex = Math.min(level - 1, LEVEL_META.length - 1);
  const meta = LEVEL_META[metaIndex];

  return {
    level,
    label: meta.label,
    icon: meta.icon,
    color: meta.color,
    next: targetXP,
    progress: progressPercent,
    prevThreshold: baseXP,
    currentLevelXP,
    nextLevelXP,
  };
}
