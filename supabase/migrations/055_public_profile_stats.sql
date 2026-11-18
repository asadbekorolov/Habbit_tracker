-- ============================================================================
-- 055: get_public_profile_stats(user) — boshqa foydalanuvchi profili uchun
--      faqat yig'ma ko'rsatkichlar
-- ============================================================================
-- 051 dan keyin habit_logs faqat egasi/admin uchun o'qiladi, shu sabab
-- "Ommaviy profil" oynasi boshqalarning zanjiri va nishonlarini hisoblay
-- olmay qolgan edi. Bu funksiya FAQAT raqamlarni qaytaradi — odat nomlari,
-- kunlik belgilar va sanalar hech qachon chiqmaydi.
--   * total_completed / active_days / best_streak — claim_badge_reward (047)
--     bilan aynan bir xil ta'rif (nishonlar ilovada shu raqamlardan hisoblanadi)
--   * current_streak — bugun yoki kecha tugaydigan uzluksiz faol kunlar;
--     muzlatilgan (streak_freezes) kunlar zanjirni uzmaydi
--   * habits_count — faol odatlar soni
--   * Yopiq profil (profile_private) — o'zi va admindan boshqaga
--     {"private": true} qaytadi, raqamlarsiz
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_profile_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_private boolean;
  v_is_admin boolean := false;
  v_today date := tashkent_today();
  v_total integer := 0;
  v_active integer := 0;
  v_best integer := 0;
  v_current integer := 0;
  v_habits integer := 0;
  v_day date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COALESCE(p.profile_private, false) INTO v_private FROM profiles p WHERE p.id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(p.is_admin, false) INTO v_is_admin FROM profiles p WHERE p.id = v_uid;

  IF v_private AND v_uid <> p_user_id AND NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('private', true);
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT log_date)
    INTO v_total, v_active
  FROM habit_logs WHERE user_id = p_user_id AND completed = true;

  WITH d AS (
    SELECT DISTINCT log_date FROM habit_logs WHERE user_id = p_user_id AND completed = true
  ), g AS (
    SELECT log_date - (ROW_NUMBER() OVER (ORDER BY log_date))::integer AS grp FROM d
  )
  SELECT COALESCE(MAX(cnt), 0) INTO v_best
  FROM (SELECT COUNT(*) AS cnt FROM g GROUP BY grp) s;

  -- Joriy zanjir: bugun faol bo'lmasa kechadan boshlab sanaladi
  v_day := v_today;
  IF NOT EXISTS (SELECT 1 FROM habit_logs WHERE user_id = p_user_id AND log_date = v_day AND completed = true) THEN
    v_day := v_today - 1;
  END IF;
  LOOP
    EXIT WHEN v_current > 3660;
    IF EXISTS (SELECT 1 FROM habit_logs WHERE user_id = p_user_id AND log_date = v_day AND completed = true) THEN
      v_current := v_current + 1;
    ELSIF EXISTS (SELECT 1 FROM streak_freezes WHERE user_id = p_user_id AND freeze_date = v_day) THEN
      NULL; -- muzlatilgan kun: uzmaydi, sanalmaydi
    ELSE
      EXIT;
    END IF;
    v_day := v_day - 1;
  END LOOP;

  SELECT COUNT(*) INTO v_habits FROM habits WHERE user_id = p_user_id AND is_active = true;

  RETURN jsonb_build_object(
    'private', false,
    'total_completed', v_total,
    'active_days', v_active,
    'best_streak', GREATEST(v_best, v_current),
    'current_streak', v_current,
    'habits_count', v_habits
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile_stats(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_public_profile_stats(uuid) TO authenticated;

COMMIT;
