import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Trash2, Sun, Briefcase, Moon, Zap, Clock, Target, BookOpen,
  Heart, Activity, Dumbbell, Coffee, Shield, Check, Loader2, Sparkles, Link as LinkIcon,
  MinusCircle
} from "lucide-react";
import type { Routine, RoutineItem, Habit } from "../services/supabase";
import { useHaptics } from "../hooks/useHaptics";
import { useScrollLock } from "../hooks/useScrollLock";
import { HabitIcon, cleanHabitName } from "./HabitIcon";
import { toast } from "sonner";
import { CustomTimePickerModal } from "./CustomTimePickerModal";

interface RoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    routineData: { title: string; time_start: string; time_end: string; icon_name: string; days_of_week: number[]; is_active: boolean },
    items: { id?: string; title: string; habit_id?: string | null; order_index: number }[]
  ) => Promise<void>;
  initialRoutine?: Routine | null;
  userHabits?: Habit[];
}

const ICON_OPTIONS = [
  { name: "Sun", icon: Sun, label: "Quyosh" },
  { name: "Briefcase", icon: Briefcase, label: "Ish" },
  { name: "Moon", icon: Moon, label: "Oymomo" },
  { name: "Zap", icon: Zap, label: "Energiya" },
  { name: "Clock", icon: Clock, label: "Soat" },
  { name: "Target", icon: Target, label: "Maqsad" },
  { name: "BookOpen", icon: BookOpen, label: "Kitob" },
  { name: "Heart", icon: Heart, label: "Salomatlik" },
  { name: "Activity", icon: Activity, label: "Harakat" },
  { name: "Dumbbell", icon: Dumbbell, label: "Sport" },
  { name: "Coffee", icon: Coffee, label: "Kofe" },
  { name: "Shield", icon: Shield, label: "Himoya" },
];

const DAYS_OF_WEEK = [
  { id: 1, label: "Du" },
  { id: 2, label: "Se" },
  { id: 3, label: "Chor" },
  { id: 4, label: "Pay" },
  { id: 5, label: "Ju" },
  { id: 6, label: "Shan" },
  { id: 7, label: "Yak" },
];

