import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteOwnAccount } from "../services/db";
import type { Profile } from "../services/supabase";
import { useLang } from "../store/LangContext";

interface DeleteAccountModalProps {
  isDark: boolean;
  profile: Profile;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteAccountModal({ isDark, profile, onClose, onDeleted }: DeleteAccountModalProps) {
  const { t } = useLang();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canConfirm = confirmText.trim() === profile.username;

  async function handleDelete() {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteOwnAccount();
      onDeleted();
    } catch (e: any) {
      setError(e?.message || t('delete_account_error'));
      setDeleting(false);
    }
  }

  // Portal to document.body — same reasoning as FeedbackModal: the caller
  // (ProfilePage) sits inside the app's normal stacking context, so a
  // plain in-tree fixed overlay could still render behind other elements
  // that establish their own stacking context.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={() => !deleting && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: isDark ? "#161B22" : "#fff", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(248,113,113,0.12)" }}
              >
                <AlertTriangle size={16} style={{ color: "var(--coral-red)" }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{t('delete_account_modal_title')}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="p-1.5 rounded-lg"
              style={{ background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6" }}
            >
              <X size={15} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            {t('delete_account_modal_warning')}
          </p>

          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
            {t('delete_account_modal_confirm_hint')}{" "}
            <span style={{ color: "var(--foreground)", fontWeight: 700 }}>{profile.username}</span>
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={profile.username}
            autoFocus
            disabled={deleting}
            className="w-full rounded-xl p-3 text-sm outline-none mb-3"
            style={{
              background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}`,
              color: "var(--foreground)",
            }}
          />

          {error && (
            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "var(--coral-red)" }}>
              ⚠ {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: "var(--foreground)" }}
            >
              {t('delete_account_modal_cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canConfirm || deleting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: !canConfirm ? "rgba(248,113,113,0.35)" : "var(--coral-red)",
                color: "#fff",
                opacity: deleting ? 0.8 : 1,
                cursor: !canConfirm || deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {t('delete_account_modal_confirm_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
