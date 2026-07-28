-- Migration 039: To'liq Admin Analitika paneli
--
-- Avvalgi "Analitika" tabi faqat analytics_events jadvalidagi xom
-- hodisalar (event) jadvalini ko'rsatardi — foydalanuvchi o'sishi,
-- odat/gamifikatsiya/guruh ko'rsatkichlari umuman yo'q edi. Bu
-- migratsiya bitta JSON qaytaruvchi RPC orqali to'rtta blokni
-- hisoblaydi: foydalanuvchi o'sishi, odat ko'rsatkichlari,
-- gamifikatsiya iqtisodiyoti, guruh/ijtimoiy ko'rsatkichlari.

CREATE OR REPLACE FUNCTION get_admin_analytics_dashboard()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users json;
  v_habits json;
  v_economy json;
  v_groups json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  -- ── Foydalanuvchi o'sishi ──
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM profiles),
    'new_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'new_week', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'banned', (SELECT COUNT(*) FROM profiles WHERE is_banned = true)
  ) INTO v_users;

  -- ── Odat ko'rsatkichlari (so'nggi 30 kun) ──
  SELECT json_build_object(
    'active_total', (SELECT COUNT(*) FROM habits WHERE is_active = true),
    'positive_count', (SELECT COUNT(*) FROM habits WHERE is_active = true AND type IS DISTINCT FROM 'negative'),
    'negative_count', (SELECT COUNT(*) FROM habits WHERE is_active = true AND type = 'negative'),
    'completion_rate_pct', (
      SELECT CASE WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE completed = true) / COUNT(*))
      END
      FROM habit_logs WHERE log_date >= CURRENT_DATE - INTERVAL '30 days'
    ),
    'logs_last_30d', (SELECT COUNT(*) FROM habit_logs WHERE log_date >= CURRENT_DATE - INTERVAL '30 days')
  ) INTO v_habits;

  -- ── Gamifikatsiya iqtisodiyoti ──
  SELECT json_build_object(
    'total_coins', (SELECT COALESCE(SUM(coins), 0) FROM profiles),
    'total_xp', (SELECT COALESCE(SUM(total_xp), 0) FROM profiles),
    'active_frames', (
      SELECT COUNT(*) FROM profiles p
      WHERE p.active_frame IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM coin_purchases cp
          WHERE cp.user_id = p.id AND cp.item_id = p.active_frame
            AND cp.purchased_at > now() - INTERVAL '30 days'
        )
    )
  ) INTO v_economy;

  -- ── Guruh va ijtimoiy ko'rsatkichlar ──
  SELECT json_build_object(
    'total_groups', (SELECT COUNT(*) FROM groups),
    'avg_members', (
      SELECT CASE WHEN COUNT(DISTINCT group_id) = 0 THEN 0
        ELSE ROUND(COUNT(*)::numeric / COUNT(DISTINCT group_id), 1)
      END
      FROM group_members
    ),
    'pending_proofs', (SELECT COUNT(*) FROM group_habit_logs WHERE approval_status = 'pending'),
    'approved_proofs', (SELECT COUNT(*) FROM group_habit_logs WHERE approval_status IN ('approved', 'auto'))
  ) INTO v_groups;

  RETURN json_build_object('users', v_users, 'habits', v_habits, 'economy', v_economy, 'groups', v_groups);
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_analytics_dashboard() TO authenticated;
