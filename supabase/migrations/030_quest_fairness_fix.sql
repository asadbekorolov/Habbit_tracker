-- Migration 030: Kunlik vazifalar — adolat tuzatishi
-- 029-migratsiyadagi "Salbiy odatga qarshi turing" vazifasi salbiy odati
-- UMUMAN yo'q foydalanuvchilar uchun hech qachon bajarilmas edi (doim
-- qulflangan qolar edi). Endi bunday foydalanuvchilarga o'rniga
-- "q_consistency" (kecha ham, bugun ham kamida bitta odat bajarish)
-- vazifasi ko'rsatiladi — client shuni tanlab yuboradi, bu yerda faqat
-- serverda mustaqil tekshirish qo'shiladi.

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
  ELSIF p_quest_id = 'q_consistency' THEN
    IF v_completed = 0 THEN RAISE EXCEPTION 'not_eligible'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM habit_logs
      WHERE user_id = uid AND log_date = v_today - 1 AND completed = true
    ) THEN RAISE EXCEPTION 'not_eligible'; END IF;
    v_reward := 5;
  ELSE
    RAISE EXCEPTION 'unknown_quest';
  END IF;

  INSERT INTO daily_quest_claims(user_id, quest_id, quest_date) VALUES (uid, p_quest_id, v_today);
  UPDATE profiles SET coins = COALESCE(coins, 0) + v_reward WHERE id = uid RETURNING coins INTO v_new_balance;
  RETURN v_new_balance;
END;
$$;
