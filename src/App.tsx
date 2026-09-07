import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Capacitor } from "@capacitor/core";
import {
  LayoutGrid, ClipboardList, ListChecks, Users, BarChart3, User as UserIcon,
  Heart, MoreHorizontal, Trophy, ShieldAlert, X as CloseIcon,
  Wallet, Settings, Sun, Moon, Activity as ActivityIcon, Globe, TrendingUp, Bell as BellIcon, Loader2, CheckCircle2, Flame, Zap,
  Coins, Plus
} from "lucide-react";
import { HabitIcon } from "./components/HabitIcon";
import { soundService } from "./services/soundService";
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
import { App as CapacitorApp } from "@capacitor/app";
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
import { JournalPage } from "./pages/JournalPage";
import { Store } from "./pages/Store";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { supabase } from "./services/supabase";
import { getProfileById, signOutUser, getHabits, getTodayLogs, touchLastSeen, computeHabitProgress, addHabit } from "./services/db";
import type { Profile } from "./services/supabase";
import { LangContext, buildLangValue, type Lang } from "./store/LangContext";
import { useUser } from "./store/UserContext";
import { MONTHS_FULL, DAYS_FULL } from "./utils/i18n";
import { trackEvent } from "./utils/analytics";
import { Toaster, toast } from "sonner";
import { useMobileLifecycle } from "./hooks/useMobileLifecycle";
import { nativeNotificationService } from "./services/nativeNotificationService";
import { notificationService } from "./services/notificationService";
import { useHaptics } from "./hooks/useHaptics";
import { AddHabitModal } from "./components/AddHabitModal";
import { useQueryClient } from "@tanstack/react-query";

import { useTheme } from "./store/ThemeContext";

const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5", "level_6", "level_7", "level_8", "level_9", "level_10"] as const;

function HeaderProgress({ percent, completed, total, isDark, lang }: { percent: number; completed: number; total: number; isDark: boolean; lang: Lang }) {
  const t = buildLangValue(lang).t;
  return (
    <div className="flex flex-col justify-center w-24 sm:w-32">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold tracking-tight uppercase text-muted-foreground">
          {t('today')}
        </span>
        <span className="text-[10px] font-bold text-primary">
          {percent}%
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.3)]"
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}


