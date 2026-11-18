// Tanlangan kunning odatlari (Kundalik va Tahlil): ko'rish va (ochiq kun bo'lsa) tahrirlash.
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import { Modal } from "../../components/Modal";
import { QuickLogModal } from "../../components/QuickLogModal";
import { HabitItem } from "./components/HabitItem";
import { NumericMetrics } from "./NumericMetrics";
import { useHabitDay } from "../../hooks/useHabitDay";
import { useFailReasonFlow } from "./useFailReasonFlow";
import { isMeasurable } from "../../utils/habitMetrics";
import { parseDateStr } from "../../utils/date";
import { MONTHS_FULL, DAYS_FULL } from "../../utils/i18n";
import { useLang } from "../../store/LangContext";
import type { Habit, Profile } from "../../services/supabase";

interface DayHabitsSheetProps {
  profile: Profile;
  date: string;
  onClose: () => void;
  onOpenHabit?: (habit: Habit) => void;
}

export function DayHabitsSheet({ profile, date, onClose, onOpenHabit }: DayHabitsSheetProps) {
  const { t, lang } = useLang();
  const day = useHabitDay(profile.id, date);
  const failFlow = useFailReasonFlow(profile.id, date, day);
  const [valueHabit, setValueHabit] = useState<Habit | null>(null);

  const d = parseDateStr(date);
  const title = `${d.getDate()} ${MONTHS_FULL[lang][d.getMonth()]}, ${DAYS_FULL[lang][d.getDay()]}`;

  const handleCheck = (habit: Habit) => {
    if (!day.locked && isMeasurable(habit) && day.entryOf(habit.id).status !== "done") setValueHabit(habit);
    else day.toggleDone(habit);
  };

  return (
    <>
      <Modal isOpen onClose={onClose} title={t("journal_day_title").replace("{date}", title)}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
            day.locked ? "bg-white/5 border-white/10 text-slate-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          }`}
        >
          {day.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {day.locked ? t("journal_day_readonly") : t("journal_day_open")}
        </div>

        <div className="space-y-2.5">
          {[...day.scheduled, ...day.unscheduled].map((habit) => (
            <HabitItem
              key={habit.id}
              habit={habit}
              entry={day.entryOf(habit.id)}
              streak={day.streaks[habit.id] ?? 0}
              locked={day.locked}
              onCheck={handleCheck}
              onFail={failFlow.requestFail}
              onOpen={onOpenHabit}
            />
          ))}
        </div>

        {day.negative.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 px-1">{t("dash_negative_section")}</h4>
            {day.negative.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                entry={day.entryOf(habit.id)}
                streak={day.streaks[habit.id] ?? 0}
                locked={day.locked}
                onCheck={(h) => day.toggleDone(h)}
                onFail={failFlow.requestFail}
                onOpen={onOpenHabit}
              />
            ))}
          </div>
        )}

        <NumericMetrics inputStyle={{}} profile={profile} logDate={date} locked={day.locked} />
      </Modal>

      {failFlow.modal}

      <AnimatePresence>
        {valueHabit && (
          <QuickLogModal
            habit={valueHabit}
            initialValue={day.entryOf(valueHabit.id).value}
            onSave={async (v) => { day.setValue(valueHabit, v); }}
            onClose={() => setValueHabit(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
