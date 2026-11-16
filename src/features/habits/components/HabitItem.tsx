import React from "react";
import { motion } from "framer-motion";
import {
  Check, Flame, BookOpen, Dumbbell, Code, Sparkles, Brain,
  Droplets, Zap, Coffee, Moon, Sun, Target, PenTool, Music, Activity, Users, UserCheck
} from "lucide-react";
import { useHaptics } from "../../../hooks/useHaptics";
import { useLang } from "../../../store/LangContext";
import type { Habit } from "../../../services/supabase";

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen, Dumbbell, Activity, Code, Sparkles, Brain, Droplets,
  Zap, Coffee, Moon, Sun, Target, PenTool, Music, Flame
};

export function resolveHabitIcon(iconName?: string, habitName?: string): React.ElementType {
  // O‘/oʻ/o’ kabi turli apostroflar bir xil ko'rinishga keltiriladi
  const name = (habitName || "").toLowerCase().replace(/[‘’ʻʼ`]/g, "'");
  // Bu ikkisi uchun umumiy "Sparkles" belgisi saqlangan bo'lsa ham mos belgi
  if (name.includes("oila") || name.includes("family") || name.includes("do'st")) return Users;
  if (name.includes("o'ziga qarash") || name.includes("parvarish") || name.includes("self")) return UserCheck;

  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  const key = (iconName || "").toLowerCase();
  if (name.includes("erta tur")) return Sun;

  if (key.includes("book") || name.includes("kitob") || name.includes("o'qish") || name.includes("mutolaa")) return BookOpen;
  if (key.includes("dumbbell") || key.includes("activity") || name.includes("sport") || name.includes("mashq") || name.includes("gym") || name.includes("yugurish")) return Dumbbell;
  if (key.includes("code") || name.includes("dastur") || name.includes("kod") || name.includes("dev") || name.includes("react")) return Code;
  if (key.includes("sparkle") || name.includes("meditatsiya") || name.includes("fikr")) return Sparkles;
  if (key.includes("brain") || name.includes("ta'lim") || name.includes("o'rganish") || name.includes("ingliz")) return Brain;
  if (key.includes("drop") || name.includes("suv") || name.includes("ichish")) return Droplets;
  if (key.includes("zap") || name.includes("energiya")) return Zap;
  if (key.includes("coffee") || name.includes("qahva") || name.includes("kofe")) return Coffee;
  if (key.includes("moon") || name.includes("uyqu")) return Moon;
  if (key.includes("sun") || name.includes("tong") || name.includes("ertalab")) return Sun;
  if (key.includes("target") || name.includes("maqsad")) return Target;
  if (key.includes("pen") || name.includes("yozish") || name.includes("jurnal")) return PenTool;
  if (key.includes("music") || name.includes("musiqa")) return Music;

  return Sparkles;
}

export interface HabitItemProps {
  habit: Habit;
  isDone: boolean;
  onToggle: (habitId: string) => void;
}

export function HabitItem({ habit, isDone, onToggle }: HabitItemProps) {
  const { t } = useLang();
  const { impactLight } = useHaptics();
  const HabitIconComponent = resolveHabitIcon(habit.emoji, habit.name);

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    impactLight();
    onToggle(habit.id);
  };

  // Hisoblangan zanjir (Dashboard beradi); bo'lmasa — 0.
  const streak = habit.streak_count ?? 0;

  return (
    <motion.div
      layout
      className={`p-4 rounded-2xl border transition-all duration-200 shadow-md backdrop-blur-xl flex items-center justify-between gap-3 group ${
        isDone
          ? "border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80"
      }`}
    >
      {/* Left: Squircle Icon Box with Lucide SVG Icon */}
      <div
        className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner transition-colors ${
          isDone
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
            : "bg-slate-800/80 border-slate-700/50 text-emerald-400"
        }`}
      >
        <HabitIconComponent className="w-5 h-5 stroke-[2.2]" />
      </div>

      {/* Center: Habit Title in Uzbek & Streak Count in Geist Mono (No strikethrough, no aggressive fading) */}
      <div className="flex-1 min-w-0">
        <h3
          className={`text-sm font-medium transition-colors truncate ${
            isDone ? "text-emerald-300 font-semibold" : "text-slate-100"
          }`}
        >
          {habit.name}
        </h3>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs font-['Geist_Mono',monospace] font-mono text-emerald-400/90">
          <Flame className="w-3.5 h-3.5 text-emerald-400 shrink-0 stroke-[2.2]" />
          <span>{t('dash_streak_days').replace('{n}', String(streak))}</span>
        </div>
      </div>

      {/* Right: Interactive Squircle Check Button */}
      <button
        type="button"
        onClick={handleCheckClick}
        aria-label={`${habit.name} bajarilganini belgilash`}
        className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-90 transition-all duration-150 cursor-pointer shrink-0 ${
          isDone
            ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            : "border-slate-700 bg-slate-800/50 text-transparent hover:border-emerald-500/50 hover:bg-slate-800"
        }`}
      >
        <Check
          className={`w-4 h-4 stroke-[3] transition-transform duration-150 ${
            isDone ? "scale-100" : "scale-50 opacity-0"
          }`}
        />
      </button>
    </motion.div>
  );
}