export default function App() {
  const { isDark, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("lang") as Lang) || "uz"; } catch { return "uz"; }
  });
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [logsView, setLogsView] = useState<"today" | "month" | "notes" | "weekly">("today");
  const [completedToday, setCompletedToday] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);

  const { profile, setProfile, refreshUserProfile, loading: userLoading } = useUser();

  const [allDoneToast, setAllDoneToast] = useState(false);
  const [streakToast, setStreakToast] = useState<{ name: string; emoji: string; days: number } | null>(null);
  const [showLevelToast, setShowLevelToast] = useState(false);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const streakTimerRef = useRef<number | undefined>(undefined);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { selectionChanged } = useHaptics();

  useEffect(() => {
    notificationService.createNotificationChannel();

    // 1. Supabase Auth Event Listener for Password Recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });

    // 2. Capacitor Deep Link Listener
    const urlListener = CapacitorApp.addListener('appUrlOpen', async (data) => {
      const url = new URL(data.url);
      // Check if the URL matches our reset password pattern
      if (url.pathname.includes('reset-password') || url.hash.includes('type=recovery')) {
        setIsResettingPassword(true);
      }
    });

    return () => {
      subscription.unsubscribe();
      urlListener.then(l => l.remove());
    };
  }, []);

  // Mobile lifecycle management (status bar, back button, keyboard, health sync)
  useMobileLifecycle({ isDark, profileId: profile?.id });

  const currentPath = location.pathname.substring(1);

  const activeTab = currentPath || "dashboard";
  const setActiveTab = (tabId: string) => {
    if (tabId !== activeTab) {
      soundService.play('tab_click');
    }
    navigate(`/${tabId}`);
  };

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
    document.body.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

    if (profile) {
      // Sync prevLevel from localStorage or current level on first load
      if (prevLevel === null) {
        const currentLevel = getLevel(profile.score || 0).level;
        const savedLevel = localStorage.getItem(`last_known_level_${profile.id}`);
        setPrevLevel(savedLevel ? Number(savedLevel) : currentLevel);
        if (!savedLevel) {
          localStorage.setItem(`last_known_level_${profile.id}`, String(currentLevel));
        }
      }

      if (location.pathname === "/login" || location.pathname === "/") {
        navigate("/dashboard");
      }
      loadTodayStats(profile.id);
      touchLastSeen();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile) return;

    // Strict boot-time daily reminder scheduling (called ONCE per app boot / profile load)
    if (Capacitor.isNativePlatform()) {
      let settings: { enabled?: boolean; time?: string } = {};
      try {
        settings = JSON.parse(localStorage.getItem(`notif_${profile.id}`) || "{}");
      } catch {
        settings = {};
      }

      if (settings.enabled && settings.time) {
        const [h, m] = settings.time.split(":").map(Number);
        notificationService.scheduleDailyReminder(h, m);
      } else if (settings.enabled === false) {
        notificationService.cancelDailyReminder();
      } else {
        // Default: schedule daily reminder at 21:00 once per day
        notificationService.scheduleDailyReminder(21, 0);
      }
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || prevLevel === null) return;
    const currentLevel = getLevel(profile.score || 0).level;
    if (currentLevel > prevLevel) {
      setShowLevelToast(true);
      setPrevLevel(currentLevel);
      localStorage.setItem(`last_known_level_${profile.id}`, String(currentLevel));
      soundService.play('streak_levelup');
    } else if (currentLevel < prevLevel) {
      setPrevLevel(currentLevel);
      localStorage.setItem(`last_known_level_${profile.id}`, String(currentLevel));
    }
  }, [profile?.score, prevLevel, profile?.id]);

  // Screen-view + first-screen-exit tracking (drop-off analysis).
  // entryScreenRef captures the very first screen a session lands on;
  // the first time the user navigates away from it (or backgrounds/closes
  // the tab while still on it), a single "first_screen_exit" event fires.
  useEffect(() => {
    if (!profile) return;
    trackEvent('screen_view', { screen: activeTab }, profile.id);

    // Refresh user profile on tab switch to ensure coins are up to date
    refreshUserProfile();

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

  const handleToggleDark = () => setTheme(isDark ? 'light' : 'dark');

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
    soundService.play('streak_levelup');
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
    try {
      if (!profile) return <Navigate to="/login" replace />;

      return (
        <div
          className="flex min-h-screen w-full bg-background"
        >
          <Sidebar isDark={isDark} activeTab={activeTab} onTabChange={setActiveTab} profile={profile} onProfileClick={() => setActiveTab("profile")} />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header
              className="sticky top-0 z-40 w-full glass border-b border-border px-4 py-3 pb-4"
              style={{
                paddingTop: "calc(0.75rem + env(safe-area-inset-top, 16px))",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className="active:scale-95 transition-transform"
                  >
                    {profile.avatar_url ? (
                      <div className="w-10 h-10 rounded-2xl border-2 border-primary/20 overflow-hidden shadow-sm flex-shrink-0">
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-sm shadow-sm flex-shrink-0">
                        {(profile.display_name || profile.full_name || 'A')[0].toUpperCase()}
                      </div>
                    )}
                  </button>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {greeting}
                    </p>
                    <p className="text-sm font-bold truncate max-w-[120px]">
                      {(profile.display_name || profile.full_name || "User").split(" ")[0]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Coins Pill */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("store")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Coins size={14} className="fill-amber-500/20" />
                    <span className="text-xs font-black tracking-tight">{profile.coins || 0}</span>
                  </button>

                  {/* Level badge pill */}
                  {(() => {
                    const lv = getLevel(profile.score || 0);
                    return (
                      <button
                        onClick={() => setActiveTab("achievements")}
                        className="flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 transition-all hover:bg-primary/20"
                        style={{ color: lv.color }}
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 overflow-hidden">
                          <HabitIcon emoji={lv.icon} size={10} noWrapper />
                        </div>
                        <span className="text-[10px] font-black tracking-tighter">LVL {lv.level}</span>
                      </button>
                    );
                  })()}

                  <NotificationBell isDark={isDark} profile={profile} onNavigate={setActiveTab} onUserClick={handleUserClick} />
                </div>
              </div>

              {/* XP Progress Bar below header content */}
              <div className="mt-3">
                 {(() => {
                    const lv = getLevel(profile.score || 0);
                    const nextThresh = lv.next || (profile.score || 0);
                    const percent = lv.next ? Math.min(100, Math.round(((profile.score || 0) - lv.prevThreshold) / (nextThresh - lv.prevThreshold) * 100)) : 100;
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>{lv.label}</span>
                          <span>{profile.score || 0} / {nextThresh} XP</span>
                        </div>
                        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full"
                          />
                        </div>
                      </div>
                    );
                 })()}
              </div>

            </header>

            {/* Content */}
            <main className="flex-1 px-4 pt-4 pb-32 overflow-y-auto bg-background app-main-padding">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto"
                >
                  {contentNode}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

          {/* Mobile floating bottom navigation */}
          <nav
            className="fixed bottom-5 left-4 right-4 z-30 md:hidden bg-slate-950/85 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl px-2 py-1.5"
          >
            <div className="flex items-center justify-between h-16 relative">
              {/* Item 1: Bosh sahifa */}
              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-90 relative cursor-pointer"
              >
                {activeTab === "dashboard" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <LayoutGrid
                  size={20}
                  strokeWidth={activeTab === "dashboard" ? 2.5 : 1.8}
                  className="relative transition-all duration-300"
                  style={{ color: activeTab === "dashboard" ? "var(--primary)" : "var(--muted-foreground)" }}
                />
                <span
                  className="relative text-[10px] font-bold mt-1 transition-all duration-300 tracking-tight"
                  style={{ color: activeTab === "dashboard" ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  Bosh sahifa
                </span>
              </button>

              {/* Item 2: Odatlar */}
              <button
                type="button"
                onClick={() => setActiveTab("habits")}
                className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-90 relative cursor-pointer"
              >
                {activeTab === "habits" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <ListChecks
                  size={20}
                  strokeWidth={activeTab === "habits" ? 2.5 : 1.8}
                  className="relative transition-all duration-300"
                  style={{ color: activeTab === "habits" ? "var(--primary)" : "var(--muted-foreground)" }}
                />
                <span
                  className="relative text-[10px] font-bold mt-1 transition-all duration-300 tracking-tight"
                  style={{ color: activeTab === "habits" ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  Odatlar
                </span>
              </button>

              {/* Item 3 (Center): Elevated Prominent "+" Action Button */}
              <div className="flex flex-col items-center justify-center flex-1 h-full relative">
                <button
                  type="button"
                  onClick={() => {
                    soundService.play('tab_click');
                    setShowAddHabitModal(true);
                  }}
                  aria-label="Yangi odat qo'shish"
                  className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/40 flex items-center justify-center transition-all active:scale-90 hover:scale-105 relative -mt-6 border-4 border-slate-950 cursor-pointer shrink-0"
                >
                  <Plus size={24} strokeWidth={3} className="text-slate-950" />
                </button>
              </div>

              {/* Item 4: Statistika */}
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-90 relative cursor-pointer"
              >
                {activeTab === "analytics" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <BarChart3
                  size={20}
                  strokeWidth={activeTab === "analytics" ? 2.5 : 1.8}
                  className="relative transition-all duration-300"
                  style={{ color: activeTab === "analytics" ? "var(--primary)" : "var(--muted-foreground)" }}
                />
                <span
                  className="relative text-[10px] font-bold mt-1 transition-all duration-300 tracking-tight"
                  style={{ color: activeTab === "analytics" ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  Statistika
                </span>
              </button>

              {/* Item 5: Profil */}
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-90 relative cursor-pointer"
              >
                {activeTab === "profile" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <UserIcon
                  size={20}
                  strokeWidth={activeTab === "profile" ? 2.5 : 1.8}
                  className="relative transition-all duration-300"
                  style={{ color: activeTab === "profile" ? "var(--primary)" : "var(--muted-foreground)" }}
                />
                <span
                  className="relative text-[10px] font-bold mt-1 transition-all duration-300 tracking-tight"
                  style={{ color: activeTab === "profile" ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  Profil
                </span>
              </button>
            </div>
          </nav>



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
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="text-emerald-400 w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  Kunlik maqsad bajarildi
                </p>
                <p className="text-xs" style={{ color: "var(--neon-green)", fontFamily: "'Geist Mono', monospace" }}>
                  Barcha {totalHabits} ta odat yakunlandi
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
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Flame className="text-orange-500 w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  {streakToast.days} kunlik seriya
                </p>
                <p className="text-xs" style={{ color: "#F97316", fontFamily: "'Geist Mono', monospace" }}>
                  {streakToast.name} odati bo'yicha
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
                <Zap size={18} strokeWidth={3} color="#0E1117" />
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
    } catch (e: any) {
      console.error("Layout Render Error:", e);
      return (
        <div className="p-10 text-center text-white bg-[#0E1117] min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-xl font-bold mb-4">Render hatosi yuz berdi</h1>
          <div className="w-full max-w-md text-left bg-black/40 p-4 rounded-xl border border-red-500/20 overflow-auto max-h-96">
            <p className="text-red-400 text-xs font-mono whitespace-pre-wrap">
              {e?.toString()}
              {"\n\n"}
              {e?.stack}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-primary text-white font-bold rounded-xl active:scale-95 transition-transform"
          >
            Qayta yuklash
          </button>
        </div>
      );
    }

  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0E1117]">
        <Loader2 size={32} className="animate-spin text-[#4ADE80]" />
      </div>
    );
  }

  if (isResettingPassword) {
    return (
      <LangContext.Provider value={langVal}>
        <Toaster position="top-right" richColors theme={isDark ? "dark" : "light"} />
        <ResetPasswordPage onComplete={() => setIsResettingPassword(false)} />
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={langVal}>
      <Toaster position="top-right" richColors theme={isDark ? "dark" : "light"} />
      <Routes>
        <Route path="/login" element={
          profile ? <Navigate to="/dashboard" replace /> : <LoginPage isDark={isDark} onLogin={handleLogin} />
        } />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={renderLayout(<Dashboard isDark={isDark} profile={profile!} completedToday={completedToday} totalHabits={totalHabits} onNavigate={setActiveTab} onCompletedChange={handleCompletedChange} onUserClick={handleUserClick} onProfileUpdate={handleProfileUpdate} />)} />
          <Route path="/habits" element={renderLayout(<HabitsManager isDark={isDark} profile={profile!} />)} />
          <Route path="/journal" element={renderLayout(
            <JournalPage
              isDark={isDark}
              profile={profile!}
              onCompletedChange={handleCompletedChange}
              onScoreChange={handleScoreChange}
              onStreakMilestone={handleStreakMilestone}
            />
          )} />
          <Route path="/logs" element={<Navigate to="/journal" replace />} />
          <Route path="/feed" element={renderLayout(<FeedPage isDark={isDark} profile={profile!} onUserClick={handleUserClick} />)} />
          <Route path="/groups" element={renderLayout(<GroupsPage isDark={isDark} profile={profile!} onUserClick={handleUserClick} />)} />
          <Route path="/achievements" element={renderLayout(<Achievements isDark={isDark} profile={profile!} />)} />
          <Route path="/analytics" element={renderLayout(
            <div className="max-w-2xl">
              <Analytics
                isDark={isDark}
                completedToday={completedToday}
                totalHabits={totalHabits}
                profile={profile!}
                onUserClick={handleUserClick}
                onProfileUpdate={handleProfileUpdate}
              />
            </div>
          )} />
          <Route path="/admin" element={renderLayout(profile?.is_admin ? <AdminPanel isDark={isDark} profile={profile} /> : <Navigate to="/dashboard" replace />)} />
          <Route path="/profile" element={renderLayout(
            profile ? (
              <ProfilePage isDark={isDark} profile={profile} onNavigate={setActiveTab} onUserClick={handleUserClick} onLogout={handleLogout} lang={lang} onLangChange={handleLangChange} onProfileUpdate={handleProfileUpdate} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
              </div>
            )
          )} />
          <Route path="/edit-profile" element={renderLayout(<EditProfilePage isDark={isDark} profile={profile!} onProfileUpdate={handleProfileUpdate} onBack={() => setActiveTab("profile")} />)} />
          <Route path="/leaderboard" element={renderLayout(<GlobalLeaderboardPage isDark={isDark} profile={profile!} onUserClick={handleUserClick} />)} />
          <Route path="/health" element={renderLayout(<HealthPage isDark={isDark} profile={profile!} />)} />
          <Route path="/store" element={renderLayout(<Store isDark={isDark} profile={profile!} onProfileUpdate={handleProfileUpdate} />)} />
          <Route path="/shop" element={<Navigate to="/store" replace />} />
          <Route path="/settings" element={renderLayout(<SettingsPage profile={profile!} onProfileUpdate={handleProfileUpdate} onLogout={handleLogout} onNavigate={setActiveTab} lang={lang} onLangChange={handleLangChange} isDark={isDark} />)} />
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

      {showLevelToast && profile && (
        <LevelUpToast
          level={getLevel(profile.score || 0).level}
          levelName={getLevel(profile.score || 0).label}
          onClose={() => setShowLevelToast(false)}
        />
      )}

      {showAddHabitModal && profile && (
        <AddHabitModal
          isOpen={showAddHabitModal}
          isDark={isDark}
          onClose={() => setShowAddHabitModal(false)}
          onAdd={async (habitData) => {
            try {
              const habit = await addHabit(
                profile.id,
                habitData.name,
                habitData.emoji,
                habitData.type,
                habitData.target_value,
                habitData.unit,
                habitData.scheduledStart,
                habitData.scheduledEnd,
                habitData.description
              );
              if (habitData.reminder && habit?.id) {
                localStorage.setItem(`reminder_${habit.id}`, habitData.reminder);
                await notificationService.initNotifications();
                await notificationService.scheduleHabitReminder(habit.id, habitData.name, habitData.reminder);
              }
              queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
              setShowAddHabitModal(false);
              toast.success("Yangi odat muvaffaqiyatli qo'shildi!");
            } catch (err: any) {
              toast.error(err?.message || "Odat qo'shishda xatolik yuz berdi");
            }
          }}
        />
      )}
    </LangContext.Provider>
  );
}