import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle, Pencil, Check, X, GripVertical, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { getHabits, addHabit, deleteHabit, updateHabit } from "../../services/db";
import { sortByOrder, setHabitOrder } from "../../utils/habitOrder";
import type { Habit, Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";
import { useHabits } from "../../hooks/useHabits";
import { useAddHabit } from "../../hooks/useAddHabit";
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "../../utils/analytics";

interface HabitsManagerProps {
  isDark: boolean;
  profile: Profile;
}

const EMOJIS_POSITIVE = ["🌅","💧","📚","📖","🏋️","🧘","♟️","🥚","🌿","💻","🎯","⚡","🏃","🎵","✍️","🚶","🧠","😴"];
const EMOJIS_NEGATIVE = ["📱","🚬","🍔","🍺","😤","🎮","🛒","💸","😴","🤐"];

type Tpl = { emoji: string; name: string; metric: "check" | "count" | "time"; target: number; unit: string };
const TEMPLATES_POS: { catKey: string; items: Tpl[] }[] = [
  { catKey: "habits_cat_health", items: [
    { emoji: "💧", name: "Kuniga 2 litr suv ichish", metric: "count", target: 2,  unit: "litr" },
    { emoji: "😴", name: "8 soat uxlash",            metric: "count", target: 8,  unit: "soat" },
    { emoji: "🏃", name: "Ertalabki badantarbiya",    metric: "check", target: 1,  unit: "" },
    { emoji: "🏋️", name: "Sport qilish",             metric: "time",  target: 30, unit: "" },
    { emoji: "🧘", name: "Meditatsiya",               metric: "time",  target: 10, unit: "" },
    { emoji: "🚶", name: "Piyoda yurish",             metric: "time",  target: 20, unit: "" },
    { emoji: "🌿", name: "Tabiatda dam",              metric: "time",  target: 15, unit: "" },
  ]},
  { catKey: "habits_cat_knowledge", items: [
    { emoji: "📖", name: "30 daqiqa kitob o'qish",     metric: "time",  target: 30, unit: "" },
    { emoji: "📵", name: "Telefonni 2 soatga cheklash", metric: "check", target: 1,  unit: "" },
    { emoji: "🆕", name: "Yangi so'z yodlash",          metric: "check", target: 1,  unit: "" },
    { emoji: "✍️", name: "Kundalik yozish",            metric: "check", target: 1,  unit: "" },
    { emoji: "🎯", name: "Ingliz tili",                 metric: "time",  target: 20, unit: "" },
    { emoji: "💻", name: "Kod yozish",                  metric: "time",  target: 30, unit: "" },
    { emoji: "🧠", name: "Podcast tinglash",            metric: "time",  target: 20, unit: "" },
  ]},
  { catKey: "habits_cat_lifestyle", items: [
    { emoji: "🌅", name: "Ertalab barvaqt turish",  metric: "check", target: 1,  unit: "" },
    { emoji: "🗓️", name: "Kunlik reja tuzish",      metric: "check", target: 1,  unit: "" },
    { emoji: "🥚", name: "Nonushta qilish",         metric: "check", target: 1,  unit: "" },
    { emoji: "😴", name: "Erta yotish",             metric: "check", target: 1,  unit: "" },
    { emoji: "♟️", name: "Shaxmat o'ynash",        metric: "check", target: 1,  unit: "" },
    { emoji: "🎵", name: "Musiqa mashq",            metric: "time",  target: 20, unit: "" },
  ]},
];
const TEMPLATES_NEG: { catKey: string; items: Tpl[] }[] = [
  { catKey: "habits_cat_digital", items: [
    { emoji: "📱", name: "Ijtimoiy tarmoq",    metric: "time",  target: 30, unit: "" },
    { emoji: "🎮", name: "Ortiqcha o'yin",     metric: "time",  target: 60, unit: "" },
  ]},
  { catKey: "habits_cat_food", items: [
    { emoji: "🍔", name: "Tez ovqat",          metric: "check", target: 1,  unit: "" },
    { emoji: "🍺", name: "Alkogol",            metric: "check", target: 1,  unit: "" },
    { emoji: "🚬", name: "Chekish",            metric: "check", target: 1,  unit: "" },
    { emoji: "💸", name: "Keraksiz xarid",     metric: "check", target: 1,  unit: "" },
  ]},
];

type PackHabit = Tpl & { type: "positive" | "negative" };
const GOAL_PACKS: { id: string; emoji: string; labelKey: string; descKey: string; color: string; habits: PackHabit[] }[] = [
  {
    id: "soghlom", emoji: "💪", labelKey: "goal_healthy_life", descKey: "goal_healthy_life_desc", color: "#4ADE80",
    habits: [
      { emoji: "🏃", name: "Yugurish",       metric: "check", target: 1,  unit: "",       type: "positive" },
      { emoji: "💧", name: "Suv ichish",      metric: "count", target: 8,  unit: "stakan", type: "positive" },
      { emoji: "🏋️", name: "Sport qilish",  metric: "time",  target: 30, unit: "",       type: "positive" },
      { emoji: "🧘", name: "Meditatsiya",     metric: "time",  target: 10, unit: "",       type: "positive" },
      { emoji: "🌅", name: "Erta turish",     metric: "check", target: 1,  unit: "",       type: "positive" },
      { emoji: "😴", name: "Erta yotish",     metric: "check", target: 1,  unit: "",       type: "positive" },
    ],
  },
  {
    id: "samarali", emoji: "📈", labelKey: "goal_productivity", descKey: "goal_productivity_desc", color: "#60A5FA",
    habits: [
      { emoji: "📚", name: "Kitob o'qish",    metric: "count", target: 20, unit: "bet",    type: "positive" },
      { emoji: "💻", name: "Kod yozish",       metric: "time",  target: 30, unit: "",       type: "positive" },
      { emoji: "🎯", name: "Ingliz tili",      metric: "time",  target: 20, unit: "",       type: "positive" },
      { emoji: "✍️", name: "Kundalik yozish", metric: "check", target: 1,  unit: "",       type: "positive" },
      { emoji: "🧠", name: "Podcast tinglash", metric: "time",  target: 20, unit: "",       type: "positive" },
    ],
  },
  {
    id: "stress", emoji: "🌿", labelKey: "goal_stress", descKey: "goal_stress_desc", color: "#A78BFA",
    habits: [
      { emoji: "🧘", name: "Meditatsiya",     metric: "time",  target: 15, unit: "",       type: "positive" },
      { emoji: "🚶", name: "Piyoda yurish",   metric: "time",  target: 20, unit: "",       type: "positive" },
      { emoji: "🌿", name: "Tabiatda dam",     metric: "time",  target: 15, unit: "",       type: "positive" },
      { emoji: "🎵", name: "Musiqa mashq",     metric: "time",  target: 20, unit: "",       type: "positive" },
      { emoji: "📱", name: "Ijtimoiy tarmoq",  metric: "time",  target: 30, unit: "",       type: "negative" },
    ],
  },
  {
    id: "detoks", emoji: "🚫", labelKey: "goal_detox", descKey: "goal_detox_desc", color: "#F87171",
    habits: [
      { emoji: "📱", name: "Ijtimoiy tarmoq",  metric: "time",  target: 30, unit: "",       type: "negative" },
      { emoji: "🎮", name: "Ortiqcha o'yin",   metric: "time",  target: 60, unit: "",       type: "negative" },
      { emoji: "💸", name: "Keraksiz xarid",   metric: "check", target: 1,  unit: "",       type: "negative" },
      { emoji: "😴", name: "Erta yotish",      metric: "check", target: 1,  unit: "",       type: "positive" },
    ],
  },
];

export function HabitsManager({ isDark, profile }: HabitsManagerProps) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { data: habitsData, isLoading: queryLoading } = useHabits(profile.id);
  const addHabitMutation = useAddHabit();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🌅");
  const [newType, setNewType] = useState<"positive" | "negative">("positive");
  const [metricType, setMetricType] = useState<"check" | "count" | "time">("check");
  const [newTarget, setNewTarget] = useState(1);
  const [newUnit, setNewUnit] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  // Odat nomi endi faqat quyidagi katalogdan tanlanadi — spam/axlat odat
  // nomlarini oldini olish uchun erkin matn kiritish maydoni olib
  // tashlandi. selectedTemplateKey tanlangan bandni vizual belgilash uchun.
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [addError, setAddError] = useState("");
  const [showGoalPack, setShowGoalPack] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [checkedPack, setCheckedPack] = useState<Set<number>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editMetricType, setEditMetricType] = useState<"check" | "count" | "time">("check");
  const [editTarget, setEditTarget] = useState(1);
  const [editUnit, setEditUnit] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const card = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 12,
    padding: 20,
  };

  const inputStyle = {
    background: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  useEffect(() => {
    if (habitsData) {
      setHabits(sortByOrder(habitsData, profile.id));
      setLoading(false);
    } else if (queryLoading) {
      setLoading(true);
    }
  }, [habitsData, queryLoading, profile.id]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true); setAddError("");
    try {
      let targetVal = 1, unitVal = "";
      if (metricType === "count") { targetVal = newTarget || 1; unitVal = newUnit.trim(); }
      if (metricType === "time")  { targetVal = newTarget || 5; unitVal = "daqiqa"; }
      
      await addHabitMutation.mutateAsync({
        userId: profile.id,
        name: newName.trim(),
        emoji: newEmoji,
        type: newType,
        target_value: targetVal,
        unit: unitVal,
        scheduledStart: newStartTime || undefined,
        scheduledEnd: newEndTime || undefined,
      });
      trackEvent('habit_created', { type: newType, metric: metricType }, profile.id);

      setNewName(""); setMetricType("check"); setNewTarget(1); setNewUnit("");
      setNewStartTime(""); setNewEndTime(""); setSelectedTemplateKey(null);
      setNewEmoji(newType === "positive" ? "🌅" : "📱");
      setShowForm(false);
    } catch (e: any) { setAddError(e?.message || t('habits_add_error')); }
    finally { setSaving(false); }
  }

  async function handleBulkAdd() {
    const goal = GOAL_PACKS.find((g) => g.id === selectedGoal);
    if (!goal) return;
    const toAdd = goal.habits.filter((_, i) => checkedPack.has(i));
    if (toAdd.length === 0) return;
    setBulkAdding(true);
    setAddError("");
    try {
      for (const h of toAdd) {
        const targetVal = h.metric === "check" ? 1 : h.target;
        const unitVal = h.metric === "time" ? "daqiqa" : h.metric === "count" ? h.unit : "";
        const habit = await addHabit(profile.id, h.name, h.emoji, h.type, targetVal, unitVal);
        setHabits((prev) => {
          const next = [...prev, habit];
          setHabitOrder(profile.id, next.map((x) => x.id));
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
      setShowGoalPack(false);
      setSelectedGoal(null);
      setCheckedPack(new Set());
    } catch (e: any) {
      setAddError(e?.message || t('habits_add_error'));
    }
    finally { setBulkAdding(false); }
  }

  function applyTemplate(tpl: Tpl) {
    setNewEmoji(tpl.emoji);
    setNewName(tpl.name);
    setMetricType(tpl.metric);
    setNewTarget(tpl.target);
    setNewUnit(tpl.unit);
    setSelectedTemplateKey(`${tpl.emoji}|${tpl.name}`);
  }

  async function handleDelete(habitId: string) {
    try {
      await deleteHabit(habitId);
      setHabits((prev) => {
        const next = prev.filter((h) => h.id !== habitId);
        setHabitOrder(profile.id, next.map((h) => h.id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
    } catch (e) { console.error(e); }
  }

  function startEditing(h: Habit) {
    setEditingId(h.id); setEditName(h.name); setEditEmoji(h.emoji);
    const tv = h.target_value || 1, u = h.unit || "";
    if (u === "daqiqa") { setEditMetricType("time"); setEditTarget(tv); setEditUnit("daqiqa"); }
    else if (tv > 1 || u) { setEditMetricType("count"); setEditTarget(tv); setEditUnit(u); }
    else { setEditMetricType("check"); setEditTarget(1); setEditUnit(""); }
    setEditStartTime((h.scheduled_start || "").slice(0, 5));
    setEditEndTime((h.scheduled_end || "").slice(0, 5));
    setEditError("");
  }

  function cancelEdit() { setEditingId(null); setEditError(""); }

  async function handleEditSave() {
    if (!editName.trim()) return;
    setEditSaving(true); setEditError("");
    try {
      const updates: Record<string, unknown> = { name: editName.trim(), emoji: editEmoji };
      if (editMetricType === "count") { updates.target_value = editTarget; updates.unit = editUnit.trim(); }
      else if (editMetricType === "time") { updates.target_value = editTarget; updates.unit = "daqiqa"; }
      else { updates.target_value = 1; updates.unit = ""; }
      updates.scheduled_start = editStartTime || null;
      updates.scheduled_end = editEndTime || null;
      const updated = await updateHabit(editingId!, updates as any);
      setHabits((prev) => prev.map((h) => (h.id === editingId ? { ...h, ...updated } : h)));
      queryClient.invalidateQueries({ queryKey: ['habits', profile.id] });
      setEditingId(null);
    } catch (e: any) { setEditError(e?.message || "Saqlashda xatolik"); }
    finally { setEditSaving(false); }
  }

  // Drag handlers
  function handleDragStart(habitId: string) { setDragId(habitId); }

  function handleDragOver(e: React.DragEvent, habitId: string) {
    e.preventDefault();
    if (habitId !== dragId) setDragOverId(habitId);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setHabits((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((h) => h.id === dragId);
      const toIdx   = arr.findIndex((h) => h.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      setHabitOrder(profile.id, arr.map((h) => h.id));
      return arr;
    });
    setDragId(null); setDragOverId(null);
  }

  function handleDragEnd() { setDragId(null); setDragOverId(null); }

  // Mobil uchun: HTML5 drag-and-drop touch ekranlarda ishlamaydi, shuning
  // uchun yuqoriga/pastga tugmalari orqali xuddi shu tur (positive/negative)
  // ichida qo'shni odat bilan joy almashtiradigan muqobil yo'l
  function moveHabit(habitId: string, direction: -1 | 1) {
    setHabits((prev) => {
      const habit = prev.find((h) => h.id === habitId);
      if (!habit) return prev;
      const sameType = prev.filter((h) => h.type === habit.type);
      const idx = sameType.findIndex((h) => h.id === habitId);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= sameType.length) return prev;
      const swapHabit = sameType[swapIdx];
      const arr = [...prev];
      const i1 = arr.findIndex((h) => h.id === habit.id);
      const i2 = arr.findIndex((h) => h.id === swapHabit.id);
      [arr[i1], arr[i2]] = [arr[i2], arr[i1]];
      setHabitOrder(profile.id, arr.map((h) => h.id));
      return arr;
    });
  }

  const positiveHabits = habits.filter((h) => h.type === "positive");
  const negativeHabits = habits.filter((h) => h.type === "negative");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--neon-green)" }} />
      </div>
    );
  }

  const dragProps = { onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, onDragEnd: handleDragEnd, dragId, dragOverId, onMove: moveHabit };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{t('habits_title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('habits_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowGoalPack(true); setSelectedGoal(null); setCheckedPack(new Set()); setAddError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: isDark ? "rgba(96,165,250,0.1)" : "#EFF6FF",
              color: "#60A5FA",
              border: "1px solid rgba(96,165,250,0.25)",
            }}
          >
            <Sparkles size={13} /> {t('habits_bundle')}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: showForm ? "rgba(74,222,128,0.1)" : "var(--neon-green)",
              color: showForm ? "var(--neon-green)" : "#0E1117",
              border: showForm ? "1px solid rgba(74,222,128,0.3)" : "none",
            }}
          >
            <Plus size={15} /> {t('habits_new')}
          </button>
        </div>
      </div>

      {/* Add form — odat nomi endi FAQAT quyidagi katalogdan tanlanadi;
          spam/axlat nom kiritishning oldini olish uchun erkin matn maydoni
          butunlay olib tashlangan (faqat mavjud odatni tahrirlashda nom
          hali ham o'zgartirilishi mumkin, chunki bu yaratish emas). */}
      {showForm && (
        <div style={{ ...card, border: "1px solid rgba(74,222,128,0.2)", background: isDark ? "rgba(74,222,128,0.04)" : "#F0FDF4" }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} style={{ color: "#4ADE80" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('habits_catalog_title')}</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{t('habits_catalog_sub')}</p>

          <div
            className="mb-4 rounded-xl p-3 max-h-72 overflow-y-auto"
            style={{
              background: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
            }}
          >
            {(newType === "positive" ? TEMPLATES_POS : TEMPLATES_NEG).map((group) => (
              <div key={group.catKey} className="mb-3 last:mb-0">
                <p
                  className="text-[10px] font-semibold mb-2 uppercase tracking-wide"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t(group.catKey as any)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((tpl) => {
                    const key = `${tpl.emoji}|${tpl.name}`;
                    const isSelected = selectedTemplateKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: isSelected ? (isDark ? "rgba(74,222,128,0.18)" : "#DCFCE7") : isDark ? "rgba(255,255,255,0.06)" : "#fff",
                          border: `1px solid ${isSelected ? "rgba(74,222,128,0.6)" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.09)"}`,
                          color: isSelected ? "#4ADE80" : "var(--foreground)",
                        }}
                      >
                        {isSelected && <Check size={11} />}
                        <span>{tpl.emoji}</span>
                        <span>{tpl.name}</span>
                        {tpl.metric === "time" && (
                          <span style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                            {tpl.target}d
                          </span>
                        )}
                        {tpl.metric === "count" && (
                          <span style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                            {tpl.target}{tpl.unit}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            {(["positive", "negative"] as const).map((typ) => (
              <button key={typ} onClick={() => { setNewType(typ); setNewEmoji(typ === "positive" ? "🌅" : "📱"); setNewName(""); setSelectedTemplateKey(null); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: newType === typ ? (typ === "positive" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)") : isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6",
                  color: newType === typ ? (typ === "positive" ? "var(--neon-green)" : "var(--coral-red)") : "var(--muted-foreground)",
                  border: `1px solid ${newType === typ ? (typ === "positive" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)") : "transparent"}`,
                }}
              >{typ === "positive" ? t('habits_positive_tab') : t('habits_negative_tab')}</button>
            ))}
          </div>
          {/* Tanlangan odat ko'rinishi — nom/emoji/o'lchov endi faqat
              yuqoridagi katalog orqali belgilanadi */}
          <div className="mb-4">
            {selectedTemplateKey ? (
              <div
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
                style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", border: "1px solid rgba(74,222,128,0.3)" }}
              >
                <span style={{ fontSize: 22 }}>{newEmoji}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{newName}</span>
              </div>
            ) : (
              <p
                className="text-xs px-3.5 py-3 rounded-xl text-center"
                style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6", color: "var(--muted-foreground)" }}
              >
                {t('habits_catalog_select_hint')}
              </p>
            )}
          </div>
          {metricType === "count" && (
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t('habits_goal_count')}</label>
                <input type="number" style={inputStyle} min={1} value={newTarget === 0 ? "" : newTarget}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewTarget(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t('habits_unit')}</label>
                <input style={inputStyle} placeholder={t('habits_unit_ph_short')} value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </div>
            </div>
          )}
          {metricType === "time" && (
            <div className="mb-4">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t('habits_goal_min')}</label>
              <div className="flex items-center gap-3">
                <input type="number" style={{ ...inputStyle, width: "auto", flex: 1 }} min={5} step={5} value={newTarget === 0 ? "" : newTarget}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewTarget(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))} />
                <span className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>daqiqa</span>
                {newTarget >= 60 && <span className="text-xs px-2 py-1 rounded-lg" style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", color: "#4ADE80" }}>= {Math.floor(newTarget / 60)}s {newTarget % 60 > 0 ? `${newTarget % 60}d` : ""}</span>}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="text-xs font-medium mb-2 block" style={{ color: "var(--muted-foreground)" }}>{t('habits_schedule')}</label>
            <div className="flex items-center gap-2">
              <input type="time" aria-label={t('habits_start_time')} style={{ ...inputStyle, flex: 1 }} value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>—</span>
              <input type="time" aria-label={t('habits_end_time')} style={{ ...inputStyle, flex: 1 }} value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </div>
          </div>
          {addError && <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>⚠ {addError}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newName.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: saving || !newName.trim() ? "rgba(74,222,128,0.3)" : "var(--neon-green)", color: "#0E1117" }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t('add')}
            </button>
            <button onClick={() => { setShowForm(false); setNewName(""); setSelectedTemplateKey(null); }} className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6", color: "var(--muted-foreground)" }}>{t('cancel_short')}</button>
          </div>
        </div>
      )}

      {/* Goal Pack Modal */}
      {showGoalPack && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setShowGoalPack(false); setSelectedGoal(null); }}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ background: isDark ? "#161B22" : "#fff", maxHeight: "85vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                {selectedGoal && (
                  <button type="button" onClick={() => setSelectedGoal(null)}
                    className="p-1.5 rounded-lg mr-1"
                    style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}>
                    <X size={15} style={{ color: "var(--foreground)" }} />
                  </button>
                )}
                <div className="flex-1">
                  <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {selectedGoal ? t(GOAL_PACKS.find((g) => g.id === selectedGoal)?.labelKey as any) : t('habits_bundle_title')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {selectedGoal ? t(GOAL_PACKS.find((g) => g.id === selectedGoal)?.descKey as any) : t('habits_bundle_sub')}
                  </p>
                </div>
                <button type="button" onClick={() => { setShowGoalPack(false); setSelectedGoal(null); }}
                  className="p-1.5 rounded-lg"
                  style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}>
                  <X size={15} style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>

              {!selectedGoal ? (
                <div className="grid grid-cols-2 gap-3">
                  {GOAL_PACKS.map((g) => (
                    <button key={g.id} type="button"
                      onClick={() => {
                        setSelectedGoal(g.id);
                        setCheckedPack(new Set(g.habits.map((_, i) => i)));
                      }}
                      className="flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all"
                      style={{
                        background: isDark ? `${g.color}12` : `${g.color}18`,
                        border: `1px solid ${g.color}30`,
                      }}>
                      <span style={{ fontSize: 28 }}>{g.emoji}</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t(g.labelKey as any)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t(g.descKey as any)}</p>
                        <p className="text-[10px] mt-1.5 font-semibold" style={{ color: g.color }}>
                          {g.habits.length} ta odat
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {(() => {
                    const goal = GOAL_PACKS.find((g) => g.id === selectedGoal)!;
                    return (
                      <div className="flex flex-col gap-2">
                        {goal.habits.map((h, i) => {
                          const checked = checkedPack.has(i);
                          return (
                            <button key={i} type="button"
                              onClick={() => setCheckedPack((prev) => {
                                const next = new Set(prev);
                                checked ? next.delete(i) : next.add(i);
                                return next;
                              })}
                              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                              style={{
                                background: checked
                                  ? isDark ? `${goal.color}12` : `${goal.color}10`
                                  : isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                                border: `1px solid ${checked ? `${goal.color}35` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                              }}>
                              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                style={{ background: checked ? goal.color : isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB" }}>
                                {checked && <Check size={12} style={{ color: "#0E1117" }} />}
                              </div>
                              <span style={{ fontSize: 20 }}>{h.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{h.name}</p>
                                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                                  {h.metric === "check" ? t('habits_yesno_label')
                                    : h.metric === "time" ? `${h.target} daqiqa`
                                    : `${h.target} ${h.unit}`}
                                  {h.type === "negative" && <span className="ml-1.5 px-1 rounded text-[10px]" style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}>{t('habits_restriction_badge')}</span>}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                        {addError && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>⚠ {addError}</p>}
                        <button type="button"
                          onClick={handleBulkAdd}
                          disabled={bulkAdding || checkedPack.size === 0}
                          className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                          style={{
                            background: checkedPack.size === 0 ? "rgba(74,222,128,0.3)" : "var(--neon-green)",
                            color: "#0E1117",
                            opacity: bulkAdding ? 0.7 : 1,
                          }}>
                          {bulkAdding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                          {bulkAdding ? t('habits_bulk_adding') : `${checkedPack.size} ${t('habits_bulk_add_btn')}`}
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Positive habits */}
      <div style={card}>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={16} style={{ color: "var(--neon-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('habits_positive_section')}</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isDark ? "rgba(74,222,128,0.1)" : "#DCFCE7", color: "var(--neon-green)" }}>
            {positiveHabits.length} ta
          </span>
        </div>
        {positiveHabits.length === 0
          ? <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('habits_no_positive')}</p>
          : (
            <div className="space-y-2">
              {positiveHabits.map((h) => (
                <HabitRow key={h.id} habit={h} isDark={isDark} inputStyle={inputStyle}
                  editingId={editingId} editName={editName} editEmoji={editEmoji} editMetricType={editMetricType}
                  editTarget={editTarget} editUnit={editUnit} editStartTime={editStartTime} editEndTime={editEndTime}
                  editSaving={editSaving} editError={editError}
                  onStartEdit={startEditing} onCancelEdit={cancelEdit} onSaveEdit={handleEditSave} onDelete={handleDelete}
                  setEditName={setEditName} setEditEmoji={setEditEmoji} setEditMetricType={setEditMetricType}
                  setEditTarget={setEditTarget} setEditUnit={setEditUnit}
                  setEditStartTime={setEditStartTime} setEditEndTime={setEditEndTime}
                  accentColor="rgba(74,222,128" rowBg={isDark ? "rgba(74,222,128,0.04)" : "#F0FDF4"} rowBorder="rgba(74,222,128,0.1)"
                  emojis={EMOJIS_POSITIVE} {...dragProps} />
              ))}
            </div>
          )
        }
      </div>

      {/* Negative habits */}
      <div style={{ ...card, border: `1px solid ${isDark ? "rgba(248,113,113,0.12)" : "rgba(248,113,113,0.2)"}` }}>
        <div className="flex items-center gap-2 mb-4">
          <XCircle size={16} style={{ color: "var(--coral-red)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('habits_negative_section')}</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isDark ? "rgba(248,113,113,0.1)" : "#FEF2F2", color: "var(--coral-red)" }}>
            {negativeHabits.length} ta
          </span>
        </div>
        {negativeHabits.length === 0
          ? <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('habits_no_negative')}</p>
          : (
            <div className="space-y-2">
              {negativeHabits.map((h) => (
                <HabitRow key={h.id} habit={h} isDark={isDark} inputStyle={inputStyle}
                  editingId={editingId} editName={editName} editEmoji={editEmoji} editMetricType={editMetricType}
                  editTarget={editTarget} editUnit={editUnit} editStartTime={editStartTime} editEndTime={editEndTime}
                  editSaving={editSaving} editError={editError}
                  onStartEdit={startEditing} onCancelEdit={cancelEdit} onSaveEdit={handleEditSave} onDelete={handleDelete}
                  setEditName={setEditName} setEditEmoji={setEditEmoji} setEditMetricType={setEditMetricType}
                  setEditTarget={setEditTarget} setEditUnit={setEditUnit}
                  setEditStartTime={setEditStartTime} setEditEndTime={setEditEndTime}
                  accentColor="rgba(248,113,113" rowBg={isDark ? "rgba(248,113,113,0.04)" : "#FFF5F5"} rowBorder="rgba(248,113,113,0.1)"
                  emojis={EMOJIS_NEGATIVE} {...dragProps} />
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

interface HabitRowProps {
  habit: Habit;
  isDark: boolean;
  inputStyle: React.CSSProperties;
  editingId: string | null;
  editName: string;
  editEmoji: string;
  editMetricType: "check" | "count" | "time";
  editTarget: number;
  editUnit: string;
  editStartTime: string;
  editEndTime: string;
  editSaving: boolean;
  editError: string;
  onStartEdit: (h: Habit) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;
  setEditName: (v: string) => void;
  setEditEmoji: (v: string) => void;
  setEditMetricType: (v: "check" | "count" | "time") => void;
  setEditTarget: (v: number) => void;
  setEditUnit: (v: string) => void;
  setEditStartTime: (v: string) => void;
  setEditEndTime: (v: string) => void;
  accentColor: string;
  rowBg: string;
  rowBorder: string;
  emojis: string[];
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  dragId: string | null;
  dragOverId: string | null;
  onMove: (habitId: string, direction: -1 | 1) => void;
}

function HabitRow({
  habit, isDark, inputStyle, editingId, editName, editEmoji, editMetricType,
  editTarget, editUnit, editStartTime, editEndTime, editSaving, editError,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete, setEditName, setEditEmoji,
  setEditMetricType, setEditTarget, setEditUnit, setEditStartTime, setEditEndTime,
  accentColor, rowBg, rowBorder, emojis, onDragStart, onDragOver, onDrop, onDragEnd, dragId, dragOverId, onMove,
}: HabitRowProps) {
  const { t } = useLang();
  const isEditing = editingId === habit.id;
  const isDragging = dragId === habit.id;
  const isDragOver = dragOverId === habit.id;

  if (isEditing) {
    return (
      <div className="px-3 py-3 rounded-xl flex flex-col gap-3"
        style={{ background: rowBg, border: `1px solid ${rowBorder}` }}>
        <div className="flex flex-wrap gap-1">
          {emojis.map((e) => (
            <button key={e} onClick={() => setEditEmoji(e)}
              className="w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all"
              style={{
                background: editEmoji === e ? isDark ? `${accentColor},0.2)` : "#DCFCE7" : isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6",
                border: editEmoji === e ? `1px solid ${accentColor},0.4)` : "1px solid transparent",
              }}>{e}</button>
          ))}
        </div>
        <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }} autoFocus />
        <div className="flex gap-2">
          {([{ v: "check", label: t('habits_simple') }, { v: "count", label: t('habits_count') }, { v: "time", label: t('habits_time_m') }] as const).map(({ v, label }) => (
            <button key={v} onClick={() => setEditMetricType(v)} className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: editMetricType === v ? isDark ? `${accentColor},0.15)` : "#DCFCE7" : isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6",
                border: `1px solid ${editMetricType === v ? `${accentColor},0.35)` : "transparent"}`,
                color: editMetricType === v ? "#4ADE80" : "var(--muted-foreground)",
              }}>{label}</button>
          ))}
        </div>
        {editMetricType === "count" && (
          <div className="flex gap-2">
            <input type="number" style={{ ...inputStyle, flex: 1 }} min={1} value={editTarget === 0 ? "" : editTarget}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setEditTarget(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
              onBlur={() => { if (editTarget === 0) setEditTarget(1); }}
              placeholder="Maqsad" />
            <input style={{ ...inputStyle, flex: 1 }} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder={t('habits_unit_ph_full')} />
          </div>
        )}
        {editMetricType === "time" && (
          <div className="flex items-center gap-2">
            <input type="number" aria-label="Daqiqa" style={{ ...inputStyle, flex: 1 }} min={5} step={5} value={editTarget === 0 ? "" : editTarget}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setEditTarget(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
              onBlur={() => { if (editTarget < 5) setEditTarget(5); }}
            />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>daqiqa</span>
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t('habits_schedule')}</label>
          <div className="flex items-center gap-2">
            <input type="time" aria-label={t('habits_start_time')} style={{ ...inputStyle, flex: 1 }} value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>—</span>
            <input type="time" aria-label={t('habits_end_time')} style={{ ...inputStyle, flex: 1 }} value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
          </div>
        </div>
        {editError && <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>⚠ {editError}</p>}
        <div className="flex gap-2">
          <button onClick={onSaveEdit} disabled={editSaving || !editName.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "var(--neon-green)", color: "#0E1117", opacity: editSaving ? 0.6 : 1 }}>
            {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t('save')}
          </button>
          <button type="button" aria-label={t('habits_cancel_edit')} onClick={onCancelEdit} className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(habit.id)}
      onDragOver={(e) => onDragOver(e, habit.id)}
      onDrop={(e) => onDrop(e, habit.id)}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl group transition-all"
      style={{
        background: rowBg,
        border: `1px solid ${isDragOver ? `${accentColor},0.5)` : rowBorder}`,
        opacity: isDragging ? 0.4 : 1,
        transform: isDragOver ? "scale(1.01)" : "scale(1)",
        boxShadow: isDragOver ? `0 0 0 2px ${accentColor},0.3)` : "none",
        cursor: "grab",
      }}
    >
      {/* Drag handle — faqat desktop, chunki HTML5 drag-and-drop touch ekranlarda ishlamaydi */}
      <GripVertical size={14} className="hidden md:block" style={{ color: "var(--muted-foreground)", opacity: 0.4, flexShrink: 0, cursor: "grab" }} />

      {/* Mobil uchun tartiblash tugmalari (drag-and-drop o'rniga) */}
      <div className="flex md:hidden flex-col shrink-0 -my-1">
        <button type="button" aria-label={t('habits_move_up')} onClick={() => onMove(habit.id, -1)}
          className="w-6 h-5 flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
          <ChevronUp size={13} />
        </button>
        <button type="button" aria-label={t('habits_move_down')} onClick={() => onMove(habit.id, 1)}
          className="w-6 h-5 flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
          <ChevronDown size={13} />
        </button>
      </div>

      <span className="text-lg">{habit.emoji}</span>
      <span className="flex-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {habit.name}
        {habit.target_value && habit.target_value > 1 && (
          <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            ({habit.target_value} {habit.unit})
          </span>
        )}
        {habit.scheduled_start && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "rgba(74,222,128,0.12)", color: "var(--neon-green)", fontFamily: "'Geist Mono', monospace" }}>
            ⏰ {habit.scheduled_start.slice(0, 5)}{habit.scheduled_end ? ` — ${habit.scheduled_end.slice(0, 5)}` : ""}
          </span>
        )}
      </span>
      {/* md:opacity-0 + hover — faqat sichqoncha bilan ishlaydigan desktopda; teginish
          ekranlarida hover holati bo'lmagani uchun mobil'da doim ko'rinadi */}
      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
        <button type="button" aria-label={t('edit')} onClick={() => onStartEdit(habit)} className="min-w-[32px] min-h-[32px] md:p-1.5 flex items-center justify-center rounded-lg"
          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--muted-foreground)" }}>
          <Pencil size={12} />
        </button>
        <button type="button" aria-label={t('delete')} onClick={() => onDelete(habit.id)} className="min-w-[32px] min-h-[32px] md:p-1.5 flex items-center justify-center rounded-lg"
          style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
