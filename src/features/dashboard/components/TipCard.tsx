// Bosh sahifa — "Bilasizmi?" maslahati: bir vaqtda faqat bittasi, X bilan
// yopiladi (yopilgani qurilmada saqlanadi va boshqa chiqmaydi).
import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Shield, Timer, Clock, NotebookPen, Bell, X, ChevronRight } from "lucide-react";
import { useLang } from "../../../store/LangContext";
import { pickTip, loadDismissedTips, saveDismissedTips, type TipId } from "../../../utils/tips";

type K = Parameters<ReturnType<typeof useLang>["t"]>[0];

const TIPS: Record<TipId, { icon: React.ElementType; title: K; body: K; cta?: { label: K; tab: string } }> = {
  freeze: { icon: Shield, title: "tip_freeze_title", body: "tip_freeze_body" },
  minutes: { icon: Timer, title: "tip_minutes_title", body: "tip_minutes_body" },
  routine: { icon: Clock, title: "tip_routine_title", body: "tip_routine_body", cta: { label: "tip_routine_cta", tab: "habits?section=routines" } },
  notes: { icon: NotebookPen, title: "tip_notes_title", body: "tip_notes_body", cta: { label: "tip_notes_cta", tab: "journal" } },
  reminder: { icon: Bell, title: "tip_reminder_title", body: "tip_reminder_body" },
};

export function TipCard({ userId, onNavigate }: { userId: string; onNavigate?: (tab: string) => void }) {
  const { t } = useLang();
  const [dismissed, setDismissed] = useState(() => loadDismissedTips(userId));
  const tipId = pickTip(dismissed);

  const dismiss = (id: TipId) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissedTips(userId, next);
  };

  return (
    <AnimatePresence mode="wait">
      {tipId && (
        <motion.aside
          key={tipId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.2 }}
          className="relative rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 pr-10"
        >
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              {React.createElement(TIPS[tipId].icon, { className: "w-4 h-4" })}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                <Lightbulb className="w-3 h-3" /> {t("tip_label")}
              </p>
              <h3 className="text-sm font-semibold text-slate-100 mt-0.5">{t(TIPS[tipId].title)}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t(TIPS[tipId].body)}</p>
              {TIPS[tipId].cta && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(TIPS[tipId].cta!.tab)}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-400 cursor-pointer"
                >
                  {t(TIPS[tipId].cta!.label)} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(tipId)}
            aria-label={t("tip_dismiss")}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
