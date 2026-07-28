import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Zap,
  ListChecks,
  Users,
  Star,
  Award,
  ShieldAlert,
  User,
  Heart,
  MessageSquarePlus,
} from "lucide-react";
import { Trophy } from "lucide-react";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";
import { FeedbackModal } from "./FeedbackModal";

interface SidebarProps {
  isDark: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  profile: Profile;
  onProfileClick?: () => void;
}

export function Sidebar({ isDark, activeTab, onTabChange, profile, onProfileClick }: SidebarProps) {
  const { t } = useLang();
  const [showFeedback, setShowFeedback] = useState(false);

  const navItems = [
    { id: "dashboard", label: t('nav_dashboard'), icon: LayoutDashboard },
    { id: "logs", label: t('nav_logs'), icon: ClipboardList },
    { id: "habits", label: t('nav_habits'), icon: ListChecks },
    { id: "health", label: t('nav_health'), icon: Heart },
    { id: "groups", label: t('nav_groups'), icon: Users },
    { id: "leaderboard", label: t('nav_leaderboard'), icon: Trophy },
    { id: "achievements", label: t('nav_achievements'), icon: Award },
    { id: "analytics", label: t('nav_analytics'), icon: BarChart3 },
    { id: "profile", label: t('nav_profile'), icon: User },
  ];

  const initials = profile.display_name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const visibleNavItems = profile.is_admin
    ? [...navItems, { id: "admin", label: t('nav_admin'), icon: ShieldAlert }]
    : navItems;

  return (
    <aside
      className="hidden md:flex flex-col w-[220px] shrink-0 h-screen sticky top-0"
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-6 py-5 border-b"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--neon-green)" }}
        >
          <Zap size={16} className="text-black" fill="black" />
        </div>
        <div>
          <p
            className="text-sm font-semibold leading-none"
            style={{ color: "var(--sidebar-foreground)" }}
          >
            HabitTracker
          </p>
          <p
            className="text-[10px] mt-0.5"
            style={{
              color: "var(--muted-foreground)",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            v2.1.0
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? "var(--sidebar-accent)" : "transparent",
                color: isActive
                  ? "var(--sidebar-primary)"
                  : "var(--muted-foreground)",
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
              {label}
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--neon-green)" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Feedback */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setShowFeedback(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ color: "var(--muted-foreground)" }}
        >
          <MessageSquarePlus size={17} strokeWidth={1.8} />
          {t('nav_feedback')}
        </button>
      </div>

      {showFeedback && (
        <FeedbackModal isDark={isDark} profile={profile} onClose={() => setShowFeedback(false)} />
      )}

      {/* User info strip */}
      <div
        className="px-4 py-4 border-t"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{
                background: profile.avatar_color || "linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)",
                color: "#0E1117",
              }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--sidebar-foreground)" }}>
              {profile.display_name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs truncate" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                @{profile.username}
              </p>
              <div className="flex items-center gap-1 text-xs" style={{ color: "#FBBF24" }}>
                <Star size={11} fill="currentColor" className="shrink-0" />
                <span className="font-bold" style={{ fontFamily: "'Geist Mono', monospace" }}>
                  {profile.score ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}