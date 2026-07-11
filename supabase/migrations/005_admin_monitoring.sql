-- ============================================================
-- Admin Monitoring & Health-Check
-- ============================================================

-- 1) last_seen_at ustuni + indeks
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at);

-- last_seen_at faqat shu RPC orqali o'zgaradi — profiles UPDATE 003
-- migratsiyada column-level GRANT bilan cheklangan, last_seen_at ruxsat
-- etilgan ustunlar ro'yxatida yo'q, shuning uchun to'g'ridan-to'g'ri
-- client UPDATE bilan o'zgartirib bo'lmaydi.
CREATE OR REPLACE FUNCTION touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET last_seen_at = now() WHERE id = auth.uid();
END;
$$;

-- 2) Monitoring: DAU + eng ommabop 5 ta odat (bajarilish soni bo'yicha)
CREATE OR REPLACE FUNCTION get_admin_monitoring_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dau integer;
  v_top_habits json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  SELECT COUNT(*) INTO v_dau
  FROM profiles
  WHERE last_seen_at >= now() - interval '24 hours';

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_top_habits
  FROM (
    SELECT h.name, COUNT(*) AS completions
    FROM habit_logs hl
    JOIN habits h ON h.id = hl.habit_id
    WHERE hl.completed = true
    GROUP BY h.name
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) t;

  RETURN json_build_object('dau', v_dau, 'top_habits', v_top_habits);
END;
$$;

-- 3) Health-check: 7 kundan beri log yozmagan ("o'lik") guruhlar
CREATE OR REPLACE FUNCTION get_inactive_groups()
RETURNS TABLE (
  group_id uuid,
  group_name text,
  leader_name text,
  last_log_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    p.display_name,
    (SELECT MAX(ghl.log_date) FROM group_habit_logs ghl WHERE ghl.group_id = g.id)
  FROM groups g
  LEFT JOIN profiles p ON p.id = g.admin_id
  WHERE COALESCE(
    (SELECT MAX(ghl.log_date) FROM group_habit_logs ghl WHERE ghl.group_id = g.id),
    g.created_at::date - INTERVAL '1 day'
  ) < (CURRENT_DATE - INTERVAL '7 days')
  ORDER BY last_log_date NULLS FIRST;
END;
$$;

-- 4) Sayt admini istalgan guruhni o'chira olishi uchun (guruh RLS'i faqat
-- guruhning o'z sardoriga ruxsat beradi, sayt admini boshqa guruhning
-- sardori bo'lmasligi mumkin)
CREATE OR REPLACE FUNCTION admin_delete_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;
  DELETE FROM groups WHERE id = p_group_id;
END;
$$;
