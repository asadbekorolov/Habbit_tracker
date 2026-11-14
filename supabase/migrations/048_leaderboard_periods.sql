-- ============================================================================
-- 048: Davrlar bo'yicha reyting (server tomonida hisoblash)
-- ============================================================================
-- Avval mijoz barcha profillar va barcha loglarni yuklab, reytingni o'zi
-- hisoblardi (PostgREST 1000 qator chegarasida kesilib qolardi va formula
-- serverdagi get_leaderboard'dan farq qilardi). Endi:
--   get_leaderboard_period(p_period)  — top-100
--   get_my_leaderboard_rank(p_period) — joriy foydalanuvchi o'rni
-- p_period: 'daily' | 'monthly' | '6months' | 'yearly' | 'all'
--
-- Samaradorlik = bajarilgan odatlar / (faol odatlar x kunlar) x 100 (max 100).
-- Kunlar = davr uzunligi, lekin hisob ochilgandan beri o'tgan kundan oshmaydi
-- ("all" — hisob ochilgandan beri). Sanalar Asia/Tashkent bo'yicha.
-- Maxfiylik qoidalari get_leaderboard (043) bilan bir xil; bloklanganlar
-- reytingda ko'rinmaydi.
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

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
             CASE WHEN cp.purchased_at IS NOT NULL THEN u.active_frame ELSE NULL END AS effective_frame
      FROM users u
      LEFT JOIN LATERAL (
        SELECT c.purchased_at FROM coin_purchases c
        WHERE c.user_id = u.id AND c.item_id = u.active_frame
          AND c.purchased_at > now() - interval '30 days'
        ORDER BY c.purchased_at DESC LIMIT 1
      ) cp ON true
    ),
    scored AS (
      SELECT
        u.*,
        fs.effective_frame,
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
      COALESCE(s.username_glow, false),
      COALESCE(s.score, 0)::integer,
      s.eff,
      s.done,
      COALESCE(s.profile_private, false),
      COALESCE(s.has_star AND s.star_expires_at > now(), false),
      ROW_NUMBER() OVER (ORDER BY s.eff DESC, s.done DESC, COALESCE(s.score, 0) DESC, s.id)
    FROM scored s;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_period(p_period text DEFAULT 'monthly')
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM _leaderboard_rows(p_period) r
  ORDER BY r.rank
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank(p_period text DEFAULT 'monthly')
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rank bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT r.rank INTO v_rank FROM _leaderboard_rows(p_period) r WHERE r.id = v_uid;
  RETURN COALESCE(v_rank, 0)::integer;
END;
$$;

-- Huquqlar: ichki funksiya hech kimga; ommaviylari faqat tizimga kirganlarga.
REVOKE EXECUTE ON FUNCTION public._leaderboard_rows(text)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard_period(text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_leaderboard_rank(text)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_leaderboard_period(text)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_leaderboard_rank(text)  TO authenticated;

-- Reyting so'rovlari uchun indeks (loglar sana bo'yicha filtrlanadi).
CREATE INDEX IF NOT EXISTS habit_logs_completed_date_idx
  ON public.habit_logs (log_date, user_id) WHERE completed = true;

COMMIT;
