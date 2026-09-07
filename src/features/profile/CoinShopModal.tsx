import React from "react";
import { X } from "lucide-react";
import { Store } from "../../pages/Store";
import type { Profile } from "../../services/supabase";

interface CoinShopModalProps {
  isDark: boolean;
  profile: Profile;
  coins: number;
  onClose: () => void;
  onCoinsChange?: (newCoins: number) => void;
  onStarPurchased?: (newExpiresAt: string) => void;
  onProfileUpdate?: (p: Profile) => void;
}

export function CoinShopModal({ isDark, profile, onClose, onProfileUpdate }: CoinShopModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-slate-950 sm:rounded-3xl rounded-t-3xl border border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Do'kon & Tanga To'ldirish</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-60px)]">
          <Store
            isDark={isDark}
            profile={profile}
            onProfileUpdate={onProfileUpdate}
            onClose={onClose}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
}

export default CoinShopModal;
