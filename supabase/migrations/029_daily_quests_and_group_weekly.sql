-- Migration 029: Kunlik vazifalar (Daily Quests) + Guruh haftalik musobaqasi
--
-- 1) daily_quest_claims — har bir foydalanuvchi, har bir vazifa, har bir kun
--    uchun bittadan yozuv (UNIQUE). Mukofot faqat claim_daily_quest() RPC
--    orqali beriladi — shart serverda mustaqil tekshiriladi, shuning uchun
--    client hech qachon to'g'ridan-to'g'ri shu jadvalga yoza olmaydi (RLS
--    faqat SELECT beradi, INSERT/UPDATE yo'q — coin_purchases'dagi kabi
--    "faqat SECURITY DEFINER orqali" naqshi).
-- 2) group_weekly_winners — har bir guruh, har bir hafta uchun bitta g'olib
--    yozuvi (UNIQUE). settle_group_week() o'tgan (tugagan) haftani hisoblab,
--    hali yozilmagan bo'lsa, g'olibga bonus tanga beradi — a'zo guruh
--    sahifasini ochganda chaqiriladi (cron shart emas, 028-migratsiyadagi
--    cleanup_expired_frame() bilan bir xil "kirganda o'z-o'zini tuzatish"
--    naqshi).

CREATE TABLE IF NOT EXISTS daily_quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  quest_date date NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_id, quest_date)
);

ALTER TABLE daily_quest_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_quest_claims_select_own" ON daily_quest_claims;
CREATE POLICY "daily_quest_claims_select_own" ON daily_quest_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION claim_daily_quest(uid uuid, p_quest_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_completed integer;
  v_total integer;
  v_neg_win boolean;
  v_reward integer;
  v_new_balance integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM daily_quest_claims
    WHERE user_id = uid AND quest_id = p_quest_id AND quest_date = v_today
  ) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  SELECT COUNT(*) INTO v_total FROM habits WHERE user_id = uid AND is_active = true;

  SELECT COUNT(*), COALESCE(bool_or(h.type = 'negative'), false)
  INTO v_completed, v_neg_win
  FROM habit_logs hl
  JOIN habits h ON h.id = hl.habit_id
  WHERE hl.user_id = uid AND hl.log_date = v_today AND hl.completed = true;

  IF p_quest_id = 'q_complete_3' THEN
    IF v_completed < 3 THEN RAISE EXCEPTION 'not_eligible'; END IF;
    v_reward := 5;
  ELSIF p_quest_id = 'q_complete_all' THEN
    IF v_total = 0 OR v_completed < v_total THEN RAISE EXCEPTION 'not_eligible'; END IF;
    v_reward := 10;
  ELSIF p_quest_id = 'q_negative_win' THEN
    IF NOT v_neg_win THEN RAISE EXCEPTION 'not_eligible'; END IF;
    v_reward := 5;
  ELSE
    RAISE EXCEPTION 'unknown_quest';
  END IF;

  INSERT INTO daily_quest_claims(user_id, quest_id, quest_date) VALUES (uid, p_quest_id, v_today);
  UPDATE profiles SET coins = COALESCE(coins, 0) + v_reward WHERE id = uid RETURNING coins INTO v_new_balance;
  RETURN v_new_balance;
END;
$$;

-- ── Guruh haftalik musobaqasi ──────────────────────────────────
CREATE TABLE IF NOT EXISTS group_weekly_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score integer NOT NULL,
  reward integer NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, week_start)
);

ALTER TABLE group_weekly_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_weekly_winners_select" ON group_weekly_winners;
CREATE POLICY "group_weekly_winners_select" ON group_weekly_winners FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION settle_group_week(p_group_id uuid)
RETURNS TABLE(user_id uuid, display_name text, score integer, reward integer, already_settled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start date := (date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 days')::date;
  v_week_end date := v_week_start + 6;
  v_existing_id uuid;
  v_winner_id uuid;
  v_winner_score integer;
  v_reward integer := 20;
BEGIN
  SELECT gw.id INTO v_existing_id FROM group_weekly_winners gw
    WHERE gw.group_id = p_group_id AND gw.week_start = v_week_start;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY
      SELECT gw.user_id, p.display_name, gw.score, gw.reward, true
      FROM group_weekly_winners gw JOIN profiles p ON p.id = gw.user_id
      WHERE gw.id = v_existing_id;
    RETURN;
  END IF;

  SELECT hl.user_id,
         SUM(LEAST(100, ROUND((hl.reps::numeric / COALESCE(mg.current_target, 1)) * 100)))::integer AS total_score
  INTO v_winner_id, v_winner_score
  FROM group_habit_logs hl
  LEFT JOIN member_goals mg ON mg.group_habit_id = hl.group_habit_id AND mg.user_id = hl.user_id
  WHERE hl.group_id = p_group_id
    AND hl.completed = true
    AND (hl.approval_status IS NULL OR hl.approval_status IN ('approved', 'auto'))
    AND hl.log_date BETWEEN v_week_start AND v_week_end
  GROUP BY hl.user_id
  ORDER BY total_score DESC
  LIMIT 1;

  IF v_winner_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO group_weekly_winners(group_id, week_start, user_id, score, reward)
    VALUES (p_group_id, v_week_start, v_winner_id, v_winner_score, v_reward);

  UPDATE profiles SET coins = COALESCE(coins, 0) + v_reward WHERE id = v_winner_id;

  RETURN QUERY
    SELECT p.id, p.display_name, v_winner_score, v_reward, false
    FROM profiles p WHERE p.id = v_winner_id;
END;
$$;
