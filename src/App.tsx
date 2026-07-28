import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LayoutDashboard, ClipboardList, ListChecks, Users, BarChart3, User, Heart, MoreHorizontal, Trophy, ShieldAlert, X as CloseIcon } from "lucide-react";
import { getLevel } from "./utils/levels";
import { Sidebar } from "./components/Sidebar";
import { HabitsLog } from "./features/habits/HabitsLog";
import { Analytics } from "./features/analytics/Analytics";
import { LoginPage } from "./features/auth/LoginPage";
import { HabitsManager } from "./features/habits/HabitsManager";
import { SettingsPage } from "./features/profile/SettingsPage";
import { GlobalLeaderboardPage } from "./features/leaderboard/GlobalLeaderboardPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { NotificationBell } from "./components/NotificationBell";
import { Achievements } from "./features/profile/Achievements";
import { AdminPanel } from "./features/groups/AdminPanel";
import { Dashboard } from "./features/dashboard/Dashboard";
import { GroupsPage } from "./features/groups/GroupsPage";
import { FeedPage } from "./features/feed/FeedPage";
import { MonthGrid } from "./features/dashboard/MonthGrid";
import { DailyNotes } from "./features/dashboard/DailyNotes";
import { LevelUpToast } from "./components/LevelUpToast";
import { WeeklyReflection } from "./features/dashboard/WeeklyReflection";
import { EditProfilePage } from "./features/profile/EditProfilePage";
import { PublicProfileModal } from "./components/PublicProfileModal";
import { HealthPage } from "./features/habits/HealthPage";
import { supabase } from "./services/supabase";
import { getProfileById, signOutUser, getHabits, getTodayLogs, touchLastSeen, computeHabitProgress } from "./services/db";
import type { Profile } from "./services/supabase";
import { LangContext, buildLangValue, type Lang } from "./store/LangContext";
import { MONTHS_FULL, DAYS_FULL } from "./utils/i18n";
import { trackEvent } from "./utils/analytics";
import { Toaster } from "sonner";

const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5"] as const;
// Sidebar'da bor, lekin mobil pastki navigatsiyada joy yo'qligi uchun "Ko'proq" varag'iga yashiringan tablar
const MOBILE_MORE_TABS = ["leaderboard", "analytics", "admin"];

function HeaderProgress({ percent, completed, total, isDark, lang }: { percent: number; completed: number; total: number; isDark: boolean; lang: Lang }) {
  const t = buildLangValue(lang).t;
  return (
    <div className="flex flex-col justify-center w-28 sm:w-32">
      <div className="flex items-end justify-between mb-1.5">
        <div>
          <p className="text-xs font-medium leading-none" style={{ color: "var(--foreground)" }}>
            {t('today')}
          </p>
          <p className="text-[10px] mt-0.5 leading-none" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {total > 0 ? `${completed}/${total} ${t('app_habits_word')}` : "—"}
          </p>
        </div>
        <span className="text-xs font-bold leading-none mb-0.5" style={{ color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
          {percent}%
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: "#4ADE80",
            boxShadow: "0 0 8px rgba(74,222,128,0.5)",
          }}
        />
      </div>
    </div>
  );
}


