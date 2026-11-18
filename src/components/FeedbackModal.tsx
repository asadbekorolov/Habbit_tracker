import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, Loader2, CheckCircle2, AlertTriangle, Bug, Sparkles, HelpCircle } from "lucide-react";
import { submitFeedback } from "../services/db";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";
import { useScrollLock } from "../hooks/useScrollLock";

interface FeedbackModalProps {
  profile: Profile;
  onClose: () => void;
}

export function FeedbackModal({ profile, onClose }: FeedbackModalProps) {
  const { t } = useLang();
  useScrollLock(true);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<"bug" | "suggestion" | "question">("suggestion");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!content.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await submitFeedback(profile.id, kind, content.trim());
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setError(e?.message || t('feedback_error'));
    } finally {
      setSending(false);
    }
  }

  // Portal to document.body — Sidebar (the caller) sits in its own stacking
  // context, so a normal in-tree fixed overlay here could still render behind
  // siblings like the Profile card that establish their own stacking context.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
        style={{ background: "#161B22", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t('feedback_title')}</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t('feedback_subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-modal-close-trigger
              className="p-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <X size={15} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CheckCircle2 size={32} style={{ color: "#4ADE80" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('feedback_sent')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3" role="radiogroup" aria-label={t('fb_type_label')}>
                {([
                  { id: "bug", label: t('fb_type_bug'), Icon: Bug, color: "#F87171" },
                  { id: "suggestion", label: t('fb_type_suggestion'), Icon: Sparkles, color: "#FBBF24" },
                  { id: "question", label: t('fb_type_question'), Icon: HelpCircle, color: "#38BDF8" },
                ] as const).map(({ id, label, Icon, color }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={kind === id}
                    onClick={() => setKind(id)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${kind === id ? "bg-slate-800 border-slate-700 text-white" : "border-white/5 text-slate-400"}`}
                  >
                    <Icon size={13} style={{ color: kind === id ? color : undefined }} /> {label}
                  </button>
                ))}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('feedback_ph')}
                rows={5}
                maxLength={1000}
                autoFocus
                className="w-full resize-none rounded-xl p-3.5 text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(255,255,255,0.07)`,
                  color: "var(--foreground)",
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1.7,
                }}
              />
              <p className="text-[10px] text-right mt-1 mb-3" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {content.length}/1000
              </p>
              {error && (
                <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}</p>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending || !content.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: !content.trim() ? "rgba(74,222,128,0.3)" : "var(--neon-green)",
                  color: "#0E1117",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? t('feedback_sending') : t('feedback_submit')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
