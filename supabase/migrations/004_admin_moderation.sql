-- ============================================================
-- Admin infratuzilmasi: is_admin ustuni + guruh moderatsiyasini
-- sayt adminiga ham ochish + yo'qolgan admin RPC'larni yaratish
--
-- Muammo: profiles jadvalida "role" ustuni yo'q edi, App.tsx'dagi
-- profile?.role === "admin" tekshiruvi doim false edi — hech kim
-- /admin sahifasiga kira olmasdi. Bundan tashqari approve_group_log/
-- reject_group_log faqat guruhning o'z sardoriga ruxsat berardi —
-- sayt admini boshqa guruhlarni moderatsiya qila olmasdi.
-- ============================================================

-- 1) is_admin ustuni
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Bu hisobni sayt admini qilib belgilash
UPDATE profiles SET is_admin = true WHERE username = 'vectorro';

-- profiles jadvalida is_admin ustuni himoyalangan bo'lishi kerak —
-- foydalanuvchi o'zini o'zi admin qila olmasligi uchun (003 migratsiyada
-- profiles UPDATE allaqachon column-level GRANT bilan cheklangan edi,
-- is_admin o'sha ruxsat etilgan ustunlar ro'yxatida yo'q, shuning uchun
-- qo'shimcha choralarga hojat yo'q — lekin ehtiyot uchun aniq REVOKE):
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;

-- 2) approve_group_log / reject_group_log — endi guruh sardori YOKI
-- sayt admini (is_admin=true) tasdiqlashi/rad etishi mumkin
CREATE OR REPLACE FUNCTION approve_group_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_admin_id uuid;
  v_is_site_admin boolean;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habit_logs WHERE id = p_log_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT admin_id INTO v_admin_id FROM groups WHERE id = v_group_id;
  SELECT is_admin INTO v_is_site_admin FROM profiles WHERE id = auth.uid();

  IF v_admin_id IS DISTINCT FROM auth.uid() AND NOT COALESCE(v_is_site_admin, false) THEN
    RAISE EXCEPTION 'Faqat guruh sardori yoki sayt admini tasdiqlashi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_group_log(p_log_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_admin_id uuid;
  v_is_site_admin boolean;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habit_logs WHERE id = p_log_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT admin_id INTO v_admin_id FROM groups WHERE id = v_group_id;
  SELECT is_admin INTO v_is_site_admin FROM profiles WHERE id = auth.uid();

  IF v_admin_id IS DISTINCT FROM auth.uid() AND NOT COALESCE(v_is_site_admin, false) THEN
    RAISE EXCEPTION 'Faqat guruh sardori yoki sayt admini rad etishi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'rejected', approved_by = auth.uid(), reject_reason = p_reason
  WHERE id = p_log_id;
END;
$$;

-- 3) toggle_user_ban — endi faqat sayt admini chaqira oladi
CREATE OR REPLACE FUNCTION toggle_user_ban(p_user_id uuid, p_is_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;
  UPDATE profiles SET is_banned = p_is_banned WHERE id = p_user_id;
END;
$$;

-- 4) reset_all_data va send_global_notification — bazada umuman yo'q edi
-- (AdminPanel'dagi tugmalar "function not found" xatosi berardi).
-- Endi ikkalasi ham SECURITY DEFINER + sayt admin tekshiruvi bilan.

CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  DELETE FROM habit_logs;
  DELETE FROM group_habit_logs;
  DELETE FROM daily_notes;
  DELETE FROM weekly_reflections;
  DELETE FROM health_logs;
  DELETE FROM streak_freezes;
  DELETE FROM coin_purchases;
  DELETE FROM duels;
  DELETE FROM feed_reactions;
  UPDATE profiles SET score = 0, coins = 0;
END;
$$;

CREATE OR REPLACE FUNCTION send_global_notification(p_title text, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  INSERT INTO notifications (user_id, title, body, type)
  SELECT id, p_title, p_body, 'admin_broadcast' FROM profiles;
END;
$$;

-- 5) Sayt-bo'ylab moderatsiya uchun kerak bo'ladigan qo'shimcha SELECT
-- policy — group_habit_logs allaqachon "authenticated USING(true)" bilan
-- ochiq (003 migratsiyada), shuning uchun qo'shimcha policy shart emas.
