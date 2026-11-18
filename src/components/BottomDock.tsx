// Mobil pastki panel: Asosiy + (sozlanadigan 0–3 bo'lim) + Profil.
import { motion } from "framer-motion";
import { Home, BookOpen, Users, BarChart3, Clock, HeartPulse, Trophy, User as UserIcon } from "lucide-react";
import type { DockSlotId } from "../utils/dockConfig";
import { useDockSlots } from "../hooks/useDockSlots";
import { useLang } from "../store/LangContext";

type DockItem = { key: string; path: string; icon: React.ElementType; labelKey: string; isActive: (tab: string, search: string) => boolean };

const routineActive = (tab: string, search: string) => tab === "habits" && search.includes("section=routines");

export const DOCK_ITEMS: Record<DockSlotId | "dashboard" | "profile", DockItem> = {
  dashboard: { key: "dashboard", path: "dashboard", icon: Home, labelKey: "nav_dashboard", isActive: (t) => t === "dashboard" },
  journal: { key: "journal", path: "journal", icon: BookOpen, labelKey: "nav_logs", isActive: (t) => t === "journal" },
  groups: { key: "groups", path: "groups", icon: Users, labelKey: "sec_groups", isActive: (t) => t === "groups" },
  analytics: { key: "analytics", path: "analytics", icon: BarChart3, labelKey: "nav_analytics", isActive: (t) => t === "analytics" },
  routine: { key: "routine", path: "habits?section=routines", icon: Clock, labelKey: "sec_routine", isActive: routineActive },
  health: { key: "health", path: "health", icon: HeartPulse, labelKey: "sec_health", isActive: (t) => t === "health" },
  leaderboard: { key: "leaderboard", path: "leaderboard", icon: Trophy, labelKey: "sec_leaderboard", isActive: (t) => t === "leaderboard" },
  profile: { key: "profile", path: "profile", icon: UserIcon, labelKey: "nav_profile", isActive: (t) => t === "profile" },
};

interface BottomDockProps {
  activeTab: string;
  search: string;
  onNavigate: (path: string) => void;
}

export function BottomDock({ activeTab, search, onNavigate }: BottomDockProps) {
  const { t } = useLang();
  const [slots] = useDockSlots();
  const items = [DOCK_ITEMS.dashboard, ...slots.map((id) => DOCK_ITEMS[id]), DOCK_ITEMS.profile];

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto md:hidden bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 rounded-full py-2.5 px-3 transition-all duration-200">
      <div className="flex items-center justify-around w-full">
        {items.map((tab) => {
          const isActive = tab.isActive(activeTab, search);
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.key}
              type="button"
              onClick={() => onNavigate(tab.path)}
              aria-label={t(tab.labelKey as any)}
              aria-current={isActive ? "page" : undefined}
              whileTap={{ scale: 0.9 }}
              className="relative flex items-center justify-center flex-1 py-2 px-2 rounded-2xl transition-all duration-200 cursor-pointer group"
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
                  isActive ? "text-emerald-400 scale-110" : "text-slate-400 group-hover:text-slate-200"
                }`}
              />
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
