import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Coins, Heart, Sparkles, ShieldCheck } from "lucide-react";
import confetti from "canvas-confetti";
import { useLang } from "../store/LangContext";

interface LevelUpToastProps {
  level: number;
  levelName: string;
  onClose: () => void;
}

export function LevelUpToast({ level, levelName, onClose }: LevelUpToastProps) {
  const { t } = useLang();

  useEffect(() => {
    // Fire festive confetti burst on mount
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"],
      });
    } catch {
      /* fallback if canvas-confetti fails */
    }

    // Auto close after 8 seconds
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
          className="w-full max-w-sm rounded-3xl bg-slate-950 border border-amber-500/30 p-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Radial Stage Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-tr from-amber-500/30 via-yellow-500/20 to-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Central Emblem & Badge */}
          <div className="relative mb-5 mt-2">
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 180, delay: 0.1 }}
              className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600 shadow-xl shadow-amber-500/25 flex items-center justify-center"
            >
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent" />
                <Trophy size={44} className="text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)] relative z-10" />
              </div>
            </motion.div>

            {/* Level Badge Pill */}
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.25 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black font-black text-[10px] px-3.5 py-1 rounded-full uppercase tracking-widest shadow-md shadow-amber-500/40 border border-amber-300 shrink-0 whitespace-nowrap"
            >
              LEVEL {level}
            </motion.div>
          </div>

          {/* Title & Prestige Label */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-1.5 mb-5"
          >
            <h2 className="text-2xl font-black tracking-wider uppercase bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              DARAJA OSHDI!
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-slate-200 text-xs font-bold">
              <Crown size={14} className="text-amber-400" />
              <span>{levelName}</span>
            </div>
          </motion.div>

          {/* Rewards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full grid grid-cols-2 gap-2.5 mb-6"
          >
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Coins size={18} />
              </div>
              <span className="text-xs font-black text-amber-400 mt-1">+50 Tanga</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bonus Mukofot</span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <span className="text-xs font-black text-emerald-400 mt-1">100% HP</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">To'liq Tiklandi</span>
            </div>
          </motion.div>

          {/* Primary CTA */}
          <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            onClick={onClose}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Sparkles size={18} />
            <span>Davom etish 🔥</span>
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
