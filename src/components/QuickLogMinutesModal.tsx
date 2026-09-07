import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2, Plus, Zap, Coins } from "lucide-react";
import { HabitIcon, cleanHabitName } from "./HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../utils/categoryTheme";
import type { Habit } from "../services/supabase";
import { useLang } from "../store/LangContext";

interface QuickLogMinutesModalProps {
  isDark?: boolean;
  habit: Habit;
  initialValue?: number;
  currentValue?: number;
  onSave: (value: number) => Promise<void>;
  onClose: () => void;
}

export function QuickLogMinutesModal({
  isDark,
  habit,
  initialValue,
  currentValue: currentValueProp,
  onSave,
  onClose,
}: QuickLogMinutesModalProps) {
  const { t } = useLang();
  const target = habit.target_value || 1;
  const initVal = initialValue ?? currentValueProp ?? 0;

  const [currentValue, setCurrentValue] = useState<number>(initVal);
  const [isEditingManually, setIsEditingManually] = useState(false);
  const [saving, setSaving] = useState(false);

  const pct = Math.min(Math.round((currentValue / target) * 100), 100);
  const category = getHabitCategory(habit.name, habit.emoji);
  const theme = getCategoryTheme(category);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(currentValue);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addPreset = (mins: number) => {
    setCurrentValue((prev) => Math.min(target * 2, prev + mins));
  };

  const setMax = () => setCurrentValue(target);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full sm:max-w-md bg-[#0D1117] border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle for mobile */}
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <HabitIcon emoji={habit.emoji} name={habit.name} size={24} />
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {cleanHabitName(habit.name)}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500 uppercase tracking-widest">
                  {t('habits_time_m')}
                </p>
                <span className="flex items-center gap-1 text-[10px] font-black text-gold uppercase bg-gold/10 px-1.5 py-0.5 rounded">
                  <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {habit.type === 'negative' ? '+10' : '+1'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} data-modal-close-trigger aria-label={t('close')} className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Real-time Progress Preview */}
        <div className="mb-10 text-center">
          <div className="flex items-baseline justify-center gap-1.5 my-4">
            {isEditingManually ? (
              <input
                type="number"
                inputMode="numeric"
                value={currentValue === 0 ? "" : currentValue}
                onChange={(e) => setCurrentValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                onBlur={() => setIsEditingManually(false)}
                autoFocus
                className="w-28 text-center text-4xl font-extrabold text-white bg-transparent border-b-2 border-emerald-500 focus:outline-none font-mono"
                placeholder="0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingManually(true)}
                className="text-4xl font-extrabold text-white hover:text-emerald-400 font-mono transition-colors active:scale-95 cursor-pointer"
              >
                {currentValue}
              </button>
            )}
            <span className="text-xl font-bold text-slate-500 font-mono">
              / {target}
            </span>
          </div>

          <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden mb-2">
            <motion.div
              animate={{ width: `${pct}%` }}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: theme.color, boxShadow: `0 0 20px ${theme.color}44` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>0%</span>
            <span style={{ color: theme.color }}>{pct}% {t('done').toLowerCase()}</span>
            <span>100%</span>
          </div>
        </div>

        {/* Quick Add Presets */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[15, 30, 60].map(mins => (
            <button
              key={mins}
              onClick={() => addPreset(mins)}
              className="py-3.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-slate-300 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} className="text-emerald-400" />
              +{mins} DAQ
            </button>
          ))}
          <button
            onClick={setMax}
            className="py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Zap size={14} fill="currentColor" />
            MAKSIMAL
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold text-sm active:scale-95 transition-all"
          >
            {t('cancel_short')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {t('save')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
