-- ============================================================================
-- 057: Bezak narxlari 20 kunlik muddatga moslashtirildi; admin statistikasi va
--      boshqa foydalanuvchining bezaklari expires_at bo'yicha
-- ============================================================================
--   * Narxlar (20 kun): Bronza 150, Kumush 300, Yaltiroq ism 400, Oltin 600.
--     purchase_shop_item narxni shop_items dan o'qiydi — RPC'ni o'zgartirish
--     shart emas. Frontend: src/utils/cosmetics.ts (test orqali solishtiriladi).
--   * get_admin_analytics_dashboard (039): "faol ramkalar" endi
--     coin_purchases.expires_at > now() bo'yicha (eski purchased_at + 30 kun emas).
--   * get_effective_cosmetics(user_ids[]): boshqa foydalanuvchilarning amaldagi
--     ramka/yaltirashi — muddati o'tgani NULL/false. Ommaviy profil oynasi shu
--     orqali ko'rsatadi (egasi ilovani ochmaguncha profiles.active_frame eski
--     qiymatda qolishi mumkin edi). Faqat ochiq ustunlar qaytadi.
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Narxlar
-- ----------------------------------------------------------------------------
INSERT INTO public.shop_items (id, kind, price, repeatable, duration_days) VALUES
  ('frame_bronze',  'frame', 150, true, 20),
  ('frame_silver',  'frame', 300, true, 20),
  ('username_glow', 'glow',  400, true, 20),
  ('frame_gold',    'frame', 600, true, 20)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind, price = EXCLUDED.price, repeatable = EXCLUDED.repeatable,
  duration_days = EXCLUDED.duration_days;

-- ----------------------------------------------------------------------------
-- 2. Admin analitika paneli (039) — faol ramkalar expires_at bo'yicha
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_analytics_dashboard()
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

  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM profiles),
    'new_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'new_week', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'banned', (SELECT COUNT(*) FROM profiles WHERE is_banned = true)
  ) INTO v_users;

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

  SELECT json_build_object(
    'total_coins', (SELECT COALESCE(SUM(coins), 0) FROM profiles),
    'total_xp', (SELECT COALESCE(SUM(total_xp), 0) FROM profiles),
    'active_frames', (
      SELECT COUNT(*) FROM profiles p
      WHERE p.active_frame IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM coin_purchases cp
          WHERE cp.user_id = p.id AND cp.item_id = p.active_frame
            AND cp.expires_at > now()
        )
    )
  ) INTO v_economy;

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

REVOKE EXECUTE ON FUNCTION public.get_admin_analytics_dashboard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_analytics_dashboard() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Boshqa foydalanuvchilarning amaldagi bezaklari (ko'pi bilan 500 ta id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_cosmetics(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, active_frame text, username_glow boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    CASE WHEN p.active_frame IS NOT NULL AND EXISTS (
           SELECT 1 FROM coin_purchases c
           WHERE c.user_id = p.id AND c.item_id = p.active_frame AND c.expires_at > now()
         ) THEN p.active_frame END,
    COALESCE(p.username_glow, false) AND EXISTS (
      SELECT 1 FROM coin_purchases c
      WHERE c.user_id = p.id AND c.item_id = 'username_glow' AND c.expires_at > now()
    )
  FROM profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY ((p_user_ids)[1:500]);
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_cosmetics(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_effective_cosmetics(uuid[]) TO authenticated;

COMMIT;
