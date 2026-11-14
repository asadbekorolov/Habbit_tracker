// Admin panel — FeedbackTab.
import { Loader2, MessageSquare, Download } from "lucide-react";
import { DATE_LOCALE } from "../adminShared";
import type { AdminPanelState } from "../useAdminPanelState";

export function FeedbackTab({ s }: { s: AdminPanelState }) {
  const { t, lang, feedback, feedbackLoading, feedbackError, replyDrafts, setReplyDrafts, replyingId, replyError, handleSendReply, exportFeedbackCsv, cardStyle } = s;

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
          {t('admin_tab_feedback')}
          <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>({feedback.length})</span>
        </h3>
        <button
          onClick={exportFeedbackCsv}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all"
          style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}
        >
          <Download size={12} /> {t('admin_export_csv')}
        </button>
      </div>
      {feedbackLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
      ) : feedbackError ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--coral-red)" }}>⚠ {feedbackError}</p>
      ) : feedback.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>{t('admin_feedback_empty')}</p>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.06)` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  {f.display_name} <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>@{f.username}</span>
                </span>
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                  {new Date(f.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted-foreground)" }}>{f.content}</p>

              {f.admin_reply ? (
                <div className="mt-3 pl-3 flex flex-col gap-1" style={{ borderLeft: `2px solid rgba(74,222,128,0.4)` }}>
                  <span className="text-[10px] font-semibold" style={{ color: "#4ADE80" }}>
                    {t('admin_feedback_your_reply')}
                    {f.admin_replied_at && (
                      <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>
                        {" · "}{new Date(f.admin_replied_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                      </span>
                    )}
                  </span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{f.admin_reply}</p>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    value={replyDrafts[f.id] || ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    placeholder={t('admin_feedback_reply_ph')}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "var(--foreground)" }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSendReply(f.id)}
                    disabled={replyingId === f.id || !(replyDrafts[f.id] || "").trim()}
                    className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{
                      background: "var(--neon-green)", color: "#0E1117",
                      opacity: (replyingId === f.id || !(replyDrafts[f.id] || "").trim()) ? 0.5 : 1,
                    }}
                  >
                    {replyingId === f.id ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                    {t('admin_feedback_reply_btn')}
                  </button>
                </div>
              )}
            </div>
          ))}
          {replyError && <p className="text-xs text-center" style={{ color: "var(--coral-red)" }}>⚠ {replyError}</p>}
        </div>
      )}
    </div>
  );
}
