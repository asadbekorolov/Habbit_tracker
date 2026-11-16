import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Capacitor } from "@capacitor/core";
import {
  LayoutGrid, ClipboardList, ListChecks, Users, BarChart3, User as UserIcon,
  Heart, MoreHorizontal, Trophy, ShieldAlert, X as CloseIcon,
  Wallet, Settings, Sun, Moon, Activity as ActivityIcon, Globe, TrendingUp, Bell as BellIcon, Loader2, CheckCircle2, Flame, Zap,
  Coins, Plus, Home, CheckSquare, BookOpen
} from "lucide-react";
import { HabitIcon } from "./components/HabitIcon";
import { soundService } from "./services/soundService";
import { getLevel } from "./utils/levels";
import { Sidebar } from "./components/Sidebar";

import { NotificationBell } from "./components/NotificationBell";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Dashboard } from "./features/dashboard/Dashboard";
import { MonthGrid } from "./features/dashboard/MonthGrid";
import { DailyNotes } from "./features/dashboard/DailyNotes";

import { WeeklyReflection } from "./features/dashboard/WeeklyReflection";

import { supabase } from "./services/supabase";
import { getProfileById, signOutUser, touchLastSeen, computeHabitProgress, addHabit } from "./services/db";
import { clearQueryCache } from "./services/queryClient";
import { useHabitsQuery, useDayLogsQuery, habitCache } from "./hooks/queries";
import { toDateStr } from "./utils/date";
import type { Profile } from "./services/supabase";
import { LangContext, buildLangValue, type Lang } from "./store/LangContext";
import { useUser } from "./store/UserContext";
import { MONTHS_FULL, DAYS_FULL, isLangLoaded, loadLang } from "./utils/i18n";
import { trackEvent } from "./utils/analytics";
import { Toaster, toast } from "sonner";
import { useMobileLifecycle } from "./hooks/useMobileLifecycle";
import { nativeNotificationService } from "./services/nativeNotificationService";
import { notificationService } from "./services/notificationService";
import { useHaptics } from "./hooks/useHaptics";

import { useQueryClient } from "@tanstack/react-query";

// Lazy-loaded routes for code splitting & instant rendering
const HabitsManager = lazy(() => import("./features/habits/HabitsManager").then(m => ({ default: m.HabitsManager })));
const Analytics = lazy(() => import("./features/analytics/Analytics").then(m => ({ default: m.Analytics })));
const SettingsPage = lazy(() => import("./features/profile/SettingsPage").then(m => ({ default: m.SettingsPage })));
const GlobalLeaderboardPage = lazy(() => import("./features/leaderboard/GlobalLeaderboardPage").then(m => ({ default: m.GlobalLeaderboardPage })));
const ProfilePage = lazy(() => import("./features/profile/ProfilePage").then(m => ({ default: m.ProfilePage })));
const Achievements = lazy(() => import("./features/profile/Achievements").then(m => ({ default: m.Achievements })));
const AdminPanel = lazy(() => import("./features/admin/AdminPanel").then(m => ({ default: m.AdminPanel })));
const GroupsPage = lazy(() => import("./features/groups/GroupsPage").then(m => ({ default: m.GroupsPage })));
const FeedPage = lazy(() => import("./features/feed/FeedPage").then(m => ({ default: m.FeedPage })));
const EditProfilePage = lazy(() => import("./features/profile/EditProfilePage").then(m => ({ default: m.EditProfilePage })));
const HealthPage = lazy(() => import("./features/habits/HealthPage").then(m => ({ default: m.HealthPage })));
const JournalPage = lazy(() => import("./pages/JournalPage").then(m => ({ default: m.JournalPage })));
const Store = lazy(() => import("./pages/Store").then(m => ({ default: m.Store })));
// Ilova ochilishida kerak bo'lmaydigan ekranlar va modallar ham alohida bo'lak.
const LoginPage = lazy(() => import("./features/auth/LoginPage").then(m => ({ default: m.LoginPage })));
const AuthCallback = lazy(() => import("./features/auth/AuthCallback").then(m => ({ default: m.AuthCallback })));
const ResetPasswordPage = lazy(() => import("./features/auth/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })));
const LevelUpToast = lazy(() => import("./components/LevelUpToast").then(m => ({ default: m.LevelUpToast })));
const PublicProfileModal = lazy(() => import("./components/PublicProfileModal").then(m => ({ default: m.PublicProfileModal })));
const AddHabitModal = lazy(() => import("./components/AddHabitModal").then(m => ({ default: m.AddHabitModal })));
const BiometricsOnboardingModal = lazy(() => import("./components/BiometricsOnboardingModal").then(m => ({ default: m.BiometricsOnboardingModal })));

function ScreenSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 animate-pulse pt-2">
      <div className="h-28 bg-slate-800/50 rounded-3xl w-full border border-white/5" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-slate-800/40 rounded-2xl w-full" />
        <div className="h-24 bg-slate-800/40 rounded-2xl w-full" />
      </div>
      <div className="h-44 bg-slate-800/40 rounded-3xl w-full" />
    </div>
  );
}

