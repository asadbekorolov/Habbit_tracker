-- ============================================================================
-- 047: Ichki iqtisodiyotni serverga ko'chirish va RPC xavfsizligi
-- ============================================================================
-- Qisqacha:
--   * Kun chegarasi: Asia/Tashkent (tashkent_today, is_log_date_open).
--   * Odat belgilash FAQAT toggle_habit_atomic orqali (habit_logs ga mijoz
--     yozishi yopiladi). Mukofotlar reward_ledger orqali: belgi olib
--     tashlansa qaytarib olinadi, qayta qo'yilsa yana beriladi — bitta
--     (user, habit, kun) uchun eng ko'pi bilan bitta mukofot.
--   * increment_*/spend_coins/add_xp_to_user/claim_daily_quest mijozdan yopiladi.
--   * Do'kon narxlari serverda (shop_items), xarid purchase_shop_item orqali.
--   * AI tahlil to'lovi faqat server (service_role) orqali.
--   * School21 nishonlari serverda tekshiriladi (claim_badge_reward).
--   * Telegram RPC'lari faqat service_role uchun; ulash bir martalik token bilan.
--   * profiles: shaxsiy ustunlar boshqalarga yopiq, o'z profili get_my_profile().
--
-- Butun fayl bitta tranzaksiya: xato bo'lsa hech narsa o'zgarmaydi.
-- Qayta ishga tushirish xavfsiz (idempotent).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Mijoz ishlatadigan, lekin hech bir migratsiyada yaratilmagan ustunlar
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year integer;

