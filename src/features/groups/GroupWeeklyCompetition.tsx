import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { getGroupWeeklyLeaderboard, settleGroupWeek, type GroupWeekWinner } from "../../services/db";
import { useLang } from "../../store/LangContext";

interface GroupWeeklyCompetitionProps {
  isDark: boolean;
  groupId: string;
  myUserId: string;
  card: React.CSSProperties;
}

export function GroupWeeklyCompetition({ isDark, groupId, myUserId, card }: GroupWeeklyCompetitionProps) {
  const { t } = useLang();
  const [weekly, setWeekly] = useState<any[]>([]);
  const [winner, setWinner] = useState<GroupWeekWinner | null>(null);

  useEffect(() => {
    getGroupWeeklyLeaderboard(groupId).then((lb) => setWeekly(lb || [])).catch(() => {});
    settleGroupWeek(groupId).then((w) => { if (w && !w.already_settled) setWinner(w); }).catch(() => {});
  }, [groupId]);

  return (
    <div className="flex flex-col gap-3 mb-4">
      {winner && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}
        >
          <Trophy size={16} style={{ color: "#FBBF24" }} />
          <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            {t('group_week_winner_prefix')} <span style={{ color: "#FBBF24" }}>{winner.display_name}</span> — +{winner.reward}🪙
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>
          {t('group_this_week')}
        </p>
        {weekly.length === 0 ? (
          <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>{t('group_week_empty')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {weekly.slice(0, 5).map((entry, i) => {
              const isMe = entry.userId === myUserId;
              return (
                <div
                  key={entry.userId}
                  className="flex items-center gap-2.5 p-2 rounded-xl"
                  style={{ ...card, background: isMe ? (isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.04)") : card.background }}
                >
                  <span className="text-xs w-5 text-center shrink-0" style={{ color: "var(--muted-foreground)" }}>{i + 1}</span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden"
                    style={{ background: entry.color || "#4ADE80", color: "#0E1117" }}
                  >
                    {entry.avatarUrl ? (
                      <img src={entry.avatarUrl} alt="" className="w-7 h-7 object-cover" />
                    ) : (
                      (entry.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                    )}
                  </div>
                  <p className="text-xs flex-1 truncate" style={{ color: isMe ? "#4ADE80" : "var(--foreground)" }}>{entry.name}</p>
                  <span className="text-xs font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{entry.score}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
