// Admin panel — umumiy turlar, konstantalar va yordamchilar.
import type { Profile } from "../../services/supabase";

export interface AdminPanelProps {
  profile: Profile;
}


export const DATE_LOCALE: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export type AdminTab = "overview" | "users" | "habits" | "feedback" | "analytics" | "monitoring" | "health";
