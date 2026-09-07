-- User feedback: any authenticated user can submit their own feedback;
-- only the site admin can read it back. Read access goes through a
-- SECURITY DEFINER RPC (matches this app's established admin-read
-- pattern — see get_admin_monitoring_stats/get_inactive_groups in
-- 005_admin_monitoring.sql) rather than an RLS policy with an EXISTS
-- subquery, so there is no direct SELECT policy for regular users here.

CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_own" ON user_feedback;
CREATE POLICY "feedback_insert_own" ON user_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION get_all_feedback()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  display_name text,
  username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- "id" bare qoldirilsa PL/pgSQL uni RETURNS TABLE'dagi "id" OUT
  -- parametri bilan aralashtirib yuboradi ("column reference id is
  -- ambiguous") — shuning uchun profiles.id deb aniq belgilanadi.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  RETURN QUERY
    SELECT f.id, f.user_id, f.content, f.created_at, p.display_name, p.username
    FROM user_feedback f
    JOIN profiles p ON p.id = f.user_id
    ORDER BY f.created_at DESC;
END;
$$;
