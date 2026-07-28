import { useState, useEffect, useRef } from "react";
import {
  X, Star, Flame, Loader2, Check,
  Send, UserPlus, UserCheck, Crown, Instagram,
} from "lucide-react";
import {
  getPublicProfileStats,
  followUser, unfollowUser, checkFollowing, getFollowCounts,
  getTelegramRequestStatus, sendTelegramRequest, isStarActive,
} from "../services/db";
import { getLevel } from "../utils/levels";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";
import type { T } from "../store/LangContext";
import { UserBadge } from "./UserBadge";

interface Badge { emoji: string; label: string; color: string }

function computeBadges(totalCompleted: number, score: number, t: T): Badge[] {
  const b: Badge[] = [];
  if (score >= 500) b.push({ emoji: "👑", label: t('level_5'), color: "#8B5CF6" });
  else if (score >= 300) b.push({ emoji: "💎", label: t('level_4'), color: "#3B82F6" });
  else if (score >= 150) b.push({ emoji: "🔥", label: t('level_3'), color: "#F97316" });
  else if (score >= 50) b.push({ emoji: "⚡", label: t('level_2'), color: "#FBBF24" });

  if (totalCompleted >= 100) b.push({ emoji: "🏆", label: t('pp_badge_100'), color: "#FBBF24" });
  else if (totalCompleted >= 50) b.push({ emoji: "🎯", label: t('pp_badge_50'), color: "#4ADE80" });
  else if (totalCompleted >= 10) b.push({ emoji: "✅", label: t('pp_badge_10'), color: "#4ADE80" });

  return b;
}

interface PublicProfileModalProps {
  isDark: boolean;
  viewingId: string;
  myProfile: Profile;
  onClose: () => void;
}

const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5"] as const;

