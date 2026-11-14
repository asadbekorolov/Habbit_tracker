import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../store/LangContext";
import {
  Bell as BellIcon, Check, Trash2, X, CheckCheck, Zap, MessageSquare,
  Users, UserPlus, Target, Flame, Lock
} from "lucide-react";
import { supabase } from "../services/supabase";
import { nativeNotificationService } from "../services/nativeNotificationService";
import type { Profile } from "../services/supabase";
import { respondTelegramRequest } from "../services/db";
import { useScrollLock } from "../hooks/useScrollLock";
import { useHaptics } from "../hooks/useHaptics";

interface NotificationBellProps {
  profile: Profile;
  onNavigate?: (tab: string) => void;
  onUserClick?: (userId: string) => void;
}

interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  telegram_request:      { icon: Zap, color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  telegram_approved:     { icon: Check, color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  telegram_request_done: { icon: CheckCheck, color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  telegram_rejected:     { icon: Lock, color: '#F87171', bg: 'rgba(248,113,113,0.13)' },
  feedback_reply:        { icon: MessageSquare, color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  contact_request:       { icon: Users, color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  follow:                { icon: UserPlus, color: '#A78BFA', bg: 'rgba(167,139,250,0.13)' },
  group_approval:        { icon: Target, color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  streak_warning:        { icon: Flame, color: '#F59E0B', bg: 'rgba(245,158,11,0.13)' },
};

function timeAgo(dateStr: string, t: (k: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notif_now');
  if (mins < 60) return `${mins}${t('notif_min')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${t('notif_hour')}`;
  const days = Math.floor(hours / 24);
  return `${days}${t('notif_day')}`;
}

function triggerNativeNotif(title: string, body: string, type: string) {
  const important = ['telegram_request', 'follow', 'group_approval'];
  const channelId = important.includes(type) ? 'social' : 'habits';

  nativeNotificationService.scheduleLocal(
    title,
    body,
    Math.floor(Date.now() / 1000),
    undefined,
    channelId
  );
}

export function NotificationBell({ profile, onNavigate, onUserClick }: NotificationBellProps) {
  const { t } = useLang();
  const haptics = useHaptics();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useScrollLock(isOpen);

  // Close modal on Escape key press (hardware back button integration)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        haptics.impactLight();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('notif:' + profile.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifications((prev) => [n, ...prev]);
          triggerNativeNotif(n.title, n.body, n.type);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile.id]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
  }

  async function markAsRead(id: string, link: string | null) {
    supabase.from("notifications").update({ is_read: true }).eq("id", id).then(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    if (link?.startsWith("profile:") && onUserClick) {
      onUserClick(link.replace("profile:", ""));
      setIsOpen(false);
    } else if (link && onNavigate && !link.includes(':')) {
      onNavigate(link);
      setIsOpen(false);
    }
  }

  async function markAllRead() {
    supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false).then(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function clearAll() {
    const { error } = await supabase.from("notifications").delete().eq("user_id", profile.id);
    if (error) { setActionError(error.message || t('err_loading')); return; }
    setNotifications([]);
    setIsOpen(false);
  }

  async function handleTgApprove(n: AppNotification) {
    if (!n.link?.startsWith("telegram_request:")) return;
    setActioningId(n.id);
    setActionError("");
    try {
      await respondTelegramRequest(n.link.replace("telegram_request:", ""), "approved");
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true, type: "telegram_request_done" } : x));
    } catch (e: any) { setActionError(e?.message || t('err_loading')); }
    finally { setActioningId(null); }
  }

  async function handleTgReject(n: AppNotification) {
    if (!n.link?.startsWith("telegram_request:")) return;
    setActioningId(n.id);
    setActionError("");
    try {
      await respondTelegramRequest(n.link.replace("telegram_request:", ""), "rejected");
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    } catch (e: any) { setActionError(e?.message || t('err_loading')); }
    finally { setActioningId(null); }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          haptics.impactLight();
          setIsOpen(!isOpen);
        }}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 text-white transition-all duration-200 active:scale-95 cursor-pointer hover:bg-slate-700"
        aria-label="Bildirishnomalar"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white shadow-sm"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:items-center bg-black/80 backdrop-blur-md overscroll-contain touch-none"
            onClick={() => {
              setIsOpen(false);
              haptics.impactLight();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col max-h-[85vh] overscroll-contain touch-pan-y relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-base text-white tracking-tight">
                    Bildirishnomalar
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {unreadCount} {t('notif_new')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.impactLight();
                        markAllRead();
                      }}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      title={t('notif_mark_read')}
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.impactLight();
                        clearAll();
                      }}
                      title={t('notif_clear')}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      haptics.impactLight();
                      setIsOpen(false);
                    }}
                    data-modal-close-trigger
                    aria-label="Close"
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white active:scale-90 transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {actionError && (
                <p className="text-xs px-1 py-1 shrink-0 text-rose-400 flex items-center gap-1">
                  <X size={12} /> {actionError}
                </p>
              )}

              {/* Notification Content List / Empty State */}
              <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-sm">
                      <BellIcon size={26} className="stroke-[2]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">
                        Hozircha yangi xabarlar yo'q
                      </p>
                      <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
                        Barcha muhim yangiliklar va eslatmalar shu yerda ko'rinadi
                      </p>
                    </div>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const cfg = TYPE_CONFIG[n.type] || { icon: BellIcon, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };
                    const isTgReq = n.type === "telegram_request" && n.link?.startsWith("telegram_request:");
                    const isTgDone = n.type === "telegram_request_done" || n.type === "telegram_approved";
                    const isActioning = actioningId === n.id;
                    const Icon = cfg.icon;

                    return (
                      <div
                        key={n.id}
                        className={`p-3 rounded-2xl transition-all border ${
                          n.is_read
                            ? "bg-slate-900/40 border-slate-800/60"
                            : "bg-slate-800/50 border-slate-700/60"
                        }`}
                      >
                        <div
                          className={!isTgReq ? "cursor-pointer" : ""}
                          onClick={!isTgReq ? () => markAsRead(n.id, n.link) : undefined}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-0.5"
                              style={{ background: cfg.bg }}
                            >
                              <Icon size={17} color={cfg.color} strokeWidth={2.2} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-white leading-snug truncate">
                                  {n.title}
                                </p>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  {timeAgo(n.created_at, t)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {n.body}
                              </p>
                            </div>

                            {!n.is_read && (
                              <div className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                            )}
                          </div>

                          {isTgDone && (
                            <p className="text-[11px] mt-2 ml-12 font-semibold text-emerald-400 flex items-center gap-1">
                              <Check size={12} /> {t('notif_accepted')}
                            </p>
                          )}
                        </div>

                        {isTgReq && !isTgDone && (
                          <div className="flex gap-2 mt-3 ml-12">
                            <button
                              type="button"
                              onClick={() => {
                                haptics.impactLight();
                                handleTgApprove(n);
                              }}
                              disabled={isActioning}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer disabled:opacity-50"
                            >
                              <Check size={13} /> {t('notif_accept')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                haptics.impactLight();
                                handleTgReject(n);
                              }}
                              disabled={isActioning}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 cursor-pointer disabled:opacity-50"
                            >
                              <X size={13} /> {t('notif_reject')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
