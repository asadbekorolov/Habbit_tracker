import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Dumbbell, Wallet, Moon, Sun, Utensils, Droplets,
  Target, PenTool, Music, Smartphone, Zap, Activity, Flame,
  Gamepad2, Shield, Heart, Sparkles, Trophy, Coffee, X, Loader2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useLang } from '../store/LangContext';

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

interface AddGroupHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (habit: any) => Promise<void>;
  isDark: boolean;
  initialData?: any;
}

export const AddGroupHabitModal: React.FC<AddGroupHabitModalProps> = ({
  isOpen, onClose, onAdd, isDark, initialData
}) => {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState(initialData?.name || "");
  const [newEmoji, setNewEmoji] = useState(initialData?.emoji || "Sparkles");
  const [newType, setNewType] = useState<"positive" | "negative">(initialData?.type || "positive");
  const [newMetricType, setNewMetricType] = useState<"check" | "count" | "time">(
    initialData?.unit === "daqiqa" ? "time" : (initialData?.target_value > 1 || initialData?.unit ? "count" : "check")
  );
  const [newTarget, setNewTarget] = useState(initialData?.target_value || 1);
  const [newUnit, setNewUnit] = useState(initialData?.unit || "");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const targetValue = newMetricType === "check" ? 1 : newTarget;
      const unit = newMetricType === "time" ? "daqiqa" : newMetricType === "count" ? (newUnit || "ta") : "";

      await onAdd({
        name: newName.trim(),
        emoji: newEmoji,
        type: newType,
        target_value: targetValue,
        unit
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || t('groups_err_generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={onClose}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{
              background: isDark ? "#161B22" : "#fff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              maxHeight: "85vh",
              overflowY: "auto",
              paddingBottom: "env(safe-area-inset-bottom)"
            }}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {initialData ? t('groups_edit_habit') : t('groups_add_habit')}
                </h3>
                <button onClick={onClose} data-modal-close-trigger className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Turi */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>{t('groups_habit_type')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([["positive", t('positive'), "#4ADE80"], ["negative", t('negative'), "#F87171"]] as const).map(([val, label, color]) => (
                    <button key={val} type="button" onClick={() => setNewType(val)}
                      className="py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: newType === val ? `${color}18` : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"),
                        border: `1px solid ${newType === val ? `${color}50` : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)")}`,
                        color: newType === val ? color : "var(--muted-foreground)",
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Dribbble-style Icon Picker */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>{t('groups_emoji')}</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 my-4">
                  {ICON_PALETTE.map(({ key, Icon, bg, text, ring }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewEmoji(key)}
                      className={`h-12 rounded-xl flex items-center justify-center transition-all ${bg} ${text} ${
                        newEmoji === key
                          ? `ring-2 ${ring} scale-105 shadow-md`
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <Icon className="w-5 h-5 stroke-[2]"/>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nomi */}
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{t('groups_habit_name')}</p>
                <input
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
                  placeholder={t('groups_habit_name_ph')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              {/* O'lchov */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>{t('groups_measure')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["check", t('groups_yes_no')], ["count", t('groups_count')], ["time", t('groups_time_m')]] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setNewMetricType(val)}
                      className="py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: newMetricType === val ? (isDark ? "rgba(255,255,255,0.12)" : "#fff") : (isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"),
                        border: `1px solid ${newMetricType === val ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)") : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}`,
                        color: newMetricType === val ? "var(--foreground)" : "var(--muted-foreground)",
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Maqsad */}
              {newMetricType !== "check" && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                      {newMetricType === "time" ? t('groups_how_many_min') : t('groups_how_many')}
                    </p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setNewTarget(v => Math.max(1, v - 1))} className="p-2 rounded-lg bg-slate-100 dark:bg-white/5"><ChevronDown size={14}/></button>
                      <input
                        type="number"
                        className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-2 py-2 text-center font-bold"
                        value={newTarget}
                        onChange={(e) => setNewTarget(parseInt(e.target.value) || 1)}
                      />
                      <button type="button" onClick={() => setNewTarget(v => v + 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-white/5"><ChevronUp size={14}/></button>
                    </div>
                  </div>
                  {newMetricType === "count" && (
                    <div className="flex-1">
                      <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>{t('groups_unit')}</p>
                      <input
                        className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-center"
                        placeholder={t('groups_unit_ph')}
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)} maxLength={10}
                      />
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-rose-500">⚠ {error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
                  {t('cancel_short')}
                </button>
                <button type="button" onClick={handleAdd} disabled={saving || !newName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--neon-green)", color: "#0E1117", opacity: (saving || !newName.trim()) ? 0.5 : 1 }}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : (initialData ? <Check size={15} /> : <Plus size={15} />)}
                  {initialData ? t('save') : t('add')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
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

function Plus(props: any) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
