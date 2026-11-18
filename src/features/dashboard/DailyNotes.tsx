import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../hooks/queries";
import { toast } from "sonner";
import { Save, Smile, Lock, Laugh, Meh, Frown, Angry } from "lucide-react";
import { getDailyNote, upsertDailyNote, getHealthLog } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { tashkentTodayAnchor, toDateStr } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import { MONTHS_FULL, DAYS_SHORT, DAYS_FULL } from "../../utils/i18n";
import { HabitIcon } from "../../components/HabitIcon";
import { AutoMetricsCard } from "./AutoMetricsCard";

interface DailyNotesProps {
  profile: Profile;
  /** Tanlangan kun — Kundalikdagi yagona hafta navigatoridan (WeekNavigator) */
  date: string;
}

export function DailyNotes({ profile, date }: DailyNotesProps) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const MOODS = [
    { value: 5, icon: Laugh, label: t('notes_mood_excellent'), color: '#10B981', glow: 'rgba(16,185,129,0.3)' },
    { value: 4, icon: Smile, label: t('notes_mood_good'),      color: '#22D3EE', glow: 'rgba(34,211,238,0.3)' },
    { value: 3, icon: Meh,   label: t('notes_mood_normal'),    color: '#FBBF24', glow: 'rgba(245,158,11,0.3)' },
    { value: 2, icon: Frown, label: t('notes_mood_bad'),       color: '#FB923C', glow: 'rgba(249,115,22,0.3)' },
    { value: 1, icon: Angry, label: t('notes_mood_terrible'),  color: '#F43F5E', glow: 'rgba(244,63,94,0.3)' },
  ];
  const now = tashkentTodayAnchor();
  const todayStr = toDateStr(now);

  const selectedDate = date;
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [sleepHours, setSleepHours] = useState<number | undefined>(undefined);
  const [screenHours, setScreenHours] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

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

  async function handleSave() {
    if (isReadOnly) return;
    setSaving(true);

    // 1. Optimistic local update
    const cacheKey = `daily_note_cache_${profile.id}_${selectedDate}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ content, mood }));
    } catch (e) {
      console.warn("Failed to update local cache", e);
    }

    try {
      const writes: Promise<any>[] = [upsertDailyNote(profile.id, selectedDate, content, mood)];

      // 2. Network sync with 5-second timeout race
      const syncPromise = Promise.all(writes);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), 5000)
      );

      await Promise.race([syncPromise, timeoutPromise]);
      // Oylik jadval (MonthGrid), Analytics va Salomatlik keshlari yangilansin.
      queryClient.invalidateQueries({ queryKey: ['notes', profile.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.health(profile.id) });

      setSaved(true);
      toast.success(t('log_metrics_saved'));
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.warn("Daily note save fallback to local:", e?.message);
      // Notify user gently
      toast.info("Yozuv mahalliy saqlandi (offline)");

      // Still treat as saved to unblock the UI
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    finally {
      // 3. Always reset loading state
      setSaving(false);
    }
  }

  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;
  // Faqat bugungi kun tahrirlanadi — o'tgan kunlar faqat o'qish uchun,
  // Sarhisob (WeeklyReflection)dagi bilan bir xil naqsh.
  const isReadOnly = !isToday;

  const cardStyle: React.CSSProperties = {
    background: "rgba(22,27,34,0.85)",
    border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: 14,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mood */}
      <div style={cardStyle} className="p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-5 text-slate-500">
          {t('notes_metrics')}
        </p>
        <div>
          {/* Mood */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Smile size={14} className="text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('notes_mood_label')}</span>
            </div>
            <div className="grid grid-cols-5 gap-2 w-full">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => !isReadOnly && setMood(mood === m.value ? undefined : m.value)}
                  disabled={isReadOnly}
                  title={m.label}
                  className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl transition-all duration-200 active:scale-95 border"
                  style={{
                    background: mood === m.value
                      ? `${m.color}33`
                      : "rgba(255,255,255,0.03)",
                    borderColor: mood === m.value
                      ? `${m.color}66`
                      : "rgba(255,255,255,0.05)",
                    boxShadow: mood === m.value ? `0 0 15px ${m.glow}` : "none",
                    opacity: isReadOnly && mood !== m.value ? 0.5 : 1,
                    cursor: isReadOnly ? "default" : "pointer",
                  }}
                >
                  <m.icon
                    size={22}
                    strokeWidth={2.5}
                    style={{ color: mood === m.value ? m.color : "rgba(255,255,255,0.3)" }}
                  />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide text-center px-1"
                    style={{ color: mood === m.value ? m.color : "rgba(255,255,255,0.3)" }}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Uyqu va ekran vaqti — avtomatik (Health Connect + UsageStats) */}
      {!isFuture && (
        <AutoMetricsCard
          userId={profile.id}
          isToday={isToday}
          storedSleepHours={sleepHours}
          storedScreenHours={screenHours}
        />
      )}

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
            background: "rgba(255,255,255,0.04)",
            border: `1px solid rgba(255,255,255,0.07)`,
            color: "var(--foreground)",
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.7,
            opacity: isReadOnly ? 0.5 : 1,
          }}
        />
        {isReadOnly && !isFuture && !loading && (
          <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            <Lock size={12} /> {t('notes_readonly_hint')}
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
              ? "rgba(255,255,255,0.06)"
              : saved ? ("rgba(74,222,128,0.15)") : "#4ADE80",
            color: isReadOnly ? "var(--muted-foreground)" : saved ? "#4ADE80" : "#0a0a0a",
            border: !isReadOnly && saved ? "1px solid rgba(74,222,128,0.4)" : "none",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {isReadOnly ? <Lock size={15} /> : <Save size={15} />}
          {isReadOnly ? t('reflect_readonly_locked') : saving ? t('notes_saving') : saved ? t('notes_saved') : t('save')}
        </button>
      )}
    </div>
  );
}
