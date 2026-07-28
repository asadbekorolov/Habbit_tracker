-- Removes the "1v1 Duel" feature entirely (product decision: unnecessary,
-- source of bugs). Drops the duels table (CASCADE also removes its RLS
-- policies and the notifications rows referencing it via free-text
-- link/type, which need no schema change since notifications.type/link
-- are plain text columns, not enums/FKs), the complete_duel() RPC, and
-- recreates reset_all_data() without its `DELETE FROM duels;` line.

DROP TABLE IF EXISTS duels CASCADE;
DROP FUNCTION IF EXISTS complete_duel(uuid);

CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  DELETE FROM habit_logs;
  DELETE FROM group_habit_logs;
  DELETE FROM daily_notes;
  DELETE FROM weekly_reflections;
  DELETE FROM health_logs;
  DELETE FROM streak_freezes;
  DELETE FROM coin_purchases;
  DELETE FROM feed_reactions;
  UPDATE profiles SET score = 0, coins = 0;
END;
$$;
