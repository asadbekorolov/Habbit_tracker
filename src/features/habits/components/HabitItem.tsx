// Yagona odat kartasi — Bosh sahifa, Kundalik (kun tahriri) va boshqa
// ro'yxatlar shu bitta komponentdan foydalanadi.
import React from "react";
import { motion } from "framer-motion";
import {
  Check, X, Flame, BookOpen, Dumbbell, Code, Sparkles, Brain, Coins, Zap,
  Droplets, Coffee, Moon, Sun, Target, PenTool, Music, Activity, Users, UserCheck,
} from "lucide-react";
import { useHaptics } from "../../../hooks/useHaptics";
import { useLang } from "../../../store/LangContext";
import type { Habit } from "../../../services/supabase";
import type { HabitDayEntry } from "../../../hooks/useHabitDay";
import { normalizeApostrophes } from "../../../utils/text";
import { cleanHabitName, EMOJI_MAP } from "../../../components/HabitIcon";
import { HABIT_REWARD, isMeasurable, progressPct } from "../../../utils/habitMetrics";

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen, Dumbbell, Activity, Code, Sparkles, Brain, Droplets,
  Zap, Coffee, Moon, Sun, Target, PenTool, Music, Flame, Users, UserCheck,
};

/** Odat belgisi — ilovadagi YAGONA tanlov (kartalar, tafsilotlar oynasi). */
export function resolveHabitIcon(iconName?: string, habitName?: string): React.ElementType {
  // O‘/oʻ/o’ kabi turli apostroflar bir xil ko'rinishga keltiriladi
  const name = normalizeApostrophes(habitName || "").toLowerCase();
  // Nomidan aniq bilinadiganlar — saqlangan umumiy belgidan ustun
  if (name.includes("oila") || name.includes("family") || name.includes("do'st")) return Users;
  if (name.includes("o'ziga qarash") || name.includes("parvarish") || name.includes("self")) return UserCheck;
  if (name.includes("dastur") || /\b(kod|code|it)\b/.test(name)) return Code;

  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  if (iconName && EMOJI_MAP[iconName]) return EMOJI_MAP[iconName];

  const key = (iconName || "").toLowerCase();
  if (name.includes("erta tur")) return Sun;
  if (key.includes("book") || name.includes("kitob") || name.includes("o'qish") || name.includes("mutolaa")) return BookOpen;
  if (key.includes("dumbbell") || key.includes("activity") || name.includes("sport") || name.includes("mashq") || name.includes("gym") || name.includes("yugurish")) return Dumbbell;
  if (key.includes("code") || name.includes("dev") || name.includes("react")) return Code;
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
  entry: HabitDayEntry;
  streak: number;
  /** Doiracha (✓): oddiy odatda belgilash, o'lchanadiganda — qiymat oynasi (ota komponent hal qiladi) */
  onCheck: (habit: Habit) => void;
  /** ✗ tugmasi (berilsa ko'rinadi; salbiy odatda — "buzildi") */
  onFail?: (habit: Habit) => void;
  /** Kartaning o'zi bosilganda — odat tafsilotlari */
  onOpen?: (habit: Habit) => void;
  locked?: boolean;
}

export function HabitItem({ habit, entry, streak, onCheck, onFail, onOpen, locked }: HabitItemProps) {
  const { t } = useLang();
  const { impactLight } = useHaptics();
  const Icon = resolveHabitIcon(habit.emoji, habit.name);
  const negative = habit.type === "negative";
  const measurable = !negative && isMeasurable(habit);
  const target = habit.target_value || 1;
  const value = entry.value || 0;
  const done = entry.status === "done";
  // O'lchanadigan odatda qisman qiymat — "jarayonda", qizil emas
  const failed = entry.status === "fail" && !(measurable && value > 0);
  const reward = negative ? HABIT_REWARD.negative : HABIT_REWARD.positive;
  const unit = habit.unit || t("minutes");

  const press = (fn?: (h: Habit) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    impactLight();
    fn?.(habit);
  };

  return (
    <motion.div
      layout
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(habit)}
      onKeyDown={(e) => { if (onOpen && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(habit); } }}
      className={`p-4 rounded-2xl border transition-all duration-200 shadow-md backdrop-blur-xl flex items-center justify-between gap-3 ${onOpen ? "cursor-pointer active:scale-[0.99]" : ""} ${
        done
          ? "border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          : failed
          ? "border-rose-500/40 bg-rose-950/15"
          : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80"
      } ${locked ? "opacity-60" : ""}`}
    >
      <div
        className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner transition-colors ${
          done
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
            : failed
            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
            : negative
            ? "bg-slate-800/80 border-slate-700/50 text-rose-300"
            : "bg-slate-800/80 border-slate-700/50 text-emerald-400"
        }`}
      >
        <Icon className="w-5 h-5 stroke-[2.2]" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-medium truncate ${done ? "text-emerald-300 font-semibold" : "text-slate-100"}`}>
          {cleanHabitName(habit.name)}
        </h3>

        {measurable && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>
                <span className={done ? "text-emerald-400 font-bold" : "text-slate-200 font-bold"}>{value}</span> / {target} {unit}
              </span>
              <span>{progressPct(value, target)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPct(value, target)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400/90">
            <Flame className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />
            {t("dash_streak_days").replace("{n}", String(streak))}
          </span>
          {done ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
              <Check className="w-3 h-3" /> {negative ? t("habit_kept") : t("habit_done")}
            </span>
          ) : failed ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
              <X className="w-3 h-3" /> {negative ? t("habit_broken") : t("habit_failed")}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                <Zap className="w-3 h-3" /> +{reward.xp} XP
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                <Coins className="w-3 h-3" /> +{reward.coins}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={press(onCheck)}
          aria-label={t(negative ? "habit_mark_kept_aria" : "habit_mark_done_aria").replace("{name}", habit.name)}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-90 transition-all duration-150 cursor-pointer ${
            done
              ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              : "border-slate-700 bg-slate-800/50 text-slate-500 hover:border-emerald-500/50"
          }`}
        >
          {measurable && !done ? (
            <span className="text-[10px] font-mono font-bold text-emerald-400">+</span>
          ) : (
            <Check className={`w-4 h-4 stroke-[3] ${done ? "" : "opacity-30"}`} />
          )}
        </button>
        {onFail && (
          <button
            type="button"
            onClick={press(onFail)}
            aria-label={t(negative ? "habit_mark_broken_aria" : "habit_mark_failed_aria").replace("{name}", habit.name)}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-90 transition-all duration-150 cursor-pointer ${
              failed
                ? "bg-rose-500 border-rose-400 text-white"
                : "border-slate-700 bg-slate-800/50 text-rose-400/60 hover:border-rose-500/50"
            }`}
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