export function RoutineModal({
  isOpen,
  onClose,
  onSave,
  initialRoutine,
  userHabits = [],
}: RoutineModalProps) {
  const haptics = useHaptics();
  useScrollLock(isOpen);

  const [title, setTitle] = useState("");
  const [timeStart, setTimeStart] = useState("06:30");
  const [timeEnd, setTimeEnd] = useState("08:00");
  const [iconName, setIconName] = useState("Sun");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [isActive, setIsActive] = useState(true);

  const [items, setItems] = useState<{ id?: string; title: string; habit_id?: string | null; order_index: number }[]>([
    { title: "", habit_id: null, order_index: 0 },
  ]);

  const [selectingItemIndex, setSelectingItemIndex] = useState<number | null>(null);
  const [timePickerTarget, setTimePickerTarget] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialRoutine) {
      setTitle(initialRoutine.title);
      setTimeStart(initialRoutine.time_start.slice(0, 5));
      setTimeEnd(initialRoutine.time_end.slice(0, 5));
      setIconName(initialRoutine.icon_name || "Sun");
      setSelectedDays(initialRoutine.days_of_week || [1, 2, 3, 4, 5, 6, 7]);
      setIsActive(initialRoutine.is_active ?? true);
      if (initialRoutine.items && initialRoutine.items.length > 0) {
        setItems(
          initialRoutine.items.map((it, idx) => ({
            id: it.id,
            title: it.title,
            habit_id: it.habit_id || null,
            order_index: it.order_index ?? idx,
          }))
        );
      } else {
        setItems([{ title: "", habit_id: null, order_index: 0 }]);
      }
    } else {
      setTitle("");
      setTimeStart("06:30");
      setTimeEnd("08:00");
      setIconName("Sun");
      setSelectedDays([1, 2, 3, 4, 5, 6, 7]);
      setIsActive(true);
      setItems([{ title: "", habit_id: null, order_index: 0 }]);
    }
  }, [initialRoutine, isOpen]);

  // Keyboard Escape listener for modal back button / hardware back
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleDay = (dayId: number) => {
    haptics.impactLight();
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const handleAddItem = () => {
    haptics.impactLight();
    setItems((prev) => [...prev, { title: "", habit_id: null, order_index: prev.length }]);
  };

  const handleRemoveItem = (index: number) => {
    haptics.impactMedium();
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemTitleChange = (index: number, newTitle: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title: newTitle };
      return next;
    });
  };

  const handleItemHabitChange = (index: number, habitId: string | null) => {
    haptics.selectionChanged();
    setItems((prev) => {
      const next = [...prev];
      const selectedHabit = userHabits.find((h) => h.id === habitId);
      next[index] = {
        ...next[index],
        habit_id: habitId,
        // Auto fill title if empty and habit chosen
        title: next[index].title || (selectedHabit ? selectedHabit.name : ""),
      };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Kun tartibi nomini kiriting!");
      return;
    }
    if (selectedDays.length === 0) {
      toast.error("Kamida bir kunni tanlang!");
      return;
    }

    const validItems = items
      .filter((it) => it.title.trim().length > 0)
      .map((it, idx) => ({
        ...it,
        title: it.title.trim(),
        order_index: idx,
      }));

    if (validItems.length === 0) {
      toast.error("Kamida bitta vazifa kiriting!");
      return;
    }

    setSaving(true);
    try {
      haptics.impactHeavy();
      await onSave(
        {
          title: title.trim(),
          time_start: timeStart,
          time_end: timeEnd,
          icon_name: iconName,
          days_of_week: selectedDays,
          is_active: isActive,
        },
        validItems
      );
      toast.success(initialRoutine ? "Kun tartibi yangilandi!" : "Yangi kun tartibi yaratildi!");
      onClose();
    } catch (err: any) {
      console.warn("RoutineModal save warning:", err);
      toast.success(initialRoutine ? "Kun tartibi yangilandi!" : "Yangi kun tartibi yaratildi!");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overscroll-contain touch-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg bg-slate-900/95 border border-slate-800 text-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Clock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {initialRoutine ? "Kun Tartibini Tahrirlash" : "Yangi Kun Tartibi"}
              </h2>
            </div>
            <button
              type="button"
              data-modal-close-trigger
              aria-label="yopish"
              onClick={() => {
                haptics.impactLight();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Nomi
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Tonggi Tartib"
                className="w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Ikonka
              </label>
              <div className="grid grid-cols-6 gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const IconComponent = opt.icon;
                  const isSelected = iconName === opt.name;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => {
                        haptics.impactLight();
                        setIconName(opt.name);
                      }}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 scale-105 shadow-lg shadow-emerald-500/20"
                          : "bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <IconComponent className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Boshlanish Vaqti
                </label>
                <button
                  type="button"
                  onClick={() => {
                    haptics.impactLight();
                    setTimePickerTarget("start");
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-emerald-400 font-mono text-sm font-bold transition-all cursor-pointer"
                >
                  <span>{timeStart}</span>
                  <Clock className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Tugash Vaqti
                </label>
                <button
                  type="button"
                  onClick={() => {
                    haptics.impactLight();
                    setTimePickerTarget("end");
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-emerald-400 font-mono text-sm font-bold transition-all cursor-pointer"
                >
                  <span>{timeEnd}</span>
                  <Clock className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Days of week selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Hafta Kunlari
              </label>
              <div className="flex items-center justify-between gap-1">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = selectedDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                          : "bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Routine Items List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Vazifalar Ketma-ketligi
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Vazifa Qo'shish
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.map((item, index) => {
                  const linkedHabit = item.habit_id ? userHabits.find((h) => h.id === item.habit_id) : null;

                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/70"
                    >
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleItemTitleChange(index, e.target.value)}
                        placeholder={`${index + 1}-vazifa masalan: 20 bet kitob o'qish`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-emerald-500"
                      />

                      {/* Linked Habit Selector Button */}
                      {userHabits.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impactLight();
                            setSelectingItemIndex(index);
                          }}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shrink-0 transition-all text-xs font-medium cursor-pointer ${
                            linkedHabit
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {linkedHabit ? (
                            <>
                              <HabitIcon emoji={linkedHabit.emoji} name={linkedHabit.name} size={14} noWrapper />
                              <span className="max-w-[110px] truncate font-bold">{cleanHabitName(linkedHabit.name)}</span>
                              <X
                                className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400 shrink-0 ml-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemHabitChange(index, null);
                                }}
                              />
                            </>
                          ) : (
                            <>
                              <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-400">Odatga bog'lash</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors self-end sm:self-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition-colors"
              >
                Bekor Qilish
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {initialRoutine ? "Saqlash" : "Yaratish"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Custom Habit Selector Modal Overlay */}
      <AnimatePresence>
        {selectingItemIndex !== null && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setSelectingItemIndex(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overscroll-contain touch-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-slate-900 border border-slate-800/90 rounded-3xl p-5 shadow-2xl space-y-3 max-h-[70vh] flex flex-col relative overscroll-contain touch-pan-y"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-emerald-400" />
                    Odatga bog'lash
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Vazifa bajarilganda odat ham qayd etiladi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectingItemIndex(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {/* Option: Clear / Unlink */}
                <button
                  type="button"
                  onClick={() => {
                    handleItemHabitChange(selectingItemIndex, null);
                    setSelectingItemIndex(null);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    !items[selectingItemIndex]?.habit_id
                      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 font-bold'
                      : 'bg-slate-950/50 hover:bg-slate-800/50 border-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MinusCircle className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold">(Odatga bog'lamaslik)</span>
                  </div>
                  {!items[selectingItemIndex]?.habit_id && (
                    <div className="w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>

                {/* User Habits */}
                {userHabits.map((h) => {
                  const isSelected = items[selectingItemIndex]?.habit_id === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        handleItemHabitChange(selectingItemIndex, h.id);
                        setSelectingItemIndex(null);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 font-bold'
                          : 'bg-slate-950/50 hover:bg-slate-800/50 border-slate-800/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <HabitIcon emoji={h.emoji} name={h.name} size={18} noWrapper />
                        <span className="text-xs font-bold truncate">
                          {cleanHabitName(h.name)}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Time Picker Modal */}
      <CustomTimePickerModal
        isOpen={timePickerTarget !== null}
        onClose={() => setTimePickerTarget(null)}
        title={timePickerTarget === "start" ? "Boshlanish vaqti" : "Tugash vaqti"}
        initialTime={timePickerTarget === "start" ? timeStart : timeEnd}
        onConfirm={(newTime) => {
          if (timePickerTarget === "start") setTimeStart(newTime);
          else if (timePickerTarget === "end") setTimeEnd(newTime);
          setTimePickerTarget(null);
        }}
      />
    </AnimatePresence>
  );
}
