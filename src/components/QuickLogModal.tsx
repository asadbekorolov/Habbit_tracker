import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2, Plus, Zap, Coins } from "lucide-react";
import { HabitIcon, cleanHabitName } from "./HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../utils/categoryTheme";
import type { Habit } from "../services/supabase";
import { useLang } from "../store/LangContext";

interface QuickLogModalProps {
  isDark?: boolean;
  isOpen?: boolean;
  habit: Habit;
  initialValue?: number;
  currentValue?: number;
  onSave: (value: number) => Promise<void>;
  onClose: () => void;
}

export function QuickLogModal({
  isDark,
  habit,
  initialValue,
  currentValue: currentValueProp,
  onSave,
  onClose,
}: QuickLogModalProps) {
  const { t } = useLang();
  const target = habit.target_value || 1;
  const initVal = initialValue ?? currentValueProp ?? 0;

  const [currentValue, setCurrentValue] = useState<number>(initVal);
  const [isEditingManually, setIsEditingManually] = useState(false);
  const [saving, setSaving] = useState(false);

  const pct = Math.min(Math.round((currentValue / target) * 100), 100);
  const category = getHabitCategory(habit.name, habit.emoji);
  const theme = getCategoryTheme(category);
  const isTime = habit.unit === "daqiqa";

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

  const addPreset = (amt: number) => {
    setCurrentValue((prev) => Math.min(target * 2, prev + amt));
  };

  const setMax = () => {
    setCurrentValue(target);
  };

  const presets = isTime ? [15, 30, 60] : (target >= 100 ? [10, 50, 100] : [1, 2, 5]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full sm:max-w-md bg-card border-t sm:border border-border rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-border rounded-full mx-auto mb-6 sm:hidden" />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <HabitIcon emoji={habit.emoji} name={habit.name} size={24} />
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {cleanHabitName(habit.name)}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  {habit.unit || t('pieces')}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-black text-gold uppercase bg-gold/10 px-1.5 py-0.5 rounded">
                  <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {habit.type === 'negative' ? '+10' : '+1'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} data-modal-close-trigger aria-label={t('close')} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="mb-10 text-center">
          {/* Tap-to-type input vs styled text button */}
          <div className="flex items-baseline justify-center gap-1.5 my-4">
            {isEditingManually ? (
              <input
                type="number"
                inputMode="numeric"
                value={currentValue === 0 ? "" : currentValue}
                onChange={(e) => setCurrentValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                onBlur={() => setIsEditingManually(false)}
                autoFocus
                className="w-28 text-center text-4xl font-extrabold text-slate-900 dark:text-white bg-transparent border-b-2 border-emerald-500 focus:outline-none font-mono"
                placeholder="0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingManually(true)}
                className="text-4xl font-extrabold text-slate-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 font-mono transition-colors active:scale-95 cursor-pointer"
              >
                {currentValue}
              </button>
            )}
            <span className="text-xl font-bold text-slate-400 dark:text-slate-500 font-mono">
              / {target}
            </span>
          </div>

          <div className="relative h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mb-2">
            <motion.div
              animate={{ width: `${pct}%` }}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: theme.color, boxShadow: `0 0 20px ${theme.color}44` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
            <span>0%</span>
            <span style={{ color: theme.color }}>{pct}% {t('done').toLowerCase()}</span>
            <span>{target} {habit.unit}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {presets.map(amt => (
            <button
              key={amt}
              onClick={() => addPreset(amt)}
              className="py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} className="text-emerald-600 dark:text-emerald-400" />
              +{amt} {isTime ? 'DAQ' : ''}
            </button>
          ))}
          <button
            onClick={setMax}
            className="py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Zap size={14} fill="currentColor" />
            MAKSIMAL
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-500 font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all"
          >
            {t('cancel_short')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
            {t('save')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
