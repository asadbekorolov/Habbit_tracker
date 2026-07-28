export function getLevel(score: number): {
  level: number; label: string; emoji: string; color: string;
  next: number | null; progress: number; prevThreshold: number;
} {
  if (score >= 500) return { level: 5, label: "Chempion", emoji: "👑", color: "#8B5CF6", next: null, progress: 100, prevThreshold: 500 };
  if (score >= 300) return { level: 4, label: "Usta",      emoji: "💎", color: "#3B82F6", next: 500, progress: Math.round(((score - 300) / 200) * 100), prevThreshold: 300 };
  if (score >= 150) return { level: 3, label: "Barqaror",  emoji: "🔥", color: "#F97316", next: 300, progress: Math.round(((score - 150) / 150) * 100), prevThreshold: 150 };
  if (score >= 50)  return { level: 2, label: "Izlanuvchi",emoji: "⚡", color: "#FBBF24", next: 150, progress: Math.round(((score - 50)  / 100) * 100), prevThreshold: 50  };
  return              { level: 1, label: "Yangi",       emoji: "🌱", color: "#4ADE80", next: 50,  progress: Math.round((score / 50) * 100),          prevThreshold: 0   };
}
