import { useState, useEffect, useMemo } from "react";
import { useLang } from "../../store/LangContext";
import {
  Star, Flame, Trophy, Target, Zap, Crown,
  Loader2, Settings, CalendarDays, Award, Moon, Sun, Globe,
  ChevronDown, ChevronUp, ChevronRight, Eye, EyeOff, Save, Bell, BellOff,
  LogOut, UserPlus, Search, Send, Instagram, Trash2,
} from "lucide-react";
import {
  getLast30DaysLogs, getHabits, getUserRank, getAllTimeLogs,
  getProfileById, getFollowCounts, getFollowersList, getFollowingList,
  searchUsers, followUser, checkFollowing, updateUserPassword,
  unlinkTelegramBot, isStarActive,
} from "../../services/db";
import { CoinShopModal } from "./CoinShopModal";
import { DeleteAccountModal } from "../../components/DeleteAccountModal";
import { getLevel } from "../../utils/levels";
import type { Profile } from "../../services/supabase";
import { UserBadge } from "../../components/UserBadge";

type Lang = "uz" | "ru" | "en";

interface ProfilePageProps {
  isDark: boolean;
  profile: Profile;
  onNavigate: (tab: string) => void;
  onUserClick?: (userId: string) => void;
  onLogout: () => void;
  onToggleDark: () => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
}

const BADGE_DEFS = [
  { id: "first_step",    titleKey: "ach_badge_first_step_title", icon: Zap,    color: "#FBBF24", check: (_s: number, _str: number, total: number) => total >= 1 },
  { id: "consistency_7", titleKey: "ach_badge_consistency7_title",    icon: Flame,  color: "#F97316", check: (_s: number, str: number) => str >= 7 },
  { id: "consistency_30",titleKey: "ach_badge_consistency30_title",         icon: Flame,  color: "#EF4444", check: (_s: number, str: number) => str >= 30 },
  { id: "score_100",     titleKey: "ach_badge_score100_title",    icon: Star,   color: "#3B82F6", check: (s: number) => s >= 100 },
  { id: "score_500",     titleKey: "level_5",       icon: Crown,  color: "#8B5CF6", check: (s: number) => s >= 500 },
  { id: "habit_100",     titleKey: "ach_badge_habit100_title",       icon: Target, color: "#EC4899", check: (_s: number, _str: number, total: number) => total >= 100 },
] as const;

const LANGS: { id: Lang; flag: string; label: string; code: string }[] = [
  { id: "uz", flag: "🇺🇿", label: "O'zbek", code: "UZ" },
  { id: "ru", flag: "🇷🇺", label: "Русский", code: "RU" },
  { id: "en", flag: "🇬🇧", label: "English", code: "GB" },
];

