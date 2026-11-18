// Kundalik: avtomatik uyqu (Health Connect) va ekran vaqti (UsageStats) — faqat o'qish.
// Bugun (Android) — jonli qiymat; o'tgan kunlar va veb — health_logs dagi saqlangan qiymat.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Moon, Smartphone, ShieldCheck, HeartPulse } from "lucide-react";
import { readAutoMetrics, requestScreenTimePermission, requestSleepPermission } from "../../services/autoMetricsService";
import { formatHoursMinutes } from "../../utils/autoMetrics";
import { useLang } from "../../store/LangContext";

interface AutoMetricsCardProps {
  userId: string;
  isToday: boolean;
  /** health_logs dagi saqlangan qiymatlar (soat) */
  storedSleepHours?: number;
  storedScreenHours?: number;
}

export function AutoMetricsCard({ userId, isToday, storedSleepHours, storedScreenHours }: AutoMetricsCardProps) {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();
  const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const liveQ = useQuery({
    queryKey: ["autoMetrics", userId],
    queryFn: readAutoMetrics,
    enabled: native && isToday,
    staleTime: 60_000,
    meta: { persist: false },
  });
  const live = isToday ? liveQ.data : undefined;

  const sleepMin = live?.sleepMinutes ?? (storedSleepHours != null ? Math.round(storedSleepHours * 60) : null);
  const screenMin = live?.screenMinutes ?? (storedScreenHours != null ? Math.round(storedScreenHours * 60) : null);
  const fmt = (m: number | null) => (m == null ? "—" : formatHoursMinutes(m, lang));

  const needScreen = !!live?.supported && !live.screenGranted;
  const needSleep = !!live?.supported && !live.sleepGranted;

  async function connectSleep() {
    await requestSleepPermission();
    queryClient.invalidateQueries({ queryKey: ["autoMetrics", userId] });
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[rgba(22,27,34,0.85)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t("auto_metrics_title")}</p>
        {live?.supported && (live.screenGranted || live.sleepGranted) && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t("auto_live")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
            <Moon className="w-3.5 h-3.5" /> {t("auto_sleep")}
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-white">{fmt(sleepMin)}</p>
        </div>
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
            <Smartphone className="w-3.5 h-3.5" /> {t("auto_screen")}
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-white">{fmt(screenMin)}</p>
        </div>
      </div>

      {needScreen && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => requestScreenTimePermission()}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-[#04120c] text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" /> {t("auto_connect_screen")}
          </button>
          <p className="text-[10.5px] leading-snug text-slate-500 text-center">{t("auto_connect_hint")}</p>
        </div>
      )}
      {needSleep && (
        <button
          type="button"
          onClick={connectSleep}
          className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <HeartPulse className="w-3.5 h-3.5 text-indigo-300" /> {t("auto_connect_sleep")}
        </button>
      )}
      {!native && <p className="text-[10.5px] text-slate-500">{t("auto_web_hint")}</p>}
    </div>
  );
}
