-- Migration 027: Expose active_frame on the leaderboard
-- Profile frames (026_shop_cosmetics.sql) are a status symbol, most
-- naturally shown off on the leaderboard where others see them.

DROP FUNCTION IF EXISTS get_leaderboard();

CREATE FUNCTION get_leaderboard()
RETURNS TABLE(
  id uuid,
  username text,
  display_label text,
  avatar_url text,
  avatar_color text,
  active_frame text,
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
      p.active_frame,
      COALESCE(p.score, 0)::integer AS score,
      LEAST(100, ROUND((COALESCE(c.done, 0)::numeric / (hc.active_habits * wd.days)) * 100))::integer AS efficiency_pct,
      COALESCE(p.profile_private, false) AS is_private,
      (p.has_star AND p.star_expires_at > now()) AS has_star
    FROM profiles p
    JOIN window_days wd ON wd.user_id = p.id
    JOIN habit_counts hc ON hc.user_id = p.id AND hc.active_habits > 0
    LEFT JOIN completions c ON c.user_id = p.id
    ORDER BY efficiency_pct DESC, COALESCE(p.score, 0) DESC
    LIMIT 50;
END;
$$;
