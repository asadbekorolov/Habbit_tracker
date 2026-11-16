// Tahlil (Analytics) — Yo'nalishlar balansi.
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

const PERIOD_LABEL: Record<string, string> = {
  weekly: "So'nggi 7 kunda",
  monthly: "So'nggi 30 kunda",
  yearly: "So'nggi 1 yilda",
  all: "Barcha vaqt davomida",
};

const DOMAIN_COLOR: Record<string, string> = {
  Rivojlanish: "#A855F7",
  "Sog'lik": "#10B981",
  Ruhiyat: "#F472B6",
  Mehnat: "#22D3EE",
};

export function CategoryBalance({ s }: { s: AnalyticsData }) {
  const { categoryBalance, card, timeFilter } = s;
  const max = Math.max(...categoryBalance.map((c) => c.done), 1);

  return (
    <div style={{ ...card, background: "rgba(22,27,34,0.85)" }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="p-2 rounded-xl bg-purple-400/10">
          <Sparkles size={16} className="text-purple-400" />
        </div>
        <h3 className="font-semibold text-sm text-white">Yo'nalishlar balansi</h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        {PERIOD_LABEL[timeFilter] ?? "Tanlangan davrda"} har bir yo'nalishda necha marta odat bajarilgani
      </p>
      <div className="space-y-4">
        {categoryBalance.map(({ domain, done, habitCount }) => {
          const pct = Math.round((done / max) * 100);
          const color = DOMAIN_COLOR[domain] ?? "#A855F7";
          return (
            <div key={domain}>
              <div className="flex justify-between items-baseline text-[11px] mb-1 font-medium">
                <span className="text-slate-300">
                  {domain}
                  {habitCount > 0 && <span className="text-slate-500 font-normal"> · {habitCount} ta odat</span>}
                </span>
                <span className="text-white font-mono">{done} marta</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
