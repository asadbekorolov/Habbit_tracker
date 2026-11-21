// "Kod orqali olish": ilova ichida (brauzerga o'tmasdan) do'st yuborgan
// to'plam kodini kiritish. Kod serverda tekshiriladi, topilsa
// ImportHabitPackModal ochiladi (ma'lumot keshda — darhol ko'rinadi).
import { useState } from "react";
import { createPortal } from "react-dom";
import { X, KeyRound, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { useLang } from "../../store/LangContext";
import { useScrollLock } from "../../hooks/useScrollLock";
import { getHabitPack } from "../../services/db";
import { queryClient } from "../../services/queryClient";
import { normalizePackCode } from "../../utils/habitPack";

interface EnterPackCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kod topildi — qabul qilish oynasini ochish */
  onFound: (code: string) => void;
}

export function EnterPackCodeModal({ isOpen, onClose, onFound }: EnterPackCodeModalProps) {
  const { t } = useLang();
  useScrollLock(isOpen);
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleOpen() {
    if (checking) return;
    const code = normalizePackCode(value);
    if (!code) { setError(t("pack_code_invalid")); return; }
    setChecking(true);
    setError("");
    try {
      await queryClient.fetchQuery({
        queryKey: ["habitPack", code],
        queryFn: () => getHabitPack(code),
        staleTime: 60_000,
      });
      onFound(code);
    } catch (e: any) {
      setError(e?.message || t("svc_pack_not_found"));
    } finally {
      setChecking(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={() => !checking && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden border border-slate-800/80"
        style={{ background: "#0d121c", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <KeyRound size={16} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">{t("pack_code_modal_title")}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-modal-close-trigger
              disabled={checking}
              aria-label={t("ref_close")}
              className="p-1.5 rounded-lg bg-white/[0.07]"
            >
              <X size={15} className="text-slate-400" />
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">{t("pack_code_modal_hint")}</p>

          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); void handleOpen(); }}
          >
            <input
              value={value}
              onChange={(e) => { setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)); setError(""); }}
              placeholder="ABC1234"
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              disabled={checking}
              aria-label={t("pack_code_label")}
              className="flex-1 min-w-0 rounded-2xl px-4 py-3 font-mono text-lg tracking-[0.25em] text-white outline-none bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/40"
            />
            <button
              type="submit"
              disabled={checking || value.length < 6}
              className="px-4 rounded-2xl text-sm font-semibold bg-emerald-500 text-[#05210f] disabled:opacity-50 flex items-center gap-1.5 active:scale-[0.98]"
            >
              {checking ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {t("pack_code_open")}
            </button>
          </form>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={12} className="shrink-0" />{error}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