export function ProfilePage({ isDark, profile, onNavigate, onUserClick, onLogout, onToggleDark, lang, onLangChange }: ProfilePageProps) {
  const { t } = useLang();
  // Profile data
  const [logs30, setLogs30] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [rank, setRank] = useState(0);
  const [freshScore, setFreshScore] = useState<number | null>(null);
  const [freshCoins, setFreshCoins] = useState(0);
  const [starExpiresAt, setStarExpiresAt] = useState<string | null>(profile.star_expires_at ?? null);
  const [showShop, setShowShop] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [tgBotLinked, setTgBotLinked] = useState(false);
  const [unlinkingTg, setUnlinkingTg] = useState(false);
  const [loading, setLoading] = useState(true);

  // Follow state
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  // User search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  // Language settings
  const [langOpen, setLangOpen] = useState(false);
  const [pendingLang, setPendingLang] = useState<Lang>(lang);

  // Password
  const [passOpen, setPassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  // Notifications
  const NOTIF_KEY = `notif_${profile.id}`;
  const _nd = (() => { try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}"); } catch { return {}; } })();
  const [notifEnabled, setNotifEnabled] = useState<boolean>(_nd.enabled ?? false);
  const [notifTime, setNotifTime] = useState<string>(_nd.time ?? "09:00");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    Promise.all([
      getLast30DaysLogs(profile.id),
      getAllTimeLogs(profile.id),
      getHabits(profile.id),
      getUserRank(profile.id),
      getProfileById(profile.id),
      getFollowCounts(profile.id),
    ]).then(([l30, lAll, h, r, freshProfile, fc]) => {
      setLogs30(l30 || []);
      setAllLogs(lAll || []);
      setHabits(h || []);
      setRank(r);
      setFreshScore(freshProfile.score ?? 0);
      setFreshCoins(freshProfile.coins ?? 0);
      setTgBotLinked(!!(freshProfile as any).telegram_chat_id);
      setFollowCounts(fc);
      setStarExpiresAt(freshProfile.star_expires_at ?? null);
    }).finally(() => setLoading(false));
  }, [profile.id]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery, profile.id);
        const withFollow = await Promise.all(
          results.map(async (u: any) => {
            const isFollowing = await checkFollowing(profile.id, u.id);
            return { ...u, isFollowing };
          })
        );
        setSearchResults(withFollow);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, profile.id]);

  async function openFollowModal(type: "followers" | "following") {
    setFollowModal(type);
    setFollowListLoading(true);
    try {
      const list = type === "followers"
        ? await getFollowersList(profile.id)
        : await getFollowingList(profile.id);
      setFollowList(list);
    } catch { setFollowList([]); }
    setFollowListLoading(false);
  }

  async function handleFollow(userId: string) {
    setFollowingStates(p => ({ ...p, [userId]: true }));
    try {
      await followUser(profile.id, userId, profile.display_name);
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: true } : u));
    } catch {
      setFollowingStates(p => ({ ...p, [userId]: false }));
    }
  }

  function saveNotif(enabled: boolean, time: string) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify({ enabled, time }));
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") { setNotifEnabled(true); saveNotif(true, notifTime); }
  }

  async function handleSavePassword() {
    if (!newPassword) return;
    if (newPassword.length < 6) { setPassError(t('settings_pass_short')); return; }
    if (newPassword !== confirmPassword) { setPassError(t('settings_pass_mismatch')); return; }
    setPassLoading(true); setPassError(""); setPassSuccess("");
    try {
      await updateUserPassword(newPassword);
      setPassSuccess(t('settings_pass_success'));
      setNewPassword(""); setConfirmPassword("");
      setTimeout(() => { setPassOpen(false); setPassSuccess(""); }, 1500);
    } catch (e: any) {
      setPassError(e.message || t('ep_error'));
    } finally {
      setPassLoading(false);
    }
  }

  const score = freshScore !== null ? freshScore : (profile.score || 0);
  const lv = getLevel(score);
  const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5"] as const;
  const lvIcons = ["", "🌱", "⚡", "🔥", "💎", "👑"];

  const totalCompleted = allLogs.filter((l: any) => l.habits?.type === "positive").length;

  const bestStreak = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const l of logs30) {
      if (l.completed && l.habits?.type === "positive") {
        byDate[l.log_date] = (byDate[l.log_date] || 0) + 1;
      }
    }
    const dates = Object.keys(byDate).filter((d) => byDate[d] > 0).sort();
    if (!dates.length) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
      if (diff === 1) { cur++; if (cur > best) best = cur; } else cur = 1;
    }
    return best;
  }, [logs30]);

  const activeDays = useMemo(() => new Set(allLogs.map((l: any) => l.log_date)).size, [allLogs]);

  const unlockedBadges = BADGE_DEFS.filter((b) => b.check(score, bestStreak, totalCompleted));

  const memberSince = useMemo(() => {
    const d = new Date(profile.created_at);
    const uzMonths = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
    return `${uzMonths[d.getMonth()]} ${d.getFullYear()}`;
  }, [profile.created_at]);

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 16,
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  const initials = profile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const currentLangObj = LANGS.find(l => l.id === lang)!;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* Profile hero card */}
      <div
        className="p-6 rounded-2xl relative overflow-hidden"
        style={{
          background: isDark
            ? `linear-gradient(135deg, ${lv.color}12 0%, rgba(22,27,34,0.95) 55%)`
            : `linear-gradient(135deg, ${lv.color}18 0%, rgba(255,255,255,0.97) 55%)`,
          border: `1px solid ${lv.color}33`,
          boxShadow: `0 0 32px ${lv.color}10`,
        }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: `${lv.color}08`, transform: "translate(30%, -30%)" }} />

        <div className="flex items-start gap-4 relative">
          <div className="shrink-0 relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover"
                style={{ border: `3px solid ${lv.color}55` }} />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
                style={{ background: profile.avatar_color || lv.color, color: "#0E1117", border: `3px solid ${lv.color}55`, boxShadow: `0 0 20px ${lv.color}30` }}>
                {initials}
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: lv.color, color: "#000", border: "2px solid var(--background)" }}>
              {lv.level}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
              {profile.display_name}
              <UserBadge active={isStarActive({ has_star: true, star_expires_at: starExpiresAt })} size={16} />
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>@{profile.username}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: `${lv.color}18`, color: lv.color, border: `1px solid ${lv.color}33` }}>
                <span>{lv.emoji}</span><span>Lv.{lv.level} {lv.label}</span>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold" style={{ color: "#FBBF24" }}>
                <Star size={14} fill="currentColor" />
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{score}</span>
                <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>ochko</span>
              </div>
              <button type="button" onClick={() => setShowShop(true)}
                className="flex items-center gap-1 text-sm font-bold"
                style={{ color: "#A78BFA", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                🪙
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{freshCoins}</span>
                <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>tanga</span>
              </button>
              {rank > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold" style={{ color: "#60A5FA" }}>
                  <Trophy size={12} /><span style={{ fontFamily: "'Geist Mono', monospace" }}>#{rank}</span>
                </div>
              )}
            </div>
          </div>

          <button type="button" onClick={() => onNavigate("edit-profile")}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: "var(--muted-foreground)" }}>
            <Settings size={16} />
          </button>
        </div>

        {lv.next !== null && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t('profile_next_level_full').replace('{icon}', lvIcons[lv.level + 1]).replace('{n}', String(lv.level + 1)).replace('{name}', t(LEVEL_LABELS[lv.level + 1] as any)).replace('{points}', String(lv.next - score))}
              </span>
              <span className="text-xs font-bold" style={{ color: lv.color, fontFamily: "'Geist Mono', monospace" }}>{lv.progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${lv.progress}%`, background: lv.color, boxShadow: `0 0 8px ${lv.color}66` }} />
            </div>
          </div>
        )}
        {lv.next === null && (
          <div className="mt-4 text-center">
            <p className="text-sm font-bold" style={{ color: lv.color }}>{t('profile_max_level_champion')}</p>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {profile.bio}
          </p>
        )}

        {/* Follow counts + social links */}
        <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}` }}>
          <button type="button" onClick={() => openFollowModal("followers")}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <span className="text-base font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{followCounts.followers}</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('profile_followers')}</span>
          </button>
          <div style={{ width: 1, height: 28, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />
          <button type="button" onClick={() => openFollowModal("following")}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <span className="text-base font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{followCounts.following}</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('profile_following')}</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {profile.telegram_username && (
              <a href={`https://t.me/${profile.telegram_username}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: isDark ? "rgba(96,165,250,0.1)" : "#EFF6FF", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.2)", textDecoration: "none" }}>
                <Send size={11} />
                {t('profile_open_tg')}
              </a>
            )}
            {profile.instagram_username && (
              <a href={`https://instagram.com/${profile.instagram_username}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: isDark ? "rgba(225,48,108,0.1)" : "#FFF0F5", color: "#E1306C", border: "1px solid rgba(225,48,108,0.2)", textDecoration: "none" }}>
                <Instagram size={11} />
                {t('profile_open_ig')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Follow modal */}
      {followModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setFollowModal(null)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: isDark ? "#161B22" : "#fff", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`, maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}` }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {followModal === "followers" ? `${t('profile_followers_list').replace('{n}', String(followCounts.followers))}` : `${t('profile_following_list').replace('{n}', String(followCounts.following))}`}
              </h3>
              <button type="button" onClick={() => setFollowModal(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", color: "var(--muted-foreground)" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: "calc(70vh - 60px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
              {followListLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
                </div>
              ) : followList.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {followModal === "followers" ? t('profile_no_followers') : t('profile_no_following')}
                </div>
              ) : followList.map((u: any) => {
                const lv2 = getLevel(u.score || 0);
                const ini = (u.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <button key={u.id} type="button"
                    onClick={() => { setFollowModal(null); onUserClick?.(u.id); }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: u.avatar_color || "#4ADE80", color: "#0E1117" }}>{ini}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{u.display_name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{u.username}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${lv2.color}18`, color: lv2.color, border: `1px solid ${lv2.color}33` }}>
                      {lv2.emoji} Lv.{lv2.level}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Coin Shop shortcut */}
      <button type="button" onClick={() => setShowShop(true)}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
        style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: "rgba(167,139,250,0.15)" }}>
          🪙
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: "#A78BFA" }}>{t('profile_coin_shop')}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {freshCoins} tanga — mukofotlar va imtiyozlar
          </p>
        </div>
        <ChevronRight size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
      </button>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Target,       label: t('profile_total_done'), value: totalCompleted, color: "#4ADE80", suffix: t('pieces') },
          { icon: Flame,        label: t('profile_best_streak'), value: bestStreak,     color: "#F97316", suffix: t('days') },
          { icon: CalendarDays, label: t('profile_active_days'), value: activeDays,     color: "#60A5FA", suffix: t('days') },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl flex flex-col gap-2" style={card}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${s.color}18` }}>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {s.value}<span className="text-sm font-normal ml-1" style={{ color: "var(--muted-foreground)" }}>{s.suffix}</span>
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {unlockedBadges.length > 0 && (
        <div className="p-5 rounded-2xl" style={card}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award size={16} style={{ color: "#FBBF24" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('profile_achievements')}</h3>
            </div>
            <button type="button" onClick={() => onNavigate("achievements")} className="text-xs font-medium" style={{ color: "var(--neon-green)" }}>
              {t('profile_all')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {unlockedBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div key={badge.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: `${badge.color}18`, color: badge.color, border: `1px solid ${badge.color}33` }}>
                  <Icon size={12} />{t(badge.titleKey as any)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Account info */}
      <div className="p-5 rounded-2xl" style={card}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t('profile_account')}</h3>
        <div className="space-y-3">
          {[
            { label: t('profile_joined'),         value: memberSince },
            { label: t('profile_active_habits'),  value: `${habits.filter((h: any) => h.is_active !== false).length} ${t('pieces')}` },
            { label: t('profile_positive_habits'),value: `${habits.filter((h: any) => h.type === "positive").length} ${t('pieces')}` },
            { label: t('profile_negative_habits'),value: `${habits.filter((h: any) => h.type === "negative").length} ${t('pieces')}` },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{item.label}</span>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>


      {/* ─── Sozlamalar ─── */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_title')}</h3>
        </div>

        {/* Dark mode */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }}>
              {isDark ? <Moon size={16} style={{ color: "#A78BFA" }} /> : <Sun size={16} style={{ color: "#FBBF24" }} />}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {isDark ? t('settings_dark_mode') : t('settings_light_mode')}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {isDark ? t('settings_to_light') : t('settings_to_dark')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onToggleDark}
            className="relative w-12 h-6 rounded-full transition-all shrink-0"
            style={{ background: isDark ? "#A78BFA" : "#D1D5DB" }}>
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: isDark ? "calc(100% - 22px)" : "2px" }} />
          </button>
        </div>

        {/* Language — accordion */}
        <div style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}>
          <button type="button" onClick={() => setLangOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 transition-all"
            style={{ background: langOpen ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)") : "transparent" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: isDark ? "rgba(96,165,250,0.12)" : "rgba(96,165,250,0.1)" }}>
                <Globe size={16} style={{ color: "#60A5FA" }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_lang')}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {currentLangObj.flag} {currentLangObj.label}
                </p>
              </div>
            </div>
            {langOpen ? <ChevronUp size={16} style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />}
          </button>

          {langOpen && (
            <div className="px-5 pb-4 space-y-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <div className="flex gap-2 pt-3">
                {LANGS.map((l) => (
                  <button key={l.id} type="button" onClick={() => setPendingLang(l.id)}
                    className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: pendingLang === l.id ? (isDark ? "rgba(96,165,250,0.15)" : "rgba(96,165,250,0.12)") : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"),
                      border: pendingLang === l.id ? "1.5px solid rgba(96,165,250,0.4)" : `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                      color: pendingLang === l.id ? "#60A5FA" : "var(--muted-foreground)",
                    }}>
                    <span style={{ fontSize: 18 }}>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
              <button type="button"
                onClick={() => { onLangChange(pendingLang); setLangOpen(false); }}
                disabled={pendingLang === lang}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: pendingLang === lang ? (isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6") : "#60A5FA",
                  color: pendingLang === lang ? "var(--muted-foreground)" : "#fff",
                  cursor: pendingLang === lang ? "not-allowed" : "pointer",
                }}>
                {pendingLang === lang ? t('profile_lang_selected') : t('profile_change_btn')}
              </button>
            </div>
          )}
        </div>

        {/* Password */}
        <div style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}>
          <button type="button"
            onClick={() => { setPassOpen(!passOpen); setPassError(""); setPassSuccess(""); }}
            className="w-full flex items-center gap-3 px-5 py-4 transition-all"
            style={{ background: passOpen ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)") : "transparent" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: isDark ? "rgba(248,113,113,0.1)" : "rgba(248,113,113,0.08)" }}>
              <span style={{ fontSize: 16 }}>🔑</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_password')}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('settings_password_sub')}</p>
            </div>
            {passOpen ? <ChevronUp size={16} style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />}
          </button>
          {passOpen && (
            <div className="px-5 pb-4 space-y-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <div className="h-2" />
              <div className="relative">
                <input type={showPass ? "text" : "password"} style={{ ...inputStyle, paddingRight: 40 }}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings_new_pass')} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} style={{ ...inputStyle, paddingRight: 40 }}
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('settings_confirm_pass')} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {passError && <p className="text-xs" style={{ color: "var(--coral-red)" }}>{passError}</p>}
              {passSuccess && <p className="text-xs" style={{ color: "var(--neon-green)" }}>{passSuccess}</p>}
              <button type="button" onClick={handleSavePassword} disabled={passLoading || !newPassword}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: !newPassword ? (isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6") : passLoading ? "rgba(74,222,128,0.4)" : "var(--neon-green)",
                  color: !newPassword ? "var(--muted-foreground)" : "#0E1117",
                  cursor: passLoading || !newPassword ? "not-allowed" : "pointer",
                }}>
                {passLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {t('settings_save_pass')}
              </button>
            </div>
          )}
        </div>

        {/* Telegram Bot */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: "rgba(56,189,248,0.12)" }}>
              ✈️
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('profile_telegram_bot_title')}</p>
              <p className="text-xs" style={{ color: tgBotLinked ? "#4ADE80" : "var(--muted-foreground)" }}>
                {tgBotLinked ? t('profile_tg_linked') : t('profile_tg_not_linked')}
              </p>
            </div>
          </div>
          {tgBotLinked ? (
            <button
              type="button"
              disabled={unlinkingTg}
              onClick={async () => {
                setUnlinkingTg(true);
                try { await unlinkTelegramBot(profile.id); setTgBotLinked(false); }
                catch (e: any) { alert(e?.message || t('err_loading')); }
                finally { setUnlinkingTg(false); }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              {unlinkingTg ? <Loader2 size={11} className="animate-spin" /> : "Uzish"}
            </button>
          ) : (
            <a
              href={`https://t.me/habbit_traccer_bot?start=${profile.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.25)", textDecoration: "none" }}
            >
              <Send size={11} /> Ulash
            </a>
          )}
        </div>

        {/* Notifications */}
        <div style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.08)" }}>
                <Bell size={16} style={{ color: "#4ADE80" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_notif')}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('settings_notif_sub')}</p>
              </div>
            </div>
            <button type="button"
              onClick={() => {
                if (notifPerm !== "granted") { requestNotifPermission(); return; }
                const next = !notifEnabled; setNotifEnabled(next); saveNotif(next, notifTime);
              }}
              className="relative w-12 h-6 rounded-full transition-all shrink-0"
              style={{ background: notifEnabled && notifPerm === "granted" ? "#4ADE80" : isDark ? "rgba(255,255,255,0.1)" : "#D1D5DB" }}>
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                style={{ left: notifEnabled && notifPerm === "granted" ? "calc(100% - 22px)" : "2px" }} />
            </button>
          </div>
          {notifPerm === "denied" && (
            <div className="mx-5 mb-3 p-3 rounded-xl" style={{ background: isDark ? "rgba(248,113,113,0.08)" : "#FFF5F5", border: "1px solid rgba(248,113,113,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <BellOff size={13} style={{ color: "var(--coral-red)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_notif_blocked')}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {t('settings_notif_blocked_hint')}
              </p>
            </div>
          )}
          {notifPerm === "default" && (
            <div className="mx-5 mb-3 p-3 rounded-xl flex items-center gap-3"
              style={{ background: isDark ? "rgba(251,191,36,0.08)" : "#FFFBEB", border: "1px solid rgba(251,191,36,0.2)" }}>
              <BellOff size={13} style={{ color: "#FBBF24", flexShrink: 0 }} />
              <div className="flex-1">
                <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{t('settings_notif_need_perm')}</p>
              </div>
              <button type="button" onClick={requestNotifPermission}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                style={{ background: "rgba(251,191,36,0.2)", color: "#FBBF24" }}>
                {t('settings_notif_allow')}
              </button>
            </div>
          )}
          {notifEnabled && notifPerm === "granted" && (
            <div className="px-5 pb-4">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t('settings_notif_time')}</label>
              <input type="time" style={inputStyle} value={notifTime}
                onChange={(e) => { setNotifTime(e.target.value); saveNotif(notifEnabled, e.target.value); }} />
            </div>
          )}
        </div>

        {/* Logout */}
        <button type="button" onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-5 py-4 text-sm font-medium transition-all"
          style={{ color: "var(--coral-red)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(248,113,113,0.06)" : "#FFF5F5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <LogOut size={16} />
          {t('settings_logout')}
        </button>

        {/* Danger zone — delete account */}
        <button type="button" onClick={() => setShowDeleteAccount(true)}
          title={t('settings_delete_account_sub')}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 text-xs font-medium transition-all"
          style={{ color: "var(--muted-foreground)", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}` }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-red)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}>
          <Trash2 size={13} />
          {t('settings_delete_account')}
        </button>
      </div>

      {/* Coin Shop Modal */}
      {showShop && (
        <CoinShopModal
          isDark={isDark}
          profile={profile}
          coins={freshCoins}
          onClose={() => setShowShop(false)}
          onCoinsChange={(n) => setFreshCoins(n)}
          onStarPurchased={(newExpiry) => setStarExpiresAt(newExpiry)}
        />
      )}

      {/* Delete Account Modal */}
      {showDeleteAccount && (
        <DeleteAccountModal
          isDark={isDark}
          profile={profile}
          onClose={() => setShowDeleteAccount(false)}
          onDeleted={onLogout}
        />
      )}

    </div>
  );
}
