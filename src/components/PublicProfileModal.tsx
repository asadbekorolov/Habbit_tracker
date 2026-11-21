import { useState, useEffect, useRef } from "react";
import {
  X, Star, Flame, Loader2, Check, Lock,
  Send, UserPlus, UserCheck, Crown, Instagram,
  AlertTriangle,
  Trophy, CheckCircle2, Award,
} from "lucide-react";
import { HabitIcon } from "./HabitIcon";
import {
  getPublicProfileStats,
  followUser, unfollowUser, checkFollowing, getFollowCounts,
  getTelegramRequestStatus, sendTelegramRequest, isStarActive,
} from "../services/db";
import { getLevel } from "../utils/levels";
import { getUsernameGlowStyle } from "../utils/cosmetics";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";
import { UserBadge } from "./UserBadge";
import { AvatarFrame } from "./AvatarFrame";
import { useScrollLock } from "../hooks/useScrollLock";
import { publicName, nameInitials } from "../utils/publicName";
import { computeNativeBadges } from "./School21BadgesModal";
import type { PublicProfileStats } from "../services/db";

interface PublicProfileModalProps {
  viewingId: string;
  myProfile: Profile;
  onClose: () => void;
}

const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5", "level_6", "level_7", "level_8", "level_9", "level_10"] as const;

