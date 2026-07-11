import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Save, Sparkles, TrendingUp, Lock } from "lucide-react";
import { getWeeklyReflection, upsertWeeklyReflection } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { toDateStr } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import { MONTHS_SHORT, DAYS_FULL, type Lang } from "../../utils/i18n";

interface WeeklyReflectionProps {
  isDark: boolean;
  profile: Profile;
}

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return toDateStr(d);
}

function formatWeekRange(weekStart: string, lang: Lang): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekStart + "T00:00:00");
  end.setDate(end.getDate() + 6);
  return `${start.getDate()} ${MONTHS_SHORT[lang][start.getMonth()]} — ${end.getDate()} ${MONTHS_SHORT[lang][end.getMonth()]} ${end.getFullYear()}`;
}

export function WeeklyReflection({ isDark, profile }: WeeklyReflectionProps) {
  const { t, lang } = useLang();
  const todayWeekStart = getWeekStart();
  const [weekStart, setWeekStart] = useState(todayWeekStart);
  const [wentWell, setWentWell] = useState("");
  const [improveNext, setImproveNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isCurrentWeek = weekStart === todayWeekStart;
  const isFutureWeek = weekStart > todayWeekStart;
  // Hafta hali to'liq tugamagan bo'lsa baholash chala ma'lumotga asoslanadi —
  // shuning uchun joriy hafta faqat Shanba 18:00dan keyin yoki Yakshanba
  // kuni tahrirlanadi. O'tgan (va nazariy jihatdan kelajak) haftalar esa
  // har doim faqat ko'rish uchun.
  const now = new Date();
  const isWeekendWindow = now.getDay() === 0 || (now.getDay() === 6 && now.getHours() >= 18);
  const isPastWeek = !isCurrentWeek;
  const isTimeLocked = isCurrentWeek && !isWeekendWindow;
  const isReadOnly = isPastWeek || isTimeLocked;

  const loadReflection = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    try {
      const data = await getWeeklyReflection(profile.id, weekStart);
      setWentWell(data?.went_well || "");
      setImproveNext(data?.improve_next || "");
    } catch {
      setWentWell("");
      setImproveNext("");
    } finally {
      setLoading(false);
    }
  }, [profile.id, weekStart]);

  useEffect(() => { loadReflection(); }, [loadReflection]);

  function prevWeek() {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(toDateStr(d));
  }

  function nextWeek() {
    if (isCurrentWeek) return;
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 7);
    const next = toDateStr(d);
    if (next <= todayWeekStart) setWeekStart(next);
  }

  async function handleSave() {
    if (isReadOnly) return;
    setSaving(true);
    setSaveError("");
    try {
      await upsertWeeklyReflection(profile.id, weekStart, wentWell, improveNext);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveError(e?.message || t('err_loading'));
    }
    finally { setSaving(false); }
  }

  const card: React.CSSProperties = {
    background: isDark ? "rgba(22,27,34,0.85)" : "var(--card)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 14,
  };

  const textarea: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
    color: "var(--foreground)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    resize: "none",
    lineHeight: 1.7,
    fontFamily: "'Inter', sans-serif",
    opacity: isReadOnly ? 0.5 : 1,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Week navigator */}
      <div style={card} className="p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}
          >
            <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold flex items-center justify-center gap-1.5" style={{ color: "var(--foreground)" }}>
              {isCurrentWeek ? t('reflect_this_week') : t('reflect_last_week')}
              {isReadOnly && <Lock size={11} style={{ color: "var(--muted-foreground)" }} />}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {formatWeekRange(weekStart, lang)}
            </p>
          </div>

          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-lg"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", opacity: isCurrentWeek ? 0.3 : 1 }}
          >
            <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
          </button>
        </div>

        {isReadOnly && !loading && (
          <p className="text-[11px] mt-3 pt-3 text-center" style={{ color: "var(--muted-foreground)", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
            🔒 {isPastWeek ? t('reflect_readonly_hint') : t('reflect_time_locked_hint')}
          </p>
        )}

        {/* Days of week mini row */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart + "T00:00:00");
            d.setDate(d.getDate() + i);
            const ds = toDateStr(d);
            const today = toDateStr();
            const isPast = ds <= today;
            const isToday = ds === today;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg"
                style={{
                  background: isToday ? "#4ADE80" : isDark ? "rgba(255,255,255,0.03)" : "#F3F4F6",
                  opacity: isPast ? 1 : 0.35,
                  minWidth: 36,
                }}
              >
                <span className="text-[9px]" style={{ color: isToday ? "#0a0a0a" : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {DAYS_FULL[lang][d.getDay()].slice(0, 2)}
                </span>
                <span className="text-xs font-bold" style={{ color: isToday ? "#0a0a0a" : "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question 1: Went well */}
      <div style={card} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: isDark ? "rgba(74,222,128,0.15)" : "#DCFCE7" }}>
            <Sparkles size={14} style={{ color: "#4ADE80" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t('reflect_q1_title')}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {t('reflect_q1_sub')}
            </p>
          </div>
        </div>
        <textarea
          style={textarea}
          rows={5}
          placeholder={
            isFutureWeek
              ? t('reflect_future_week')
              : loading
              ? t('notes_loading_ph')
              : t('reflect_q1_ph')
          }
          value={loading ? "" : wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          disabled={isReadOnly || loading}
          maxLength={1000}
        />
        <p className="text-[10px] text-right mt-1" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
          {wentWell.length}/1000
        </p>
      </div>

      {/* Question 2: Improve next */}
      <div style={card} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: isDark ? "rgba(96,165,250,0.15)" : "#EFF6FF" }}>
            <TrendingUp size={14} style={{ color: "#60A5FA" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t('reflect_q2_title')}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {t('reflect_q2_sub')}
            </p>
          </div>
        </div>
        <textarea
          style={textarea}
          rows={5}
          placeholder={
            isFutureWeek
              ? t('reflect_future_week')
              : loading
              ? t('notes_loading_ph')
              : t('reflect_q2_ph')
          }
          value={loading ? "" : improveNext}
          onChange={(e) => setImproveNext(e.target.value)}
          disabled={isReadOnly || loading}
          maxLength={1000}
        />
        <p className="text-[10px] text-right mt-1" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
          {improveNext.length}/1000
        </p>
      </div>

      {/* Save — o'tgan haftalarda disabled, faqat joriy hafta tahrirlanadi */}
      <button
        onClick={handleSave}
        disabled={saving || loading || isReadOnly}
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
        {isReadOnly ? (isPastWeek ? t('reflect_readonly_locked') : t('reflect_time_locked_btn')) : saving ? t('notes_saving') : saved ? t('notes_saved') : t('reflect_save_btn')}
      </button>
      {saveError && (
        <p className="text-xs text-center" style={{ color: "var(--coral-red)" }}>⚠ {saveError}</p>
      )}
    </div>
  );
}
