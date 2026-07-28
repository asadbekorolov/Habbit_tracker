import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Save, Moon, Monitor, Smile, Lock } from "lucide-react";
import { getDailyNote, upsertDailyNote, getHealthLog, upsertHealthLog } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { toDateStr } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import { MONTHS_FULL, DAYS_SHORT, DAYS_FULL } from "../../utils/i18n";

interface DailyNotesProps {
  isDark: boolean;
  profile: Profile;
}

export function DailyNotes({ isDark, profile }: DailyNotesProps) {
  const { t, lang } = useLang();
  const MOODS = [
    { value: 5, emoji: "😄", label: t('notes_mood_excellent') },
    { value: 4, emoji: "🙂", label: t('notes_mood_good') },
    { value: 3, emoji: "😐", label: t('notes_mood_normal') },
    { value: 2, emoji: "😕", label: t('notes_mood_bad') },
    { value: 1, emoji: "😞", label: t('notes_mood_terrible') },
  ];
  const now = new Date();
  const todayStr = toDateStr(now);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [sleepHours, setSleepHours] = useState<number | undefined>(undefined);
  const [screenHours, setScreenHours] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  const parsedDate = new Date(selectedDate + "T00:00:00");
  const dayOfWeek = parsedDate.getDay();
  const dayNum = parsedDate.getDate();
  const monthName = MONTHS_FULL[lang][parsedDate.getMonth()];
  const yearNum = parsedDate.getFullYear();

  const loadNote = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    // Ikkalasi mustaqil so'rov — biri (masalan health_logs) vaqtincha
    // muvaffaqiyatsiz bo'lsa ham, ikkinchisi (daily_notes)dan muvaffaqiyatli
    // yuklangan ma'lumot bekor qilinmasligi kerak (avval Promise.all bittasi
    // rad etilsa ikkalasini ham bo'sh qilib qo'yardi).
    const [noteResult, healthResult] = await Promise.allSettled([
      getDailyNote(profile.id, selectedDate),
      getHealthLog(profile.id, selectedDate),
    ]);
    const note = noteResult.status === "fulfilled" ? noteResult.value : null;
    const health = healthResult.status === "fulfilled" ? healthResult.value : null;
    setContent(note?.content || "");
    setMood(note?.mood ?? undefined);
    setSleepHours(health?.sleep_hours ?? undefined);
    setScreenHours(health?.screen_time_hours ?? undefined);
    setLoading(false);
  }, [profile.id, selectedDate]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  function prevDay() {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateStr(d));
  }

  function nextDay() {
    if (selectedDate >= todayStr) return;
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(toDateStr(d));
  }

  async function handleSave() {
    if (isReadOnly) return;
    setSaving(true);
    setSaveError("");
    try {
      // sleep_hours/screen_time_hours faqat foydalanuvchi ularni haqiqatan
      // o'zgartirgan (yoki avval yuklangan) bo'lsa yuboriladi — aks holda
      // undefined qiymatni null sifatida jo'natish upsert'da health_logs'dagi
      // MAVJUD qiymatni jim o'chirib yuborardi (masalan HealthPage'da
      // kiritilgan uyqu vaqti, faqat kayfiyat/eslatma saqlanganda ham).
      const healthFields: { sleep_hours?: number; screen_time_hours?: number } = {};
      if (sleepHours !== undefined) healthFields.sleep_hours = sleepHours;
      if (screenHours !== undefined) healthFields.screen_time_hours = screenHours;

      const writes: Promise<any>[] = [upsertDailyNote(profile.id, selectedDate, content, mood)];
      if (Object.keys(healthFields).length > 0) {
        writes.push(upsertHealthLog(profile.id, selectedDate, healthFields));
      }
      await Promise.all(writes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setSaveError(e?.message || t('notes_save_error'));
    }
    finally { setSaving(false); }
  }

  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;
  // Faqat bugungi kun tahrirlanadi — o'tgan kunlar faqat o'qish uchun,
  // Sarhisob (WeeklyReflection)dagi bilan bir xil naqsh.
  const isReadOnly = !isToday;

  const cardStyle: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Date nav */}
      <div style={cardStyle} className="p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={prevDay}
            className="p-1.5 rounded-lg"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}
          >
            <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {isToday ? `${t('today')} — ` : ""}{DAYS_FULL[lang][dayOfWeek]}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {dayNum} {monthName} {yearNum}
            </p>
          </div>

          <button
            onClick={nextDay}
            disabled={isToday}
            className="p-1.5 rounded-lg"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              opacity: isToday ? 0.3 : 1,
            }}
          >
            <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
          </button>
        </div>

        {/* Quick date chips: last 7 days */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const ds = toDateStr(d);
            const isSelected = ds === selectedDate;
            const dow = d.getDay();
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all"
                style={{
                  background: isSelected
                    ? "#4ADE80"
                    : isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6",
                  minWidth: 40,
                }}
              >
                <span className="text-[9px]" style={{ color: isSelected ? "#0a0a0a" : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {DAYS_SHORT[lang][dow]}
                </span>
                <span className="text-xs font-semibold" style={{ color: isSelected ? "#0a0a0a" : "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mood + Sleep + Screen */}
      <div style={cardStyle} className="p-4">
        <p className="text-xs font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>
          {t('notes_metrics')}
        </p>
        <div className="flex flex-col gap-3">
          {/* Mood */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Smile size={13} style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('notes_mood_label')}</span>
            </div>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => !isReadOnly && setMood(mood === m.value ? undefined : m.value)}
                  disabled={isReadOnly}
                  title={m.label}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all"
                  style={{
                    background: mood === m.value
                      ? isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7"
                      : isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6",
                    border: `1px solid ${mood === m.value ? "rgba(74,222,128,0.4)" : "transparent"}`,
                    flex: 1,
                    opacity: isReadOnly && mood !== m.value ? 0.5 : 1,
                    cursor: isReadOnly ? "default" : "pointer",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                  <span className="text-[9px]" style={{ color: mood === m.value ? "#4ADE80" : "var(--muted-foreground)" }}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sleep + Screen in a row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Sleep */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Moon size={13} style={{ color: "#60A5FA" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('notes_sleep_label')}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.5}
                  value={sleepHours ?? 0}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  disabled={isReadOnly}
                  className="flex-1"
                  style={{ accentColor: "#60A5FA", opacity: isReadOnly ? 0.5 : 1 }}
                />
                <span
                  className="text-xs font-bold w-8 text-right"
                  style={{ color: "#60A5FA", fontFamily: "'Geist Mono', monospace" }}
                >
                  {sleepHours ?? 0}h
                </span>
              </div>
            </div>

            {/* Screen */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Monitor size={13} style={{ color: "#F87171" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t('notes_screen_label')}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.5}
                  value={screenHours ?? 0}
                  onChange={(e) => setScreenHours(parseFloat(e.target.value))}
                  disabled={isReadOnly}
                  className="flex-1"
                  style={{ accentColor: "#F87171", opacity: isReadOnly ? 0.5 : 1 }}
                />
                <span
                  className="text-xs font-bold w-8 text-right"
                  style={{ color: "#F87171", fontFamily: "'Geist Mono', monospace" }}
                >
                  {screenHours ?? 0}h
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes textarea */}
      <div style={cardStyle} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            {t('notes_note_label')}
          </p>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {content.length} {t('notes_char_count')}
          </span>
        </div>
        <textarea
          value={loading ? "" : content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            loading ? t('notes_loading_ph')
            : isFuture ? t('notes_future_ph')
            : isReadOnly ? t('notes_readonly_empty_ph')
            : t('notes_write_ph')
          }
          disabled={isReadOnly || loading}
          rows={8}
          className="w-full resize-none rounded-xl p-3.5 text-sm outline-none transition-all"
          style={{
            background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
            color: "var(--foreground)",
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.7,
            opacity: isReadOnly ? 0.5 : 1,
          }}
        />
        {isReadOnly && !isFuture && !loading && (
          <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            🔒 {t('notes_readonly_hint')}
          </p>
        )}
      </div>

      {/* Save button — o'tgan kunlarda disabled, faqat bugungi kun tahrirlanadi */}
      {!isFuture && (
        <button
          onClick={handleSave}
          disabled={saving || isReadOnly}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: isReadOnly
              ? isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6"
              : saved ? (isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7") : "#4ADE80",
            color: isReadOnly ? "var(--muted-foreground)" : saved ? "#4ADE80" : "#0a0a0a",
            border: !isReadOnly && saved ? "1px solid rgba(74,222,128,0.4)" : "none",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {isReadOnly ? <Lock size={15} /> : <Save size={15} />}
          {isReadOnly ? t('reflect_readonly_locked') : saving ? t('notes_saving') : saved ? t('notes_saved') : t('save')}
        </button>
      )}
      {saveError && (
        <p className="text-xs text-center" style={{ color: "var(--coral-red)" }}>⚠ {saveError}</p>
      )}
    </div>
  );
}
