-- Migration 040: Admin — kengaytirilgan foydalanuvchi boshqaruvi
--
-- Eslatma: `is_banned` ustuni va `toggle_user_ban()` RPC allaqachon
-- setup.sql/004-migratsiyada mavjud edi (blok/blokdan chiqarish tugmasi
-- Admin Panel'da avvaldan ishlagan) — bu migratsiya ularni takrorlamaydi,
-- faqat YETISHMAYOTGAN ikkita imkoniyatni qo'shadi:
--
--   1) get_admin_users_efficiency() — har bir foydalanuvchi uchun
--      samaradorlik foizini (get_leaderboard()dagi bilan bir xil formula:
--      so'nggi 30 kunlik bajarilgan / (faol odatlar × kunlar) × 100)
--      BITTA so'rovda qaytaradi — Foydalanuvchilar jadvalida har bir
--      qator uchun alohida so'rov yubormaslik uchun (N+1 muammosining
--      oldini olish).
--   2) admin_grant_balance(user_id, coins_delta, score_delta) — adminga
--      foydalanuvchiga bonus tanga/ball berish (yoki kamaytirish)
--      imkonini beradi, natija hech qachon manfiy bo'lmaydi.

CREATE OR REPLACE FUNCTION get_admin_users_efficiency()
RETURNS TABLE(user_id uuid, efficiency_pct integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  RETURN QUERY
    WITH window_days AS (
      SELECT p.id AS uid,
             GREATEST(1, LEAST(30, (CURRENT_DATE - p.created_at::date) + 1)) AS days
      FROM profiles p
    ),
    habit_counts AS (
      SELECT h.user_id AS uid, COUNT(*) AS active_habits
      FROM habits h
      WHERE h.is_active = true
      GROUP BY h.user_id
    ),
    completions AS (
      SELECT hl.user_id AS uid, COUNT(*) AS done
      FROM habit_logs hl
      WHERE hl.completed = true
        AND hl.log_date >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY hl.user_id
    )
    SELECT
      p.id,
      CASE WHEN COALESCE(hc.active_habits, 0) = 0 THEN 0
        ELSE LEAST(100, ROUND((COALESCE(c.done, 0)::numeric / (hc.active_habits * wd.days)) * 100))::integer
      END
    FROM profiles p
    JOIN window_days wd ON wd.uid = p.id
    LEFT JOIN habit_counts hc ON hc.uid = p.id
    LEFT JOIN completions c ON c.uid = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_users_efficiency() TO authenticated;

CREATE OR REPLACE FUNCTION admin_grant_balance(p_user_id uuid, p_coins_delta integer, p_score_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  UPDATE profiles
  SET coins = GREATEST(0, COALESCE(coins, 0) + COALESCE(p_coins_delta, 0)),
      score = GREATEST(0, COALESCE(score, 0) + COALESCE(p_score_delta, 0))
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_grant_balance(uuid, integer, integer) TO authenticated;
