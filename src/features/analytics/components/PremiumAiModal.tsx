// Tahlil (Analytics) — PremiumAiModal.
import { motion } from "framer-motion";
import { Loader2, Sparkles, Coins } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function PremiumAiModal({ s }: { s: AnalyticsData }) {
  const { coachLoading, setShowPremiumAI, handlePremiumAI } = s;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
       <motion.div
         initial={{ scale: 0.9, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="w-full max-w-md p-6 rounded-3xl bg-[#161B22] border border-amber-500/30 shadow-2xl"
       >
          <div className="flex items-center gap-3 mb-4">
             <div className="p-3 rounded-2xl bg-amber-500/20">
                <Sparkles className="w-6 h-6 text-amber-400" />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white">Premium AI Tahlil</h2>
                <p className="text-xs text-slate-400">Shaxsiy murabbiyingizdan chuqur tahlil</p>
             </div>
          </div>

          <div className="space-y-4 mb-6">
             <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-300 leading-relaxed">
                   Ushbu tahlil sizning:
                   <br />• <b>Eng kuchsiz odatlaringiz</b> va ularni tuzatish yo'llari
                   <br />• <b>Eng mahsuldor vaqtlaringiz</b> tahlili
                   <br />• <b>Psixologik tavsiyalar</b> va motivatsiyani oshirish
                   <br />ni o'z ichiga oladi.
                </p>
             </div>
             <div className="flex justify-between items-center px-1">
                <span className="text-xs text-slate-500">Narxi:</span>
                <div className="flex items-center gap-1">
                   <span className="text-sm font-black text-amber-400">200</span>
                   <Coins className="w-3.5 h-3.5 text-amber-400" />
                </div>
             </div>
          </div>

          <div className="flex gap-3">
             <button
               onClick={() => setShowPremiumAI(false)}
               className="flex-1 py-3 rounded-2xl bg-white/5 text-slate-400 text-sm font-bold active:scale-95 transition-all"
             >
                Bekor qilish
             </button>
             <button
               onClick={handlePremiumAI}
               disabled={coachLoading}
               className="flex-1 py-3 rounded-2xl bg-amber-500 text-black text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-2"
             >
                {coachLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tasdiqlash"}
             </button>
          </div>
       </motion.div>
    </div>
  );
}
