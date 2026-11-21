// Profil: ixcham "Do'stlarni taklif qilish" kartasi — bosilganda oyna ochiladi.
import { useState } from "react";
import { Gift, ChevronRight } from "lucide-react";
import { useLang } from "../../../store/LangContext";
import { useProfile } from "../../../store/UserContext";
import { useReferralInfoQuery } from "../../../hooks/queries";
import { REFERRED_BONUS, REFERRER_BONUS } from "../../../utils/referral";
import { InviteFriendsModal } from "./InviteFriendsModal";

export function InviteFriendsCard() {
  const { t } = useLang();
  const profile = useProfile();
  const { data: info } = useReferralInfoQuery(profile.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="premium-card w-full p-4 flex items-center gap-3 text-left hover:border-emerald-500/30 active:scale-[0.99] transition-all cursor-pointer"
      >
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <Gift size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{t("ref_card_title")}</div>
          <div className="text-[11px] text-slate-400 font-medium">
            <span className="font-mono text-emerald-300">+{REFERRER_BONUS}</span> {t("ref_card_you")} ·{" "}
            <span className="font-mono text-emerald-300">+{REFERRED_BONUS}</span> {t("ref_card_friend")}
          </div>
        </div>
        {info?.code && (
          <span className="font-mono text-xs font-bold tracking-widest px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 shrink-0">
            {info.code}
          </span>
        )}
        <ChevronRight size={16} className="text-slate-500 shrink-0" />
      </button>
      {open && <InviteFriendsModal isOpen={open} onClose={() => setOpen(false)} />}
    </>
  );
}
