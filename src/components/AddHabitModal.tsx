import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Dumbbell, Wallet, Moon, Sun, Utensils, Droplets,
  Target, PenTool, Music, Smartphone, Zap, Activity, Flame,
  Gamepad2, Shield, Heart, Sparkles, Trophy, Coffee, X, Loader2,
  ChevronDown, ChevronUp, Bell, BellOff, Plus, Clock
} from 'lucide-react';
import { useLang } from '../store/LangContext';
import { CustomTimePickerModal } from './CustomTimePickerModal';

const ICON_PALETTE = [
  { key: 'BookOpen', Icon: BookOpen, bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-400' },
  { key: 'Dumbbell', Icon: Dumbbell, bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-400' },
  { key: 'Wallet', Icon: Wallet, bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-400' },
  { key: 'Moon', Icon: Moon, bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-400' },
  { key: 'Sun', Icon: Sun, bg: 'bg-orange-100 dark:bg-orange-950/60', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-400' },
  { key: 'Utensils', Icon: Utensils, bg: 'bg-yellow-100 dark:bg-yellow-950/60', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-400' },
  { key: 'Droplets', Icon: Droplets, bg: 'bg-cyan-100 dark:bg-cyan-950/60', text: 'text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-400' },
  { key: 'Target', Icon: Target, bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-400' },
  { key: 'PenTool', Icon: PenTool, bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-400' },
  { key: 'Music', Icon: Music, bg: 'bg-pink-100 dark:bg-pink-950/60', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-400' },
  { key: 'Smartphone', Icon: Smartphone, bg: 'bg-slate-100 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-400' },
  { key: 'Zap', Icon: Zap, bg: 'bg-yellow-100 dark:bg-yellow-950/60', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-400' },
  { key: 'Activity', Icon: Activity, bg: 'bg-teal-100 dark:bg-teal-950/60', text: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-400' },
  { key: 'Flame', Icon: Flame, bg: 'bg-red-100 dark:bg-red-950/60', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-400' },
  { key: 'Gamepad2', Icon: Gamepad2, bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-400' },
  { key: 'Shield', Icon: Shield, bg: 'bg-gray-100 dark:bg-gray-800/60', text: 'text-gray-600 dark:text-gray-400', ring: 'ring-gray-400' },
  { key: 'Heart', Icon: Heart, bg: 'bg-pink-100 dark:bg-pink-950/60', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-400' },
  { key: 'Sparkles', Icon: Sparkles, bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-400' },
  { key: 'Trophy', Icon: Trophy, bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-400' },
  { key: 'Coffee', Icon: Coffee, bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-500' },
];

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (habit: any) => Promise<void>;
  isDark: boolean;
  initialData?: any;
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({
  isOpen, onClose, onAdd, isDark, initialData
}) => {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState(initialData?.name || "");
  const [newEmoji, setNewEmoji] = useState(initialData?.emoji || "Sparkles");
  const [newType, setNewType] = useState<"positive" | "negative">(initialData?.type || "positive");
  const [metricType, setMetricType] = useState<"check" | "count" | "time">(
    initialData?.unit === "daqiqa" ? "time" : (initialData?.target_value > 1 || initialData?.unit ? "count" : "check")
  );
  const [newTarget, setNewTarget] = useState(initialData?.target_value || 1);
  const [newUnit, setNewUnit] = useState(initialData?.unit || "");
  const [newStartTime, setNewStartTime] = useState(initialData?.scheduled_start?.slice(0, 5) || "");
  const [newEndTime, setNewEndTime] = useState(initialData?.scheduled_end?.slice(0, 5) || "");
  const [newDescription, setNewDescription] = useState(initialData?.description || "");
  const [newReminderEnabled, setNewReminderEnabled] = useState(!!initialData?.reminder);
  const [newReminderTime, setNewReminderTime] = useState(initialData?.reminder || "09:00");
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | 'reminder' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(initialData?.name || "");
      setNewEmoji(initialData?.emoji || "Sparkles");
      setNewType(initialData?.type || "positive");
      setMetricType(
        initialData?.unit === "daqiqa" ? "time" : (initialData?.target_value > 1 || initialData?.unit ? "count" : "check")
      );
      setNewTarget(initialData?.target_value || 1);
      setNewUnit(initialData?.unit || "");
      setNewStartTime(initialData?.scheduled_start?.slice(0, 5) || "");
      setNewEndTime(initialData?.scheduled_end?.slice(0, 5) || "");
      setNewDescription(initialData?.description || "");
      setNewReminderEnabled(!!initialData?.reminder);
      setNewReminderTime(initialData?.reminder || "09:00");
      setError("");
    }
  }, [initialData, isOpen]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      let targetVal = 1, unitVal = "";
      if (metricType === "count") { targetVal = newTarget || 1; unitVal = newUnit.trim(); }
      if (metricType === "time")  { targetVal = newTarget || 5; unitVal = "daqiqa"; }

      await onAdd({
        name: newName.trim(),
        emoji: newEmoji,
        type: newType,
        target_value: targetVal,
        unit: unitVal,
        scheduledStart: newStartTime || undefined,
        scheduledEnd: newEndTime || undefined,
        description: newDescription.trim() || undefined,
        reminder: newReminderEnabled ? newReminderTime : undefined
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || t('habits_add_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              background: isDark ? "#0D1117" : "#FFFFFF",
              borderTop: isDark ? "1px solid rgba(255,255,255,0.1)" : "none"
            }}
            className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Sparkles size={16} className="text-emerald-600 dark:text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{initialData ? t('groups_edit_habit') : t('habits_new')}</h3>
              </div>
              <button onClick={onClose} data-modal-close-trigger className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Type Switcher */}
              <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5">
                {(["positive", "negative"] as const).map((typ) => (
                  <button
                    key={typ}
                    onClick={() => { setNewType(typ); }}
                    className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    style={{
                      background: newType === typ ? (typ === "positive" ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)") : "transparent",
                      color: newType === typ ? (typ === "positive" ? (isDark ? "#10B981" : "#059669") : (isDark ? "#F43F5E" : "#DC2626")) : (isDark ? "rgba(255,255,255,0.4)" : "#64748B"),
                    }}
                  >
                    {typ === "positive" ? t('habits_positive_tab') : t('habits_negative_tab')}
                  </button>
                ))}
              </div>

              {/* Dribbble-style Icon Picker */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-slate-500">{t('habits_catalog_title')}</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 my-4">
                  {ICON_PALETTE.map(({ key, Icon, bg, text, ring }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewEmoji(key)}
                      className={`h-14 rounded-2xl flex items-center justify-center transition-all ${bg} ${text} ${
                        newEmoji === key
                          ? `ring-2 ${ring} scale-105 shadow-md`
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <Icon className="w-6 h-6 stroke-[2]"/>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">{t('habits_custom_name')}</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white transition-all"
                    placeholder={t('habits_custom_name_ph')}
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">{t('habits_schedule')}</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTimePickerTarget('start')}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between text-slate-900 dark:text-white text-xs font-mono font-bold transition-all hover:border-emerald-500/50"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                          <span>{newStartTime || "Boshlanishi"}</span>
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimePickerTarget('end')}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between text-slate-900 dark:text-white text-xs font-mono font-bold transition-all hover:border-emerald-500/50"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                          <span>{newEndTime || "Tugashi"}</span>
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">{t('habits_measure')}</label>
                    <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                      {[
                        { key: 'check' as const, label: "ODDIY" },
                        { key: 'count' as const, label: "SONI" },
                        { key: 'time' as const, label: "VAQT" },
                      ].map(({ key, label }) => (
                        <button key={key} type="button" onClick={() => setMetricType(key)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${metricType === key ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reminder Settings */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${newReminderEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                        {newReminderEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{t('habits_reminder')}</p>
                        <p className="text-[10px] text-slate-500">{t('habits_reminder_hint')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewReminderEnabled(!newReminderEnabled)}
                      className={`w-12 h-6 rounded-full relative transition-colors ${newReminderEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <motion.div
                        animate={{ x: newReminderEnabled ? 26 : 4 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                      />
                    </button>
                  </div>

                  <AnimatePresence>
                    {newReminderEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vaqtni tanlang</span>
                        <button
                          type="button"
                          onClick={() => setTimePickerTarget('reminder')}
                          className="py-1.5 px-3 rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-mono font-bold text-slate-900 dark:text-white hover:border-emerald-500/50 transition-all"
                        >
                          <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                          <span>{newReminderTime || "09:00"}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {metricType !== 'check' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="w-full max-w-full overflow-hidden box-border"
                  >
                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">
                      {metricType === 'time' ? t('habits_goal_min') : t('habits_goal_count')}
                    </label>
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setNewTarget(prev => Math.max(metricType === 'time' ? 5 : 1, prev - (metricType === 'time' ? 5 : 1)))}
                        className="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white active:scale-95 transition-all shadow-sm dark:shadow-none"
                      >
                        <ChevronDown size={20} />
                      </button>

                      <div className="flex-1 min-w-0 flex items-center gap-2 px-2">
                        <input
                          type="number"
                          className="min-w-0 flex-1 text-center font-bold text-xl bg-white dark:bg-black/30 rounded-xl py-2.5 px-3 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-inner dark:shadow-none"
                          value={newTarget === 0 ? "" : newTarget}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setNewTarget(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                        {metricType === 'count' && (
                          <input
                            className="w-20 text-center text-xs font-bold bg-white dark:bg-white/5 rounded-xl py-2 px-2 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 outline-none"
                            placeholder={t('habits_unit_ph_short')}
                            value={newUnit}
                            onChange={(e) => setNewUnit(e.target.value)}
                          />
                        )}
                        {metricType === 'time' && <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">MIN</span>}
                      </div>

                      <button
                        type="button"
                        onClick={() => setNewTarget(prev => prev + (metricType === 'time' ? 5 : 1))}
                        className="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white active:scale-95 transition-all shadow-sm dark:shadow-none"
                      >
                        <ChevronUp size={20} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {error && <p className="text-xs text-rose-500 text-center">⚠ {error}</p>}

              <div className="pt-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : (initialData ? <Check size={18} /> : <Plus size={18} />)}
                  {initialData ? t('save') : t('add')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <CustomTimePickerModal
        isOpen={timePickerTarget !== null}
        initialTime={
          timePickerTarget === 'start' ? newStartTime : timePickerTarget === 'end' ? newEndTime : newReminderTime
        }
        title={
          timePickerTarget === 'start' ? "Boshlanish vaqti" : timePickerTarget === 'end' ? "Tugash vaqti" : "Eslatma vaqti"
        }
        onSave={(timeStr) => {
          if (timePickerTarget === 'start') setNewStartTime(timeStr);
          if (timePickerTarget === 'end') setNewEndTime(timeStr);
          if (timePickerTarget === 'reminder') setNewReminderTime(timeStr);
        }}
        onClose={() => setTimePickerTarget(null)}
        isDark={isDark}
      />
    </AnimatePresence>
  );
};

function Check(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
