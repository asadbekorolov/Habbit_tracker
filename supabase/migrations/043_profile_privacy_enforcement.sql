-- Migration 043: Profil maxfiyligini (profile_private) haqiqatan
-- global reyting va foydalanuvchi qidiruvida qo'llash
--
-- Muammo: "Yuqori maxfiylik" (profile_private=true) tugmasi profilda bor
-- edi va get_leaderboard() `is_private` bayrog'ini qaytarardi, lekin
-- frontend buni FAQAT qulf ikonkasi ko'rsatish va profilni bosib ochishni
-- taqiqlash uchun ishlatardi — ism (display_label) va rasm (avatar_url)
-- baribir SQL javobida to'liq holda qaytardi, ya'ni tarmoq javobida
-- (Network tab) va demak amalda ekranda ham to'liq ko'rinardi.
--
-- Yanada jiddiyroq: foydalanuvchi qidiruvi (searchUsers) umuman
-- to'g'ridan-to'g'ri `profiles` jadvalidan o'qiydigan klient so'rovi edi —
-- profile_private'ni hech qachon tekshirmasdi, hatto ism bo'yicha ham
-- qidirishga (`display_name.ilike`) ruxsat berardi. Endi SECURITY DEFINER
-- `search_users()` RPC orqali: maxfiy profil FAQAT username bo'yicha
-- topiladi (ismi bo'yicha qidiruvda chiqmaydi), va topilganda ham ism
-- hamda rasm o'rniga NULL qaytadi (frontend username'ga tushadi).

-- ── get_leaderboard(): maxfiy profil uchun ism/rasm yashiriladi ────────
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
        WHEN COALESCE(p.profile_private, false) THEN p.username
        WHEN p.display_name IS NULL OR btrim(p.display_name) = '' THEN p.username
        WHEN split_part(btrim(p.display_name), ' ', 2) = '' THEN split_part(btrim(p.display_name), ' ', 1)
        ELSE split_part(btrim(p.display_name), ' ', 1) || ' ' || left(split_part(btrim(p.display_name), ' ', 2), 1) || '.'
      END AS display_label,
      CASE WHEN COALESCE(p.profile_private, false) THEN NULL ELSE p.avatar_url END AS avatar_url,
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

-- ── search_users(): maxfiy profil faqat username bo'yicha topiladi,
--    va topilganda ham ism/rasm o'rniga NULL qaytaradi ─────────────────
CREATE OR REPLACE FUNCTION search_users(p_query text, p_exclude_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_color text,
  score integer,
  is_private boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.username,
    CASE WHEN COALESCE(p.profile_private, false) THEN NULL ELSE p.display_name END AS display_name,
    CASE WHEN COALESCE(p.profile_private, false) THEN NULL ELSE p.avatar_url END AS avatar_url,
    p.avatar_color,
    COALESCE(p.score, 0)::integer AS score,
    COALESCE(p.profile_private, false) AS is_private
  FROM profiles p
  WHERE p.id <> COALESCE(p_exclude_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND btrim(p_query) <> ''
    AND (
      p.username ILIKE '%' || btrim(p_query) || '%'
      OR (NOT COALESCE(p.profile_private, false) AND p.display_name ILIKE '%' || btrim(p_query) || '%')
    )
  ORDER BY p.score DESC NULLS LAST
  LIMIT 8;
$$;

GRANT EXECUTE ON FUNCTION search_users(text, uuid) TO authenticated;
