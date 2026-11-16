// Kunlik raqamli ko'rsatkichlar (tabiatda / do'stlar bilan o'tkazilgan vaqt) —
// health_logs ga yoziladi. Kundalikdagi kun oynasida ishlatiladi.
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SlidersHorizontal, Loader2, Save } from "lucide-react";
import { getHealthLog, upsertHabitMetric, type HabitMetricKey } from "../../services/db";
import type { Profile } from "../../services/supabase";
import { useLang } from "../../store/LangContext";

export function NumericMetrics({ inputStyle, profile, logDate, locked }: { inputStyle: React.CSSProperties; profile: Profile; logDate: string; locked: boolean;
}) {
  const { t } = useLang();
  const [natureTime, setNatureTime] = useState(0);
  const [savedNature, setSavedNature] = useState(0);
  const [savingNature, setSavingNature] = useState(false);
  const [socialTime, setSocialTime] = useState(0);
  const [savedSocial, setSavedSocial] = useState(0);
  const [savingSocial, setSavingSocial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHealthLog(profile.id, logDate).then((log) => {
      if (cancelled) return;
      const n = log?.nature_time_minutes ?? 0;
      const s = log?.social_time_minutes ?? 0;
      setNatureTime(n); setSavedNature(n);
      setSocialTime(s); setSavedSocial(s);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile.id, logDate]);

  async function saveMetric(key: HabitMetricKey, value: number, setSaving: (v: boolean) => void, setSaved: (v: number) => void) {
    setSaving(true);
    try {
      await upsertHabitMetric(profile.id, key, logDate, value);
      setSaved(value);
      toast.success(t('log_metrics_saved'));
    } catch (e: any) {
      toast.info("Mahalliy saqlandi");
      setSaved(value);
    } finally {
      setSaving(false);
    }
  }

  const disabled = locked || loading;

  return (
    <div className="p-6 rounded-[2rem] glass" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center gap-2 mb-6">
        <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white">{t('log_metrics')}</h3>
      </div>
      <div className="space-y-10">
        <MetricSlider
          label={t('log_nature_time')} value={natureTime} onChange={setNatureTime}
          max={120} target={60} color="#10B981" unit={t('minutes')} step={5}
          dirty={natureTime !== savedNature} saving={savingNature} disabled={disabled}
          onSave={() => saveMetric('nature_time_minutes', natureTime, setSavingNature, setSavedNature)}
        />
        <MetricSlider
          label={t('log_social_time')} value={socialTime} onChange={setSocialTime}
          max={180} target={60} color="#C084FC" unit={t('minutes')} step={5}
          dirty={socialTime !== savedSocial} saving={savingSocial} disabled={disabled}
          onSave={() => saveMetric('social_time_minutes', socialTime, setSavingSocial, setSavedSocial)}
        />
      </div>
    </div>
  );
}

interface MetricSliderProps {
  label: string; value: number; onChange: (v: number) => void;
  max: number; target: number; color: string; unit: string;
  step?: number; dirty: boolean; saving: boolean; disabled: boolean; onSave: () => void;
}

function MetricSlider({ label, value, onChange, max, target, color, unit, step = 1, dirty, saving, disabled, onSave }: MetricSliderProps) {
  const { t } = useLang();
  const canSave = dirty && !saving && !disabled;

  return (
    <div style={{ opacity: disabled ? 0.6 : 1 }} className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-white text-sm">{label}</span>
        <div className="flex items-center gap-3">
           <span className="text-xs font-mono text-emerald-400 font-black">{value} / {target} {unit.slice(0,3)}</span>
           <button onClick={onSave} disabled={!canSave} className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400 disabled:opacity-30">
             {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
           </button>
        </div>
      </div>
      <input
        type="range" min={0} max={Math.max(max, value)} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10"
        style={{ accentColor: color }}
      />
    </div>
  );
}
