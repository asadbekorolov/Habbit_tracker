// "Odatlarni ulashish": tanlangan odatlardan to'plam (059) yaratib, havola
// beradi. Maxfiylik: salbiy (cheklov) odatlar sukut bo'yicha belgilanmagan.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Share2, Check, Copy, Send, Loader2, AlertTriangle, ShieldAlert, Link2, Package } from "lucide-react";
import { useLang } from "../../store/LangContext";
import { useProfile } from "../../store/UserContext";
import { useScrollLock } from "../../hooks/useScrollLock";
import { useReferralInfoQuery } from "../../hooks/queries";
import { createHabitPack } from "../../services/db";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { defaultPackSelection, packLink } from "../../utils/habitPack";
import { copyText, openExternal, shareLink, telegramShareUrl } from "../../utils/share";
import type { Habit } from "../../services/supabase";

const MAX_ITEMS = 30;

interface ShareHabitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  habits: Habit[];
}

export function ShareHabitsModal({ isOpen, onClose, habits }: ShareHabitsModalProps) {
  const { t } = useLang();
  const profile = useProfile();
  useScrollLock(isOpen);
  const { data: refInfo } = useReferralInfoQuery(profile.id);
  const [title, setTitle] = useState(() => t("pack_default_title"));
  const [selected, setSelected] = useState<Set<string>>(() => defaultPackSelection(habits));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; count: number; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Ro'yxatdagi tartibda (salbiylar oxirida emas — foydalanuvchi ko'rgan tartib)
  const ordered = useMemo(() => habits.filter((h) => h.is_active !== false), [habits]);
  const selectedIds = ordered.filter((h) => selected.has(h.id)).map((h) => h.id);

  if (!isOpen) return null;

  const link = result ? packLink(result.code, refInfo?.code) : "";
  const shareText = result
    ? t("pack_share_text").replace("{title}", result.title).replace("{n}", String(result.count))
    : "";

  function toggle(id: string) {
    setError("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_ITEMS) next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (creating) return;
    const clean = title.trim();
    if (!clean) { setError(t("svc_pack_invalid_title")); return; }
    if (selectedIds.length === 0) { setError(t("svc_pack_no_habits")); return; }
    setCreating(true);
    setError("");
    try {
      const r = await createHabitPack(clean, selectedIds);
      setResult({ ...r, title: clean });
    } catch (e: any) {
      setError(e?.message || t("svc_pack_create_error"));
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else toast.error(t("ref_copy_failed"));
  }

  async function handleShare() {
    const r = await shareLink({ title: t("pack_share_title"), text: shareText, url: link });
    if (r === "copied") toast.success(t("ref_link_copied"));
    else if (r === "failed") toast.error(t("ref_copy_failed"));
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={() => !creating && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-800/80"
        style={{ background: "#0d121c", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
              <Share2 size={16} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white">{t("pack_share_modal_title")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close-trigger
            disabled={creating}
            aria-label={t("ref_close")}
            className="p-1.5 rounded-lg bg-white/[0.07]"
          >
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {result ? (
          <div className="px-5 pb-5 space-y-4 overflow-y-auto overscroll-contain touch-pan-y">
            <div className="rounded-3xl p-4 bg-emerald-500/[0.06] border border-emerald-500/25 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Package size={15} className="text-emerald-400" />
                <span className="truncate">{result.title}</span>
                <span className="font-mono text-[11px] text-emerald-300 ml-auto shrink-0">{result.count} {t("pack_habits_count")}</span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 bg-black/30 border border-white/[0.06]">
                <Link2 size={14} className="text-slate-500 shrink-0" />
                <span className="font-mono text-[11px] text-slate-200 truncate flex-1 select-all">{link.replace(/^https:\/\//, "")}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {t("pack_code_label")}: <span className="font-mono font-bold tracking-widest text-slate-300">{result.code}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={handleCopy} className="flex flex-col items-center justify-center gap-1 py-3 px-1.5 rounded-2xl text-[11px] leading-tight text-center font-semibold bg-slate-800/80 text-slate-200 border border-slate-700/60 active:scale-[0.98]">
                {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? t("ref_copied") : t("pack_copy_link")}
              </button>
              <button type="button" onClick={() => openExternal(telegramShareUrl(link, shareText))} className="flex flex-col items-center justify-center gap-1 py-3 px-1.5 rounded-2xl text-[11px] leading-tight text-center font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 active:scale-[0.98]">
                <Send size={17} /> {t("share_btn_telegram")}
              </button>
              <button type="button" onClick={handleShare} className="flex flex-col items-center justify-center gap-1 py-3 px-1.5 rounded-2xl text-[11px] leading-tight text-center font-semibold bg-emerald-500 text-[#05210f] active:scale-[0.98]">
                <Share2 size={17} /> {t("share_btn_share")}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t("pack_result_hint")}</p>
          </div>
        ) : (
          <>
            <div className="px-5 space-y-3 shrink-0">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("pack_title_label")}</span>
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value.slice(0, 80)); setError(""); }}
                  maxLength={80}
                  disabled={creating}
                  className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40"
                />
              </label>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{t("pack_select_hint")}</span>
                <span className="font-mono text-emerald-300">{selectedIds.length}/{ordered.length}</span>
              </div>
            </div>

            <div className="px-5 py-3 space-y-1.5 overflow-y-auto overscroll-contain touch-pan-y min-h-0">
              {ordered.map((h) => {
                const on = selected.has(h.id);
                const negative = h.type === "negative";
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggle(h.id)}
                    disabled={creating}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all ${
                      on ? "bg-emerald-500/[0.07] border-emerald-500/30" : "bg-slate-900/50 border-slate-800/80"
                    }`}
                  >
                    <HabitIcon emoji={h.emoji} name={h.name} size={16} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{cleanHabitName(h.name)}</span>
                      {negative && (
                        <span className="flex items-center gap-1 text-[10px] text-rose-300/80">
                          <ShieldAlert size={10} /> {t("pack_negative_note")}
                        </span>
                      )}
                    </span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${on ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}>
                      {on && <Check size={13} className="text-[#05210f]" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-5 pt-3 space-y-2 shrink-0 border-t border-white/[0.05]">
              {error && (
                <p className="text-xs px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="shrink-0" />{error}
                </p>
              )}
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || selectedIds.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-emerald-500 text-[#05210f] disabled:opacity-50 active:scale-[0.99]"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {t("pack_create_link")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
