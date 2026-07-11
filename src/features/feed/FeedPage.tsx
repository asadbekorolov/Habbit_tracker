import { useState, useEffect } from "react";
import { Loader2, Rss, UserPlus, Flame } from "lucide-react";
import { getFollowingFeed, getFollowingStreaks, getFollowingNewHabits, searchUsers, followUser, checkFollowing, getFeedReactions, toggleFeedReaction } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { toDateStr } from "../../utils/date";
import { DAYS_FULL, MONTHS_SHORT, type Lang } from "../../utils/i18n";
import type { T } from "../../store/LangContext";

interface FeedPageProps {
  isDark: boolean;
  profile: Profile;
  onUserClick?: (userId: string) => void;
}

function formatDate(dateStr: string, lang: Lang, t: T): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = toDateStr();
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return t('today');
  if (dateStr === yesterday) return t('yesterday');
  return `${DAYS_FULL[lang][d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[lang][d.getMonth()]}`;
}

function timeAgo(logDate: string, lang: Lang, t: T): string {
  const today = toDateStr();
  if (logDate === today) return t('today').toLowerCase();
  const diff = Math.round((new Date(today).getTime() - new Date(logDate).getTime()) / 86400000);
  if (diff === 1) return t('yesterday').toLowerCase();
  return t('feed_days_ago').replace('{n}', String(diff));
}

type RxEntry = { fire: number; clap: number; myFire: boolean; myClap: boolean };

