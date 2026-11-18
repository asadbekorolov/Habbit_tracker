// Sozlamalar — mantiqiy bo'limlarga ajratilgan squircle kartalar:
// Hisob va maxfiylik, Til va interfeys, Bildirishnomalar va vaqt,
// Ma'lumotlar va kesh, Hisobdan chiqish.
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, User, Shield, Globe, Vibrate, Bell, Clock, RefreshCw, Database, LogOut,
  ChevronRight, UserPen, Ruler, KeyRound, Eye, EyeOff, Loader2, Save, Send, WifiOff, CheckCircle2, PanelBottom,
} from "lucide-react";
import { useDockSlots } from "../../hooks/useDockSlots";
import { DOCK_OPTIONS, MAX_DOCK_SLOTS, toggleDockSlot } from "../../utils/dockConfig";
import { DOCK_ITEMS } from "../../components/BottomDock";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { updateUserPassword, updateUserProfile } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { useUser } from "../../store/UserContext";
import { notificationService } from "../../services/notificationService";
import { habitSyncQueue } from "../../services/habitSyncQueue";
import { useNavBack } from "../../hooks/useNavBack";
import { listHabitReminders } from "../../utils/reminders";
import { CustomTimePickerModal } from "../../components/CustomTimePickerModal";

type Lang = "uz" | "ru" | "en";

interface SettingsPageProps {
  onProfileUpdate: (newProfile: Profile) => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  lang: Lang;
  onLangChange: (l: Lang) => void;
}

