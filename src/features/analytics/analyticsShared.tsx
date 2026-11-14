// Tahlil (Analytics) — umumiy turlar, konstantalar va yordamchilar.
import type { Profile } from "../../services/supabase";

export interface AnalyticsProps {
  completedToday: number;
  totalHabits: number;
  onUserClick?: (userId: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}


export const uzMonths = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
