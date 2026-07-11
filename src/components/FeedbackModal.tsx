import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { submitFeedback } from "../services/db";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";

interface FeedbackModalProps {
  isDark: boolean;
  profile: Profile;
  onClose: () => void;
}

export function FeedbackModal({ isDark, profile, onClose }: FeedbackModalProps) {
  const { t } = useLang();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!content.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await submitFeedback(profile.id, content.trim());
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
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: isDark ? "#161B22" : "#fff", paddingBottom: "env(safe-area-inset-bottom)" }}
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
              className="p-1.5 rounded-lg"
              style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}
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
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('feedback_ph')}
                rows={5}
                maxLength={1000}
                autoFocus
                className="w-full resize-none rounded-xl p-3.5 text-sm outline-none transition-all"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
                  color: "var(--foreground)",
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1.7,
                }}
              />
              <p className="text-[10px] text-right mt-1 mb-3" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                {content.length}/1000
              </p>
              {error && (
                <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>⚠ {error}</p>
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