export function PublicProfileModal({ isDark, viewingId, myProfile, onClose }: PublicProfileModalProps) {
  const { t } = useLang();
  const [data, setData] = useState<{
    profile: Profile;
    totalCompleted: number;
    habitsCount: number;
  } | null>(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tgStatus, setTgStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [tgLoading, setTgLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isSelf = viewingId === myProfile.id;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [stats, fc, following] = await Promise.all([
          getPublicProfileStats(viewingId),
          getFollowCounts(viewingId),
          !isSelf ? checkFollowing(myProfile.id, viewingId) : Promise.resolve(false),
        ]);
        const s = stats as any;
        setData(s);
        setFollowCounts(fc);
        setIsFollowing(following as boolean);
        if (!isSelf && s?.profile?.telegram_private && s?.profile?.telegram_username) {
          const status = await getTelegramRequestStatus(myProfile.id, viewingId);
          setTgStatus(status);
        }
      } catch (e: any) {
        setLoadError(e?.message || t('err_loading'));
      }
      setLoading(false);
    }
    load();
  }, [viewingId]);

  async function handleFollow() {
    if (!data) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowCounts((prev) => ({
      ...prev,
      followers: prev.followers + (wasFollowing ? -1 : 1),
    }));
    try {
      if (wasFollowing) await unfollowUser(myProfile.id, viewingId);
      else await followUser(myProfile.id, viewingId, myProfile.display_name);
    } catch {
      setIsFollowing(wasFollowing);
    }
  }

  async function handleTelegramRequest() {
    if (tgLoading) return;
    setTgLoading(true);
    try {
      await sendTelegramRequest(myProfile.id, viewingId, myProfile.display_name, myProfile.username);
      setTgStatus('pending');
    } catch (e: any) {
      alert(e?.message || t('err_loading'));
    }
    setTgLoading(false);
  }

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {loading ? (
          <Loader2 size={28} className="animate-spin" style={{ color: "#4ADE80" }} />
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl" style={{ background: isDark ? "#161B22" : "#fff" }}>
            <p className="text-sm" style={{ color: "var(--coral-red)" }}>⚠ {loadError || t('err_loading')}</p>
            <button onClick={onClose} className="text-xs underline" style={{ color: "var(--muted-foreground)" }}>
              {t('close')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const { profile, totalCompleted, habitsCount } = data;
  const lv = getLevel(profile.score || 0);
  const initials = profile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  // Telegram identifikatori faqat quyidagi holatlarda DOM'ga chiqariladi:
  // o'zi, yoki profil ochiq (telegram_private=false), yoki so'rov allaqachon
  // tasdiqlangan. Aks holda hech narsa ko'rsatilmaydi — pastdagi "So'rov
  // yuborish" tugmasi orqali ruxsat so'raladi (Actions bo'limi).
  const canSeeTelegram = isSelf || !profile.telegram_private || tgStatus === 'approved';

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: isDark ? "#0E1117" : "#fff",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          maxHeight: "90vh",
          overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Hero */}
        <div className="relative p-6 pb-4"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${lv.color}14 0%, rgba(14,17,23,0.98) 60%)`
              : `linear-gradient(135deg, ${lv.color}18 0%, rgba(255,255,255,0.98) 60%)`,
          }}>
          <button type="button" onClick={onClose} aria-label={t('close')}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", color: "var(--muted-foreground)" }}>
            <X size={15} />
          </button>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover"
                  style={{ border: `3px solid ${lv.color}55` }} />
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
                  style={{ background: profile.avatar_color || lv.color, color: "#0E1117", border: `3px solid ${lv.color}55` }}>
                  {initials}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: lv.color, color: "#000", border: "2px solid var(--background)" }}>
                {lv.level}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold leading-tight" style={{ color: "var(--foreground)" }}>
                  {profile.display_name}
                </h2>
                <UserBadge active={isStarActive(profile)} size={14} />
                {profile.is_admin && <Crown size={14} style={{ color: "#FBBF24" }} />}
              </div>
              {isSelf && (
                <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  @{profile.username}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: `${lv.color}18`, color: lv.color, border: `1px solid ${lv.color}33` }}>
                  {lv.emoji} Lv.{lv.level} {t(LEVEL_LABELS[lv.level] as any)}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold" style={{ color: "#FBBF24" }}>
                  <Star size={13} fill="currentColor" />
                  <span style={{ fontFamily: "'Geist Mono', monospace" }}>{profile.score || 0}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              {profile.bio}
            </p>
          )}

          {/* Follow counts + social links in one row */}
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {followCounts.followers}
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('profile_followers')}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {followCounts.following}
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{t('profile_following')}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {profile.telegram_username && canSeeTelegram && (
                <a
                  href={`https://t.me/${profile.telegram_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: isDark ? "rgba(96,165,250,0.12)" : "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)", textDecoration: "none" }}
                >
                  <Send size={12} />
                  {t('pp_telegram_connect')}
                </a>
              )}
              {profile.instagram_username && (
                <a
                  href={`https://instagram.com/${profile.instagram_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: isDark ? "rgba(225,48,108,0.12)" : "rgba(225,48,108,0.08)", color: "#E1306C", border: "1px solid rgba(225,48,108,0.25)", textDecoration: "none" }}
                >
                  <Instagram size={12} />
                  @{profile.instagram_username}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 px-5 py-3 border-t"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
          {[
            { icon: Star, label: t('pp_points'), value: profile.score || 0, color: "#FBBF24" },
            { icon: Flame, label: t('nav_habits'), value: habitsCount, color: "#F97316" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 py-2">
              <s.icon size={16} style={{ color: s.color }} />
              <p className="text-base font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {s.value}
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Achievements */}
        {(() => {
          const badges = computeBadges(totalCompleted, profile.score || 0, t);
          if (badges.length === 0) return null;
          return (
            <div className="px-5 py-3 border-b"
              style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <p className="text-[11px] font-semibold mb-2 uppercase" style={{ color: "var(--muted-foreground)" }}>
                {t('ach_title')}
              </p>
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b.label}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}>
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Actions */}
        {!isSelf && (
          <div className="p-5 flex flex-col gap-2">
            {/* Follow */}
            <button onClick={handleFollow}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: isFollowing ? (isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6") : "var(--neon-green)",
                color: isFollowing ? "var(--muted-foreground)" : "#0E1117",
                border: isFollowing ? `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` : "none",
              }}>
              {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {isFollowing ? t('following') : t('follow')}
            </button>

            <div className="flex gap-2">
              {/* Telegram */}
              {profile.telegram_username && (
                !profile.telegram_private || tgStatus === 'approved' ? (
                  <a href={`https://t.me/${profile.telegram_username}`}
                    target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                    style={{ background: isDark ? "rgba(96,165,250,0.12)" : "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)", textDecoration: "none" }}>
                    <Send size={15} />
                    {t('profile_open_tg')}
                  </a>
                ) : tgStatus === 'pending' ? (
                  <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                    style={{ background: isDark ? "rgba(74,222,128,0.08)" : "#F0FDF4", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.25)" }}>
                    <Check size={15} />
                    {t('pp_request_sent')}
                  </div>
                ) : (
                  <button type="button" onClick={handleTelegramRequest} disabled={tgLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                    style={{ background: isDark ? "rgba(96,165,250,0.12)" : "rgba(96,165,250,0.1)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)", opacity: tgLoading ? 0.6 : 1 }}>
                    {tgLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {t('pp_request_btn')}
                  </button>
                )
              )}

              {/* Instagram */}
              {profile.instagram_username && (
                <a href={`https://instagram.com/${profile.instagram_username}`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                  style={{ background: isDark ? "rgba(225,48,108,0.12)" : "rgba(225,48,108,0.08)", color: "#E1306C", border: "1px solid rgba(225,48,108,0.25)", textDecoration: "none" }}>
                  <Instagram size={15} />
                  {t('profile_open_ig')}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Self view */}
        {isSelf && (
          <div className="px-5 pb-5 pt-3">
            <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
              {t('pp_self_view_hint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
