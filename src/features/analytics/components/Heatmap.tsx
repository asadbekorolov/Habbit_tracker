// Tahlil (Analytics) — Heatmap.
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function Heatmap({ s }: { s: AnalyticsData }) {
  const { t, heatmapData, card, getHeatColor } = s;

  return (
    <div style={{ ...card, background: "rgba(22,27,34,0.85)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-400/10">
            <Calendar size={16} className="text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              Faollik Matritsasi
            </h3>
            <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
              So'nggi 90 kunlik izchillik
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {t('analytics_heatmap_low')}
          </span>
          {[0, 1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: getHeatColor(s) }}
            />
          ))}
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {t('analytics_heatmap_high')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(14px,1fr))] gap-1.5">
        {heatmapData.map((day, i) => (
          <motion.div
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => toast(`${day.date}: ${day.done} ta bajarildi (${day.rate}%)`)}
            className="aspect-square rounded-sm cursor-pointer"
            style={{ background: getHeatColor(day.score) }}
          />
        ))}
      </div>

      <div className="flex justify-between mt-3">
        <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
          {heatmapData[0]?.date}
        </span>
        <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
          Bugun
        </span>
      </div>
    </div>
  );
}
