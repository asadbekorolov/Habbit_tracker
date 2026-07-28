import { useState, useEffect } from "react";
import { Trophy, Star, Medal, Loader2, Lock } from "lucide-react";
import { getLeaderboard, type LeaderboardEntry } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { UserBadge } from "../../components/UserBadge";

interface GlobalLeaderboardPageProps {
  isDark: boolean;
  profile: Profile;
  onUserClick?: (userId: string) => void;
}

export function GlobalLeaderboardPage({ isDark, profile, onUserClick }: GlobalLeaderboardPageProps) {
  const { t } = useLang();
  const [list, setList] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await getLeaderboard();
      setList(data);
    } catch (e: any) {
      setError(e.message || t('err_loading'));
    } finally {
      setLoading(false);
    }
  }

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  const myRank = list.findIndex((u) => u.id === profile.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-sm" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {t('lb_title')}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {t('lb_sub')}
          </p>
        </div>
        {myRank >= 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", border: "1px solid rgba(74,222,128,0.25)" }}
          >
            <Medal size={14} style={{ color: "#4ADE80" }} />
            <span className="text-sm font-bold" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
              #{myRank + 1}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('lb_your_rank')}</span>
          </div>
        )}
      </div>

      {/* Top 3 podium */}
      {list.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {[list[1], list[0], list[2]].map((user, podiumIdx) => {
            const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
            const heights = [80, 100, 70];
            const medals = ["🥈", "🥇", "🥉"];
            const colors = ["rgba(192,192,192,0.15)", "rgba(251,191,36,0.15)", "rgba(205,127,50,0.15)"];
            const borderColors = ["rgba(192,192,192,0.4)", "rgba(251,191,36,0.4)", "rgba(205,127,50,0.4)"];
            const isMe = user.id === profile.id;
            const initials = user.display_label.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div
                key={user.id}
                className="flex flex-col items-center gap-1"
                style={{ width: 90 }}
              >
                <span className="text-2xl">{medals[podiumIdx]}</span>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" style={{ border: `2px solid ${borderColors[podiumIdx]}` }} />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: user.avatar_color || "#4ADE80", color: "#0E1117", border: `2px solid ${borderColors[podiumIdx]}` }}
                  >
                    {initials}
                  </div>
                )}
                <p className="text-xs font-semibold text-center truncate w-full flex items-center justify-center gap-1" style={{ color: isMe ? "#4ADE80" : "var(--foreground)" }}>
                  {isMe ? t('you_short') : user.display_label}
                  <UserBadge active={user.has_star} size={10} />
                </p>
                <div
                  className="w-full flex flex-col items-center justify-center rounded-t-xl pt-2"
                  style={{ height: heights[podiumIdx], background: colors[podiumIdx], border: `1px solid ${borderColors[podiumIdx]}` }}
                >
                  <div className="flex items-center gap-1">
                    <Star size={11} fill="#FBBF24" style={{ color: "#FBBF24" }} />
                    <span className="text-sm font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                      {user.score ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>#{rank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div style={card} className="overflow-hidden">
        {list.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2">
            <Trophy size={28} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t('lb_empty')}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)" }}>
            {list.map((user, i) => {
              const isMe = user.id === profile.id;
              const canView = isMe || !user.is_private;
              const initials = user.display_label.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
              const rankIcon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors min-h-[44px]"
                  onClick={canView ? () => onUserClick?.(user.id) : undefined}
                  style={{
                    background: isMe
                      ? isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.05)"
                      : "transparent",
                    cursor: onUserClick && canView ? "pointer" : "default",
                  }}
                >
                  <div className="w-7 text-center shrink-0">
                    {rankIcon
                      ? <span className="text-lg">{rankIcon}</span>
                      : <span className="text-xs font-bold" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                    }
                  </div>

                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: user.avatar_color || "#4ADE80", color: "#0E1117" }}
                    >
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: isMe ? "#4ADE80" : "var(--foreground)" }}>
                      {user.display_label} {isMe && <span className="text-xs">{t('lb_you')}</span>}
                      <UserBadge active={user.has_star} size={12} />
                      {!canView && <Lock size={11} style={{ color: "var(--muted-foreground)" }} />}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                      @{user.username}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Star size={13} fill="#FBBF24" style={{ color: "#FBBF24" }} />
                    <span
                      className="text-sm font-bold"
                      style={{ color: isMe ? "#4ADE80" : "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}
                    >
                      {user.score ?? 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
