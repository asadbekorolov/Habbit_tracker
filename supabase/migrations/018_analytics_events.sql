-- Lightweight first-party event tracking: screen views, feature usage,
-- signup funnel, first-screen exits — so product decisions before launch
-- can be data-driven without pulling in a third-party analytics SDK.

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can write events, but only tagged with their own
-- user_id (or none) — no direct SELECT policy for regular users. Reads go
-- through the admin-only get_analytics_summary() RPC, matching this app's
-- established admin-read pattern (get_all_feedback, get_admin_monitoring_stats).
DROP POLICY IF EXISTS "analytics_events_insert" ON analytics_events;
CREATE POLICY "analytics_events_insert" ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION get_analytics_summary(p_days integer DEFAULT 30)
RETURNS TABLE (
  event_name text,
  total_count bigint,
  unique_users bigint,
  unique_sessions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- profiles.id/profiles.is_admin qat'iy nomlanadi — bu funksiya "id"
  -- nomli OUT ustunga ega emas, lekin loyihadagi qabul qilingan
  -- ehtiyot chorasi sifatida baribir aniq belgilaymiz.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  RETURN QUERY
    SELECT
      e.event_name,
      COUNT(*)::bigint AS total_count,
      COUNT(DISTINCT e.user_id)::bigint AS unique_users,
      COUNT(DISTINCT e.session_id)::bigint AS unique_sessions
    FROM analytics_events e
    WHERE e.created_at >= now() - (p_days || ' days')::interval
    GROUP BY e.event_name
    ORDER BY total_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_analytics_summary(integer) TO authenticated;
