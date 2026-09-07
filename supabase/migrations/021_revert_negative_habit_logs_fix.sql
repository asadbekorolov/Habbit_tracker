-- Migration 021: Revert migration 020
-- Migration 020 was based on a wrong premise: the app's completed-boolean
-- semantics for negative habits (completed=true = kept/resisted = Green,
-- completed=false = broken = Red) were already correct in the toggle logic
-- (markNegativeHabit / handleQuickToggleNegative) and in the monthly report
-- color logic (MonthGrid.tsx). Running 020 inverted every existing
-- negative-habit log, corrupting data that was already correct — this is
-- what caused "bajarildi" (circle/kept) to show red in the monthly report.
--
-- Re-inverting restores the original, correct values (NOT applied twice ==
-- original state).

UPDATE habit_logs
SET completed = NOT completed
WHERE habit_id IN (
  SELECT id FROM habits WHERE type = 'negative'
);
