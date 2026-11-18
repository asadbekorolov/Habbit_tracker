-- ============================================================================
-- 056: Kosmetika — 20 kunlik muddat, yangi narxlar, yoqish/o'chirish;
--      Fikr va takliflar — admin paneli va adminga bildirishnoma
-- ============================================================================
-- 1-QISM. KOSMETIKA (ramkalar va "Yaltiroq ism")
--   * Har bir xarid endi coin_purchases.expires_at ga ega (xarid paytida
--     shop_items.duration_days dan hisoblanadi — trigger). Eski xaridlar:
--       - ramkalar o'sha paytdagi 30 kunlik shart bilan (purchased_at + 30);
--       - "Yaltiroq ism" ilgari doimiy edi — bugundan boshlab 20 kun beriladi.
--   * Narxlar: Bronza 300, Kumush 600, Oltin 1000, Yaltiroq ism 800.
--     Muddat: hammasi 20 kun. Frontend: src/utils/cosmetics.ts (bir xil).
--   * Yechish/taqish: profiles.active_frame / profiles.username_glow — faqat
--     "ko'rsatilsinmi" belgisi. Yechilganda muddat kuymaydi; muddat tugaguncha
--     equip_cosmetic bilan qayta yoqiladi ('frame' va yangi 'glow').
--   * Faol (muddati o'tmagan) bezakni qayta sotib olib bo'lmaydi
--     ('already_active'); muddat tugagach — "Yana sotib olish".
--   * Reyting (_leaderboard_rows) muddatni expires_at bo'yicha tekshiradi,
--     yaltirash ham muddati o'tgan bo'lsa ko'rsatilmaydi.
--   * cleanup_expired_frame(uid) muddati o'tgan ramka va yaltirashni yechadi.
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1.1 expires_at ustuni va eski xaridlar
-- ----------------------------------------------------------------------------
ALTER TABLE public.coin_purchases ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.coin_purchases
   SET expires_at = purchased_at + interval '30 days'
 WHERE expires_at IS NULL
   AND item_id IN ('frame_bronze', 'frame_silver', 'frame_gold');

UPDATE public.coin_purchases
   SET expires_at = GREATEST(purchased_at, now()) + interval '20 days'
 WHERE expires_at IS NULL
   AND item_id = 'username_glow';

CREATE INDEX IF NOT EXISTS coin_purchases_user_item_exp_idx
  ON public.coin_purchases (user_id, item_id, expires_at);

-- ----------------------------------------------------------------------------
-- 1.2 Katalog: narxlar va 20 kun
-- ----------------------------------------------------------------------------
INSERT INTO public.shop_items (id, kind, price, repeatable, duration_days) VALUES
  ('frame_bronze',  'frame', 300,  true, 20),
  ('frame_silver',  'frame', 600,  true, 20),
  ('frame_gold',    'frame', 1000, true, 20),
  ('username_glow', 'glow',  800,  true, 20)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind, price = EXCLUDED.price, repeatable = EXCLUDED.repeatable,
  duration_days = EXCLUDED.duration_days;

-- ----------------------------------------------------------------------------
-- 1.3 Xarid paytida expires_at avtomatik (har qanday yozish yo'li uchun)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._coin_purchase_set_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT duration_days INTO v_days FROM shop_items WHERE id = NEW.item_id;
    IF v_days IS NOT NULL THEN
      NEW.expires_at := COALESCE(NEW.purchased_at, now()) + make_interval(days => v_days);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._coin_purchase_set_expiry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS coin_purchases_set_expiry ON public.coin_purchases;
CREATE TRIGGER coin_purchases_set_expiry
  BEFORE INSERT ON public.coin_purchases
  FOR EACH ROW EXECUTE FUNCTION public._coin_purchase_set_expiry();

-- Bezak qachongacha amal qiladi (eng so'nggi xarid); yo'q bo'lsa NULL
CREATE OR REPLACE FUNCTION public._cosmetic_expires_at(p_uid uuid, p_item_id text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MAX(expires_at) FROM coin_purchases
   WHERE user_id = p_uid AND item_id = p_item_id;
$$;
REVOKE EXECUTE ON FUNCTION public._cosmetic_expires_at(uuid, text) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1.4 Sotib olish
-- ----------------------------------------------------------------------------
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
  v_expires_at timestamptz;
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

  -- Muddatli bezak hali amal qilsa — qayta sotib olinmaydi
  IF v_item.kind IN ('frame', 'glow')
     AND _cosmetic_expires_at(v_uid, p_item_id) > now() THEN
    RAISE EXCEPTION 'already_active';
  END IF;

  UPDATE profiles SET coins = coins - v_item.price
  WHERE id = v_uid AND COALESCE(coins, 0) >= v_item.price
  RETURNING coins INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  INSERT INTO coin_purchases (user_id, item_id)
  VALUES (v_uid, p_item_id)
  RETURNING purchased_at, expires_at INTO v_purchased_at, v_expires_at;

  -- Avtomatik qo'llash
  IF v_item.kind = 'glow' THEN
    UPDATE profiles SET username_glow = true WHERE id = v_uid;
  ELSIF v_item.kind = 'frame' THEN
    UPDATE profiles SET active_frame = p_item_id WHERE id = v_uid;
  ELSIF v_item.kind = 'title' THEN
    UPDATE profiles SET active_title = p_item_id WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('coins', v_balance, 'item_id', p_item_id,
                            'purchased_at', v_purchased_at, 'expires_at', v_expires_at);
END;
$$;

-- ----------------------------------------------------------------------------
-- 1.5 Taqish / yechish (frame, glow, title)
-- ----------------------------------------------------------------------------
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
    IF p_item_id IS NOT NULL AND NOT (
      EXISTS (SELECT 1 FROM shop_items WHERE id = p_item_id AND kind = 'frame')
      AND COALESCE(_cosmetic_expires_at(v_uid, p_item_id) > now(), false)
    ) THEN
      RAISE EXCEPTION 'not_owned';
    END IF;
    UPDATE profiles SET active_frame = p_item_id WHERE id = v_uid;
  ELSIF p_kind = 'glow' THEN
    IF p_item_id IS NOT NULL AND NOT (
      EXISTS (SELECT 1 FROM shop_items WHERE id = p_item_id AND kind = 'glow')
      AND COALESCE(_cosmetic_expires_at(v_uid, p_item_id) > now(), false)
    ) THEN
      RAISE EXCEPTION 'not_owned';
    END IF;
    UPDATE profiles SET username_glow = (p_item_id IS NOT NULL) WHERE id = v_uid;
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

-- ----------------------------------------------------------------------------
-- 1.6 Muddati o'tgan ramka va yaltirashni yechish (ilova ochilganda)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_frame(uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frame text;
  v_glow boolean;
BEGIN
  SELECT active_frame, username_glow INTO v_frame, v_glow FROM profiles WHERE id = uid;

  IF v_glow AND NOT COALESCE(_cosmetic_expires_at(uid, 'username_glow') > now(), false) THEN
    UPDATE profiles SET username_glow = false WHERE id = uid;
  END IF;

  IF v_frame IS NOT NULL AND NOT COALESCE(_cosmetic_expires_at(uid, v_frame) > now(), false) THEN
    UPDATE profiles SET active_frame = NULL WHERE id = uid;
    RETURN NULL;
  END IF;

  RETURN v_frame;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1.7 Reyting: ramka va yaltirash muddati expires_at bo'yicha
--     (048 dagi funksiyaning o'zi, faqat frame_status/glow o'zgargan)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._leaderboard_rows(p_period text)
RETURNS TABLE (
  id uuid,
  username text,
  display_label text,
  avatar_url text,
  avatar_color text,
  active_frame text,
  username_glow boolean,
  score integer,
  efficiency_pct integer,
  completed_count integer,
  is_private boolean,
  has_star boolean,
  rank bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_today date := tashkent_today();
  v_period_days integer;
BEGIN
  v_period_days := CASE p_period
    WHEN 'daily'   THEN 1
    WHEN 'monthly' THEN 30
    WHEN '6months' THEN 182
    WHEN 'yearly'  THEN 365
    WHEN 'all'     THEN NULL
    ELSE -1
  END;
  IF v_period_days = -1 THEN
    RAISE EXCEPTION 'invalid_period';
  END IF;

  RETURN QUERY
    WITH users AS (
      SELECT p.*,
             GREATEST(1, (v_today - (p.created_at AT TIME ZONE 'Asia/Tashkent')::date) + 1) AS age_days
      FROM profiles p
      WHERE NOT COALESCE(p.is_banned, false)
    ),
    window_days AS (
      SELECT u.id AS user_id,
             CASE WHEN v_period_days IS NULL THEN u.age_days
                  ELSE LEAST(v_period_days, u.age_days) END AS days
      FROM users u
    ),
    habit_counts AS (
      SELECT h.user_id, COUNT(*) AS active_habits
      FROM habits h
      WHERE h.is_active = true
      GROUP BY h.user_id
    ),
    completions AS (
      SELECT hl.user_id, COUNT(*) AS done
      FROM habit_logs hl
      JOIN window_days wd ON wd.user_id = hl.user_id
      WHERE hl.completed = true
        AND hl.log_date >  v_today - wd.days
        AND hl.log_date <= v_today
      GROUP BY hl.user_id
    ),
    frame_status AS (
      SELECT u.id AS user_id,
             CASE WHEN u.active_frame IS NOT NULL AND EXISTS (
                    SELECT 1 FROM coin_purchases c
                    WHERE c.user_id = u.id AND c.item_id = u.active_frame AND c.expires_at > now()
                  ) THEN u.active_frame ELSE NULL END AS effective_frame,
             (COALESCE(u.username_glow, false) AND EXISTS (
                    SELECT 1 FROM coin_purchases c
                    WHERE c.user_id = u.id AND c.item_id = 'username_glow' AND c.expires_at > now()
                  )) AS effective_glow
      FROM users u
    ),
    scored AS (
      SELECT
        u.*,
        fs.effective_frame,
        fs.effective_glow,
        COALESCE(c.done, 0)::integer AS done,
        LEAST(100, ROUND((COALESCE(c.done, 0)::numeric / (hc.active_habits * wd.days)) * 100))::integer AS eff
      FROM users u
      JOIN window_days wd ON wd.user_id = u.id
      JOIN habit_counts hc ON hc.user_id = u.id AND hc.active_habits > 0
      LEFT JOIN completions c ON c.user_id = u.id
      JOIN frame_status fs ON fs.user_id = u.id
    )
    SELECT
      s.id,
      s.username,
      CASE
        WHEN COALESCE(s.profile_private, false) THEN s.username
        WHEN s.display_name IS NULL OR btrim(s.display_name) = '' THEN s.username
        WHEN split_part(btrim(s.display_name), ' ', 2) = '' THEN split_part(btrim(s.display_name), ' ', 1)
        ELSE split_part(btrim(s.display_name), ' ', 1) || ' ' || left(split_part(btrim(s.display_name), ' ', 2), 1) || '.'
      END,
      CASE WHEN COALESCE(s.profile_private, false) THEN NULL ELSE s.avatar_url END,
      s.avatar_color,
      s.effective_frame,
      s.effective_glow,
      COALESCE(s.score, 0)::integer,
      s.eff,
      s.done,
      COALESCE(s.profile_private, false),
      COALESCE(s.has_star AND s.star_expires_at > now(), false),
      ROW_NUMBER() OVER (ORDER BY s.eff DESC, s.done DESC, COALESCE(s.score, 0) DESC, s.id)
    FROM scored s;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1.8 Huquqlar
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public._leaderboard_rows(text)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_shop_item(text)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equip_cosmetic(text, text)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_frame(uuid)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.purchase_shop_item(text)       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.equip_cosmetic(text, text)     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_expired_frame(uuid)    TO authenticated;

COMMIT;