const LANGS: { id: Lang; label: string }[] = [
  { id: "uz", label: "O'zbek" },
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

function Switch({ on, onToggle, label, disabled }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-slate-700"}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-slate-900/50 border border-slate-800/80 p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <Icon className="w-4 h-4 text-emerald-400" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ icon: Icon, title, sub, onClick, right }: {
  icon: React.ElementType; title: string; sub?: string; onClick?: () => void; right?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-300" />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-sm font-medium text-slate-100 truncate">{title}</span>
        {sub && <span className="block text-[11px] text-slate-400 leading-snug">{sub}</span>}
      </span>
      {right ?? (onClick ? <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" /> : null)}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-800/40 active:scale-[0.99] transition-all cursor-pointer">
      {body}
    </button>
  ) : (
    <div className="w-full flex items-center gap-3 p-2.5">{body}</div>
  );
}

/** "Pastki navigatsiya paneli": Asosiy va Profil doim; o'rtada 0–3 bo'lim. */
function DockSection() {
  const { t } = useLang();
  const [slots, saveSlots] = useDockSlots();
  const preview = [DOCK_ITEMS.dashboard, ...slots.map((id) => DOCK_ITEMS[id]), DOCK_ITEMS.profile];
  const full = slots.length >= MAX_DOCK_SLOTS;

  return (
    <Section icon={PanelBottom} title={t("st_dock")}>
      <p className="text-[11px] text-slate-400 leading-snug px-1">{t("st_dock_sub")}</p>
      <div className="flex items-center justify-around rounded-full bg-slate-950/60 border border-slate-800 py-2 px-3" aria-hidden="true">
        {preview.map((it) => {
          const Icon = it.icon;
          const fixed = it.key === "dashboard" || it.key === "profile";
          return <Icon key={it.key} className={`w-5 h-5 ${fixed ? "text-slate-500" : "text-emerald-400"}`} />;
        })}
      </div>
      <div className="space-y-0.5">
        {[DOCK_ITEMS.dashboard, DOCK_ITEMS.profile].map((it) => (
          <Row key={it.key} icon={it.icon} title={t(it.labelKey as any)} right={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t("st_dock_fixed")}</span>} />
        ))}
        {DOCK_OPTIONS.map((id) => {
          const it = DOCK_ITEMS[id];
          const on = slots.includes(id);
          return (
            <Row
              key={id}
              icon={it.icon}
              title={t(it.labelKey as any)}
              right={
                <Switch
                  on={on}
                  label={t(it.labelKey as any)}
                  disabled={!on && full}
                  onToggle={() => saveSlots(toggleDockSlot(slots, id))}
                />
              }
            />
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 px-1 flex justify-between">
        <span>{full ? t("st_dock_limit") : ""}</span>
        <span className="font-mono">{slots.length}/{MAX_DOCK_SLOTS}</span>
      </p>
    </Section>
  );
}

export function SettingsPage({ onLogout, onNavigate, onProfileUpdate, lang, onLangChange }: SettingsPageProps) {
  const { t } = useLang();
  const { profile, session, setProfile } = useUser();
  const queryClient = useQueryClient();
  const goBack = useNavBack();

  // ── Maxfiylik ───────────────────────────────────────────────────
  const [isPrivate, setIsPrivate] = useState(!!profile?.profile_private);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  async function togglePrivacy() {
    if (!profile) return;
    const next = !isPrivate;
    setIsPrivate(next);
    setSavingPrivacy(true);
    try {
      const updated = await updateUserProfile(profile.id, { profile_private: next });
      setProfile(updated);
      onProfileUpdate(updated);
      toast.success(t("st_private_saved"));
    } catch (e: any) {
      setIsPrivate(!next);
      toast.error(e?.message || t("ep_error"));
    } finally {
      setSavingPrivacy(false);
    }
  }

  // ── Parol ───────────────────────────────────────────────────────
  const [passOpen, setPassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  async function handleSavePassword() {
    if (!newPassword) return;
    if (newPassword.length < 6) { setPassError(t("settings_pass_short")); return; }
    if (newPassword !== confirmPassword) { setPassError(t("settings_pass_mismatch")); return; }
    setPassLoading(true);
    setPassError("");
    try {
      await updateUserPassword(newPassword);
      toast.success(t("settings_pass_success"));
      setNewPassword(""); setConfirmPassword(""); setPassOpen(false);
    } catch (e: any) {
      setPassError(e?.message || t("ep_error"));
    } finally {
      setPassLoading(false);
    }
  }

  // ── Vibratsiya ──────────────────────────────────────────────────
  const [haptics, setHaptics] = useState(() => {
    try { return localStorage.getItem("haptics_enabled") === "true"; } catch { return false; }
  });
  function toggleHaptics() {
    const next = !haptics;
    setHaptics(next);
    try { localStorage.setItem("haptics_enabled", String(next)); } catch { /* yo'q */ }
  }

  // ── Bildirishnomalar ────────────────────────────────────────────
  const notifKey = `notif_${profile?.id ?? "anon"}`;
  const stored = (() => { try { return JSON.parse(localStorage.getItem(notifKey) || "{}"); } catch { return {}; } })();
  const [notifEnabled, setNotifEnabled] = useState<boolean>(stored.enabled ?? false);
  const [notifTime, setNotifTime] = useState<string>(stored.time ?? "09:00");
  const [notifPickerOpen, setNotifPickerOpen] = useState(false);
  const [notifPerm, setNotifPerm] = useState<"default" | "granted" | "denied">("default");
  const habitReminders = (() => { try { return listHabitReminders(localStorage); } catch { return []; } })();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    LocalNotifications.checkPermissions()
      .then(({ display }) => setNotifPerm(display === "granted" ? "granted" : display === "denied" ? "denied" : "default"))
      .catch(() => setNotifPerm("default"));
  }, []);

  async function applyNotifications(enabled: boolean, time: string) {
    try { localStorage.setItem(notifKey, JSON.stringify({ enabled, time })); } catch { /* yo'q */ }
    const [h, m] = time.split(":").map(Number);
    // Odat nomlari — keshdagi ro'yxatdan (eslatma matni uchun)
    const habits = (queryClient.getQueryData<{ id: string; name: string }[]>(["habits", profile?.id]) || []);
    const nameOf = (id: string) => habits.find((x) => x.id === id)?.name || "IDROK";
    if (enabled) {
      await notificationService.scheduleDailyReminder(h, m);
      for (const r of habitReminders) await notificationService.scheduleHabitReminder(r.habitId, nameOf(r.habitId), r.time);
    } else {
      // Eslatma vaqtlari qurilmada qoladi — qayta yoqilganda tiklanadi
      await notificationService.cancelDailyReminder();
      for (const r of habitReminders) await notificationService.cancelHabitReminder(r.habitId);
    }
  }

  async function toggleNotifications() {
    if (notifPerm !== "granted") {
      const ok = await notificationService.initNotifications();
      if (!ok) { setNotifPerm("denied"); return; }
      setNotifPerm("granted");
    }
    const next = !notifEnabled;
    setNotifEnabled(next);
    await applyNotifications(next, notifTime);
  }

  // ── Sinxronizatsiya holati (habitSyncQueue) ─────────────────────
  const pending = useSyncExternalStore(
    (cb) => habitSyncQueue.subscribe(cb),
    () => habitSyncQueue.size(),
    () => 0
  );
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const [syncing, setSyncing] = useState(false);
  async function syncNow() {
    setSyncing(true);
    try {
      habitSyncQueue.flush();
      await queryClient.invalidateQueries();
      toast.success(t("st_sync_done"));
    } finally {
      setSyncing(false);
    }
  }

  // ── Chiqish ─────────────────────────────────────────────────────
  const [confirmLogout, setConfirmLogout] = useState(false);

  const email = session?.user?.email || "";
  const name = profile?.display_name || profile?.username || "";
  const initials = name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <div className="max-w-2xl mx-auto pb-32 space-y-4">
      {/* Sarlavha */}
      <div className="grid grid-cols-[40px_1fr_40px] items-center">
        <button
          type="button"
          onClick={goBack}
          aria-label={t("st_back")}
          className="w-10 h-10 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-200 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-center text-base font-bold text-white">{t("settings_title")}</h2>
        <span />
      </div>

      {/* 1. Hisob va maxfiylik */}
      <Section icon={User} title={t("st_account")}>
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/40 border border-slate-800">
          <span className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center shrink-0">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white truncate">{name}</span>
            <span className="block text-[11px] font-mono text-slate-400 truncate">{email}</span>
          </span>
        </div>
        <Row
          icon={Shield}
          title={t("st_private")}
          sub={isPrivate ? t("st_private_on") : t("st_private_off")}
          right={<Switch on={isPrivate} onToggle={togglePrivacy} label={t("st_private")} disabled={savingPrivacy} />}
        />
        <Row icon={Ruler} title={t("st_body_params")} sub={t("st_body_params_sub")} onClick={() => onNavigate("profile?edit=params")} />
        <Row icon={UserPen} title={t("settings_edit_profile")} sub={t("settings_edit_sub")} onClick={() => onNavigate("edit-profile")} />
        <Row icon={KeyRound} title={t("settings_password")} sub={t("settings_password_sub")} onClick={() => setPassOpen((v) => !v)} />
        {passOpen && (
          <div className="space-y-2 px-1">
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPassError(""); }}
                placeholder={t("settings_new_pass")}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
              />
              <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="show" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 cursor-pointer">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type={showPass ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPassError(""); }}
              placeholder={t("settings_confirm_pass")}
              className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
            />
            {passError && <p className="text-[11px] text-rose-400">{passError}</p>}
            <button
              type="button"
              onClick={handleSavePassword}
              disabled={passLoading || !newPassword}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {passLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("settings_save_pass")}
            </button>
          </div>
        )}
      </Section>

      {/* 2. Til va interfeys */}
      <Section icon={Globe} title={t("st_interface")}>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-950/50 border border-slate-800" role="radiogroup" aria-label={t("settings_lang")}>
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={lang === l.id}
              onClick={() => onLangChange(l.id)}
              className={`py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                lang === l.id ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Row
          icon={Vibrate}
          title={t("st_haptics")}
          sub={t("st_haptics_sub")}
          right={<Switch on={haptics} onToggle={toggleHaptics} label={t("st_haptics")} />}
        />
      </Section>

      {/* Pastki navigatsiya paneli */}
      <DockSection />

      {/* 3. Bildirishnomalar va vaqt */}
      <Section icon={Bell} title={t("st_notif_time")}>
        <Row
          icon={Bell}
          title={t("st_notif_all")}
          sub={t("st_notif_all_sub").replace("{n}", String(habitReminders.length))}
          right={<Switch on={notifEnabled && notifPerm !== "denied"} onToggle={toggleNotifications} label={t("st_notif_all")} />}
        />
        {notifPerm === "denied" && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25">
            <p className="text-xs font-semibold text-rose-200">{t("settings_notif_blocked")}</p>
            <p className="text-[11px] text-rose-200/80 mt-0.5">{t("settings_notif_blocked_hint")}</p>
          </div>
        )}
        {notifEnabled && notifPerm !== "denied" && (
          <>
            <button
              type="button"
              onClick={() => setNotifPickerOpen(true)}
              className="w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-950/40 border border-slate-800 hover:border-emerald-500/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-sm text-slate-200">
                <Clock className="w-4 h-4 text-emerald-400" /> {t("st_notif_daily_time")}
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400">{notifTime}</span>
            </button>
            <CustomTimePickerModal
              isOpen={notifPickerOpen}
              title={t("st_notif_daily_time")}
              initialTime={notifTime}
              onConfirm={(v) => {
                setNotifTime(v);
                applyNotifications(true, v);
              }}
              onClose={() => setNotifPickerOpen(false)}
            />
            <button
              type="button"
              onClick={async () => { await notificationService.sendTestNotificationNow(); toast.success(t("st_notif_test_sent")); }}
              className="w-full py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> {t("st_notif_test")}
            </button>
          </>
        )}
        <div className="flex items-center justify-between px-2.5 text-[11px]">
          <span className="text-slate-400">{t("st_timezone")}</span>
          <span className="font-mono text-slate-200">Asia/Tashkent • UTC+5</span>
        </div>
      </Section>

      {/* 4. Ma'lumotlar va kesh */}
      <Section icon={Database} title={t("st_data")}>
        <div className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs ${
          pending === 0 ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200" : "bg-amber-500/10 border-amber-500/25 text-amber-200"
        }`}>
          {!online ? <WifiOff className="w-4 h-4 shrink-0" /> : pending === 0 ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
          <span className="flex-1">
            {pending === 0 ? t("st_sync_ok") : t("st_sync_pending").replace("{n}", String(pending))}
            {!online && <span className="block text-[11px] opacity-80">{t("st_offline")}</span>}
          </span>
          <span className="font-mono">{pending}</span>
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing || !online}
          className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-100 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {t("st_sync_now")}
        </button>
      </Section>

      {/* 5. Hisobdan chiqish */}
      {confirmLogout ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-950/30 p-4 space-y-3">
          <p className="text-sm text-rose-100">{t("st_logout_confirm")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onLogout} className="py-2.5 rounded-xl bg-rose-500 text-white text-sm font-bold cursor-pointer">
              {t("st_logout_yes")}
            </button>
            <button type="button" onClick={() => setConfirmLogout(false)} className="py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold cursor-pointer">
              {t("hd_cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="w-full py-3.5 rounded-3xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> {t("settings_logout")}
        </button>
      )}
    </div>
  );
}
