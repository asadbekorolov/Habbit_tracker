import { Star } from "lucide-react";

interface UserBadgeProps {
  // Chaqiruvchi joyning o'zi qaror qiladi: xom profil (has_star +
  // star_expires_at) bo'lsa services/db.ts'dagi isStarActive() bilan
  // hisoblab shu yerga bitta boolean sifatida beradi (masalan
  // get_leaderboard() RPC buni serverda allaqachon hisoblab beradi,
  // qayta xom ustunlarga ehtiyoj yo'q).
  active?: boolean;
  size?: number;
}

// Global "Star" ko'rsatkichi — GlobalLeaderboard, GroupsPage a'zolar
// ro'yxati va PublicProfileModal'da bir xil ko'rinishda ishlatiladi.
export function UserBadge({ active, size = 12 }: UserBadgeProps) {
  if (!active) return null;
  return (
    <Star
      size={size}
      className="shrink-0"
      style={{ color: "#FBBF24" }}
      fill="#FBBF24"
      aria-label="Star"
    />
  );
}
