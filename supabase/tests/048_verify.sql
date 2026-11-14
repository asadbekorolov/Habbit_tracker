-- ============================================================================
-- 048 tekshiruvi — Supabase SQL Editor'da BUTUNLIGICHA bitta "Run" bilan.
-- 2 ta statement: funksiyani yaratish va chaqirish. Xatti-harakat testlari
-- ichki blokda bajarilib, oxirida bekor qilinadi (ma'lumot o'zgarmaydi);
-- funksiya ishini tugatgach o'zini o'chiradi. Natija: n | test | result | detail.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._verify_048()
RETURNS TABLE (n bigint, test text, result text, detail text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_period text;
  v_cnt int;
  v_bad int;
  v_user uuid;
  v_habit uuid;
  v_today date := public.tashkent_today();
  v_rank_fn int;
  v_rank_row bigint;
  d0 int; d1 int;
BEGIN
  -- 1) Huquqlar
  v_out := v_out || (
    SELECT jsonb_agg(jsonb_build_object('t', t.name, 'r', CASE WHEN t.ok THEN 'PASS' ELSE 'FAIL' END) ORDER BY t.i)
    FROM (VALUES
      (1, 'anon: get_leaderboard_period yopiq',          NOT has_function_privilege('anon', 'public.get_leaderboard_period(text)', 'execute')),
      (2, 'authenticated: get_leaderboard_period ochiq', has_function_privilege('authenticated', 'public.get_leaderboard_period(text)', 'execute')),
      (3, 'anon: get_my_leaderboard_rank yopiq',         NOT has_function_privilege('anon', 'public.get_my_leaderboard_rank(text)', 'execute')),
      (4, 'authenticated: get_my_leaderboard_rank ochiq', has_function_privilege('authenticated', 'public.get_my_leaderboard_rank(text)', 'execute')),
      (5, 'authenticated: _leaderboard_rows yopiq',      NOT has_function_privilege('authenticated', 'public._leaderboard_rows(text)', 'execute'))
    ) AS t(i, name, ok)
  );

  -- 2) Har bir davr: <= 100 qator, foiz 0..100, o'rinlar 1..N ketma-ket, bloklanganlar yo'q
  FOREACH v_period IN ARRAY ARRAY['daily', 'monthly', '6months', 'yearly', 'all'] LOOP
    SELECT count(*),
           count(*) FILTER (WHERE r.efficiency_pct NOT BETWEEN 0 AND 100 OR r.completed_count < 0)
      INTO v_cnt, v_bad
    FROM public.get_leaderboard_period(v_period) r;
    v_out := v_out || jsonb_build_object('t', format('%s: qatorlar va foizlar to''g''ri', v_period),
      'r', CASE WHEN v_cnt <= 100 AND v_bad = 0 THEN 'PASS' ELSE 'FAIL' END,
      'd', format('%s qator', v_cnt));

    SELECT count(*) INTO v_bad FROM (
      SELECT r.rank, ROW_NUMBER() OVER (ORDER BY r.rank) AS expected
      FROM public.get_leaderboard_period(v_period) r
    ) x WHERE x.rank <> x.expected;
    v_out := v_out || jsonb_build_object('t', format('%s: o''rinlar 1 dan uzluksiz', v_period),
      'r', CASE WHEN v_bad = 0 THEN 'PASS' ELSE 'FAIL' END);

    SELECT count(*) INTO v_bad
    FROM public.get_leaderboard_period(v_period) r
    JOIN public.profiles p ON p.id = r.id
    WHERE COALESCE(p.is_banned, false)
       OR (COALESCE(p.profile_private, false) AND r.avatar_url IS NOT NULL);
    v_out := v_out || jsonb_build_object('t', format('%s: bloklangan/maxfiy qoidalari', v_period),
      'r', CASE WHEN v_bad = 0 THEN 'PASS' ELSE 'FAIL' END);
  END LOOP;

  BEGIN
    PERFORM * FROM public.get_leaderboard_period('weekly_bad');
    v_out := v_out || jsonb_build_object('t', 'noto''g''ri davr rad etiladi', 'r', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || jsonb_build_object('t', 'noto''g''ri davr rad etiladi',
      'r', CASE WHEN SQLERRM LIKE '%invalid_period%' THEN 'PASS' ELSE 'FAIL' END, 'd', SQLERRM);
  END;

  -- 3) Foydalanuvchi sifatida (oxirida bekor qilinadi)
  SELECT h.id, h.user_id INTO v_habit, v_user
  FROM public.habits h
  JOIN public.profiles p ON p.id = h.user_id AND NOT COALESCE(p.is_banned, false)
  WHERE h.is_active
    AND NOT EXISTS (SELECT 1 FROM public.habit_logs l WHERE l.habit_id = h.id AND l.log_date = v_today)
  LIMIT 1;

  IF v_habit IS NULL THEN
    v_out := v_out || jsonb_build_object('t', 'foydalanuvchi testlari', 'r', 'SKIP', 'd', 'bugun belgilanmagan faol odat topilmadi');
  ELSE
    BEGIN
      -- Hisob postgres sifatida o'qiladi (_leaderboard_rows foydalanuvchiga yopiq),
      -- belgi esa foydalanuvchi sifatida qo'yiladi.
      SELECT r.completed_count INTO d0 FROM public._leaderboard_rows('daily') r WHERE r.id = v_user;

      PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      PERFORM public.toggle_habit_atomic(v_habit, v_today, 'done');
      v_rank_fn := public.get_my_leaderboard_rank('daily');
      RESET ROLE;

      SELECT r.completed_count, r.rank INTO d1, v_rank_row FROM public._leaderboard_rows('daily') r WHERE r.id = v_user;
      v_out := v_out || jsonb_build_object('t', 'kunlik reyting yangi belgini hisoblaydi',
        'r', CASE WHEN d1 = COALESCE(d0, 0) + 1 THEN 'PASS' ELSE 'FAIL' END,
        'd', format('%s -> %s', COALESCE(d0, 0), d1));
      v_out := v_out || jsonb_build_object('t', 'get_my_leaderboard_rank jadvaldagi o''rin bilan bir xil',
        'r', CASE WHEN v_rank_fn = v_rank_row AND v_rank_fn > 0 THEN 'PASS' ELSE 'FAIL' END,
        'd', format('fn=%s, jadval=%s', v_rank_fn, v_rank_row));

      RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'verify_048_rollback';
    EXCEPTION
      WHEN SQLSTATE 'P0099' THEN NULL;
      WHEN OTHERS THEN
        v_out := v_out || jsonb_build_object('t', 'foydalanuvchi testlari kutilmagan xato bilan to''xtadi', 'r', 'FAIL', 'd', SQLERRM);
    END;
  END IF;

  BEGIN
    SET LOCAL ROLE anon;
    PERFORM * FROM public.get_leaderboard_period('monthly');
    v_out := v_out || jsonb_build_object('t', 'anon reytingni o''qiy olmaydi', 'r', 'FAIL');
  EXCEPTION WHEN insufficient_privilege THEN
    v_out := v_out || jsonb_build_object('t', 'anon reytingni o''qiy olmaydi', 'r', 'PASS');
  END;
  RESET ROLE;

  EXECUTE 'DROP FUNCTION IF EXISTS public._verify_048()';

  RETURN QUERY
    SELECT e.ord, e.val->>'t', e.val->>'r', e.val->>'d'
    FROM jsonb_array_elements(v_out) WITH ORDINALITY AS e(val, ord)
    ORDER BY e.ord;
END;
$fn$;

SELECT * FROM public._verify_048();
