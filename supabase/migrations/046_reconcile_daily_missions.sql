-- Migration 046: Dynamic Two-Way Daily Mission & Reward Reconciliation
-- Evaluates habit completion criteria for a user on a given date and reconciles
-- daily quest claims and awarded coins/XP (deducting rewards if criteria are no longer met).

CREATE OR REPLACE FUNCTION reconcile_daily_missions(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_habits integer := 0;
  v_completed_count integer := 0;
  v_negative_broken_count integer := 0;
  v_negative_kept_count integer := 0;
  v_has_negative boolean := false;
  v_yesterday_completed boolean := false;

  v_q3_eligible boolean := false;
  v_qall_eligible boolean := false;
  v_qneg_eligible boolean := false;
  v_qcons_eligible boolean := false;

  v_claimed_q3 boolean := false;
  v_claimed_qall boolean := false;
  v_claimed_qneg boolean := false;
  v_claimed_qcons boolean := false;

  v_coins_granted integer := 0;
  v_xp_granted integer := 0;
  v_coins_deducted integer := 0;
  v_xp_deducted integer := 0;

  v_net_coins integer := 0;
  v_net_xp integer := 0;

  v_final_coins integer := 0;
  v_final_score integer := 0;

  v_granted_list jsonb := '[]'::jsonb;
  v_revoked_list jsonb := '[]'::jsonb;
BEGIN
  -- 1) Calculate active habit stats for p_date
  SELECT COUNT(*) INTO v_total_habits
  FROM habits
  WHERE user_id = p_user_id AND is_active = true;

  -- Habit completion stats for p_date
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE hl.completed = true), 0),
    COALESCE(COUNT(*) FILTER (WHERE h.type = 'negative' AND hl.completed = false), 0),
    COALESCE(COUNT(*) FILTER (WHERE h.type = 'negative' AND hl.completed = true), 0),
    COALESCE(bool_or(h.type = 'negative'), false)
  INTO
    v_completed_count,
    v_negative_broken_count,
    v_negative_kept_count,
    v_has_negative
  FROM habit_logs hl
  JOIN habits h ON h.id = hl.habit_id
  WHERE hl.user_id = p_user_id AND hl.log_date = p_date;

  -- Yesterday activity
  SELECT EXISTS (
    SELECT 1 FROM habit_logs
    WHERE user_id = p_user_id AND log_date = (p_date - INTERVAL '1 day')::date AND completed = true
  ) INTO v_yesterday_completed;

  -- 2) Evaluate eligibility
  -- q_complete_3: Requires active completed >= 3
  v_q3_eligible := (v_completed_count >= 3);

  -- q_complete_all: Requires total habits > 0 and all completed, and no broken negative habits
  v_qall_eligible := (v_total_habits > 0 AND v_completed_count >= v_total_habits AND v_negative_broken_count = 0);

  -- q_negative_win: Requires negative habits exist, 0 broken, and at least 1 negative habit kept/logged
  v_qneg_eligible := (v_has_negative AND v_negative_broken_count = 0 AND (v_negative_kept_count > 0 OR v_completed_count > 0));

  -- q_consistency: Requires completed today > 0 AND yesterday completed > 0
  v_qcons_eligible := (v_completed_count > 0 AND v_yesterday_completed);

  -- 3) Check existing claims in daily_quest_claims
  SELECT EXISTS (
    SELECT 1 FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_complete_3'
  ) INTO v_claimed_q3;

  SELECT EXISTS (
    SELECT 1 FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_complete_all'
  ) INTO v_claimed_qall;

  SELECT EXISTS (
    SELECT 1 FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_negative_win'
  ) INTO v_claimed_qneg;

  SELECT EXISTS (
    SELECT 1 FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_consistency'
  ) INTO v_claimed_qcons;

  -- 4) Process transitions for each quest

  -- q_complete_3 (Reward: 5 coins, 5 XP)
  IF v_q3_eligible AND NOT v_claimed_q3 THEN
    INSERT INTO daily_quest_claims (user_id, quest_id, quest_date) VALUES (p_user_id, 'q_complete_3', p_date);
    v_coins_granted := v_coins_granted + 5;
    v_xp_granted := v_xp_granted + 5;
    v_granted_list := v_granted_list || jsonb_build_object('questId', 'q_complete_3', 'rewardCoins', 5, 'rewardXp', 5);
  ELSIF NOT v_q3_eligible AND v_claimed_q3 THEN
    DELETE FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_complete_3';
    v_coins_deducted := v_coins_deducted + 5;
    v_xp_deducted := v_xp_deducted + 5;
    v_revoked_list := v_revoked_list || jsonb_build_object('questId', 'q_complete_3', 'rewardCoins', 5, 'rewardXp', 5);
  END IF;

  -- q_complete_all (Reward: 10 coins, 10 XP)
  IF v_qall_eligible AND NOT v_claimed_qall THEN
    INSERT INTO daily_quest_claims (user_id, quest_id, quest_date) VALUES (p_user_id, 'q_complete_all', p_date);
    v_coins_granted := v_coins_granted + 10;
    v_xp_granted := v_xp_granted + 10;
    v_granted_list := v_granted_list || jsonb_build_object('questId', 'q_complete_all', 'rewardCoins', 10, 'rewardXp', 10);
  ELSIF NOT v_qall_eligible AND v_claimed_qall THEN
    DELETE FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_complete_all';
    v_coins_deducted := v_coins_deducted + 10;
    v_xp_deducted := v_xp_deducted + 10;
    v_revoked_list := v_revoked_list || jsonb_build_object('questId', 'q_complete_all', 'rewardCoins', 10, 'rewardXp', 10);
  END IF;

  -- q_negative_win (Reward: 5 coins, 5 XP)
  IF v_qneg_eligible AND NOT v_claimed_qneg THEN
    INSERT INTO daily_quest_claims (user_id, quest_id, quest_date) VALUES (p_user_id, 'q_negative_win', p_date);
    v_coins_granted := v_coins_granted + 5;
    v_xp_granted := v_xp_granted + 5;
    v_granted_list := v_granted_list || jsonb_build_object('questId', 'q_negative_win', 'rewardCoins', 5, 'rewardXp', 5);
  ELSIF NOT v_qneg_eligible AND v_claimed_qneg THEN
    DELETE FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_negative_win';
    v_coins_deducted := v_coins_deducted + 5;
    v_xp_deducted := v_xp_deducted + 5;
    v_revoked_list := v_revoked_list || jsonb_build_object('questId', 'q_negative_win', 'rewardCoins', 5, 'rewardXp', 5);
  END IF;

  -- q_consistency (Reward: 5 coins, 5 XP)
  IF v_qcons_eligible AND NOT v_claimed_qcons THEN
    INSERT INTO daily_quest_claims (user_id, quest_id, quest_date) VALUES (p_user_id, 'q_consistency', p_date);
    v_coins_granted := v_coins_granted + 5;
    v_xp_granted := v_xp_granted + 5;
    v_granted_list := v_granted_list || jsonb_build_object('questId', 'q_consistency', 'rewardCoins', 5, 'rewardXp', 5);
  ELSIF NOT v_qcons_eligible AND v_claimed_qcons THEN
    DELETE FROM daily_quest_claims WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = 'q_consistency';
    v_coins_deducted := v_coins_deducted + 5;
    v_xp_deducted := v_xp_deducted + 5;
    v_revoked_list := v_revoked_list || jsonb_build_object('questId', 'q_consistency', 'rewardCoins', 5, 'rewardXp', 5);
  END IF;

  -- 5) Calculate net deltas & update profiles
  v_net_coins := v_coins_granted - v_coins_deducted;
  v_net_xp := v_xp_granted - v_xp_deducted;

  IF v_net_coins != 0 OR v_net_xp != 0 THEN
    UPDATE profiles
    SET
      coins = GREATEST(0, COALESCE(coins, 0) + v_net_coins),
      score = GREATEST(0, COALESCE(score, 0) + v_net_xp)
    WHERE id = p_user_id
    RETURNING coins, score INTO v_final_coins, v_final_score;
  ELSE
    SELECT COALESCE(coins, 0), COALESCE(score, 0)
    INTO v_final_coins, v_final_score
    FROM profiles WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'coins', v_final_coins,
    'score', v_final_score,
    'coinsDelta', v_net_coins,
    'xpDelta', v_net_xp,
    'grantedQuests', v_granted_list,
    'revokedQuests', v_revoked_list
  );
END;
$$;