export function PublicProfileModal({ viewingId, myProfile, onClose }: PublicProfileModalProps) {
  const { t } = useLang();
  useScrollLock(true);
  const [data, setData] = useState<PublicProfileStats | null>(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tgStatus, setTgStatus] = useState<'none' | 'pending' | 'approved' | 'cooldown'>('none');
  const [tgRetryAt, setTgRetryAt] = useState<string | null>(null);
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
        if (!isSelf && s?.profile?.telegram_private && s?.profile?.has_telegram) {
          const { status, retryAt } = await getTelegramRequestStatus(myProfile.id, viewingId);
          setTgStatus(status);
          setTgRetryAt(retryAt || null);
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
      await sendTelegramRequest(viewingId);
      setTgStatus('pending');
      setTgRetryAt(null);
    } catch (e: any) {
      if (e?.message === 'COOLDOWN') {
        const { status, retryAt } = await getTelegramRequestStatus(myProfile.id, viewingId);
        setTgStatus(status);
        setTgRetryAt(retryAt || null);
      } else {
        alert(e?.message || t('err_loading'));
      }
    }
    setTgLoading(false);
  }

  // Escape / Android "Orqaga" — oynani yopadi. Hook har renderda (yuklanish
  // paytida ham) chaqiriladi: avval early return'dan keyin turgani React
  // #310 ("Rendered more hooks than during the previous render") xatosini berardi.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function formatCooldown(retryAt: string | null): string {
    const ms = retryAt ? new Date(retryAt).getTime() - Date.now() : 0;
    if (ms <= 0) return t('pp_request_cooldown_m').replace('{m}', '0');
    const totalMins = Math.ceil(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0
      ? t('pp_request_cooldown_hm').replace('{h}', String(h)).replace('{m}', String(m))
      : t('pp_request_cooldown_m').replace('{m}', String(m));
  }

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {loading ? (
          <Loader2 size={28} className="animate-spin" style={{ color: "#4ADE80" }} />
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl" style={{ background: "#161B22" }}>
            <p className="text-sm" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{loadError || t('err_loading')}</p>
            <button onClick={onClose} className="text-xs underline" style={{ color: "var(--muted-foreground)" }}>
              {t('close')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const { profile, isPrivate, totalCompleted, activeDays, bestStreak, currentStreak } = data;
  const lv = getLevel(profile.score || 0);
  const name = publicName(profile, t('pp_user'));
  const initials = nameInitials(name);
  // Nishonlar — o'z profilidagi bilan bir xil shartlar (utils/badges), faqat ochilganlari
  const earnedBadges = isPrivate ? [] : computeNativeBadges({ score: profile.score || 0, totalCompleted, activeDays, bestStreak }).filter((b) => b.isUnlocked);

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overscroll-contain touch-none"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800/90 text-white shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative p-6 pb-4"
          style={{
            background: `linear-gradient(135deg, ${lv.color}14 0%, rgba(14,17,23,0.98) 60%)`,
          }}>
          <button type="button" onClick={onClose} data-modal-close-trigger aria-label={t('close')}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--muted-foreground)" }}>
            <X size={15} />
          </button>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <AvatarFrame frameId={profile.active_frame}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full overflow-hidden object-cover"
                    style={{ border: profile.active_frame ? "none" : `3px solid ${lv.color}55` }} />
                ) : (
                  <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold"
                    style={{ background: profile.avatar_color || lv.color, color: "#0E1117", border: profile.active_frame ? "none" : `3px solid ${lv.color}55` }}>
                    {initials}
                  </div>
                )}
              </AvatarFrame>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: lv.color, color: "#000", border: "2px solid var(--background)" }}>
                {lv.level}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold leading-tight break-words" style={{ color: "var(--foreground)", ...(profile.username_glow ? getUsernameGlowStyle() : {}) }}>
                  {name}
                </h2>
                <UserBadge active={isStarActive(profile)} size={14} />
                {profile.is_admin && <Crown size={14} style={{ color: "#FBBF24" }} />}
              </div>
              {profile.username && (
                <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  @{profile.username}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: `${lv.color}18`, color: lv.color, border: `1px solid ${lv.color}33` }}>
                  <HabitIcon emoji={lv.icon} size={12} noWrapper /> <span className="font-mono">LVL {lv.level}</span> {t(LEVEL_LABELS[lv.level] as any)}
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
            <p className="mt-3 text-sm leading-relaxed line-clamp-3 break-words" style={{ color: "var(--muted-foreground)" }}>
              {profile.bio}
            </p>
          )}

          {/* Follow counts + social links in one row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
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
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {profile.instagram_username && (
                <a
                  href={`https://instagram.com/${profile.instagram_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: "rgba(225,48,108,0.12)", color: "#E1306C", border: "1px solid rgba(225,48,108,0.25)", textDecoration: "none" }}
                >
                  <Instagram size={12} />
                  @{profile.instagram_username}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Statistika — faqat yig'ma raqamlar; odatlar va kunlik belgilar yopiq */}
        {isPrivate ? (
          <div className="mx-5 my-3 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 px-3.5 py-3 text-xs text-slate-400">
            <Lock size={14} className="shrink-0" /> {t('pp_private_stats')}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {[
              { icon: Flame, label: t('pp_current_streak'), value: currentStreak, color: "#F97316" },
              { icon: Trophy, label: t('pp_best_streak'), value: bestStreak, color: "#FBBF24" },
              { icon: CheckCircle2, label: t('pp_total_done'), value: totalCompleted, color: "#10B981" },
            ].map((st) => (
              <div key={st.label} className="flex flex-col items-center gap-1 py-2 rounded-2xl bg-slate-950/40 border border-slate-800/70">
                <st.icon size={16} style={{ color: st.color }} />
                <p className="text-base font-bold leading-none font-mono" style={{ color: "var(--foreground)" }}>{st.value}</p>
                <p className="text-[10.5px] text-center leading-tight px-1" style={{ color: "var(--muted-foreground)" }}>{st.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Qo'lga kiritilgan nishonlar */}
        {earnedBadges.length > 0 && (
          <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[11px] font-semibold mb-2 uppercase flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
              <Award size={12} /> {t('pp_badges_earned')} <span className="font-mono">{earnedBadges.length}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((b) => (
                <span key={b.id}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}>
                  <b.icon size={12} /> {b.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isSelf && (
          <div className="p-5 flex flex-col gap-2">
            {/* Follow */}
            <button onClick={handleFollow}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: isFollowing ? ("rgba(255,255,255,0.07)") : "var(--neon-green)",
                color: isFollowing ? "var(--muted-foreground)" : "#0E1117",
                border: isFollowing ? `1px solid rgba(255,255,255,0.1)` : "none",
              }}>
              {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {isFollowing ? t('following') : t('follow')}
            </button>

            <div className="flex gap-2">
              {/* Telegram */}
              {(profile.telegram_username || profile.has_telegram) && (
                // username server tomonidan faqat ruxsat bo'lsa qaytariladi (get_telegram_contact)
                profile.telegram_username && (!profile.telegram_private || tgStatus === 'approved') ? (
                  <a href={`https://t.me/${profile.telegram_username}`}
                    target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                    style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)", textDecoration: "none" }}>
                    <Send size={15} />
                    {t('profile_open_tg')}
                  </a>
                ) : tgStatus === 'pending' ? (
                  <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                    style={{ background: "rgba(74,222,128,0.08)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.25)" }}>
                    <Check size={15} />
                    {t('pp_request_sent')}
                  </div>
                ) : tgStatus === 'cooldown' ? (
                  <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium text-center"
                    style={{ background: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                    <Lock size={15} />
                    {formatCooldown(tgRetryAt)}
                  </div>
                ) : (
                  <button type="button" onClick={handleTelegramRequest} disabled={tgLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium"
                    style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)", opacity: tgLoading ? 0.6 : 1 }}>
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
                  style={{ background: "rgba(225,48,108,0.12)", color: "#E1306C", border: "1px solid rgba(225,48,108,0.25)", textDecoration: "none" }}>
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
