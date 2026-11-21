// "Do'stlarni taklif qilish" — shaxsiy kod, nusxalash, ulashish, Telegram
// va (yangi foydalanuvchi uchun) do'st kodini qo'lda kiritish.
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Gift, Copy, Check, Share2, Send, Loader2, AlertTriangle, UserPlus, Coins, Ticket } from "lucide-react";
import { useLang } from "../../../store/LangContext";
import { useUser } from "../../../store/UserContext";
import { useScrollLock } from "../../../hooks/useScrollLock";
import { useReferralInfoQuery } from "../../../hooks/queries";
import { applyReferralCode } from "../../../services/db";
import { queryClient, queryKeys } from "../../../services/queryClient";
import { normalizeReferralCode, referralLink, REFERRED_BONUS, REFERRER_BONUS } from "../../../utils/referral";
import { copyText, openExternal, shareLink, telegramShareUrl } from "../../../utils/share";

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function inviteRuleText(t: (k: any) => string): string {
  return t("ref_rule").replace("{a}", String(REFERRER_BONUS)).replace("{b}", String(REFERRED_BONUS));
}

export function InviteFriendsModal({ isOpen, onClose }: InviteFriendsModalProps) {
  const { t } = useLang();
  const { profile, updateCoins } = useUser();
  useScrollLock(isOpen);
  const infoQ = useReferralInfoQuery(profile?.id);
  const info = infoQ.data;
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const link = info ? referralLink(info.code) : "";
  const shareText = info ? t("ref_share_text").replace("{code}", info.code).replace("{b}", String(REFERRED_BONUS)) : "";

  const hoursLeft = info?.can_apply
    ? Math.max(1, Math.ceil((new Date(info.apply_until).getTime() - Date.now()) / 3_600_000))
    : 0;

  async function handleCopy() {
    if (!info) return;
    if (await copyText(info.code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else toast.error(t("ref_copy_failed"));
  }

  async function handleShare() {
    if (!info) return;
    const r = await shareLink({ title: t("ref_share_title"), text: shareText, url: link, dialogTitle: t("ref_share_title") });
    if (r === "copied") toast.success(t("ref_link_copied"));
    else if (r === "failed") toast.error(t("ref_copy_failed"));
  }

  async function handleTelegram() {
    if (!info) return;
    await openExternal(telegramShareUrl(link, shareText));
  }

  async function handleApply() {
    const code = normalizeReferralCode(input);
    if (!code) { setError(t("svc_ref_invalid_code")); return; }
    if (!profile || applying) return;
    setApplying(true);
    setError("");
    try {
      const r = await applyReferralCode(code);
      updateCoins(r.coins);
      setInput("");
      toast.success(t("ref_applied_toast").replace("{n}", String(r.bonus)));
      await queryClient.invalidateQueries({ queryKey: queryKeys.referral(profile.id) });
    } catch (e: any) {
      setError(e?.message || t("svc_ref_generic"));
    } finally {
      setApplying(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[88vh] overflow-y-auto overscroll-contain touch-pan-y border border-slate-800/80"
        style={{ background: "#0d121c", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <Gift size={17} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">{t("ref_modal_title")}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-modal-close-trigger
              aria-label={t("ref_close")}
              className="p-1.5 rounded-lg bg-white/[0.07]"
            >
              <X size={15} className="text-slate-400" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">{inviteRuleText(t)}</p>

          {infoQ.isPending ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-emerald-400" /></div>
          ) : !info ? (
            <div className="rounded-2xl p-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{t("svc_ref_generic")}</span>
              <button type="button" onClick={() => infoQ.refetch()} className="font-bold text-rose-200 underline underline-offset-2">{t("ref_retry")}</button>
            </div>
          ) : (
            <>
              {/* Shaxsiy kod */}
              <div className="rounded-3xl p-4 bg-emerald-500/[0.06] border border-emerald-500/25">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80 mb-2">{t("ref_your_code")}</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-bold tracking-[0.2em] text-white select-all">{info.code}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 active:scale-95"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? t("ref_copied") : t("ref_copy")}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-emerald-500 text-[#05210f] active:scale-[0.98]"
                >
                  <Share2 size={16} /> {t("ref_share")}
                </button>
                <button
                  type="button"
                  onClick={handleTelegram}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 active:scale-[0.98]"
                >
                  <Send size={16} /> {t("ref_telegram")}
                </button>
              </div>

              {/* Statistika */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl p-3 bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><UserPlus size={12} /> {t("ref_invited")}</div>
                  <div className="font-mono text-xl font-bold text-white mt-1">{info.invited_count}</div>
                </div>
                <div className="rounded-2xl p-3 bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Coins size={12} /> {t("ref_earned")}</div>
                  <div className="font-mono text-xl font-bold text-amber-300 mt-1">+{info.earned_coins}</div>
                </div>
              </div>

              {/* Do'st kodini kiritish (faqat yangi foydalanuvchi, 48 soat) */}
              {info.can_apply && (
                <div className="rounded-3xl p-4 bg-slate-900/60 border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white"><Ticket size={14} className="text-emerald-400" /> {t("ref_enter_title")}</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {t("ref_enter_hint").replace("{b}", String(REFERRED_BONUS)).replace("{h}", String(hoursLeft))}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => { setInput(e.target.value.toUpperCase().slice(0, 8)); setError(""); }}
                      placeholder="X7K9P2A"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={applying}
                      className="flex-1 min-w-0 rounded-xl px-3 py-2.5 font-mono text-sm tracking-[0.15em] text-white outline-none bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={applying || !input.trim()}
                      className="px-4 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {t("ref_apply")}
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle size={12} className="shrink-0" />{error}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
