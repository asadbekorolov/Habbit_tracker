// Tahlil (Analytics) — CategoryBalance.
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function CategoryBalance({ s }: { s: AnalyticsData }) {
  const { categoryBalance, card } = s;

  return (
    <div style={{ ...card, background: "rgba(22,27,34,0.85)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-purple-400/10">
          <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          Yo'nalishlar balansi
        </h3>
      </div>
      <div className="space-y-4">
        {Object.entries(categoryBalance).map(([cat, val]) => {
          const max = Math.max(...Object.values(categoryBalance), 1);
          const pct = Math.round((val / max) * 100);
          return (
            <div key={cat}>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="text-slate-500 dark:text-muted-foreground">{cat}</span>
                <span className="text-slate-900 dark:text-foreground">{val} ta</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                 <motion.div
                   initial={{ width: 0 }}
                   animate={{ width: `${pct}%` }}
                   className="h-full bg-purple-500 rounded-full"
                 />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
