-- Migration 025: Efficiency-based leaderboard
-- The old get_leaderboard() ordered purely by raw cumulative `score`
-- (+1 per positive habit completion), which structurally favors users
-- with MORE habits over genuinely consistent users with fewer habits --
-- someone with 3 habits done every single day scored far below someone
-- with 10 habits done half the time. Replace with an efficiency ratio:
-- (completed habit-logs in the last 30 days) / (active habit count *
-- days in that window) * 100, ranked by that percentage. `score` is
-- still returned (as a secondary stat) but no longer drives the order.

DROP FUNCTION IF EXISTS get_leaderboard();

CREATE FUNCTION get_leaderboard()
RETURNS TABLE(
  id uuid,
  username text,
  display_label text,
  avatar_url text,
  avatar_color text,
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

-- get_leaderboard() only returns the top 50, so ProfilePage's "my rank"
-- number (getUserRank) needs its own query against the same efficiency
-- ranking to find a user's position even outside the top 50.
CREATE OR REPLACE FUNCTION get_user_rank_efficiency(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank integer;
BEGIN
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
  ranked AS (
    SELECT
      p.id,
      LEAST(100, ROUND((COALESCE(c.done, 0)::numeric / (hc.active_habits * wd.days)) * 100)) AS efficiency_pct,
      COALESCE(p.score, 0) AS score,
      ROW_NUMBER() OVER (ORDER BY LEAST(100, ROUND((COALESCE(c.done, 0)::numeric / (hc.active_habits * wd.days)) * 100)) DESC, COALESCE(p.score, 0) DESC) AS rn
    FROM profiles p
    JOIN window_days wd ON wd.user_id = p.id
    JOIN habit_counts hc ON hc.user_id = p.id AND hc.active_habits > 0
    LEFT JOIN completions c ON c.user_id = p.id
  )
  SELECT rn INTO v_rank FROM ranked WHERE id = p_user_id;

  RETURN COALESCE(v_rank, 0);
END;
$$;
