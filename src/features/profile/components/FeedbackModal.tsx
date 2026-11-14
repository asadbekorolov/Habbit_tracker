import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, Loader2, CheckCircle2, Bug, Sparkles, MessageSquare } from "lucide-react";
import { submitFeedback } from "../../../services/db";
import type { Profile } from "../../../services/supabase";
import { useLang } from "../../../store/LangContext";
import { useHaptics } from "../../../hooks/useHaptics";
import { useScrollLock } from "../../../hooks/useScrollLock";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  profile: Profile;
}

export type FeedbackType = "bug" | "suggestion" | "feedback";

export function FeedbackModal({ isOpen, onClose, isDark = true, profile }: FeedbackModalProps) {
  const { t } = useLang();
  const { notificationSuccess, impactLight } = useHaptics();
  useScrollLock(isOpen);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Keyboard Escape listener for Android hardware back button
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");

    try {
      await submitFeedback(profile.id, feedbackType, message.trim());
      await notificationSuccess();
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage("");
        onClose();
      }, 1500);
    } catch (e: any) {
      setError(e?.message || "Yuborishda xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally {
      setSending(false);
    }
  }

  const typeOptions: { id: FeedbackType; label: string; icon: React.ElementType; color: string }[] = [
    { id: "bug", label: "Xatolik", icon: Bug, color: "#F87171" },
    { id: "suggestion", label: "Taklif", icon: Sparkles, color: "#FBBF24" },
    { id: "feedback", label: "Fikr", icon: MessageSquare, color: "#38BDF8" },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overscroll-contain touch-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800/90 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white">Fikr va Takliflar</h3>
            <p className="text-xs text-slate-400 mt-0.5">Ilovani yaxshilashda yordam bering</p>
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

        {sent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Rahmat! Xabaringiz yuborildi</p>
              <p className="text-xs text-slate-400 mt-1">Sizning fikringiz ilovani yaxshilashga yordam beradi.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Segmented Selector for Type */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Murojaat turi
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
                {typeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = feedbackType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        impactLight();
                        setFeedbackType(opt.id);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "bg-slate-800 text-white shadow-md border border-slate-700"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Icon size={14} style={{ color: active ? opt.color : undefined }} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Xabar matni
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  {message.length}/500
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder={
                  feedbackType === "bug"
                    ? "Xatolik haqida batafsil yozing..."
                    : feedbackType === "suggestion"
                    ? "Qanday yangi imkoniyat qo'shilishini xohlaysiz?"
                    : "Fikringizni qoldiring..."
                }
                rows={4}
                maxLength={500}
                className="w-full rounded-2xl bg-slate-950/60 border border-slate-800 focus:border-emerald-500/50 p-3.5 text-sm text-slate-200 outline-none resize-none transition-all placeholder:text-slate-600"
              />
            </div>

            {error && (
              <p className="text-xs px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                {error}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-800 text-slate-400 hover:text-white font-semibold text-sm transition-all cursor-pointer active:scale-95"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{sending ? "Yuborilmoqda..." : "Yuborish"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
