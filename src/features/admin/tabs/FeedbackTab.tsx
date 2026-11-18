// Admin panel — "Fikr va takliflar": foydalanuvchilar yuborgan xatolik,
// taklif va savollar. O'qilmaganlar tepada; har birida to'liq ism,
// email/@username, tur, to'liq matn va yuborilgan vaqt.
import { useState } from "react";
import {
  Loader2, MessageSquare, Download, AlertTriangle, Bug, Sparkles, HelpCircle,
  MessageCircle, CheckCheck, Undo2, Trash2, Mail, AtSign, Clock,
} from "lucide-react";
import { DATE_LOCALE } from "../adminShared";
import type { AdminPanelState } from "../useAdminPanelState";
import type { FeedbackEntry, FeedbackKind } from "../../../services/db";

const KIND: Record<FeedbackKind, { icon: React.ElementType; key: "fb_type_bug" | "fb_type_suggestion" | "fb_type_question" | "fb_type_feedback"; cls: string }> = {
  bug: { icon: Bug, key: "fb_type_bug", cls: "text-rose-300 bg-rose-500/10 border-rose-500/25" },
  suggestion: { icon: Sparkles, key: "fb_type_suggestion", cls: "text-amber-300 bg-amber-500/10 border-amber-500/25" },
  question: { icon: HelpCircle, key: "fb_type_question", cls: "text-sky-300 bg-sky-500/10 border-sky-500/25" },
  feedback: { icon: MessageCircle, key: "fb_type_feedback", cls: "text-slate-300 bg-slate-500/10 border-slate-500/25" },
};

function authorName(f: FeedbackEntry): string {
  return (f.full_name || "").trim() || (f.display_name || "").trim() || (f.username ? `@${f.username}` : "—");
}

export function FeedbackTab({ s }: { s: AdminPanelState }) {
  const {
    t, lang, feedback, feedbackLoading, feedbackError, replyDrafts, setReplyDrafts, replyingId, replyError,
    handleSendReply, exportFeedbackCsv, unreadFeedback, feedbackBusyId, handleToggleFeedbackRead, handleDeleteFeedback,
  } = s;
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const locale = DATE_LOCALE[lang] || "uz-UZ";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
    });
  const list = filter === "unread" ? feedback.filter((f) => !f.is_read) : feedback;

  return (
    <section className="rounded-3xl bg-slate-900/60 border border-slate-800 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" /> {t("admin_tab_feedback")}
            <span className="font-mono text-xs text-slate-400">({feedback.length})</span>
          </h3>
          {unreadFeedback > 0 && (
            <p className="text-[11px] font-mono text-emerald-400 mt-0.5">{t("adm_fb_unread_n").replace("{n}", String(unreadFeedback))}</p>
          )}
        </div>
        <button
          type="button"
          onClick={exportFeedbackCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/25 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> {t("admin_export_csv")}
        </button>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl bg-slate-950/60 border border-slate-800 w-fit">
        {(["all", "unread"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              filter === k ? "bg-slate-800 text-white" : "text-slate-400"
            }`}
          >
            {k === "all" ? t("adm_fb_all") : t("adm_fb_unread")}
            {k === "unread" && unreadFeedback > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-mono font-bold flex items-center justify-center">
                {unreadFeedback}
              </span>
            )}
          </button>
        ))}
      </div>

      {feedbackLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-emerald-400" /></div>
      ) : feedbackError ? (
        <p className="text-sm text-center py-4 text-rose-300"><AlertTriangle className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]" />{feedbackError}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-center py-6 text-slate-400">{filter === "unread" ? t("adm_fb_no_unread") : t("admin_feedback_empty")}</p>
      ) : (
        <div className="space-y-3">
          {list.map((f) => {
            const kind = KIND[f.type] || KIND.feedback;
            const KindIcon = kind.icon;
            const busy = feedbackBusyId === f.id;
            return (
              <article
                key={f.id}
                className={`p-3.5 rounded-2xl border space-y-2.5 ${
                  f.is_read ? "bg-slate-950/40 border-slate-800" : "bg-emerald-500/[0.06] border-emerald-500/30"
                }`}
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      {!f.is_read && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-label={t("adm_fb_new")} />}
                      {authorName(f)}
                    </p>
                    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-slate-400 mt-0.5">
                      {f.email && <span className="flex items-center gap-1 min-w-0"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{f.email}</span></span>}
                      {f.username && <span className="flex items-center gap-1"><AtSign className="w-3 h-3 shrink-0" />{f.username}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${kind.cls}`}>
                    <KindIcon className="w-3 h-3" /> {t(kind.key)}
                  </span>
                </header>

                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-200">{f.content}</p>

                <p className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <Clock className="w-3 h-3" /> {fmt(f.created_at)}
                </p>

                {f.admin_reply ? (
                  <div className="pl-3 border-l-2 border-emerald-500/40 space-y-0.5">
                    <p className="text-[10px] font-semibold text-emerald-400">
                      {t("admin_feedback_your_reply")}
                      {f.admin_replied_at && <span className="font-mono text-slate-500"> · {fmt(f.admin_replied_at)}</span>}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">{f.admin_reply}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={replyDrafts[f.id] || ""}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                      placeholder={t("admin_feedback_reply_ph")}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none bg-slate-900 border border-slate-800 focus:border-emerald-500/40 text-slate-100 placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendReply(f.id)}
                      disabled={replyingId === f.id || !(replyDrafts[f.id] || "").trim()}
                      className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 disabled:opacity-50 cursor-pointer"
                    >
                      {replyingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                      {t("admin_feedback_reply_btn")}
                    </button>
                  </div>
                )}

                <footer className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleFeedbackRead(f.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-60 ${
                      f.is_read ? "text-slate-300 border-slate-700 bg-slate-900" : "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    }`}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : f.is_read ? <Undo2 className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
                    {f.is_read ? t("adm_fb_mark_unread") : t("adm_fb_mark_read")}
                  </button>
                  {confirmDeleteId === f.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setConfirmDeleteId(null); handleDeleteFeedback(f.id); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white cursor-pointer disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t("adm_fb_delete_confirm")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 border border-slate-700 cursor-pointer"
                      >
                        {t("tp_cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDeleteId(f.id)}
                      aria-label={t("adm_fb_delete")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 border border-rose-500/25 bg-rose-500/10 cursor-pointer disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t("adm_fb_delete")}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
          {replyError && (
            <p className="text-xs text-center text-rose-300"><AlertTriangle className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]" />{replyError}</p>
          )}
        </div>
      )}
    </section>
  );
}
