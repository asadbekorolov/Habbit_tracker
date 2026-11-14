// Guruh tafsilotlari — umumiy turlar, konstantalar va yordamchilar.

export const DATE_LOCALE: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };


export interface GroupsPageProps {
  onUserClick?: (userId: string) => void;
}


export type View = "list" | "detail";

export type DetailTab = "habits" | "members" | "leaderboard" | "approve" | "stats" | "teams";


export type LogState = {
  id: string;
  completed: boolean;
  status: "pending" | "approved" | "rejected" | "auto";
  proofNote: string;
  rejectReason?: string;
};
