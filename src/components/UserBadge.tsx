import { Star as StarIcon } from "lucide-react";

interface UserBadgeProps {
  active?: boolean;
  size?: number;
}

export function UserBadge({ active, size = 12 }: UserBadgeProps) {
  if (!active) return null;
  return (
    <StarIcon
      size={size}
      className="shrink-0"
      style={{ color: "#FBBF24" }}
      fill="#FBBF24"
      aria-label="Star"
    />
  );
}
