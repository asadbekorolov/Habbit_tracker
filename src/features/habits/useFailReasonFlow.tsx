// X (bajarilmadi) tugmasi oqimi: allaqachon "bajarilmadi" bo'lsa — bekor qiladi,
// aks holda sabab yozish va zanjirni saqlash oynasini ochadi.
import { useState } from "react";
import type { Habit } from "../../services/supabase";
import type { useHabitDay } from "../../hooks/useHabitDay";
import { isMeasurable } from "../../utils/habitMetrics";
import { HabitFailReasonModal } from "./HabitFailReasonModal";

type HabitDay = ReturnType<typeof useHabitDay>;

export function useFailReasonFlow(userId: string, date: string, day: HabitDay) {
  const [habit, setHabit] = useState<Habit | null>(null);

  const requestFail = (h: Habit) => {
    const entry = day.entryOf(h.id);
    const partial = h.type !== "negative" && isMeasurable(h) && entry.value > 0;
    // Qayta bosish — "bajarilmadi"ni bekor qilish; yopiq kunda — tushunarli xabar (toggleFail ichida)
    if ((entry.status === "fail" && !partial) || day.locked) {
      day.toggleFail(h);
      return;
    }
    setHabit(h);
  };

  const modal = habit ? (
    <HabitFailReasonModal
      habit={habit}
      userId={userId}
      date={date}
      streak={day.streaks[habit.id] ?? 0}
      onConfirm={(reason) => {
        day.failWithReason(habit, reason);
        setHabit(null);
      }}
      onClose={() => setHabit(null)}
    />
  ) : null;

  return { requestFail, modal };
}
