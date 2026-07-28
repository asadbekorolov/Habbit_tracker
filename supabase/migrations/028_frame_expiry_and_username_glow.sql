-- Migration 028: Frame expiration (30 kun) + Yaltiroq ism (username glow)
--
-- 1) Profil ramkalari endi doimiy emas — har bir xarid 30 kun amal qiladi
--    (coin_purchases.purchased_at asosida hisoblanadi, ramka uchun alohida
--    jadval shart emas). Muddati o'tgach qayta sotib olish kerak.
-- 2) cleanup_expired_frame(uid): foydalanuvchi ilovaga kirganda/do'konni
--    ochganda chaqiriladi — agar profiles.active_frame'ning tegishli xaridi
--    30 kundan oshgan bo'lsa, uni avtomatik yechib tashlaydi (NULL qiladi).
--    Boshqa foydalanuvchilar reytingda buni real vaqtda ko'rishi uchun
--    get_leaderboard() ham xuddi shu muddatni mustaqil tekshiradi (pastda).
-- 3) profiles.username_glow — "Yaltiroq ism" kosmetikasi, doimiy (muddatsiz)
--    xarid, boolean bayroq sifatida saqlanadi (frame'dan farqli, chunki
--    kunlik audit yozuvi kifoya, muddat hisoblash shart emas).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_glow boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION cleanup_expired_frame(uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frame text;
  v_valid boolean;
BEGIN
  SELECT active_frame INTO v_frame FROM profiles WHERE id = uid;
  IF v_frame IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM coin_purchases
    WHERE user_id = uid AND item_id = v_frame
      AND purchased_at > now() - interval '30 days'
  ) INTO v_valid;

  IF NOT v_valid THEN
    UPDATE profiles SET active_frame = NULL WHERE id = uid;
    RETURN NULL;
  END IF;

  RETURN v_frame;
END;
$$;

-- get_leaderboard() ni muddat tekshiruvi va username_glow bilan qayta yaratish
DROP FUNCTION IF EXISTS get_leaderboard();

CREATE FUNCTION get_leaderboard()
RETURNS TABLE(
  id uuid,
  username text,
  display_label text,
  avatar_url text,
  avatar_color text,
  active_frame text,
  username_glow boolean,
  score integer,
  efficiency_pct integer,
  is_private boolean,
  has_star boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    WITH window_days AS (
      SELECT p.id AS user_id,
             GREATEST(1, LEAST(30, (CURRENT_DATE - p.created_at::date) + 1)) AS days
      FROM profiles p
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
      WHERE hl.completed = true
        AND hl.log_date >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY hl.user_id
    ),
    frame_status AS (
      SELECT p.id AS user_id,
             CASE WHEN cp.purchased_at IS NOT NULL THEN p.active_frame ELSE NULL END AS effective_frame
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT purchased_at FROM coin_purchases
        WHERE user_id = p.id AND item_id = p.active_frame
          AND purchased_at > now() - interval '30 days'
        ORDER BY purchased_at DESC LIMIT 1
      ) cp ON true
    )
    SELECT
      p.id,
      p.username,
      CASE
        WHEN p.display_name IS NULL OR btrim(p.display_name) = '' THEN p.username
        WHEN split_part(btrim(p.display_name), ' ', 2) = '' THEN split_part(btrim(p.display_name), ' ', 1)
        ELSE split_part(btrim(p.display_name), ' ', 1) || ' ' || left(split_part(btrim(p.display_name), ' ', 2), 1) || '.'
      END AS display_label,
      p.avatar_url,
      p.avatar_color,
      fs.effective_frame AS active_frame,
      p.username_glow,
      COALESCE(p.score, 0)::integer AS score,
      LEAST(100, ROUND((COALESCE(c.done, 0)::numeric / (hc.active_habits * wd.days)) * 100))::integer AS efficiency_pct,
      COALESCE(p.profile_private, false) AS is_private,
      (p.has_star AND p.star_expires_at > now()) AS has_star
    FROM profiles p
    JOIN window_days wd ON wd.user_id = p.id
    JOIN habit_counts hc ON hc.user_id = p.id AND hc.active_habits > 0
    LEFT JOIN completions c ON c.user_id = p.id
    JOIN frame_status fs ON fs.user_id = p.id
    ORDER BY efficiency_pct DESC, COALESCE(p.score, 0) DESC
    LIMIT 50;
END;
$$;