-- ----------------------------------------------------------------------------
-- 1. Sana yordamchilari (Asia/Tashkent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tashkent_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date;
$$;

-- Belgilash oynasi: kun 00:00 dan ertasi kuni 09:00 gacha (Toshkent vaqti).
CREATE OR REPLACE FUNCTION public.is_log_date_open(p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_date IS NOT NULL AND (
    p_date = tashkent_today()
    OR (p_date = tashkent_today() - 1
        AND (now() AT TIME ZONE 'Asia/Tashkent')::time < time '09:00')
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Balans yordamchisi (ichki)
-- ----------------------------------------------------------------------------
-- Tangalar qaytarib olinganda 0 dan pastga tushishi mumkin (qarz). Aks holda
-- "ol -> sarfla -> belgini olib tashla (0 da to'xtaydi) -> qayta ol" sikli
-- cheksiz tanga beradi. spend_* funksiyalari coins >= narx talab qiladi,
-- shuning uchun qarzdor foydalanuvchi hech narsa sotib ololmaydi.
CREATE OR REPLACE FUNCTION public._apply_balance(
  p_user_id uuid, p_score integer, p_coins integer, p_xp integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles SET
    score         = GREATEST(0, COALESCE(score, 0) + COALESCE(p_score, 0)),
    coins         = COALESCE(coins, 0) + COALESCE(p_coins, 0),
    total_xp      = GREATEST(0, COALESCE(total_xp, 0) + COALESCE(p_xp, 0)),
    current_level = calculate_level(GREATEST(0, COALESCE(total_xp, 0) + COALESCE(p_xp, 0)))
  WHERE id = p_user_id;
$$;

-- Bitta foydalanuvchining barcha mukofot o'zgarishlarini ketma-ket bajarish
-- (ikki tab / ikki qurilma / bot bir vaqtda — poyga holati bo'lmaydi).
CREATE OR REPLACE FUNCTION public._lock_user_rewards(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('rewards:' || p_user_id::text, 0));
$$;

-- ----------------------------------------------------------------------------
-- 3. Mukofotlar daftari
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id      uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date      date NOT NULL,
  score_awarded integer NOT NULL DEFAULT 0,
  coins_awarded integer NOT NULL DEFAULT 0,
  xp_awarded    integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  source        text NOT NULL DEFAULT 'app',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, habit_id, log_date)
);

ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reward_ledger_select_own ON public.reward_ledger;
CREATE POLICY reward_ledger_select_own ON public.reward_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.reward_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reward_ledger TO authenticated;

-- Hozir hali ochiq bo'lgan kunlardagi (bugun/kecha) bajarilgan loglar eski
-- tizimda allaqachon mukofotlangan bo'lishi mumkin. Ularni daftarga balansni
-- o'zgartirmasdan yozamiz — aks holda "olib tashla -> qayta qo'y" bir marta
-- ortiqcha mukofot berardi.
INSERT INTO public.reward_ledger (user_id, habit_id, log_date, score_awarded, coins_awarded, xp_awarded, active, source)
SELECT hl.user_id, hl.habit_id, hl.log_date,
       1,
       CASE WHEN h.type = 'negative' THEN 10 ELSE 1 END,
       CASE WHEN h.type = 'negative' THEN 15 ELSE 5 END,
       true, 'backfill'
FROM habit_logs hl
JOIN habits h ON h.id = hl.habit_id AND h.user_id = hl.user_id
WHERE hl.completed = true
  AND hl.log_date >= tashkent_today() - 1
ON CONFLICT (user_id, habit_id, log_date) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Kunlik vazifalar — ichki hisoblash (046 mantig'i, Toshkent sanasi bilan)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reconcile_daily_missions(p_user_id uuid, p_date date)
RETURNS jsonb
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
  v_eligible boolean;
  v_claimed boolean;
  v_quest record;
  v_coins_granted integer := 0;
  v_xp_granted integer := 0;
  v_coins_deducted integer := 0;
  v_xp_deducted integer := 0;
  v_granted jsonb := '[]'::jsonb;
  v_revoked jsonb := '[]'::jsonb;
  v_final_coins integer;
  v_final_score integer;
BEGIN
  SELECT COUNT(*) INTO v_total_habits
  FROM habits WHERE user_id = p_user_id AND is_active = true;

  SELECT
    COALESCE(COUNT(*) FILTER (WHERE hl.completed = true), 0),
    COALESCE(COUNT(*) FILTER (WHERE h.type = 'negative' AND hl.completed = false), 0),
    COALESCE(COUNT(*) FILTER (WHERE h.type = 'negative' AND hl.completed = true), 0),
    COALESCE(bool_or(h.type = 'negative'), false)
  INTO v_completed_count, v_negative_broken_count, v_negative_kept_count, v_has_negative
  FROM habit_logs hl
  JOIN habits h ON h.id = hl.habit_id
  WHERE hl.user_id = p_user_id AND hl.log_date = p_date;

  SELECT EXISTS (
    SELECT 1 FROM habit_logs
    WHERE user_id = p_user_id AND log_date = p_date - 1 AND completed = true
  ) INTO v_yesterday_completed;

  FOR v_quest IN
    SELECT * FROM (VALUES
      ('q_complete_3',   5,  5),
      ('q_complete_all', 10, 10),
      ('q_negative_win', 5,  5),
      ('q_consistency',  5,  5)
    ) AS q(quest_id, reward_coins, reward_xp)
  LOOP
    v_eligible := CASE v_quest.quest_id
      WHEN 'q_complete_3'   THEN v_completed_count >= 3
      WHEN 'q_complete_all' THEN v_total_habits > 0 AND v_completed_count >= v_total_habits AND v_negative_broken_count = 0
      WHEN 'q_negative_win' THEN v_has_negative AND v_negative_broken_count = 0 AND (v_negative_kept_count > 0 OR v_completed_count > 0)
      WHEN 'q_consistency'  THEN v_completed_count > 0 AND v_yesterday_completed
    END;

    SELECT EXISTS (
      SELECT 1 FROM daily_quest_claims
      WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = v_quest.quest_id
    ) INTO v_claimed;

    IF v_eligible AND NOT v_claimed THEN
      INSERT INTO daily_quest_claims (user_id, quest_id, quest_date)
      VALUES (p_user_id, v_quest.quest_id, p_date)
      ON CONFLICT DO NOTHING;
      v_coins_granted := v_coins_granted + v_quest.reward_coins;
      v_xp_granted := v_xp_granted + v_quest.reward_xp;
      v_granted := v_granted || jsonb_build_object('questId', v_quest.quest_id, 'rewardCoins', v_quest.reward_coins, 'rewardXp', v_quest.reward_xp);
    ELSIF NOT v_eligible AND v_claimed THEN
      DELETE FROM daily_quest_claims
      WHERE user_id = p_user_id AND quest_date = p_date AND quest_id = v_quest.quest_id;
      v_coins_deducted := v_coins_deducted + v_quest.reward_coins;
      v_xp_deducted := v_xp_deducted + v_quest.reward_xp;
      v_revoked := v_revoked || jsonb_build_object('questId', v_quest.quest_id, 'rewardCoins', v_quest.reward_coins, 'rewardXp', v_quest.reward_xp);
    END IF;
  END LOOP;

  -- Vazifa "XP"si avvalgidek score ga yoziladi.
  IF (v_coins_granted - v_coins_deducted) <> 0 OR (v_xp_granted - v_xp_deducted) <> 0 THEN
    PERFORM _apply_balance(p_user_id, v_xp_granted - v_xp_deducted, v_coins_granted - v_coins_deducted, 0);
  END IF;

  SELECT COALESCE(coins, 0), COALESCE(score, 0) INTO v_final_coins, v_final_score
  FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'coins', v_final_coins,
    'score', v_final_score,
    'coinsDelta', v_coins_granted - v_coins_deducted,
    'xpDelta', v_xp_granted - v_xp_deducted,
    'grantedQuests', v_granted,
    'revokedQuests', v_revoked
  );
END;
$$;

-- Ommaviy o'ram: faqat o'zi uchun va faqat ochiq kun uchun.
DROP FUNCTION IF EXISTS public.reconcile_daily_missions(uuid, date);
CREATE FUNCTION public.reconcile_daily_missions(p_user_id uuid, p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_date date := COALESCE(p_date, tashkent_today());
  v_coins integer;
  v_score integer;
BEGIN
  IF v_uid IS NULL OR p_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  PERFORM _lock_user_rewards(v_uid);

  -- Yopilgan kun: hech narsa o'zgartirmasdan joriy holatni qaytaramiz.
  IF NOT is_log_date_open(v_date) THEN
    SELECT COALESCE(coins, 0), COALESCE(score, 0) INTO v_coins, v_score FROM profiles WHERE id = v_uid;
    RETURN jsonb_build_object('coins', v_coins, 'score', v_score, 'coinsDelta', 0, 'xpDelta', 0,
                              'grantedQuests', '[]'::jsonb, 'revokedQuests', '[]'::jsonb);
  END IF;

  RETURN _reconcile_daily_missions(v_uid, v_date);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Yadro: odat holatini o'rnatish + mukofot (ichki, hech kimga ochilmaydi)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._set_habit_status(
  p_user_id uuid,
  p_habit_id uuid,
  p_date date,
  p_status text,
  p_value numeric DEFAULT 1,
  p_source text DEFAULT 'app'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_ledger_id uuid;
  v_ledger_active boolean;
  v_ledger_score integer;
  v_ledger_coins integer;
  v_ledger_xp integer;
  v_score integer := 1;
  v_coins integer;
  v_xp integer;
  v_value numeric := LEAST(GREATEST(COALESCE(p_value, 1), 0), 100000);
  v_recon jsonb;
  v_profile record;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('done', 'fail', 'neutral') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT type INTO v_type FROM habits WHERE id = p_habit_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'habit_not_found';
  END IF;

  PERFORM _lock_user_rewards(p_user_id);

  -- 1) Log holati
  IF p_status = 'neutral' THEN
    DELETE FROM habit_logs
    WHERE habit_id = p_habit_id AND user_id = p_user_id AND log_date = p_date;
  ELSE
    INSERT INTO habit_logs (habit_id, user_id, log_date, completed, value)
    VALUES (p_habit_id, p_user_id, p_date, p_status = 'done', v_value)
    ON CONFLICT (habit_id, user_id, log_date)
    DO UPDATE SET completed = EXCLUDED.completed, value = EXCLUDED.value;
  END IF;

  -- 2) Mukofot (server belgilagan miqdorlar)
  IF v_type = 'negative' THEN
    v_coins := 10; v_xp := 15;
  ELSE
    v_coins := 1;  v_xp := 5;
  END IF;

  SELECT id, active, score_awarded, coins_awarded, xp_awarded
    INTO v_ledger_id, v_ledger_active, v_ledger_score, v_ledger_coins, v_ledger_xp
  FROM reward_ledger
  WHERE user_id = p_user_id AND habit_id = p_habit_id AND log_date = p_date
  FOR UPDATE;

  IF p_status = 'done' THEN
    IF v_ledger_id IS NULL THEN
      INSERT INTO reward_ledger (user_id, habit_id, log_date, score_awarded, coins_awarded, xp_awarded, active, source)
      VALUES (p_user_id, p_habit_id, p_date, v_score, v_coins, v_xp, true, p_source);
      PERFORM _apply_balance(p_user_id, v_score, v_coins, v_xp);
    ELSIF NOT v_ledger_active THEN
      UPDATE reward_ledger
      SET active = true, score_awarded = v_score, coins_awarded = v_coins, xp_awarded = v_xp,
          source = p_source, updated_at = now()
      WHERE id = v_ledger_id;
      PERFORM _apply_balance(p_user_id, v_score, v_coins, v_xp);
    END IF;
  ELSIF v_ledger_id IS NOT NULL AND v_ledger_active THEN
    -- Belgi olib tashlandi yoki "bajarilmadi" -> berilgan mukofot qaytariladi.
    UPDATE reward_ledger SET active = false, updated_at = now() WHERE id = v_ledger_id;
    PERFORM _apply_balance(p_user_id, -v_ledger_score, -v_ledger_coins, -v_ledger_xp);
  END IF;

  -- 3) Kunlik vazifalar
  v_recon := _reconcile_daily_missions(p_user_id, p_date);

  SELECT COALESCE(coins, 0) AS coins, COALESCE(score, 0) AS score,
         COALESCE(total_xp, 0) AS total_xp, COALESCE(current_level, 1) AS current_level
    INTO v_profile
  FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', p_status,
    'coins', v_profile.coins,
    'score', v_profile.score,
    'total_xp', v_profile.total_xp,
    'level', v_profile.current_level,
    'reconciliation', v_recon
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Mijoz uchun yagona belgilash RPC'si
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_habit_atomic(
  p_habit_id uuid,
  p_date date,
  p_status text,
  p_value numeric DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT is_log_date_open(p_date) THEN
    RAISE EXCEPTION 'date_locked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM habits WHERE id = p_habit_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'habit_not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND COALESCE(is_banned, false)) THEN
    RAISE EXCEPTION 'banned';
  END IF;

  RETURN _set_habit_status(v_uid, p_habit_id, p_date, p_status, p_value, 'app');
END;
$$;

-- habit_logs: mijoz faqat o'qiy oladi, yozish faqat RPC orqali.
REVOKE INSERT, UPDATE, DELETE ON public.habit_logs FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Guruh tasdig'i: shaxsiy odat mukofoti ham yadro (daftar) orqali
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_group_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_group_habit_id uuid;
  v_member_id uuid;
  v_log_date date;
  v_reps integer;
  v_is_site_admin boolean;
  v_linked_habit_id uuid;
BEGIN
  SELECT ghl.group_id, ghl.group_habit_id, ghl.user_id, ghl.log_date, ghl.reps
    INTO v_group_id, v_group_habit_id, v_member_id, v_log_date, v_reps
  FROM group_habit_logs ghl
  WHERE ghl.id = p_log_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT is_admin INTO v_is_site_admin FROM profiles WHERE id = auth.uid();
  IF NOT is_group_admin(v_group_id, auth.uid()) AND NOT COALESCE(v_is_site_admin, false) THEN
    RAISE EXCEPTION 'Faqat guruh sardori yoki sayt admini tasdiqlashi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_log_id;

  SELECT habit_id INTO v_linked_habit_id
  FROM group_habit_links
  WHERE group_habit_id = v_group_habit_id AND user_id = v_member_id;

  IF v_linked_habit_id IS NOT NULL THEN
    -- Bitta (a'zo, odat, kun) uchun ilova, bot va guruh tasdig'i birgalikda
    -- eng ko'pi bilan bitta mukofot beradi.
    PERFORM _set_habit_status(v_member_id, v_linked_habit_id, v_log_date, 'done',
                              GREATEST(1, COALESCE(v_reps, 1)), 'group');
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Mijozdan yopiladigan eski iqtisodiyot funksiyalari
-- ----------------------------------------------------------------------------
-- claim_daily_quest: mijoz endi ishlatmaydi; baribir uid ga ishonmaydigan va
-- Toshkent sanasini ishlatadigan qilib qayta yoziladi, keyin yopiladi.
CREATE OR REPLACE FUNCTION public.claim_daily_quest(uid uuid, p_quest_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR uid IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  PERFORM _lock_user_rewards(v_uid);
  v_result := _reconcile_daily_missions(v_uid, tashkent_today());
  RETURN (v_result->>'coins')::integer;
END;
$$;

-- Jonli bazada biror funksiya bo'lmasa ham tranzaksiya to'xtamasligi uchun
-- har birini mavjudligini tekshirib yopamiz.
DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.increment_score(uuid, integer)',
    'public.increment_coins(uuid, integer)',
    'public.spend_coins(uuid, integer)',
    'public.add_xp_to_user(uuid, integer)',
    'public.claim_daily_quest(uuid, text)']
  LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 9. Do'kon: narxlar serverda
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_items (
  id            text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('buff', 'resource', 'frame', 'title', 'avatar_color', 'glow')),
  price         integer NOT NULL CHECK (price > 0),
  repeatable    boolean NOT NULL DEFAULT false,  -- qayta sotib olish mumkinmi
  duration_days integer,                          -- muddatli (ramkalar)
  active        boolean NOT NULL DEFAULT true
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_items_read ON public.shop_items;
CREATE POLICY shop_items_read ON public.shop_items FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.shop_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shop_items TO authenticated;

INSERT INTO public.shop_items (id, kind, price, repeatable, duration_days) VALUES
  ('streak_repair',          'buff',         250,  true,  NULL),
  ('streak_freeze',          'buff',         10,   true,  NULL),
  ('shield_gold_3d',         'buff',         25,   true,  NULL),
  ('xp_booster',             'buff',         100,  true,  NULL),
  ('pdf_focus_guide',        'resource',     400,  false, NULL),
  ('checklist_productivity', 'resource',     150,  false, NULL),
  ('telegram_vip_access',    'resource',     1000, false, NULL),
  ('frame_bronze',           'frame',        8,    true,  30),
  ('frame_silver',           'frame',        20,   true,  30),
  ('frame_gold',             'frame',        50,   true,  30),
  ('title_master',           'title',        150,  false, NULL),
  ('title_legend',           'title',        350,  false, NULL),
  ('avatar_color_sunset',    'avatar_color', 20,   false, NULL),
  ('avatar_color_galaxy',    'avatar_color', 20,   false, NULL),
  ('avatar_color_ocean',     'avatar_color', 20,   false, NULL),
  ('username_glow',          'glow',         40,   false, NULL)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind, price = EXCLUDED.price, repeatable = EXCLUDED.repeatable,
  duration_days = EXCLUDED.duration_days;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item shop_items%ROWTYPE;
  v_balance integer;
  v_purchased_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_item FROM shop_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_item';
  END IF;

  PERFORM _lock_user_rewards(v_uid);

  IF NOT v_item.repeatable AND EXISTS (
    SELECT 1 FROM coin_purchases WHERE user_id = v_uid AND item_id = p_item_id
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  UPDATE profiles SET coins = coins - v_item.price
  WHERE id = v_uid AND COALESCE(coins, 0) >= v_item.price
  RETURNING coins INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  INSERT INTO coin_purchases (user_id, item_id)
  VALUES (v_uid, p_item_id)
  RETURNING purchased_at INTO v_purchased_at;

  -- Avtomatik qo'llash (avval mijoz qilardi)
  IF v_item.kind = 'glow' THEN
    UPDATE profiles SET username_glow = true WHERE id = v_uid;
  ELSIF v_item.kind = 'frame' THEN
    UPDATE profiles SET active_frame = p_item_id WHERE id = v_uid;
  ELSIF v_item.kind = 'title' THEN
    UPDATE profiles SET active_title = p_item_id WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('coins', v_balance, 'item_id', p_item_id, 'purchased_at', v_purchased_at);
END;
$$;

-- Ramka/unvonni taqish yoki yechish (egalik serverda tekshiriladi).
CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_kind text, p_item_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_kind = 'frame' THEN
    IF p_item_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM coin_purchases cp
      JOIN shop_items si ON si.id = cp.item_id AND si.kind = 'frame'
      WHERE cp.user_id = v_uid AND cp.item_id = p_item_id
        AND cp.purchased_at > now() - make_interval(days => COALESCE(si.duration_days, 30))
    ) THEN
      RAISE EXCEPTION 'not_owned';
    END IF;
    UPDATE profiles SET active_frame = p_item_id WHERE id = v_uid;
  ELSIF p_kind = 'title' THEN
    IF p_item_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM coin_purchases cp
      JOIN shop_items si ON si.id = cp.item_id AND si.kind = 'title'
      WHERE cp.user_id = v_uid AND cp.item_id = p_item_id
    ) THEN
      RAISE EXCEPTION 'not_owned';
    END IF;
    UPDATE profiles SET active_title = p_item_id WHERE id = v_uid;
  ELSE
    RAISE EXCEPTION 'invalid_kind';
  END IF;
END;
$$;

-- Xaridlar va muzlatishlarni mijoz o'zi yoza olmaydi.
REVOKE INSERT, UPDATE, DELETE ON public.coin_purchases FROM anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.streak_freezes') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE ON public.streak_freezes FROM anon, authenticated;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. AI tahlil to'lovi (faqat server / service_role)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_coins_for_ai(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cost CONSTANT integer := 200;
  v_balance integer;
BEGIN
  PERFORM _lock_user_rewards(p_user_id);
  UPDATE profiles SET coins = coins - c_cost
  WHERE id = p_user_id AND COALESCE(coins, 0) >= c_cost
  RETURNING coins INTO v_balance;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_coins_for_ai(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cost CONSTANT integer := 200;
  v_balance integer;
BEGIN
  PERFORM _lock_user_rewards(p_user_id);
  UPDATE profiles SET coins = COALESCE(coins, 0) + c_cost
  WHERE id = p_user_id
  RETURNING coins INTO v_balance;
  RETURN v_balance;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. School21 nishonlari — shartlar serverda
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badge_claims (
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id   text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);
ALTER TABLE public.badge_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS badge_claims_select_own ON public.badge_claims;
CREATE POLICY badge_claims_select_own ON public.badge_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.badge_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.badge_claims TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_badge_reward(p_badge_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total_completed integer;
  v_active_days integer;
  v_best_streak integer;
  v_score integer;
  v_eligible boolean;
  v_reward_xp integer;
  v_reward_coins integer;
  v_coins integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT r.xp, r.coins INTO v_reward_xp, v_reward_coins
  FROM (VALUES
    ('first_step',        20,  5),
    ('consistency_7',     50,  15),
    ('consistency_30',    150, 50),
    ('consistency_100',   500, 200),
    ('morning_hero',      75,  25),
    ('health_ambassador', 100, 30),
    ('knowledge_miner',   200, 60)
  ) AS r(badge_id, xp, coins)
  WHERE r.badge_id = p_badge_id;

  IF v_reward_xp IS NULL THEN
    RAISE EXCEPTION 'unknown_badge';
  END IF;

  PERFORM _lock_user_rewards(v_uid);

  IF EXISTS (SELECT 1 FROM badge_claims WHERE user_id = v_uid AND badge_id = p_badge_id) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT log_date)
    INTO v_total_completed, v_active_days
  FROM habit_logs WHERE user_id = v_uid AND completed = true;

  -- Eng uzun ketma-ketlik: kamida bitta bajarilgan odat bo'lgan uzluksiz kunlar.
  WITH d AS (
    SELECT DISTINCT log_date FROM habit_logs WHERE user_id = v_uid AND completed = true
  ), g AS (
    SELECT log_date - (ROW_NUMBER() OVER (ORDER BY log_date))::integer AS grp FROM d
  )
  SELECT COALESCE(MAX(cnt), 0) INTO v_best_streak
  FROM (SELECT COUNT(*) AS cnt FROM g GROUP BY grp) s;

  SELECT COALESCE(score, 0) INTO v_score FROM profiles WHERE id = v_uid;

  v_eligible := CASE p_badge_id
    WHEN 'first_step'        THEN v_total_completed >= 1
    WHEN 'consistency_7'     THEN v_best_streak >= 7
    WHEN 'consistency_30'    THEN v_best_streak >= 30
    WHEN 'consistency_100'   THEN v_best_streak >= 100
    WHEN 'morning_hero'      THEN v_total_completed >= 5
    WHEN 'health_ambassador' THEN v_active_days >= 7
    WHEN 'knowledge_miner'   THEN v_score >= 500
    ELSE false
  END;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;

  INSERT INTO badge_claims (user_id, badge_id) VALUES (v_uid, p_badge_id);
  -- Nishon "XP"si avvalgidek score ga yoziladi.
  PERFORM _apply_balance(v_uid, v_reward_xp, v_reward_coins, 0);

  SELECT coins, score INTO v_coins, v_score FROM profiles WHERE id = v_uid;
  RETURN jsonb_build_object('coins', v_coins, 'score', v_score,
                            'rewardXp', v_reward_xp, 'rewardCoins', v_reward_coins);
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Telegram: bir martalik ulash tokeni + service_role'ga yopilgan RPC'lar
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_link_tokens FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_telegram_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  DELETE FROM telegram_link_tokens WHERE user_id = v_uid OR expires_at < now();
  -- 32 ta hex belgi (Telegram /start parametri: [A-Za-z0-9_-], <= 64).
  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO telegram_link_tokens (token, user_id, expires_at)
  VALUES (v_token, v_uid, now() + interval '15 minutes');
  RETURN v_token;
END;
$$;

DROP FUNCTION IF EXISTS public.link_telegram_account(uuid, bigint);
CREATE OR REPLACE FUNCTION public.link_telegram_account(p_token text, p_telegram_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_name text;
BEGIN
  UPDATE telegram_link_tokens
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL AND expires_at > now()
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  -- Bitta chat faqat bitta hisobga ulanadi.
  UPDATE profiles SET telegram_chat_id = NULL
  WHERE telegram_chat_id = p_telegram_chat_id AND id <> v_user_id;

  UPDATE profiles SET telegram_chat_id = p_telegram_chat_id
  WHERE id = v_user_id
  RETURNING display_name INTO v_name;

  RETURN jsonb_build_object('ok', true, 'display_name', v_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_telegram_recipients(p_group_id uuid, p_exclude_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(p.telegram_chat_id)
    INTO v_result
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  WHERE gm.group_id = p_group_id
    AND gm.user_id <> p_exclude_user_id
    AND p.telegram_chat_id IS NOT NULL;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_habits_for_telegram(p_telegram_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_today date := tashkent_today();
BEGIN
  SELECT id, display_name INTO v_uid, v_name
  FROM profiles WHERE telegram_chat_id = p_telegram_chat_id
  LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'display_name', v_name,
    'habits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id::text, 'name', h.name, 'emoji', h.emoji,
        'done', EXISTS (
          SELECT 1 FROM habit_logs
          WHERE habit_id = h.id AND user_id = v_uid AND log_date = v_today AND completed = true)
      ) ORDER BY h.created_at)
      FROM habits h
      WHERE h.user_id = v_uid AND h.is_active = true AND h.type = 'positive'
    ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_habit_via_telegram(p_telegram_chat_id bigint, p_habit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_emoji text;
  v_today date := tashkent_today();
BEGIN
  SELECT id INTO v_uid FROM profiles WHERE telegram_chat_id = p_telegram_chat_id LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  SELECT name, emoji INTO v_name, v_emoji
  FROM habits WHERE id = p_habit_id AND user_id = v_uid AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'habit_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM habit_logs
    WHERE habit_id = p_habit_id AND user_id = v_uid AND log_date = v_today AND completed = true
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_done', true, 'name', v_name, 'emoji', v_emoji);
  END IF;

  -- Ilova bilan bir xil daftar: bitta odat/kun uchun bitta mukofot.
  PERFORM _set_habit_status(v_uid, p_habit_id, v_today, 'done', 1, 'telegram');

  RETURN jsonb_build_object('ok', true, 'already_done', false, 'name', v_name, 'emoji', v_emoji);
END;
$$;

-- Boshqa foydalanuvchining Telegram username'i: o'zi, ochiq bo'lsa yoki
-- so'rov tasdiqlangan bo'lsa ko'rinadi.
CREATE OR REPLACE FUNCTION public.get_telegram_contact(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_username text;
  v_private boolean;
  v_visible boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT telegram_username, COALESCE(telegram_private, false)
    INTO v_username, v_private
  FROM profiles WHERE id = p_user_id;

  v_visible := v_uid = p_user_id
    OR NOT v_private
    OR EXISTS (
      SELECT 1 FROM telegram_requests
      WHERE requester_id = v_uid AND target_id = p_user_id AND status = 'approved');

  RETURN jsonb_build_object(
    'has_telegram', v_username IS NOT NULL AND v_username <> '',
    'username', CASE WHEN v_visible THEN v_username ELSE NULL END
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. profiles: ustun darajasidagi ruxsatlar
-- ----------------------------------------------------------------------------
-- O'z to'liq profili (shaxsiy ustunlar bilan)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p) FROM profiles p WHERE p.id = auth.uid();
$$;

DO $$
DECLARE
  v_col text;
  v_private text[] := ARRAY[
    'phone', 'telegram_chat_id', 'telegram_username', 'is_admin', 'is_banned',
    'last_seen_at', 'height_cm', 'weight_kg', 'birth_date', 'birth_year'];
  v_updatable text[] := ARRAY[
    'display_name', 'full_name', 'username', 'avatar_url', 'avatar_color', 'bio',
    'telegram_username', 'telegram_private', 'instagram_username', 'profile_private',
    'phone', 'height_cm', 'weight_kg', 'birth_date', 'birth_year'];
  v_insertable text[] := ARRAY[
    'id', 'username', 'display_name', 'full_name', 'avatar_url', 'avatar_color'];
BEGIN
  -- Jadval darajasidagi huquqlarni olib, ustunlar bo'yicha qaytadan beramiz.
  REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM anon, authenticated;

  FOR v_col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
  LOOP
    EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I) ON public.profiles FROM anon, authenticated',
                   v_col, v_col, v_col);

    IF NOT (v_col = ANY (v_private)) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.profiles TO authenticated', v_col);
    END IF;
    IF v_col = ANY (v_updatable) THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated', v_col);
    END IF;
    IF v_col = ANY (v_insertable) THEN
      EXECUTE format('GRANT INSERT (%I) ON public.profiles TO authenticated', v_col);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 14. Funksiya huquqlari
-- ----------------------------------------------------------------------------
-- Supabase yangi funksiyalarga anon/authenticated'ga avtomatik EXECUTE beradi,
-- shuning uchun har birini aniq belgilaymiz.

-- Ichki: hech kimga (faqat boshqa SECURITY DEFINER funksiyalar ichidan)
REVOKE EXECUTE ON FUNCTION public._apply_balance(uuid, integer, integer, integer)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._lock_user_rewards(uuid)                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._reconcile_daily_missions(uuid, date)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._set_habit_status(uuid, uuid, date, text, numeric, text)   FROM PUBLIC, anon, authenticated;

-- Faqat server (service_role)
REVOKE EXECUTE ON FUNCTION public.spend_coins_for_ai(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_coins_for_ai(uuid)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_telegram_account(text, bigint)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_group_telegram_recipients(uuid, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_habits_for_telegram(bigint)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_habit_via_telegram(bigint, uuid)         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.spend_coins_for_ai(uuid)                          TO service_role;
GRANT  EXECUTE ON FUNCTION public.refund_coins_for_ai(uuid)                         TO service_role;
GRANT  EXECUTE ON FUNCTION public.link_telegram_account(text, bigint)               TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_group_telegram_recipients(uuid, uuid)         TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_habits_for_telegram(bigint)                   TO service_role;
GRANT  EXECUTE ON FUNCTION public.complete_habit_via_telegram(bigint, uuid)         TO service_role;

-- Tizimga kirgan foydalanuvchilar uchun (ichkarida auth.uid() tekshiriladi)
REVOKE EXECUTE ON FUNCTION public.toggle_habit_atomic(uuid, date, text, numeric)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_daily_missions(uuid, date)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_shop_item(text)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equip_cosmetic(text, text)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_badge_reward(text)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_telegram_link_token()                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_telegram_contact(uuid)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_profile()                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_group_log(uuid)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_telegram_request(uuid)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_telegram_request(uuid, text)              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_habit_atomic(uuid, date, text, numeric)    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_daily_missions(uuid, date)              TO authenticated;
GRANT  EXECUTE ON FUNCTION public.purchase_shop_item(text)                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.equip_cosmetic(text, text)                        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_badge_reward(text)                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_telegram_link_token()                      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_telegram_contact(uuid)                        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_profile()                                  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_group_log(uuid)                           TO authenticated;
GRANT  EXECUTE ON FUNCTION public.send_telegram_request(uuid)                       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.respond_telegram_request(uuid, text)              TO authenticated;

COMMIT;
