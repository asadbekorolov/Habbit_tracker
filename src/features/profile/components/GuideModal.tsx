import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, Zap, Coins, Heart, ChevronDown, ChevronUp, Sparkles, HelpCircle } from "lucide-react";
import { useScrollLock } from "../../../hooks/useScrollLock";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuideModal({ isOpen, onClose }: GuideModalProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const faqs = [
    {
      icon: Zap,
      color: "#38BDF8",
      question: "XP (Tajriba) va Darajalar qanday hisoblanadi?",
      answer:
        "Har kuni rejalashtirilgan odatlarni bajarganingizda sizga XP va daraja (Level) ballari beriladi. Har bir bajarilgan ijobiy odat uchun 5 XP beriladi. XP to'plaganingiz sari darajangiz va unvonlaringiz oshadi.",
    },
    {
      icon: Coins,
      color: "#FBBF24",
      question: "Tangalar nimaga kerak va qanday to'planadi?",
      answer:
        "Tangalar — IDROK ichki valyutasi bo'lib, uning yordamida Do'kondan profil ramkalari, unvonlar, streak qalqonlari va AI murabbiy tahlilini xarid qilishingiz mumkin. Kunlik odat bajarganda tangalar mukofot sifatida beriladi.",
    },
    {
      icon: Heart,
      color: "#F43F5E",
      question: "Health Connect va Salomatlik integratsiyasi",
      answer:
        "IDROK ilovasi qurilmangizning Health Connect servisi bilan sinxronlashib, kunlik qadamlar, uyqu vaqti va jismoniy faollik ko'rsatkichlarini avtomatik ravishda jurnalga kiritib boradi.",
    },
    {
      icon: HelpCircle,
      color: "#10B981",
      question: "Streak (Uzluksiz seriya) nima?",
      answer:
        "Streak — ketma-ket har kuni odatni o'tkazib yubormasdan bajarilgan kunlar soni. Agar biror kun kutilmaganda qolib ketsa, Do'kondan Streak Qalqoni yoki Tiklash qalqonini ishlatishingiz mumkin.",
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overscroll-contain touch-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white max-h-[85vh] flex flex-col relative overflow-hidden overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Qo'llanma va FAQ</h3>
              <p className="text-xs text-slate-400 mt-0.5">Asosiy imkoniyatlar bo'yicha ko'rsatma</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close-trigger
            aria-label="Yopish"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3 overflow-y-auto flex-1 pr-1">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            const Icon = faq.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-950/60 border border-slate-800 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors hover:bg-slate-800/30 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${faq.color}15`, border: `1px solid ${faq.color}30` }}
                    >
                      <Icon size={16} style={{ color: faq.color }} />
                    </div>
                    <span className="text-xs font-bold text-slate-200 leading-snug">{faq.question}</span>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-400 leading-relaxed border-t border-slate-800/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
          >
            Tushundim
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
