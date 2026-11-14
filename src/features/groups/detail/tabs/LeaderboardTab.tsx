// Guruh tafsilotlari — LeaderboardTab.
import { Trophy } from "lucide-react";
import { UserBadge } from "../../../../components/UserBadge";
import { GroupWeeklyCompetition } from "../../GroupWeeklyCompetition";
import type { GroupDetailState } from "../useGroupDetail";

export function LeaderboardTab({ s }: { s: GroupDetailState }) {
  const { profile, group, card, t, leaderboard } = s;

  return (
    <div className="flex flex-col gap-3">
      <GroupWeeklyCompetition groupId={group.id} myUserId={profile.id} card={card} />
      <div className="px-1 pb-1">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t('groups_only_approved_counted')}
        </p>
      </div>
      {leaderboard.length === 0 ? (
        <div style={card} className="p-8 flex flex-col items-center gap-2">
          <Trophy size={28} style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t('groups_no_approved')}</p>
        </div>
      ) : (
        leaderboard.map((entry, i) => {
          const isMe = entry.userId === profile.id;
          const medalColors = ["#FBBF24", "#94A3B8", "#B45309"];
          return (
            <div key={entry.userId} className="flex items-center gap-3 p-3.5 rounded-2xl"
              style={{
                ...card,
                background: isMe ? ("rgba(74,222,128,0.06)") : card.background,
                border: isMe ? "1px solid rgba(74,222,128,0.25)" : card.border,
              }}>
              <div className="w-8 flex justify-center shrink-0">
                {i < 3 ? (
                  <Trophy size={18} style={{ color: medalColors[i] }} strokeWidth={2.5} />
                ) : (
                  <span className="text-xs font-bold opacity-40" style={{ fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                )}
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                style={{ background: entry.color || "#4ADE80", color: "#0E1117" }}>
                {entry.avatarUrl ? (
                  <img src={entry.avatarUrl} alt="" className="w-9 h-9 object-cover" />
                ) : (
                  (entry.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: isMe ? "#4ADE80" : "var(--foreground)" }}>
                  {entry.name} {isMe && t('lb_you')}
                  <UserBadge active={entry.hasStar} size={12} />
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.min((entry.score / (leaderboard[0]?.score || 1)) * 100, 100)}%`,
                      maxWidth: 100,
                      background: isMe ? "#4ADE80" : "rgba(255,255,255,0.15)",
                    }} />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {entry.completed} ta
                  </span>
                </div>
              </div>
              <span className="text-sm font-bold" style={{ color: isMe ? "#4ADE80" : "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {entry.score}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
