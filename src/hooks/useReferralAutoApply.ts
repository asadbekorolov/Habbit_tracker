// Taklif havolasi orqali kelgan foydalanuvchi tizimga kirgach saqlangan kod
// avtomatik qo'llanadi (bir marta). Tarmoq xatosida kod saqlanib qoladi va
// keyingi ochilishda qayta urinadi.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUser } from "../store/UserContext";
import { useLang } from "../store/LangContext";
import { applyReferralCode, ReferralError } from "../services/db";
import { queryClient, queryKeys } from "../services/queryClient";
import { clearPendingReferral, getPendingReferral, isFinalReferralError } from "../utils/referral";

export function useReferralAutoApply() {
  const { profile, updateCoins } = useUser();
  const { t } = useLang();
  const triedFor = useRef<string | null>(null);
  const profileId = profile?.id ?? null;

  useEffect(() => {
    if (!profileId || triedFor.current === profileId) return;
    const code = getPendingReferral();
    if (!code) return;
    triedFor.current = profileId;

    applyReferralCode(code)
      .then((r) => {
        clearPendingReferral();
        updateCoins(r.coins);
        toast.success(t("ref_applied_toast").replace("{n}", String(r.bonus)));
        void queryClient.invalidateQueries({ queryKey: queryKeys.referral(profileId) });
      })
      .catch((e) => {
        const c = e instanceof ReferralError ? e.code : null;
        if (!isFinalReferralError(c)) return; // tarmoq — keyinroq qayta urinish
        clearPendingReferral();
        // O'z kodi yoki allaqachon taklif qilingan — jim; qolganlari haqida xabar
        if (c !== "already_referred" && c !== "self_referral") toast.error(e.message);
      });
  }, [profileId, updateCoins, t]);
}
