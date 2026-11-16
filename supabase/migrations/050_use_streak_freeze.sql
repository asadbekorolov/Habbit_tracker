-- ============================================================================
-- 050: Zanjirni muzlatish (streak freeze) — server RPC
-- ============================================================================
-- 047 dan beri mijoz streak_freezes ga to'g'ridan-to'g'ri yoza olmaydi
-- (REVOKE INSERT), lekin muzlatishni qo'llaydigan server funksiyasi yo'q edi:
-- do'kondan sotib olingan muzlatish hech qachon ishlatilmasdi.
--
-- use_streak_freeze(p_date):
--   * faqat bugun yoki kecha (Toshkent kuni) muzlatiladi;
--   * oyiga 2 ta bepul + shu oy do'kondan sotib olinganlar (coin_purchases,
--     item_id = 'streak_freeze') — mijozdagi FREE_FREEZES_PER_MONTH bilan bir xil;
--   * bir kun ikki marta muzlatilmaydi.
-- Muzlatish butun hisobga tegishli: o'sha kun barcha odatlar zanjirini uzmaydi
-- (utils/streaks.ts). Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.use_streak_freeze(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := tashkent_today();
  v_month_start date := date_trunc('month', tashkent_today())::date;
  v_used integer;
  v_extra integer;
  v_limit integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_date IS NULL OR p_date NOT IN (v_today, v_today - 1) THEN
    RAISE EXCEPTION 'date_not_allowed';
  END IF;

  -- Bir vaqtdagi ikki so'rov limitdan oshib ketmasin
  PERFORM _lock_user_rewards(v_uid);

  IF EXISTS (SELECT 1 FROM streak_freezes WHERE user_id = v_uid AND freeze_date = p_date) THEN
    RAISE EXCEPTION 'already_frozen';
  END IF;

  SELECT count(*) INTO v_used
    FROM streak_freezes
   WHERE user_id = v_uid AND freeze_date >= v_month_start;

  SELECT count(*) INTO v_extra
    FROM coin_purchases
   WHERE user_id = v_uid AND item_id = 'streak_freeze'
     AND (purchased_at AT TIME ZONE 'Asia/Tashkent')::date >= v_month_start;

  v_limit := 2 + v_extra;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'no_freezes_left';
  END IF;

  INSERT INTO streak_freezes (user_id, freeze_date) VALUES (v_uid, p_date);

  RETURN jsonb_build_object(
    'freeze_date', p_date,
    'remaining', v_limit - v_used - 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.use_streak_freeze(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.use_streak_freeze(date) TO authenticated;

COMMIT;