export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return true;
    }
  });
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("lang") as Lang) || "uz"; } catch { return "uz"; }
  });
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [logsView, setLogsView] = useState<"today" | "month" | "notes" | "weekly">("today");
  const [completedToday, setCompletedToday] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [allDoneToast, setAllDoneToast] = useState(false);
  const [streakToast, setStreakToast] = useState<{ name: string; emoji: string; days: number } | null>(null);
  const [showLevelToast, setShowLevelToast] = useState(false);
  const [prevLevel, setPrevLevel] = useState(1);
  const streakTimerRef = useRef<number | undefined>(undefined);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname.substring(1);
  const activeTab = currentPath || "dashboard";
  const setActiveTab = (tabId: string) => navigate(`/${tabId}`);

  const completedTodayRef = useRef(completedToday);
  completedTodayRef.current = completedToday;
  const totalHabitsRef = useRef(totalHabits);
  totalHabitsRef.current = totalHabits;
  const entryScreenRef = useRef<string | null>(null);
  const exitTrackedRef = useRef(false);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.body.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

    // Supabase session tekshirish
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const p = await getProfileById(session.user.id);
          
          if (p.is_banned) {
            await signOutUser();
            alert(buildLangValue(lang).t('banned_account_msg'));
            setAuthLoading(false);
            return;
          }

          setProfile(p);
          setPrevLevel(getLevel(p.score || 0).level);
          if (location.pathname === "/login" || location.pathname === "/") navigate("/dashboard");
          await loadTodayStats(session.user.id);
          touchLastSeen();

        }
      } catch {}
      setAuthLoading(false);
    };
    init();

    // Auth holati o'zgarsa
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        navigate("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let settings: { enabled?: boolean; time?: string } = {};
    try { settings = JSON.parse(localStorage.getItem(`notif_${profile.id}`) || "{}"); } catch { return; }
    if (!settings.enabled || !settings.time) return;

    const [h, m] = settings.time.split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) return;

    const timer = setTimeout(() => {
      const done = completedTodayRef.current;
      const total = totalHabitsRef.current;
      const tt = buildLangValue(lang).t;
      let body: string;
      if (total === 0) body = tt('notif_daily_no_habits');
      else if (done === total) body = tt('notif_daily_all_done').replace('{n}', String(total));
      else if (done === 0) body = tt('notif_daily_none_done');
      else body = tt('notif_daily_partial').replace('{done}', String(done)).replace('{total}', String(total));
      new Notification(tt('notif_daily_title'), { body, tag: "daily-reminder", icon: "/favicon.ico" });
    }, target.getTime() - now.getTime());

    return () => clearTimeout(timer);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    const currentLevel = getLevel(profile.score || 0).level;
    if (currentLevel > prevLevel) {
      setShowLevelToast(true);
      setPrevLevel(currentLevel);
    } else if (currentLevel < prevLevel) {
      setPrevLevel(currentLevel);
    }
  }, [profile?.score, prevLevel]);

  // Screen-view + first-screen-exit tracking (drop-off analysis).
  // entryScreenRef captures the very first screen a session lands on;
  // the first time the user navigates away from it (or backgrounds/closes
  // the tab while still on it), a single "first_screen_exit" event fires.
  useEffect(() => {
    if (!profile) return;
    trackEvent('screen_view', { screen: activeTab }, profile.id);
    if (entryScreenRef.current === null) {
      entryScreenRef.current = activeTab;
    } else if (!exitTrackedRef.current && activeTab !== entryScreenRef.current) {
      exitTrackedRef.current = true;
      trackEvent('first_screen_exit', { from_screen: entryScreenRef.current, to_screen: activeTab }, profile.id);
    }
  }, [activeTab, profile?.id]);

  useEffect(() => {
    if (!profile) return;
    const handler = () => {
      if (document.visibilityState === "hidden" && !exitTrackedRef.current) {
        exitTrackedRef.current = true;
        trackEvent('first_screen_exit', { from_screen: entryScreenRef.current, to_screen: null, reason: "backgrounded_or_closed" }, profile.id);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [profile?.id]);

  async function loadTodayStats(userId: string) {
    try {
      const [habitsData, logsData] = await Promise.all([getHabits(userId), getTodayLogs(userId)]);
      const { completed, total } = computeHabitProgress(habitsData || [], logsData || []);
      setTotalHabits(total);
      setCompletedToday(completed);
    } catch {}
  }

  const handleLogin = (p: Profile) => {
    entryScreenRef.current = null;
    exitTrackedRef.current = false;
    setProfile(p);
    setPrevLevel(getLevel(p.score || 0).level);
    loadTodayStats(p.id);
    touchLastSeen();
    navigate("/dashboard");
  };

  const handleProfileUpdate = (newProfile: Profile) => {
    setProfile(newProfile);
  };

  const handleLogout = async () => {
    await signOutUser();
    setProfile(null);
    navigate("/login");
  };

  const handleToggleDark = () => setIsDark((d) => !d);

  const handleLangChange = (l: Lang) => {
    setLang(l);
    localStorage.setItem("lang", l);
  };

  const handleUserClick = (userId: string) => setViewingUserId(userId);

  const handleCompletedChange = (completed: number, total: number) => {
    const wasAllDone = completedToday === totalHabits && totalHabits > 0;
    const nowAllDone = completed === total && total > 0;
    setCompletedToday(completed);
    setTotalHabits(total);
    if (!wasAllDone && nowAllDone) {
      setAllDoneToast(true);
      setTimeout(() => setAllDoneToast(false), 3500);
    }
  };

  const handleScoreChange = (delta: number) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, score: Math.max(0, (prev.score || 0) + delta) };
    });
  };

  function handleStreakMilestone(name: string, emoji: string, days: number) {
    clearTimeout(streakTimerRef.current);
    setStreakToast({ name, emoji, days });
    streakTimerRef.current = window.setTimeout(() => setStreakToast(null), 4000);
  }

  const overallPercent = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
  const langVal = buildLangValue(lang);
  const t = langVal.t;

  const now = new Date();
  const dateStr = `${DAYS_FULL[lang][now.getDay()]}, ${now.getDate()} ${MONTHS_FULL[lang][now.getMonth()]} ${now.getFullYear()}`;
  const hour = now.getHours();
  const greeting = hour < 12 ? t('greeting_morning') : hour < 17 ? t('greeting_afternoon') : t('greeting_evening');

  const renderLayout = (contentNode: React.ReactNode) => {
    if (!profile) return <Navigate to="/login" replace />;

    return (
      <div
        className="flex min-h-screen w-full"
        style={{ background: "var(--background)", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <Sidebar isDark={isDark} activeTab={activeTab} onTabChange={setActiveTab} profile={profile} onProfileClick={() => setActiveTab("profile")} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header
            className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 py-3 md:py-4"
            style={{
              background: isDark ? "rgba(14,17,23,0.85)" : "rgba(249,250,251,0.85)",
              backdropFilter: "blur(16px)",
              borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}`,
              // iPhone'da PWA standalone rejimida (black-translucent status bar)
              // sahifa tarkibi notch/Dynamic Island ostidan boshlanadi —
              // shuni qoplash uchun. Oddiy brauzer tabida env() 0 qaytaradi,
              // shuning uchun boshqa qurilmalarga ta'sir qilmaydi.
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <div>
              <h1 className="text-sm md:text-lg font-semibold leading-none" style={{ color: "var(--foreground)" }}>
                {greeting}, {profile.display_name.split(" ")[0]} 👋
              </h1>
              <p className="hidden sm:block text-xs mt-1" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {dateStr}
              </p>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Level badge */}
              {(() => {
                const lv = getLevel(profile.score || 0);
                return (
                  <button
                    onClick={() => setActiveTab("achievements")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: isDark ? `${lv.color}18` : `${lv.color}22`,
                      border: `1px solid ${lv.color}44`,
                      color: lv.color,
                    }}
                    title={t('app_level_tooltip').replace('{lvl}', String(lv.level)).replace('{name}', t(LEVEL_LABELS[lv.level] as any))}
                  >
                    <span style={{ fontSize: 14 }}>{lv.emoji}</span>
                    <span className="hidden sm:inline" style={{ fontFamily: "'Geist Mono', monospace" }}>
                      Lv.{lv.level}
                    </span>
                  </button>
                );
              })()}

              <HeaderProgress percent={overallPercent} completed={completedToday} total={totalHabits} isDark={isDark} lang={lang} />

              {/* Oxirida — shu bilan uning ochiladigan menyusi (absolute right-0)
                  ekranning haqiqiy o'ng chetiga yaqin joylashadi va mobil
                  ekranlarda chapga chiqib ketmaydi (340px kenglik) */}
              <NotificationBell isDark={isDark} profile={profile} onNavigate={setActiveTab} />
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 md:p-6 overflow-auto app-main-padding">
            {contentNode}
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
          style={{
            background: isDark ? "rgba(14,17,23,0.95)" : "rgba(249,250,251,0.97)",
            backdropFilter: "blur(16px)",
            borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
            // Home indicator (iPhone X+) tugma maydoni bilan ustma-ust
            // tushib, tugmalar bosilishi noaniq bo'lib qolmasligi uchun
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="flex items-center justify-around px-2 py-2">
            {[
              { id: "dashboard", icon: LayoutDashboard },
              { id: "logs",      icon: ClipboardList },
              { id: "habits",    icon: ListChecks },
              { id: "health",    icon: Heart },
              { id: "groups",    icon: Users },
              { id: "profile",   icon: User },
              { id: "more",      icon: MoreHorizontal },
            ].map(({ id, icon: Icon }) => {
              const mobileLabels: Record<string, string> = {
                dashboard: t('mobile_nav_home'),
                logs:      t('dash_journal'),
                habits:    t('nav_habits'),
                health:    t('mobile_nav_health'),
                groups:    t('mobile_nav_groups'),
                profile:   t('nav_profile'),
                more:      t('mobile_nav_more'),
              };
              const label = mobileLabels[id] || id;
              const isMoreTab = MOBILE_MORE_TABS.includes(activeTab);
              const active = id === "more" ? isMoreTab : (activeTab === id && !isMoreTab);
              return (
                <button
                  key={id}
                  onClick={() => id === "more" ? setShowMobileMore(true) : setActiveTab(id)}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[44px] min-h-[44px] justify-center"
                  style={{
                    background: active ? (isDark ? "rgba(74,222,128,0.12)" : "rgba(74,222,128,0.1)") : "transparent",
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.6}
                    style={{ color: active ? "#4ADE80" : "var(--muted-foreground)" }}
                  />
                  <span
                    className="text-[9px] font-medium leading-none"
                    style={{ color: active ? "#4ADE80" : "var(--muted-foreground)" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobil "Ko'proq" varag'i — Sidebar'da bor, bottom nav'da joy yo'q tablar uchun */}
        {showMobileMore && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center md:hidden"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowMobileMore(false)}
          >
            <div
              className="w-full rounded-t-3xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
              style={{ background: isDark ? "#161B22" : "#fff" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('mobile_more_title')}</h3>
                <button
                  onClick={() => setShowMobileMore(false)}
                  className="p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <CloseIcon size={18} />
                </button>
              </div>
              <div className="px-3 pb-4">
                {[
                  { id: "leaderboard", icon: Trophy, label: t('nav_leaderboard') },
                  { id: "analytics", icon: BarChart3, label: t('nav_analytics') },
                  ...(profile?.is_admin ? [{ id: "admin", icon: ShieldAlert, label: t('nav_admin') }] : []),
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); setShowMobileMore(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-all min-h-[44px]"
                    style={{
                      background: activeTab === id ? (isDark ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.08)") : "transparent",
                      color: activeTab === id ? "#4ADE80" : "var(--foreground)",
                    }}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All-done celebration toast */}
        {allDoneToast && (
          <div
            className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl"
            style={{
              transform: "translateX(-50%)",
              background: isDark ? "rgba(22,27,34,0.97)" : "#fff",
              border: "1px solid rgba(74,222,128,0.4)",
              boxShadow: "0 0 30px rgba(74,222,128,0.25)",
              animation: "slideDown 0.4s ease",
            }}
          >
            <span style={{ fontSize: 24 }}>🎉</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {t('toast_all_done_title')}
              </p>
              <p className="text-xs" style={{ color: "var(--neon-green)", fontFamily: "'Geist Mono', monospace" }}>
                {t('toast_all_done_sub').replace('{n}', String(totalHabits))}
              </p>
            </div>
          </div>
        )}

        {streakToast && (
          <div
            className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl"
            style={{
              transform: "translateX(-50%)",
              background: isDark ? "rgba(22,27,34,0.97)" : "#fff",
              border: "1px solid rgba(249,115,22,0.4)",
              boxShadow: "0 0 30px rgba(249,115,22,0.2)",
              animation: "slideDown 0.4s ease",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 24 }}>{streakToast.emoji}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {t('toast_streak_title').replace('{n}', String(streakToast.days))}
              </p>
              <p className="text-xs" style={{ color: "#F97316", fontFamily: "'Geist Mono', monospace" }}>
                {t('toast_streak_sub').replace('{name}', streakToast.name)}
              </p>
            </div>
          </div>
        )}

        {showLevelToast && profile && (
          <LevelUpToast
            level={getLevel(profile.score || 0).level}
            levelName={t(LEVEL_LABELS[getLevel(profile.score || 0).level] as any)}
            onClose={() => setShowLevelToast(false)}
          />
        )}

        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div
            className="fixed bottom-20 md:bottom-6 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
            style={{
              transform: "translateX(-50%)",
              background: isDark ? "rgba(22,27,34,0.97)" : "#fff",
              border: "1px solid rgba(74,222,128,0.3)",
              boxShadow: "0 0 30px rgba(74,222,128,0.15)",
              animation: "slideUp 0.4s ease",
              whiteSpace: "nowrap",
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "#4ADE80" }}>
              <span style={{ fontSize: 18 }}>⚡</span>
            </div>
            <div className="mr-1">
              <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                {t('pwa_install_title')}
              </p>
              <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                {t('pwa_install_sub')}
              </p>
            </div>
            <button
              onClick={async () => {
                if (!installPrompt) return;
                installPrompt.prompt();
                const { outcome } = await installPrompt.userChoice;
                if (outcome === "accepted") setInstallPrompt(null);
                setShowInstallBanner(false);
                sessionStorage.setItem("pwa-install-dismissed", "1");
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
              style={{ background: "#4ADE80", color: "#0E1117" }}
            >
              {t('pwa_install_btn')}
            </button>
            <button
              onClick={() => {
                setShowInstallBanner(false);
                sessionStorage.setItem("pwa-install-dismissed", "1");
              }}
              className="text-lg leading-none shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            >
              ×
            </button>
          </div>
        )}

        <style>{`
          @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(16px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; width: 16px; height: 16px;
            border-radius: 50%; background: white; cursor: pointer;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3); border: 2px solid rgba(0,0,0,0.1);
          }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(139,148,158,0.3); border-radius: 4px; }
        `}</style>
      </div>
    );
  };

  return (
    <LangContext.Provider value={langVal}>
      <Toaster position="top-right" richColors theme={isDark ? "dark" : "light"} />
      <Routes>
        <Route path="/login" element={
          profile ? <Navigate to="/dashboard" replace /> : <LoginPage isDark={isDark} onLogin={handleLogin} />
        } />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={renderLayout(<Dashboard isDark={isDark} profile={profile!} completedToday={completedToday} totalHabits={totalHabits} onNavigate={setActiveTab} onCompletedChange={handleCompletedChange} onUserClick={handleUserClick} />)} />
          <Route path="/habits" element={renderLayout(<HabitsManager isDark={isDark} profile={profile!} />)} />
          <Route path="/logs" element={renderLayout(
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('nav_logs')}</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {logsView === "today" ? t('logs_today_hint') : logsView === "month" ? t('logs_month_hint') : logsView === "notes" ? t('logs_notes_hint') : t('logs_weekly_hint')}
                  </p>
                </div>
                <div className="flex rounded-xl p-1" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6" }}>
                  {(["today", "month", "notes", "weekly"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setLogsView(v)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: logsView === v ? (isDark ? "rgba(255,255,255,0.1)" : "#fff") : "transparent",
                        color: logsView === v ? "var(--foreground)" : "var(--muted-foreground)",
                        boxShadow: logsView === v ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      {{ today: t('logs_tab_today'), month: t('month'), notes: t('logs_tab_notes'), weekly: t('logs_tab_weekly') }[v] ?? v}
                    </button>
                  ))}
                </div>
              </div>
              {logsView === "today"
                ? <HabitsLog isDark={isDark} profile={profile!} onCompletedChange={handleCompletedChange} onScoreChange={handleScoreChange} onStreakMilestone={handleStreakMilestone} />
                : logsView === "month"
                ? <MonthGrid isDark={isDark} profile={profile!} />
                : logsView === "notes"
                ? <DailyNotes isDark={isDark} profile={profile!} />
                : <WeeklyReflection isDark={isDark} profile={profile!} />
              }
            </div>
          )} />
          <Route path="/feed" element={renderLayout(<FeedPage isDark={isDark} profile={profile!} onUserClick={handleUserClick} />)} />
          <Route path="/groups" element={renderLayout(<GroupsPage isDark={isDark} profile={profile!} onUserClick={handleUserClick} />)} />
          <Route path="/achievements" element={renderLayout(<Achievements isDark={isDark} profile={profile!} />)} />
          <Route path="/analytics" element={renderLayout(
            <div className="max-w-2xl">
              <div className="mb-4">
                <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('analytics_page_title')}</h2>
              </div>
              <Analytics isDark={isDark} completedToday={completedToday} totalHabits={totalHabits} profile={profile!} />
            </div>
          )} />
          <Route path="/admin" element={renderLayout(profile?.is_admin ? <AdminPanel isDark={isDark} profile={profile} /> : <Navigate to="/dashboard" replace />)} />
          <Route path="/profile" element={renderLayout(<ProfilePage isDark={isDark} profile={profile!} onNavigate={setActiveTab} onUserClick={handleUserClick} onLogout={handleLogout} onToggleDark={handleToggleDark} lang={lang} onLangChange={handleLangChange} />)} />
          <Route path="/edit-profile" element={renderLayout(<EditProfilePage isDark={isDark} profile={profile!} onProfileUpdate={handleProfileUpdate} onBack={() => setActiveTab("profile")} />)} />
          <Route path="/leaderboard" element={renderLayout(<GlobalLeaderboardPage isDark={isDark} profile={profile!} onUserClick={handleUserClick} />)} />
          <Route path="/health" element={renderLayout(<HealthPage isDark={isDark} profile={profile!} />)} />
        </Route>
      </Routes>

      {viewingUserId && profile && (
        <PublicProfileModal
          isDark={isDark}
          viewingId={viewingUserId}
          myProfile={profile}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </LangContext.Provider>
  );
}