import React, { lazy, Suspense } from "react";
import { X } from "lucide-react";
import type { Profile } from "../../services/supabase";
import { useScrollLock } from "../../hooks/useScrollLock";

const Store = lazy(() => import("../../pages/Store").then(m => ({ default: m.Store })));

interface CoinShopModalProps {
  profile: Profile;
  coins: number;
  onClose: () => void;
  onCoinsChange?: (newCoins: number) => void;
  onStarPurchased?: (newExpiresAt: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}

export function CoinShopModal({ profile, onClose, onProfileUpdate }: CoinShopModalProps) {
  useScrollLock(true);

  // Keyboard Escape listener for Android hardware back button
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overscroll-contain touch-none"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-slate-900 border border-slate-800/90 text-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden my-auto max-h-[85vh] flex flex-col relative overscroll-contain touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Do'kon & Tanga To'ldirish</h2>
          <button
            type="button"
            data-modal-close-trigger
            aria-label="yopish"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain touch-pan-y max-h-[calc(85vh-60px)]">
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-emerald-400 font-medium text-xs">Yuklanmoqda...</div>}>
            <Store
              onProfileUpdate={onProfileUpdate}
              onClose={onClose}
              isModal={true}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default CoinShopModal;
