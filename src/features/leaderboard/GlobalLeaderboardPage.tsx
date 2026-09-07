import { useState, useEffect } from "react";
import { Trophy, Star, Medal, Crown, Loader2, Lock, AlertCircle } from "lucide-react";
import { getLeaderboard, type LeaderboardEntry, getCached } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { UserBadge } from "../../components/UserBadge";
import { AvatarFrame } from "../../components/AvatarFrame";
import { getUsernameGlowStyle } from "../../utils/cosmetics";

interface GlobalLeaderboardPageProps {
  isDark: boolean;
  profile: Profile;
  onUserClick?: (userId: string) => void;
}

type LeaderboardPeriod = 'daily' | 'monthly' | '6months' | 'yearly' | 'all';

export function GlobalLeaderboardPage({ isDark, profile, onUserClick }: GlobalLeaderboardPageProps) {
  const { t } = useLang();
  const initialCached = getCached<LeaderboardEntry[]>(`leaderboard_monthly`);
  const [list, setList] = useState<LeaderboardEntry[]>(initialCached || []);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<LeaderboardPeriod>('monthly');

  useEffect(() => {
    load(period);
  }, [period]);

  async function load(p: LeaderboardPeriod) {
    const cached = getCached<LeaderboardEntry[]>(`leaderboard_${p}`);
    if (!cached) setLoading(true);
    setError("");
    try {
      const data = await getLeaderboard(p);
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

  const periods: { id: LeaderboardPeriod; label: string }[] = [
    { id: 'daily', label: 'Kunlik' },
    { id: 'monthly', label: 'Oylik' },
    { id: '6months', label: '6 Oylik' },
    { id: 'yearly', label: 'Yillik' },
    { id: 'all', label: 'Barchasi' },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
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

      {/* Interval Filters */}
      <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 mb-6 overflow-x-auto no-scrollbar">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 min-w-[70px] py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              period === p.id
                ? "bg-white dark:bg-white/10 text-emerald-500 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        </div>
      ) : error ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-8 h-8 text-amber-400/80 mb-2"/>
          <p className="text-sm text-slate-300 font-medium">Reyting ma'lumotlarini yuklab bo'lmadi</p>
          <button
            onClick={() => load(period)}
            className="mt-3 px-4 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-400 hover:bg-slate-700 transition-colors"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {list.length >= 3 && (
            <div className="flex items-end justify-center gap-3 mb-10 mt-4">
              {[list[1], list[0], list[2]].map((user, podiumIdx) => {
                const rank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                const heights = [90, 120, 80];

                const themes = {
                  1: {
                    icon: Crown,
                    iconColor: "#FDE047",
                    glow: "rgba(251, 191, 36, 0.6)",
                    badgeBg: "linear-gradient(to bottom, rgba(251, 191, 36, 0.2), rgba(180, 83, 9, 0.3))",
                    badgeBorder: "rgba(251, 191, 36, 0.4)",
                    columnGradient: "linear-gradient(to bottom, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05), transparent)",
                    columnBorder: "rgba(251, 191, 36, 0.4)"
                  },
                  2: {
                    icon: Medal,
                    iconColor: "#E2E8F0",
                    glow: "rgba(226, 232, 240, 0.5)",
                    badgeBg: "rgba(148, 163, 184, 0.2)",
                    badgeBorder: "rgba(203, 213, 225, 0.4)",
                    columnGradient: "linear-gradient(to bottom, rgba(148, 163, 184, 0.15), rgba(148, 163, 184, 0.05), transparent)",
                    columnBorder: "rgba(203, 213, 225, 0.4)"
                  },
                  3: {
                    icon: Medal,
                    iconColor: "#B45309",
                    glow: "rgba(180, 83, 9, 0.5)",
                    badgeBg: "rgba(120, 53, 15, 0.2)",
                    badgeBorder: "rgba(180, 83, 9, 0.4)",
                    columnGradient: "linear-gradient(to bottom, rgba(120, 53, 15, 0.15), rgba(120, 53, 15, 0.05), transparent)",
                    columnBorder: "rgba(180, 83, 9, 0.4)"
                  }
                }[rank as 1|2|3];

                const isMe = user.id === profile.id;
                const initials = user.display_label.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                const Icon = themes.icon;

                return (
                  <div
                    key={user.id}
                    className="flex flex-col items-center"
                    style={{ width: 100 }}
                  >
                    <div className="mb-2 relative z-10">
                      <div
                        className="rounded-full p-2 border flex items-center justify-center shadow-lg"
                        style={{ background: themes.badgeBg, borderColor: themes.badgeBorder }}
                      >
                        <Icon size={rank === 1 ? 22 : 18} style={{ color: themes.iconColor, filter: `drop-shadow(0 0 8px ${themes.glow})` }} strokeWidth={2.5} />
                      </div>
                    </div>

                    <div className="relative mb-2">
                      <AvatarFrame frameId={user.active_frame}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: user.active_frame ? "none" : `2px solid ${themes.badgeBorder}` }} />
                        ) : (
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shadow-inner"
                            style={{ background: user.avatar_color || "#4ADE80", color: "#0E1117", border: user.active_frame ? "none" : `2px solid ${themes.badgeBorder}` }}
                          >
                            {initials}
                          </div>
                        )}
                      </AvatarFrame>
                    </div>

                    <div className="flex flex-col items-center gap-1 mb-3 px-1 w-full relative z-10">
                      <p className="text-xs font-bold text-center truncate w-full flex items-center justify-center gap-1" style={{ color: isMe ? "#4ADE80" : "var(--foreground)", ...(user.username_glow ? getUsernameGlowStyle(isDark) : {}) }}>
                        {isMe ? t('you_short') : user.display_label}
                        <UserBadge active={user.has_star} size={10} />
                      </p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5 uppercase tracking-tighter">
                        {user.efficiency_pct ?? 0}%
                      </span>
                    </div>

                    <div
                      className="w-full flex flex-col items-center justify-start pt-3 rounded-t-3xl relative overflow-hidden"
                      style={{
                        height: heights[podiumIdx],
                        background: themes.columnGradient,
                        borderTop: `2px solid ${themes.columnBorder}`
                      }}
                    >
                      <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
                      <span className="text-xl font-black text-white/20 select-none" style={{ fontFamily: "'Geist Mono', monospace" }}>
                        #{rank}
                      </span>
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
                  const rank = i + 1;

                  const rankStyles = rank === 1
                    ? "text-amber-300 bg-amber-400/10 border border-amber-400/20"
                    : rank === 2
                    ? "text-slate-200 bg-slate-300/10 border border-slate-300/20"
                    : rank === 3
                    ? "text-amber-600 bg-amber-700/10 border border-amber-700/20"
                    : "";

                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-4 py-4 transition-colors min-h-[56px]"
                      onClick={canView ? () => onUserClick?.(user.id) : undefined}
                      style={{
                        background: isMe
                          ? isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.05)"
                          : "transparent",
                        cursor: onUserClick && canView ? "pointer" : "default",
                      }}
                    >
                      <div className="w-8 flex justify-center shrink-0">
                        {rank <= 3 ? (
                          <div className={`w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black font-mono ${rankStyles}`}>
                            {rank}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-black font-mono text-xs w-6 text-center">{rank}</span>
                        )}
                      </div>

                      <AvatarFrame frameId={user.active_frame}>
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
                      </AvatarFrame>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: isMe ? "#4ADE80" : "var(--foreground)", ...(user.username_glow ? getUsernameGlowStyle(isDark) : {}) }}>
                          {user.display_label} {isMe && <span className="text-xs">{t('lb_you')}</span>}
                          <UserBadge active={user.has_star} size={12} />
                          {!canView && <Lock size={11} style={{ color: "var(--muted-foreground)" }} />}
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                          @{user.username}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className="text-sm font-bold"
                          style={{ color: isMe ? "#4ADE80" : "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}
                        >
                          {user.efficiency_pct ?? 0}%
                        </span>
                        <span className="text-[10px] flex items-center gap-1 font-black" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                          <Star size={11} className="fill-amber-400 text-amber-400 mr-0.5" strokeWidth={2.5} />
                          {user.score ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
