-- Migration 020: Fix negative habit logs semantics
-- Invert completed boolean for existing negative habit logs so completed=true
-- consistently represents successfully kept/resisted (Green) and completed=false
-- represents broken/failed (Red).

UPDATE habit_logs
SET completed = NOT completed
WHERE habit_id IN (
  SELECT id FROM habits WHERE type = 'negative'
);
