// "Bajarilmadi" — sabab yozish va zanjirni qalqon bilan saqlash oynasi.
// Bosh sahifa va Kundalikda X tugmasi bosilganda ochiladi.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Shield, ShieldCheck, X, MessageSquareText } from "lucide-react";
import { Modal } from "../../components/Modal";
import { cleanHabitName } from "../../components/HabitIcon";
import { useFreezeInfoQuery } from "../../hooks/queries";
import { applyStreakFreeze, FREE_FREEZES_PER_MONTH } from "../../services/db";
import { addDays, getTashkentToday } from "../../utils/date";
import { useLang } from "../../store/LangContext";
import type { Habit } from "../../services/supabase";

interface HabitFailReasonModalProps {
  habit: Habit;
  userId: string;
  /** Belgilanayotgan kun */
  date: string;
  /** Odatning joriy zanjiri */
  streak: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function HabitFailReasonModal({ habit, userId, date, streak, onConfirm, onClose }: HabitFailReasonModalProps) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [freezing, setFreezing] = useState(false);
  const freezeQ = useFreezeInfoQuery(userId);
  const negative = habit.type === "negative";

  const today = getTashkentToday();
  // Qalqon faqat bugun yoki kechaga qo'yiladi (050)
  const canFreezeDate = date === today || date === addDays(today, -1);
  const frozen = (freezeQ.data?.dates || []).includes(date);
  const freezeLeft = Math.max(0, FREE_FREEZES_PER_MONTH + (freezeQ.data?.extra ?? 0) - (freezeQ.data?.monthly ?? 0));

  async function handleFreeze() {
    setFreezing(true);
    try {
      await applyStreakFreeze(date);
      toast.success(t("fr_frozen"));
      queryClient.invalidateQueries({ queryKey: ["freezes", userId] });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("no_freezes_left")) toast.info(t("hd_freeze_none_left"));
      else if (msg.includes("use_streak_freeze") || e?.code === "PGRST202") toast.error(t("hd_freeze_server_old"));
      else toast.error(t("hd_freeze_error"));
    } finally {
      setFreezing(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={t("fr_title")} maxWidthClass="sm:max-w-md">
      <p className="text-sm font-semibold text-white">{cleanHabitName(habit.name)}</p>

      {streak > 0 && (
        <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-3 space-y-2.5">
          <p className="flex items-start gap-2 text-sm font-semibold text-orange-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-400" />
            <span>{t("fr_streak_warn").replace("{n}", String(streak))}</span>
          </p>
          {frozen ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <ShieldCheck className="w-4 h-4" /> {t("fr_frozen")}
            </p>
          ) : canFreezeDate ? (
            <>
              <button
                type="button"
                onClick={handleFreeze}
                disabled={freezing || freezeLeft <= 0}
                className="w-full py-2.5 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-100 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Shield className="w-4 h-4" /> {t("fr_freeze")}
              </button>
              <p className="text-[11px] font-mono text-sky-200/80 text-center">
                {freezeLeft > 0 ? t("fr_freeze_left").replace("{n}", String(freezeLeft)) : t("hd_freeze_none_left")}
              </p>
            </>
          ) : null}
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <MessageSquareText className="w-4 h-4 text-slate-400" />
          {negative ? t("fr_question_negative") : t("fr_question_positive")}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          placeholder={t("fr_placeholder")}
          className="w-full rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-500/50 resize-none"
        />
        <span className="flex justify-between text-[10px] text-slate-500">
          <span>{t("fr_hint")}</span>
          <span className="font-mono">{reason.length}/500</span>
        </span>
      </label>

      <button
        type="button"
        onClick={() => onConfirm(reason)}
        className="w-full py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
      >
        <X className="w-4 h-4" strokeWidth={3} />
        {negative ? t("fr_submit_broke") : t("fr_submit")}
      </button>
    </Modal>
  );
}
