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

interface NotificationBellProps {
  isDark: boolean;
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

function timeAgo(dateStr: string, t: (k: string) => string): string {
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

export function NotificationBell({ isDark, profile, onNavigate, onUserClick }: NotificationBellProps) {
  const { t } = useLang();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  // Lock body scroll while notification modal/popover is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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
  const bg = isDark ? "#161B22" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer"
        style={{
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          color: "var(--foreground)",
          border: `1px solid ${border}`,
        }}
        aria-label="Bildirishnomalar"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "#EF4444", color: "#fff" }}
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
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-start justify-center sm:justify-end p-4 pt-16 sm:pt-14 sm:pr-6"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
              style={{ background: bg, border: `1px solid ${border}`, maxHeight: "calc(85vh - 3rem)" }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b shrink-0"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-base tracking-tight" style={{ color: "var(--foreground)" }}>
                    Bildirishnomalar
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
                      {unreadCount} {t('notif_new')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary transition-colors font-medium cursor-pointer"
                      style={{ color: "var(--muted-foreground)" }}
                      title={t('notif_mark_read')}
                    >
                      <CheckCheck size={13} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      title={t('notif_clear')}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary hover:text-red-400 transition-colors font-medium cursor-pointer"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    data-modal-close-trigger
                    aria-label="Close"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground active:scale-90 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {actionError && (
                <p className="text-xs px-5 py-2 shrink-0" style={{ color: "var(--coral-red)" }}>
                  ⚠ {actionError}
                </p>
              )}

              {/* Notification Content List / Empty State */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {notifications.length === 0 ? (
                  <div className="px-6 py-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                      <BellIcon size={28} />
                    </div>
                    <p className="text-sm font-medium text-white mb-1">
                      Hozircha yangi xabarlar yo'q
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      Barcha muhim yangiliklar va eslatmalar shu yerda ko'rinadi
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const cfg = TYPE_CONFIG[n.type] || { icon: BellIcon, color: 'var(--muted-foreground)', bg: 'transparent' };
                    const isTgReq = n.type === "telegram_request" && n.link?.startsWith("telegram_request:");
                    const isTgDone = n.type === "telegram_request_done" || n.type === "telegram_approved";
                    const isActioning = actioningId === n.id;
                    const Icon = cfg.icon;

                    return (
                      <div
                        key={n.id}
                        className="p-3.5 rounded-2xl transition-all border"
                        style={{
                          borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                          background: n.is_read
                            ? "transparent"
                            : isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
                        }}
                      >
                        <div
                          className={!isTgReq ? "cursor-pointer" : ""}
                          onClick={!isTgReq ? () => markAsRead(n.id, n.link) : undefined}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                              style={{ background: cfg.bg }}
                            >
                              <Icon size={18} color={cfg.color} strokeWidth={2.5} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                                  {n.title}
                                </p>
                                <span className="text-[10px] shrink-0 mt-0.5 font-medium" style={{ color: "var(--muted-foreground)" }}>
                                  {timeAgo(n.created_at, t)}
                                </span>
                              </div>
                              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                                {n.body}
                              </p>
                            </div>

                            {!n.is_read && (
                              <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            )}
                          </div>

                          {isTgDone && (
                            <p className="text-[11px] mt-2 ml-13 font-semibold text-emerald-400">
                              {t('notif_accepted')}
                            </p>
                          )}
                        </div>

                        {isTgReq && !isTgDone && (
                          <div className="flex gap-2 mt-3 ml-13">
                            <button
                              type="button"
                              onClick={() => handleTgApprove(n)}
                              disabled={isActioning}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                              style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                            >
                              <Check size={13} /> {t('notif_accept')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTgReject(n)}
                              disabled={isActioning}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                              style={{ background: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}
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
