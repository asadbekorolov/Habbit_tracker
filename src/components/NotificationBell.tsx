import { useState, useEffect, useRef } from "react";
import { useLang } from "../store/LangContext";
import { Bell, Check, Trash2, X, CheckCheck } from "lucide-react";
import { supabase } from "../services/supabase";
import { approveTelegramRequest, rejectTelegramRequest } from "../services/db";
import type { Profile } from "../services/supabase";

interface NotificationBellProps {
  isDark: boolean;
  profile: Profile;
  onNavigate?: (tab: string) => void;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  telegram_request:      { icon: '📨', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  telegram_approved:     { icon: '✅', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  telegram_request_done: { icon: '✓',  color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  contact_request:       { icon: '👋', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  follow:                { icon: '👥', color: '#A78BFA', bg: 'rgba(167,139,250,0.13)' },
  group_approval:        { icon: '🎯', color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  streak_warning:        { icon: '🔥', color: '#F59E0B', bg: 'rgba(245,158,11,0.13)' },
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

function triggerBrowserNotif(title: string, body: string, type: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const important = ['telegram_request', 'follow', 'group_approval'];
  if (!important.includes(type) && !document.hidden) return;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: type });
  } catch {}
}

export function NotificationBell({ isDark, profile, onNavigate }: NotificationBellProps) {
  const { t } = useLang();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('notif:' + profile.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          triggerBrowserNotif(n.title, n.body, n.type);
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
    // "O'qilgan" belgisi kosmetik — navigatsiya baribir davom etadi, xato
    // bo'lsa ham keyingi fetchNotifications() haqiqiy holatni tiklaydi
    supabase.from("notifications").update({ is_read: true }).eq("id", id).then(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    if (link && onNavigate && !link.includes(':')) {
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

  // ── Telegram request ──────────────────────────────────────────────────────
  async function handleTgApprove(n: Notification) {
    if (!n.link?.startsWith("telegram_request:")) return;
    setActioningId(n.id);
    setActionError("");
    try {
      await approveTelegramRequest(n.link.replace("telegram_request:", ""), profile.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true, type: "telegram_request_done" } : x));
    } catch (e: any) { setActionError(e?.message || t('err_loading')); }
    finally { setActioningId(null); }
  }
  async function handleTgReject(n: Notification) {
    if (!n.link?.startsWith("telegram_request:")) return;
    setActioningId(n.id);
    setActionError("");
    try {
      await rejectTelegramRequest(n.link.replace("telegram_request:", ""), profile.id);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    } catch (e: any) { setActionError(e?.message || t('err_loading')); }
    finally { setActioningId(null); }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const bg = isDark ? "#161B22" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
        style={{
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          color: "var(--foreground)",
          border: `1px solid ${border}`,
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "#EF4444", color: "#fff" }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                {t('notif_title')}
              </h3>
              {unreadCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
                  {unreadCount} {t('notif_new')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  title={t('notif_mark_read')}
                >
                  <CheckCheck size={12} /> {t('notif_mark_read')}
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  title={t('notif_clear')}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors hover:text-red-400"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <p className="text-xs px-4 py-2" style={{ color: "var(--coral-red)" }}>⚠ {actionError}</p>
          )}

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p style={{ fontSize: 32 }}>🔔</p>
                <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
                  {t('notif_empty')}
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || { icon: '📣', color: 'var(--muted-foreground)', bg: 'transparent' };
                const isTgReq = n.type === "telegram_request" && n.link?.startsWith("telegram_request:");
                const isTgDone = n.type === "telegram_request_done" || n.type === "telegram_approved";
                const isActioning = actioningId === n.id;

                return (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b transition-colors"
                    style={{
                      borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
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
                        {/* Icon */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                          style={{ background: cfg.bg }}
                        >
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                              {n.title}
                            </p>
                            <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                              {timeAgo(n.created_at, t)}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                            {n.body}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "#EF4444" }} />
                        )}
                      </div>

                      {/* Done badge */}
                      {isTgDone && (
                        <p className="text-[11px] mt-1.5 ml-12 font-medium" style={{ color: "#4ADE80" }}>
                          {t('notif_accepted')}
                        </p>
                      )}
                    </div>

                    {/* Telegram request actions */}
                    {isTgReq && !isTgDone && (
                      <div className="flex gap-2 mt-2 ml-12">
                        <button
                          type="button"
                          onClick={() => handleTgApprove(n)}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(74,222,128,0.14)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                        >
                          <Check size={11} /> {t('notif_accept')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTgReject(n)}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(248,113,113,0.12)", color: "#F87171", border: "1px solid rgba(248,113,113,0.25)" }}
                        >
                          <X size={11} /> {t('notif_reject')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