export function FeedPage({ isDark, profile, onUserClick }: FeedPageProps) {
  const { t, lang } = useLang();
  const [feed, setFeed] = useState<any[]>([]);
  const [newHabits, setNewHabits] = useState<any[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, RxEntry>>({});

  useEffect(() => { loadFeed(); }, [profile.id]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery, profile.id);
        const withFollowState = await Promise.all(
          results.map(async (u: any) => {
            const isFollowing = await checkFollowing(profile.id, u.id);
            return { ...u, isFollowing };
          })
        );
        setSearchResults(withFollowState);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, profile.id]);

  async function loadFeed() {
    setLoading(true);
    try {
      const [feedData, newHabitsData] = await Promise.all([
        getFollowingFeed(profile.id),
        getFollowingNewHabits(profile.id),
      ]);

      const feedUserIds = feedData.map((item: any) => item.user_id);
      const newHabitUserIds = newHabitsData.map((item: any) => item.user_id);
      const allUserIds = [...new Set([...feedUserIds, ...newHabitUserIds])];
      const streaksData = await getFollowingStreaks(allUserIds);

      const logItemIds = feedData.map((item: any) => item.id as string);
      const nhItemIds = newHabitsData.map((item: any) => `nh-${item.id}` as string);
      const rawReactions = await getFeedReactions([...logItemIds, ...nhItemIds]);

      const rxMap: Record<string, RxEntry> = {};
      for (const r of rawReactions) {
        if (!rxMap[r.item_id]) rxMap[r.item_id] = { fire: 0, clap: 0, myFire: false, myClap: false };
        if (r.reaction_type === "fire") {
          rxMap[r.item_id].fire++;
          if (r.reactor_id === profile.id) rxMap[r.item_id].myFire = true;
        } else if (r.reaction_type === "clap") {
          rxMap[r.item_id].clap++;
          if (r.reactor_id === profile.id) rxMap[r.item_id].myClap = true;
        }
      }

      setFeed(feedData);
      setNewHabits(newHabitsData);
      setStreaks(streaksData);
      setReactions(rxMap);
    } catch {
      setFeed([]);
      setNewHabits([]);
      setStreaks({});
      setReactions({});
    }
    setLoading(false);
  }

  async function handleFollow(userId: string) {
    setFollowingStates(p => ({ ...p, [userId]: true }));
    try {
      await followUser(profile.id, userId, profile.display_name);
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: true } : u));
      await loadFeed();
    } catch {
      setFollowingStates(p => ({ ...p, [userId]: false }));
    }
  }

  async function handleReact(itemId: string, type: "fire" | "clap") {
    const prev = reactions[itemId] || { fire: 0, clap: 0, myFire: false, myClap: false };
    const isActive = type === "fire" ? prev.myFire : prev.myClap;
    setReactions(r => {
      const entry = r[itemId] || { fire: 0, clap: 0, myFire: false, myClap: false };
      return {
        ...r,
        [itemId]: {
          fire: type === "fire" ? entry.fire + (isActive ? -1 : 1) : entry.fire,
          clap: type === "clap" ? entry.clap + (isActive ? -1 : 1) : entry.clap,
          myFire: type === "fire" ? !isActive : entry.myFire,
          myClap: type === "clap" ? !isActive : entry.myClap,
        },
      };
    });
    try {
      await toggleFeedReaction(profile.id, itemId, type);
    } catch {
      setReactions(r => ({ ...r, [itemId]: prev }));
    }
  }

  function ReactionBar({ itemId }: { itemId: string }) {
    const rx = reactions[itemId] || { fire: 0, clap: 0, myFire: false, myClap: false };
    const btnBase: React.CSSProperties = {
      display: "flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 600, borderRadius: 8, padding: "3px 8px",
      border: "none", cursor: "pointer", transition: "background 0.15s",
    };
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <button
          type="button"
          onClick={() => handleReact(itemId, "fire")}
          style={{
            ...btnBase,
            background: rx.myFire
              ? "rgba(249,115,22,0.18)"
              : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            color: rx.myFire ? "#F97316" : "var(--muted-foreground)",
          }}
        >
          🔥 {rx.fire > 0 && <span>{rx.fire}</span>}
        </button>
        <button
          type="button"
          onClick={() => handleReact(itemId, "clap")}
          style={{
            ...btnBase,
            background: rx.myClap
              ? "rgba(96,165,250,0.18)"
              : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            color: rx.myClap ? "#60A5FA" : "var(--muted-foreground)",
          }}
        >
          👏 {rx.clap > 0 && <span>{rx.clap}</span>}
        </button>
      </div>
    );
  }

  // Build unified items: logs + new_habit events
  type UnifiedItem = { type: "log"; date: string; data: any } | { type: "new_habit"; date: string; data: any };
  const allItems: UnifiedItem[] = [
    ...feed.map(item => ({ type: "log" as const, date: item.log_date, data: item })),
    ...newHabits.map(item => ({ type: "new_habit" as const, date: item.created_at.split("T")[0], data: item })),
  ];

  // Group by date
  const grouped: Record<string, UnifiedItem[]> = {};
  for (const item of allItems) {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.9)" : "#fff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  const hasAnyContent = feed.length > 0 || newHabits.length > 0;

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('feed_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {t('feed_sub')}
          </p>
        </div>
        <button
          type="button"
          onClick={loadFeed}
          className="ml-auto p-2 rounded-xl"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}
          title={t('refresh_label')}
        >
          <Rss size={15} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>

      {/* Search to follow */}
      <div style={card} className="p-4">
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
          {t('feed_search_title')}
        </p>
        <input
          style={inputStyle}
          placeholder={t('feed_search_ph')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searching && (
          <div className="flex justify-center py-3">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--neon-green)" }} />
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            {searchResults.map((u) => {
              const initials = (u.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
              const isFollowing = u.isFollowing || followingStates[u.id];
              return (
                <div key={u.id} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUserClick?.(u.id)}
                    className="flex items-center gap-2.5 flex-1 min-w-0"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
                      style={{ background: u.avatar_color || "#4ADE80", color: "#0E1117" }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-8 h-8 object-cover" /> : initials}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{u.display_name}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>@{u.username}</p>
                    </div>
                  </button>
                  {!isFollowing && (
                    <button
                      type="button"
                      onClick={() => handleFollow(u.id)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "var(--neon-green)", color: "#0E1117" }}
                    >
                      <UserPlus size={12} /> {t('follow')}
                    </button>
                  )}
                  {isFollowing && (
                    <span className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg" style={{ color: "var(--neon-green)", background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7" }}>
                      {t('following')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {searchQuery.trim() && !searching && searchResults.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: "var(--muted-foreground)" }}>{t('feed_not_found')}</p>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        </div>
      ) : !hasAnyContent ? (
        <div style={card} className="p-10 flex flex-col items-center gap-3">
          <span className="text-4xl">📡</span>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('feed_empty')}</p>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            {t('feed_empty_hint')}
          </p>
        </div>
      ) : (
        sortedDates.map((date) => (
          <div key={date}>
            <p className="text-xs font-bold mb-2 px-1" style={{ color: "var(--muted-foreground)" }}>
              {formatDate(date, lang, t)}
            </p>
            <div style={card} className="overflow-hidden">
              {grouped[date].map((item, idx) => {
                const isLast = idx === grouped[date].length - 1;
                const dividerStyle = { borderBottom: isLast ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` };

                if (item.type === "new_habit") {
                  const h = item.data;
                  const p = h.profiles;
                  if (!p) return null;
                  const initials = (p.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                  const userStreak = streaks[h.user_id] || 0;
                  const itemId = `nh-${h.id}`;
                  return (
                    <div key={itemId} className="flex items-start gap-3 px-4 py-3" style={dividerStyle}>
                      <button
                        type="button"
                        onClick={() => onUserClick?.(p.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden mt-0.5"
                        style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}
                      >
                        {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-8 h-8 object-cover" /> : initials}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onUserClick?.(p.id)}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: "var(--foreground)" }}
                          >
                            {p.display_name}
                          </button>
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('feed_new_habit')}</span>
                          <span className="text-sm">{h.emoji}</span>
                          <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{h.name}</span>
                          {userStreak >= 2 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                              style={{ background: "rgba(249,115,22,0.12)", color: "#F97316", fontFamily: "'Geist Mono', monospace" }}>
                              <Flame size={9} fill="#F97316" /> {userStreak}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                          {timeAgo(date, lang, t)}
                        </p>
                        <ReactionBar itemId={itemId} />
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: isDark ? "rgba(74,222,128,0.08)" : "#F0FDF4" }}>
                        <span style={{ fontSize: 14 }}>🌱</span>
                      </div>
                    </div>
                  );
                }

                // type === "log"
                const logItem = item.data;
                const p = logItem.profiles;
                const h = logItem.habits;
                if (!p || !h) return null;
                const initials = (p.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                const userStreak = streaks[logItem.user_id] || 0;
                return (
                  <div
                    key={logItem.id}
                    className="flex items-start gap-3 px-4 py-3"
                    style={dividerStyle}
                  >
                    <button
                      type="button"
                      onClick={() => onUserClick?.(p.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden mt-0.5"
                      style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}
                    >
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-8 h-8 object-cover" /> : initials}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onUserClick?.(p.id)}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: "var(--foreground)" }}
                        >
                          {p.display_name}
                        </button>
                        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('feed_done')}</span>
                        <span className="text-sm">{h.emoji}</span>
                        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{h.name}</span>
                        {userStreak >= 2 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                            style={{ background: "rgba(249,115,22,0.12)", color: "#F97316", fontFamily: "'Geist Mono', monospace" }}>
                            <Flame size={9} fill="#F97316" /> {userStreak}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {timeAgo(date, lang, t)}
                      </p>
                      <ReactionBar itemId={logItem.id} />
                    </div>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: isDark ? "rgba(74,222,128,0.12)" : "#DCFCE7" }}>
                      <span style={{ fontSize: 14 }}>✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
