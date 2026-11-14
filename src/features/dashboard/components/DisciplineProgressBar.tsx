import React from "react";
import { motion } from "framer-motion";

export interface DisciplineProgressBarProps {
  completedCount: number;
  totalCount: number;
  percentage: number;
}

export function DisciplineProgressBar({
  completedCount,
  totalCount,
  percentage
}: DisciplineProgressBarProps) {
  const safePercentage = Math.min(100, Math.max(0, percentage));

  return (
    <section className="rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl p-5 shadow-2xl shadow-black/40 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200 tracking-wide">
          Bugungi intizom
        </span>
        <div className="flex items-center gap-1.5 font-['Geist_Mono',monospace] font-mono text-xs font-bold text-emerald-400 tracking-tight">
          <span>{completedCount} / {totalCount} bajarildi</span>
          <span className="text-slate-600">•</span>
          <span>{safePercentage}%</span>
        </div>
      </div>

      {/* Slim Progress Track */}
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden mt-3 relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safePercentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
        />
      </div>
    </section>
  );
}
