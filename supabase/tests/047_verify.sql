-- ============================================================================
-- 047 tekshiruvi — Supabase SQL Editor'da BUTUNLIGICHA bitta "Run" bilan.
--
-- Qanday ishlaydi:
--   * Faqat 2 ta statement: funksiyani yaratish va uni chaqirish. Vaqtinchalik
--     jadval ishlatilmaydi (SQL Editor har statement'ni alohida bajarsa ham
--     ishlaydi).
--   * Barcha xatti-harakat testlari ichki blokda bajariladi va oxirida
--     ataylab xato bilan bekor qilinadi — bazadagi ma'lumotlar o'zgarmaydi.
--   * Funksiya ishini tugatgach o'zini o'chiradi.
--   * Natija: bitta jadval (n, test, result, detail) — PASS / FAIL / SKIP.
--
-- Talab: bazada kamida 2 foydalanuvchi va ulardan birida bugun belgilanmagan
-- kamida bitta faol odat bo'lishi kerak (aks holda xatti-harakat testlari SKIP).
-- ============================================================================

CREATE OR REPLACE FUNCTION public._verify_047()
RETURNS TABLE (n bigint, test text, result text, detail text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_user uuid;
  v_other uuid;
  v_habit uuid;
  v_today date := public.tashkent_today();
  c0 int; c1 int; c2 int; c3 int;
  x0 int; x1 int; x2 int; x3 int;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1) Huquqlar (o'zgarishsiz tekshiruv)
  -- --------------------------------------------------------------------------
  v_out := v_out || (
    SELECT jsonb_agg(jsonb_build_object('t', t.name, 'r', CASE WHEN t.ok THEN 'PASS' ELSE 'FAIL' END) ORDER BY t.i)
    FROM (VALUES
      (1,  'authenticated: increment_coins yopiq',          NOT has_function_privilege('authenticated', 'public.increment_coins(uuid,integer)', 'execute')),
      (2,  'authenticated: increment_score yopiq',          NOT has_function_privilege('authenticated', 'public.increment_score(uuid,integer)', 'execute')),
      (3,  'authenticated: spend_coins yopiq',              NOT has_function_privilege('authenticated', 'public.spend_coins(uuid,integer)', 'execute')),
      (4,  'anon: toggle_habit_atomic yopiq',               NOT has_function_privilege('anon', 'public.toggle_habit_atomic(uuid,date,text,numeric)', 'execute')),
      (5,  'authenticated: toggle_habit_atomic ochiq',      has_function_privilege('authenticated', 'public.toggle_habit_atomic(uuid,date,text,numeric)', 'execute')),
      (6,  'authenticated: link_telegram_account yopiq',    NOT has_function_privilege('authenticated', 'public.link_telegram_account(text,bigint)', 'execute')),
      (7,  'service_role: link_telegram_account ochiq',     has_function_privilege('service_role', 'public.link_telegram_account(text,bigint)', 'execute')),
      (8,  'authenticated: get_habits_for_telegram yopiq',  NOT has_function_privilege('authenticated', 'public.get_habits_for_telegram(bigint)', 'execute')),
      (9,  'authenticated: spend_coins_for_ai yopiq',       NOT has_function_privilege('authenticated', 'public.spend_coins_for_ai(uuid)', 'execute')),
      (10, 'anon: send_telegram_request yopiq',             NOT has_function_privilege('anon', 'public.send_telegram_request(uuid)', 'execute')),
      (11, 'habit_logs: INSERT yopiq',                      NOT has_table_privilege('authenticated', 'public.habit_logs', 'insert')),
      (12, 'coin_purchases: INSERT yopiq',                  NOT has_table_privilege('authenticated', 'public.coin_purchases', 'insert')),
      (13, 'profiles.phone: SELECT yopiq',                  NOT has_column_privilege('authenticated', 'public.profiles', 'phone', 'select')),
      (14, 'profiles.telegram_chat_id: SELECT yopiq',       NOT has_column_privilege('authenticated', 'public.profiles', 'telegram_chat_id', 'select')),
      (15, 'profiles.is_admin: SELECT yopiq',               NOT has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'select')),
      (16, 'profiles.display_name: SELECT ochiq',           has_column_privilege('authenticated', 'public.profiles', 'display_name', 'select')),
      (17, 'profiles.coins: UPDATE yopiq',                  NOT has_column_privilege('authenticated', 'public.profiles', 'coins', 'update')),
      (18, 'profiles.username_glow: UPDATE yopiq',          NOT has_column_privilege('authenticated', 'public.profiles', 'username_glow', 'update')),
      (19, 'profiles.display_name: UPDATE ochiq',           has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update')),
      (20, 'shop_items: frame_gold narxi 50',               COALESCE((SELECT price = 50 FROM public.shop_items WHERE id = 'frame_gold'), false))
    ) AS t(i, name, ok)
  );

  -- --------------------------------------------------------------------------
  -- 2) Xatti-harakat testlari (foydalanuvchi sifatida; oxirida bekor qilinadi)
  -- --------------------------------------------------------------------------
  SELECT h.id, h.user_id INTO v_habit, v_user
  FROM public.habits h
  WHERE h.is_active
    AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.habit_id = h.id AND l.log_date = v_today)
  LIMIT 1;
  SELECT p.id INTO v_other FROM public.profiles p WHERE p.id IS DISTINCT FROM v_user LIMIT 1;

  IF v_habit IS NULL OR v_other IS NULL THEN
    v_out := v_out || jsonb_build_object('t', 'xatti-harakat testlari', 'r', 'SKIP', 'd', 'mos foydalanuvchi/odat topilmadi');
  ELSE
    BEGIN
      -- Foydalanuvchi sessiyasini simulyatsiya qilish
      PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      -- Boshlang'ich holatni normallashtirish (eski vazifa da'volarini moslash)
      PERFORM public.reconcile_daily_missions(v_user, v_today);
      c0 := (public.get_my_profile()->>'coins')::int;  x0 := (public.get_my_profile()->>'total_xp')::int;

      PERFORM public.toggle_habit_atomic(v_habit, v_today, 'done');
      c1 := (public.get_my_profile()->>'coins')::int;  x1 := (public.get_my_profile()->>'total_xp')::int;
      v_out := v_out || jsonb_build_object('t', 'done mukofot beradi',
        'r', CASE WHEN x1 > x0 AND c1 > c0 THEN 'PASS' ELSE 'FAIL' END,
        'd', format('tanga %s->%s, xp %s->%s', c0, c1, x0, x1));

      PERFORM public.toggle_habit_atomic(v_habit, v_today, 'done');
      c2 := (public.get_my_profile()->>'coins')::int;  x2 := (public.get_my_profile()->>'total_xp')::int;
      v_out := v_out || jsonb_build_object('t', 'takroriy done qo''shimcha bermaydi',
        'r', CASE WHEN x2 = x1 AND c2 = c1 THEN 'PASS' ELSE 'FAIL' END,
        'd', format('tanga %s->%s, xp %s->%s', c1, c2, x1, x2));

      PERFORM public.toggle_habit_atomic(v_habit, v_today, 'neutral');
      PERFORM public.toggle_habit_atomic(v_habit, v_today, 'done');
      PERFORM public.toggle_habit_atomic(v_habit, v_today, 'neutral');
      c3 := (public.get_my_profile()->>'coins')::int;  x3 := (public.get_my_profile()->>'total_xp')::int;
      v_out := v_out || jsonb_build_object('t', 'done/neutral sikli balansni o''zgartirmaydi',
        'r', CASE WHEN x3 = x0 AND c3 = c0 THEN 'PASS' ELSE 'FAIL' END,
        'd', format('tanga %s->%s, xp %s->%s', c0, c3, x0, x3));

      BEGIN
        PERFORM public.toggle_habit_atomic(v_habit, v_today - 2, 'done');
        v_out := v_out || jsonb_build_object('t', '2 kun oldingi sana qulflangan', 'r', 'FAIL');
      EXCEPTION WHEN OTHERS THEN
        v_out := v_out || jsonb_build_object('t', '2 kun oldingi sana qulflangan',
          'r', CASE WHEN SQLERRM LIKE '%date_locked%' THEN 'PASS' ELSE 'FAIL' END, 'd', SQLERRM);
      END;

      BEGIN
        PERFORM public.increment_coins(v_user, 1000000);
        v_out := v_out || jsonb_build_object('t', 'increment_coins chaqirib bo''lmaydi', 'r', 'FAIL');
      EXCEPTION WHEN insufficient_privilege THEN
        v_out := v_out || jsonb_build_object('t', 'increment_coins chaqirib bo''lmaydi', 'r', 'PASS');
      END;

      BEGIN
        INSERT INTO public.habit_logs (habit_id, user_id, log_date, completed) VALUES (v_habit, v_user, v_today, true);
        v_out := v_out || jsonb_build_object('t', 'habit_logs ga to''g''ridan-to''g''ri yozib bo''lmaydi', 'r', 'FAIL');
      EXCEPTION WHEN insufficient_privilege THEN
        v_out := v_out || jsonb_build_object('t', 'habit_logs ga to''g''ridan-to''g''ri yozib bo''lmaydi', 'r', 'PASS');
      END;

      BEGIN
        UPDATE public.profiles SET coins = 999999 WHERE id = v_user;
        v_out := v_out || jsonb_build_object('t', 'o''z tangasini yozib bo''lmaydi', 'r', 'FAIL');
      EXCEPTION WHEN insufficient_privilege THEN
        v_out := v_out || jsonb_build_object('t', 'o''z tangasini yozib bo''lmaydi', 'r', 'PASS');
      END;

      BEGIN
        PERFORM p.phone FROM public.profiles p WHERE p.id = v_other;
        v_out := v_out || jsonb_build_object('t', 'boshqaning telefonini o''qib bo''lmaydi', 'r', 'FAIL');
      EXCEPTION WHEN insufficient_privilege THEN
        v_out := v_out || jsonb_build_object('t', 'boshqaning telefonini o''qib bo''lmaydi', 'r', 'PASS');
      END;

      BEGIN
        PERFORM public.reconcile_daily_missions(v_other, v_today);
        v_out := v_out || jsonb_build_object('t', 'boshqa uchun reconcile rad etiladi', 'r', 'FAIL');
      EXCEPTION WHEN OTHERS THEN
        v_out := v_out || jsonb_build_object('t', 'boshqa uchun reconcile rad etiladi',
          'r', CASE WHEN SQLERRM LIKE '%not_authorized%' THEN 'PASS' ELSE 'FAIL' END, 'd', SQLERRM);
      END;

      BEGIN
        PERFORM public.purchase_shop_item('free_money');
        v_out := v_out || jsonb_build_object('t', 'noma''lum buyum rad etiladi', 'r', 'FAIL');
      EXCEPTION WHEN OTHERS THEN
        v_out := v_out || jsonb_build_object('t', 'noma''lum buyum rad etiladi',
          'r', CASE WHEN SQLERRM LIKE '%unknown_item%' THEN 'PASS' ELSE 'FAIL' END, 'd', SQLERRM);
      END;

      BEGIN
        PERFORM public.get_habits_for_telegram(1);
        v_out := v_out || jsonb_build_object('t', 'bot funksiyasi foydalanuvchiga yopiq', 'r', 'FAIL');
      EXCEPTION WHEN insufficient_privilege THEN
        v_out := v_out || jsonb_build_object('t', 'bot funksiyasi foydalanuvchiga yopiq', 'r', 'PASS');
      END;

      -- Barcha test o'zgarishlarini (loglar, balans, rol, sessiya) bekor qilish
      RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'verify_047_rollback';
    EXCEPTION
      WHEN SQLSTATE 'P0099' THEN
        NULL;  -- kutilgan: ma'lumotlar qaytarildi
      WHEN OTHERS THEN
        v_out := v_out || jsonb_build_object('t', 'xatti-harakat testlari kutilmagan xato bilan to''xtadi', 'r', 'FAIL', 'd', SQLERRM);
    END;
  END IF;

  -- Funksiya o'zini o'chiradi (bazada iz qolmaydi)
  EXECUTE 'DROP FUNCTION IF EXISTS public._verify_047()';

  RETURN QUERY
    SELECT e.ord, e.val->>'t', e.val->>'r', e.val->>'d'
    FROM jsonb_array_elements(v_out) WITH ORDINALITY AS e(val, ord)
    ORDER BY e.ord;
END;
$fn$;

SELECT * FROM public._verify_047();