const LEVEL_LABELS = ["", "level_1", "level_2", "level_3", "level_4", "level_5", "level_6", "level_7", "level_8", "level_9", "level_10"] as const;

export default function App() {
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("lang") as Lang) || "uz"; } catch { return "uz"; }
  });
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);

  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showBiometricsOnboarding, setShowBiometricsOnboarding] = useState(false);

  const { profile, setProfile, refreshUserProfile, loading: userLoading, isPasswordRecovery: isResettingPassword, setPasswordRecovery: setIsResettingPassword } = useUser();

  const [allDoneToast, setAllDoneToast] = useState(false);
  const [streakToast, setStreakToast] = useState<{ name: string; emoji: string; days: number } | null>(null);
  const [showLevelToast, setShowLevelToast] = useState(false);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const streakTimerRef = useRef<number | undefined>(undefined);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Biometrics Onboarding popup trigger (only for new registrations / uncompleted first visits)
  useEffect(() => {
    if (!profile) {
      setShowBiometricsOnboarding(false);
      return;
    }

    const isCompleted = localStorage.getItem(`biometrics_completed_${profile.id}`) === 'true';
    const hasAllFields = !!(profile.birth_date && profile.height_cm && profile.weight_kg);

    if (hasAllFields) {
      try {
        localStorage.setItem(`biometrics_completed_${profile.id}`, 'true');
      } catch {}
      setShowBiometricsOnboarding(false);
    } else if (!isCompleted) {
      setShowBiometricsOnboarding(true);
    } else {
      setShowBiometricsOnboarding(false);
    }
  }, [profile?.id, profile?.birth_date, profile?.height_cm, profile?.weight_kg]);

  // Dynamic Keyboard Visibility listener to hide bottom dock while typing
  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    if (Capacitor.isNativePlatform()) {
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        showListener = Keyboard.addListener('keyboardWillShow', () => setIsKeyboardVisible(true));
        hideListener = Keyboard.addListener('keyboardWillHide', () => setIsKeyboardVisible(false));
      }).catch(() => {});
    }

    const handleResize = () => {
      if (window.visualViewport) {
        setIsKeyboardVisible(window.visualViewport.height < window.innerHeight - 150);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      showListener?.then?.((h: any) => h.remove());
      hideListener?.then?.((h: any) => h.remove());
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useEffect(() => {
    notificationService.createNotificationChannel();

    // Auth hodisalari (sessiya, PASSWORD_RECOVERY) — UserContext'dagi yagona
    // tinglovchida. Bu yerda faqat Capacitor deep link'lari.
    const urlListener = CapacitorApp.addListener('appUrlOpen', async (data) => {
      const rawUrl = data.url;

      if (
        rawUrl.startsWith('com.idrok.app://') ||
        rawUrl.includes('auth-callback') ||
        rawUrl.includes('login-callback')
      ) {
        try {
          await Browser.close();
        } catch (_) {}

        const normalizedUrl = rawUrl.replace('com.idrok.app://', 'https://idrok.app/');
        let parsedUrl: URL | null = null;
        try {
          parsedUrl = new URL(normalizedUrl);
        } catch {}

        if (parsedUrl) {
          if (parsedUrl.hash) {
            const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              // Muvaffaqiyatda SIGNED_IN hodisasi profilni o'zi yangilaydi.
              if (error) console.error('Failed to set Supabase session from hash:', error.message);
              return;
            }
          }

          const code = parsedUrl.searchParams.get('code');
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) console.error('Failed to exchange code for session:', error.message);
          }
        }
      }

      if (rawUrl.includes('reset-password') || rawUrl.includes('type=recovery')) {
        setIsResettingPassword(true);
      }
    });

    return () => {
      urlListener.then(l => l.remove());
    };
  }, [setIsResettingPassword]);

  // Mobile lifecycle management (status bar, hardware back button, health sync)
  useMobileLifecycle({ profileId: profile?.id });

  // Navbat serverdan haqiqiy balans/darajani qaytarganda header'dagi
  // optimistik qiymatlarni server qiymati bilan almashtiramiz.
  useEffect(() => {
    const onSynced = (e: Event) => {
      const r = (e as CustomEvent).detail?.result;
      if (!r || typeof r.coins !== 'number') return;
      setProfile((prev) => prev ? {
        ...prev,
        coins: r.coins,
        score: r.score ?? prev.score,
        total_xp: r.total_xp ?? prev.total_xp,
        current_level: r.level ?? prev.current_level,
      } : prev);
    };
    window.addEventListener('habit-sync-success', onSynced);
    return () => window.removeEventListener('habit-sync-success', onSynced);
  }, []);

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
      touchLastSeen();
    }
  }, [profile?.id]);

  // Bugungi progress — React Query keshidan (navbatdagi belgilar bilan).
  const todayStr = toDateStr();
  const { data: statsHabits } = useHabitsQuery(profile?.id);
  const { data: statsTodayLogs } = useDayLogsQuery(profile?.id, todayStr);
  useEffect(() => {
    if (!statsHabits || !statsTodayLogs) return;
    const { completed, total } = computeHabitProgress(statsHabits, statsTodayLogs);
    setTotalHabits(total);
    setCompletedToday(completed);
  }, [statsHabits, statsTodayLogs]);

  useEffect(() => {
    if (!profile) return;

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

  useEffect(() => {
    if (!profile) return;
    trackEvent('screen_view', { screen: activeTab }, profile.id);
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


  const handleLogin = (p: Profile) => {
    entryScreenRef.current = null;
    exitTrackedRef.current = false;
    setProfile(p);
    setPrevLevel(getLevel(p.score || 0).level);
    touchLastSeen();
    navigate("/dashboard");
  };

  const handleProfileUpdate = (newProfile: Profile) => {
    setProfile(newProfile);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.warn("Logout warning:", e);
    }
    setProfile(null);
    localStorage.removeItem("user_profile_latest");
    await clearQueryCache();
    navigate("/login", { replace: true });
  };

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

  // ru/en lug'ati alohida bo'lak: tanlanganda yuklanadi, so'ng qayta chiziladi.
  const [, setLangLoadedTick] = useState(0);
  useEffect(() => {
    if (isLangLoaded(lang)) return;
    let alive = true;
    loadLang(lang).then(() => { if (alive) setLangLoadedTick((n) => n + 1); });
    return () => { alive = false; };
  }, [lang]);

  const langVal = buildLangValue(lang);
  const t = langVal.t;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t('greeting_morning') : hour < 17 ? t('greeting_afternoon') : t('greeting_evening');

  const renderLayout = (contentNode: React.ReactNode) => {
    try {
      if (!profile) return <Navigate to="/login" replace />;

      return (
        <div className="flex min-h-screen w-full bg-background">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} profile={profile} onProfileClick={() => setActiveTab("profile")} />

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

                  <NotificationBell profile={profile} onNavigate={setActiveTab} onUserClick={handleUserClick} />
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
            <main className="flex-1 px-4 pt-4 pb-36 md:pb-4 overflow-y-auto bg-background app-main-padding">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-2xl mx-auto"
                >
                  <Suspense fallback={<ScreenSkeleton />}>
                    {contentNode}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

          {/* Dock ostidagi bo'shliqni yopuvchi qatlam: skroll paytida kontent
              dock atrofidan ko'rinib qolmasligi uchun */}
          {!isKeyboardVisible && (
            <div
              aria-hidden="true"
              className="fixed bottom-0 inset-x-0 z-30 md:hidden pointer-events-none bg-gradient-to-t from-[#090d16] via-[#090d16]/95 to-transparent"
              style={{ height: "calc(7rem + env(safe-area-inset-bottom))" }}
            />
          )}

          {/* Mobile floating bottom navigation (Icon-Only Minimalist Dock) - Dynamically hidden when virtual keyboard opens */}
          {!isKeyboardVisible && (
            <nav
              className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto md:hidden bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 rounded-full py-2.5 px-4 transition-all duration-200"
            >
              <div className="flex items-center justify-around w-full">
                {[
                  { id: "dashboard", label: "Asosiy", icon: Home },
                  { id: "journal", label: "Kundalik", icon: BookOpen },
                  { id: "analytics", label: "Tahlil", icon: BarChart3 },
                  { id: "profile", label: "Profil", icon: UserIcon },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-label={tab.label}
                      whileTap={{ scale: 0.9 }}
                      className="relative flex items-center justify-center flex-1 py-2 px-3 rounded-2xl transition-all duration-200 cursor-pointer group"
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-pill"
                          className="absolute inset-0 bg-emerald-500/15 border border-emerald-500/25 rounded-2xl shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon
                        className={`w-6 h-6 relative z-10 transition-all duration-200 ${
                          isActive
                            ? "text-emerald-400 scale-110"
                            : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      />
                    </motion.button>
                  );
                })}
              </div>
            </nav>
          )}

          {/* All-done celebration toast */}
          {allDoneToast && (
            <div
              className="fixed top-20 left-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl"
              style={{
                transform: "translateX(-50%)",
                background: "rgba(22,27,34,0.97)",
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
                background: "rgba(22,27,34,0.97)",
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
            <Suspense fallback={null}>
              <LevelUpToast
                level={getLevel(profile.score || 0).level}
                levelName={t(LEVEL_LABELS[getLevel(profile.score || 0).level] as any)}
                onClose={() => setShowLevelToast(false)}
              />
            </Suspense>
          )}

          {/* PWA Install Banner */}
          {showInstallBanner && (
            <div
              className="fixed bottom-20 md:bottom-6 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
              style={{
                transform: "translateX(-50%)",
                background: "rgba(22,27,34,0.97)",
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

  if (userLoading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0E1117]">
        <Loader2 size={32} className="animate-spin text-[#4ADE80]" />
      </div>
    );
  }

  if (isResettingPassword) {
    return (
      <LangContext.Provider value={langVal}>
        <Toaster position="top-right" richColors theme={"dark"} />
        <Suspense fallback={<ScreenSkeleton />}>
          <ResetPasswordPage onComplete={() => setIsResettingPassword(false)} />
        </Suspense>
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={langVal}>
      <Toaster position="top-right" richColors theme={"dark"} />
      <Routes>
        <Route path="/login" element={
          profile ? <Navigate to="/dashboard" replace /> : (
            <Suspense fallback={<ScreenSkeleton />}>
              <LoginPage onLogin={handleLogin} />
            </Suspense>
          )
        } />
        <Route path="/auth/callback" element={
          <Suspense fallback={<ScreenSkeleton />}>
            <AuthCallback />
          </Suspense>
        } />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={renderLayout(<Dashboard completedToday={completedToday} totalHabits={totalHabits} onNavigate={setActiveTab} onCompletedChange={handleCompletedChange} onUserClick={handleUserClick} onProfileUpdate={handleProfileUpdate} />)} />
          <Route path="/habits" element={renderLayout(<HabitsManager />)} />
          <Route path="/journal" element={renderLayout(
            <JournalPage
              onCompletedChange={handleCompletedChange}
              onScoreChange={handleScoreChange}
              onStreakMilestone={handleStreakMilestone}
            />
          )} />
          <Route path="/logs" element={<Navigate to="/journal" replace />} />
          <Route path="/feed" element={renderLayout(<FeedPage onUserClick={handleUserClick} />)} />
          <Route path="/groups" element={renderLayout(<GroupsPage onUserClick={handleUserClick} />)} />
          <Route path="/achievements" element={renderLayout(<Achievements />)} />
          <Route path="/analytics" element={renderLayout(
            <div className="max-w-2xl">
              <Analytics
                completedToday={completedToday}
                totalHabits={totalHabits}
                onUserClick={handleUserClick}
                onProfileUpdate={handleProfileUpdate}
              />
            </div>
          )} />
          <Route path="/admin" element={renderLayout(profile?.is_admin ? <AdminPanel profile={profile} /> : <Navigate to="/dashboard" replace />)} />
          <Route path="/profile" element={renderLayout(
            profile ? (
              <ProfilePage onNavigate={setActiveTab} onUserClick={handleUserClick} onLogout={handleLogout} lang={lang} onLangChange={handleLangChange} onProfileUpdate={handleProfileUpdate} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
              </div>
            )
          )} />
          <Route path="/edit-profile" element={renderLayout(<EditProfilePage onProfileUpdate={handleProfileUpdate} onBack={() => setActiveTab("profile")} />)} />
          <Route path="/leaderboard" element={renderLayout(<GlobalLeaderboardPage onUserClick={handleUserClick} />)} />
          <Route path="/health" element={renderLayout(<HealthPage />)} />
          <Route path="/store" element={renderLayout(<Store onProfileUpdate={handleProfileUpdate} />)} />
          <Route path="/shop" element={<Navigate to="/store" replace />} />
          <Route path="/settings" element={renderLayout(<SettingsPage onProfileUpdate={handleProfileUpdate} onLogout={handleLogout} onNavigate={setActiveTab} lang={lang} onLangChange={handleLangChange} />)} />
        </Route>
      </Routes>

      <Suspense fallback={null}>
      {viewingUserId && profile && (
        <PublicProfileModal
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
              habitCache.added(queryClient, profile.id, habit);
              setShowAddHabitModal(false);
              toast.success("Yangi odat muvaffaqiyatli qo'shildi!");
            } catch (err: any) {
              toast.error(err?.message || "Odat qo'shishda xatolik yuz berdi");
            }
          }}
        />
      )}

      {profile && showBiometricsOnboarding && (
        <BiometricsOnboardingModal
          isOpen={showBiometricsOnboarding}
          profile={profile}
          onProfileUpdate={(updated) => {
            if (profile?.id) {
              try {
                localStorage.setItem(`biometrics_completed_${profile.id}`, 'true');
              } catch {}
            }
            setShowBiometricsOnboarding(false);
            handleProfileUpdate(updated);
          }}
          onClose={() => {
            if (profile?.id) {
              try {
                localStorage.setItem(`biometrics_completed_${profile.id}`, 'true');
              } catch {}
            }
            setShowBiometricsOnboarding(false);
          }}
          allowDismiss={true}
        />
      )}
      </Suspense>
    </LangContext.Provider>
  );
}
