// Guruh tafsilotlari — HabitsTab.
import { Trash2, Circle, Clock, MessageSquare, Pencil, ClipboardList, AlertTriangle } from "lucide-react";
import { cleanHabitName } from "../../../../components/HabitIcon";
import { getHabitCategory, getCategoryTheme } from "../../../../utils/categoryTheme";
import type { GroupDetailState } from "../useGroupDetail";

export function HabitsTab({ s }: { s: GroupDetailState }) {
  const { card, t, habits, todayLogs, error, setError, proofHabitId, setProofHabitId, setProofCount, showAddHabit, isAdmin, openEditHabit, handleDeleteHabit, statusIcon, statusBg, statusBorder } = s;

  return (
    <div className="flex flex-col gap-3">
      {error && !proofHabitId && !showAddHabit && (
        <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}</p>
      )}
      {/* Legend */}
      <div className="flex items-center gap-3 px-1 pb-1 flex-wrap">
        {[
          { color: "#4ADE80", label: t('groups_approved') },
          { color: "#FBBF24", label: t('pending') },
          { color: "#F87171", label: t('rejected') },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {habits.length === 0 ? (
        <div style={card} className="p-8 flex flex-col items-center gap-2">
          <ClipboardList size={28} style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isAdmin ? t('groups_first_habit') : t('groups_no_habits')}
          </p>
        </div>
      ) : (
        habits.map((habit) => {
          const logState = todayLogs[habit.id];
          const isMarked = logState?.completed;
          const canMark = !isMarked || logState?.status === "rejected";
          const category = getHabitCategory(habit.name, habit.emoji);
          const theme = getCategoryTheme(category);

          return (
            <div key={habit.id} className="rounded-2xl overflow-hidden"
              style={{ ...card, background: isMarked ? statusBg(logState) : card.background, border: statusBorder(logState) }}>
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => { if (canMark) { setProofHabitId(habit.id); setProofCount(habit.target_value || 1); setError(""); } }}
                  className="shrink-0 transition-all"
                  style={{ cursor: canMark ? "pointer" : "default" }}
                >
                  {isMarked ? statusIcon(logState) : <Circle size={22} style={{ color: "var(--muted-foreground)" }} />}
                </button>

                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden transition-all duration-300"
                  style={{
                    background: theme.gradient,
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow
                  }}
                >
                   <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                   <theme.icon size={20} color={theme.color} strokeWidth={2.5} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium"
                      style={{ color: logState?.status === "approved" || logState?.status === "auto" ? "#4ADE80" : "var(--foreground)" }}>
                      {cleanHabitName(habit.name)}
                    </p>
                    {habit.target_value > 1 && habit.unit && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "rgba(255,255,255,0.07)", color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {habit.target_value} {habit.unit}
                      </span>
                    )}
                    {habit.type === "negative" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}>{t('groups_negative_badge_lower')}</span>
                    )}
                  </div>
                  {logState?.status === "pending" && (
                    <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "#FBBF24" }}>
                      <Clock size={10} /> {t('groups_pending_leader_approval')}
                    </p>
                  )}
                  {logState?.status === "rejected" && (
                    <p className="text-[11px] mt-0.5" style={{ color: "#F87171" }}>
                      {t('groups_rejected_retry').replace('{reason}', logState.rejectReason ? `: ${logState.rejectReason}` : "")}
                    </p>
                  )}
                  {logState?.proofNote && (logState.status === "pending" || logState.status === "approved") && (
                    <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <MessageSquare size={10} /> {logState.proofNote}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditHabit(habit)}
                      className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteHabit(habit.id)}
                      className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--coral-red)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      <p className="text-xs text-center mt-1" style={{ color: "var(--muted-foreground)" }}>
        {Object.values(todayLogs).filter((l) => l.completed && (l.status === "approved" || l.status === "auto")).length} tasdiqlangan
        {" / "}
        {Object.values(todayLogs).filter((l) => l.completed && l.status === "pending").length} kutilmoqda
        {" / "}
        {habits.length} ta odat
      </p>
    </div>
  );
}
