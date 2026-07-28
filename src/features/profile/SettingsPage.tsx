import { useState } from "react";
import { Loader2, LogOut, Eye, EyeOff, Bell, BellOff, UserPen, Moon, Sun, ChevronDown, ChevronUp, Save, Globe } from "lucide-react";
import { updateUserPassword } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";

type Lang = "uz" | "ru" | "en";

interface SettingsPageProps {
  isDark: boolean;
  profile: Profile;
  onProfileUpdate: (newProfile: Profile) => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  onToggleDark: () => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
}

export function SettingsPage({ isDark, profile, onLogout, onNavigate, onToggleDark, lang, onLangChange }: SettingsPageProps) {
  const { t } = useLang();
  const [passOpen, setPassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  const NOTIF_KEY = `notif_${profile.id}`;
  const _nd = (() => { try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}"); } catch { return {}; } })();
  const [notifEnabled, setNotifEnabled] = useState<boolean>(_nd.enabled ?? false);
  const [notifTime, setNotifTime] = useState<string>(_nd.time ?? "09:00");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  function saveNotif(enabled: boolean, time: string) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify({ enabled, time }));
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") { setNotifEnabled(true); saveNotif(true, notifTime); }
  }

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
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

  const LANGS: { id: Lang; flag: string; label: string }[] = [
    { id: "uz", flag: "🇺🇿", label: "O'zbek" },
    { id: "ru", flag: "🇷🇺", label: "Русский" },
    { id: "en", flag: "🇬🇧", label: "English" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('settings_sub')}</p>
        </div>
      </div>

      {/* Profile shortcut */}
      <button onClick={() => onNavigate("edit-profile")}
        className="w-full flex items-center gap-3 p-4 rounded-xl mb-3 transition-all text-left"
        style={{ background: isDark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
          <UserPen size={16} style={{ color: "#4ADE80" }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_edit_profile')}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('settings_edit_sub')}</p>
        </div>
        <span style={{ color: "var(--muted-foreground)", fontSize: 18 }}>›</span>
      </button>

      {/* Dark / Light mode */}
      <div style={card} className="p-4 mb-3">
        <div className="flex items-center justify-between">
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
          <button onClick={onToggleDark}
            className="relative w-12 h-6 rounded-full transition-all shrink-0"
            style={{ background: isDark ? "#A78BFA" : "#D1D5DB" }}>
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: isDark ? "calc(100% - 22px)" : "2px" }} />
          </button>
        </div>
      </div>

      {/* Language */}
      <div style={card} className="p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: isDark ? "rgba(96,165,250,0.12)" : "rgba(96,165,250,0.1)" }}>
            <Globe size={16} style={{ color: "#60A5FA" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('settings_lang')}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('settings_lang_sub')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => onLangChange(l.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: lang === l.id ? (isDark ? "rgba(96,165,250,0.15)" : "rgba(96,165,250,0.12)") : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"),
                border: lang === l.id ? "1.5px solid rgba(96,165,250,0.4)" : `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
                color: lang === l.id ? "#60A5FA" : "var(--muted-foreground)",
              }}>
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Password — compact accordion */}
      <div style={card} className="mb-3 overflow-hidden">
        <button onClick={() => { setPassOpen(!passOpen); setPassError(""); setPassSuccess(""); }}
          className="w-full flex items-center gap-3 p-4 transition-all"
          style={{ background: passOpen ? (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)") : "transparent" }}>
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
          <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <div className="h-3" />
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
            <button onClick={handleSavePassword} disabled={passLoading || !newPassword}
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

      {/* Notifications */}
      <div style={card} className="p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
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
          <div className="mt-2 p-3 rounded-xl" style={{ background: isDark ? "rgba(248,113,113,0.08)" : "#FFF5F5", border: "1px solid rgba(248,113,113,0.2)" }}>
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
          <div className="mt-2 p-3 rounded-xl flex items-center gap-3"
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
          <div className="mt-3">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t('settings_notif_time')}</label>
            <input type="time" style={inputStyle} value={notifTime}
              onChange={(e) => { setNotifTime(e.target.value); saveNotif(notifEnabled, e.target.value); }} />
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
        style={{ background: "rgba(248,113,113,0.08)", color: "var(--coral-red)", border: "1px solid rgba(248,113,113,0.2)" }}>
        <LogOut size={16} />
        {t('settings_logout')}
      </button>
    </div>
  );
}
