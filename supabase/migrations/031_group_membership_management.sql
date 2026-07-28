-- Migration 031: Guruh a'zoligini boshqarish — chiqish, o'chirish,
-- chiqarib yuborish, ikkinchi admin (co-admin)
--
-- Muammo: guruhlar bo'limida a'zolikni boshqarish umuman yo'q edi — hech
-- kim chiqib keta olmasdi, sardor a'zoni chiqara olmasdi, guruhni o'chirib
-- bo'lmasdi, va yagona sardor (groups.admin_id) yo'qolib qolsa guruh
-- boshqarilmas holga kelardi. group_members.role ustuni allaqachon bor
-- edi va guruh yaratuvchisiga 'admin' bilan yoziladi (createGroup), lekin
-- hech qayerda TEKSHIRILMASDI — faqat groups.admin_id (yagona egasi)
-- amaliy huquq berardi. Endi ikkalasi ham hisobga olinadi:
--   - "asosiy sardor" (groups.admin_id) — guruhni o'chira oladi, egalikni
--     topshira oladi, boshqalarga co-admin huquqi bera oladi.
--   - "co-admin" (group_members.role='admin') — kunlik boshqaruvni qila
--     oladi (odat qo'shish/o'chirish, isbot tasdiqlash/rad etish, a'zoni
--     chiqarib yuborish, jamoalarni boshqarish) — lekin guruhni o'chira
--     olmaydi va boshqa a'zoni admin qila olmaydi.

CREATE OR REPLACE FUNCTION is_group_admin(p_group_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.admin_id = p_uid)
      OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = p_group_id AND gm.user_id = p_uid AND gm.role = 'admin');
$$;

-- ── group_habits / group_subteams / group_subteam_members: co-admin ham
--    yoza oladigan bo'ldi (avval faqat groups.admin_id) ────────────────
DROP POLICY IF EXISTS "group_habits_write_admin" ON group_habits;
CREATE POLICY "group_habits_write_admin" ON group_habits FOR ALL TO authenticated
  USING (is_group_admin(group_habits.group_id, auth.uid()))
  WITH CHECK (is_group_admin(group_habits.group_id, auth.uid()));

DROP POLICY IF EXISTS "group_subteams_write_admin" ON group_subteams;
CREATE POLICY "group_subteams_write_admin" ON group_subteams FOR ALL TO authenticated
  USING (is_group_admin(group_subteams.group_id, auth.uid()))
  WITH CHECK (is_group_admin(group_subteams.group_id, auth.uid()));

DROP POLICY IF EXISTS "group_subteam_members_write_admin" ON group_subteam_members;
CREATE POLICY "group_subteam_members_write_admin" ON group_subteam_members FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_subteams st WHERE st.id = group_subteam_members.subteam_id
      AND is_group_admin(st.group_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_subteams st WHERE st.id = group_subteam_members.subteam_id
      AND is_group_admin(st.group_id, auth.uid())
  ));

-- ── approve_group_log / reject_group_log: co-admin ham tasdiqlay oladi ──
CREATE OR REPLACE FUNCTION approve_group_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_is_site_admin boolean;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habit_logs WHERE id = p_log_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT is_admin INTO v_is_site_admin FROM profiles WHERE id = auth.uid();

  IF NOT is_group_admin(v_group_id, auth.uid()) AND NOT COALESCE(v_is_site_admin, false) THEN
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
  v_is_site_admin boolean;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habit_logs WHERE id = p_log_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT is_admin INTO v_is_site_admin FROM profiles WHERE id = auth.uid();

  IF NOT is_group_admin(v_group_id, auth.uid()) AND NOT COALESCE(v_is_site_admin, false) THEN
    RAISE EXCEPTION 'Faqat guruh sardori yoki sayt admini rad etishi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'rejected', approved_by = auth.uid(), reject_reason = p_reason
  WHERE id = p_log_id;
END;
$$;

-- ── Guruhdan chiqish ────────────────────────────────────────────────
-- Oddiy a'zo — darhol chiqadi. Asosiy sardor — agar yagona a'zo bo'lsa
-- guruh butunlay o'chadi (bo'sh guruh qolib ketmasligi uchun), aks holda
-- avval egalikni boshqasiga topshirishi kerak (owner_must_transfer xatosi).
CREATE OR REPLACE FUNCTION leave_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_member_count integer;
BEGIN
  SELECT admin_id INTO v_admin_id FROM groups WHERE id = p_group_id;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Guruh topilmadi';
  END IF;

  IF v_admin_id = auth.uid() THEN
    SELECT COUNT(*) INTO v_member_count FROM group_members WHERE group_id = p_group_id;
    IF v_member_count > 1 THEN
      RAISE EXCEPTION 'owner_must_transfer';
    END IF;
    DELETE FROM groups WHERE id = p_group_id;
    RETURN;
  END IF;

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = auth.uid();
END;
$$;

-- ── A'zoni chiqarib yuborish (kick) ─────────────────────────────────
-- Sardor yoki co-admin chaqira oladi; asosiy sardorni hech kim chiqara
-- olmaydi (faqat o'zi leave_group orqali, egalikni topshirgandan keyin).
CREATE OR REPLACE FUNCTION kick_member(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT admin_id INTO v_admin_id FROM groups WHERE id = p_group_id;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Guruh topilmadi';
  END IF;

  IF NOT is_group_admin(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Faqat sardor yoki admin a''zoni chiqarishi mumkin';
  END IF;

  IF p_user_id = v_admin_id THEN
    RAISE EXCEPTION 'Asosiy sardorni chiqarib bo''lmaydi';
  END IF;

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

-- ── Guruhni o'chirish (faqat asosiy sardor) ─────────────────────────
CREATE OR REPLACE FUNCTION delete_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = auth.uid()) THEN
    RAISE EXCEPTION 'Faqat asosiy sardor guruhni o''chira oladi';
  END IF;
  DELETE FROM groups WHERE id = p_group_id;
END;
$$;

-- ── Co-admin tayinlash/olib tashlash (faqat asosiy sardor) ──────────
CREATE OR REPLACE FUNCTION set_group_member_role(p_group_id uuid, p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Noto''g''ri rol';
  END IF;

  SELECT admin_id INTO v_admin_id FROM groups WHERE id = p_group_id;
  IF v_admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat asosiy sardor rol bera oladi';
  END IF;

  IF p_user_id = v_admin_id THEN
    RAISE EXCEPTION 'Asosiy sardor rolini o''zgartirib bo''lmaydi';
  END IF;

  UPDATE group_members SET role = p_role WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

-- ── Egalikni topshirish (faqat asosiy sardor) ───────────────────────
CREATE OR REPLACE FUNCTION transfer_group_ownership(p_group_id uuid, p_new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = auth.uid()) THEN
    RAISE EXCEPTION 'Faqat asosiy sardor egalikni topshira oladi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_new_owner_id) THEN
    RAISE EXCEPTION 'Foydalanuvchi guruh a''zosi emas';
  END IF;

  UPDATE groups SET admin_id = p_new_owner_id WHERE id = p_group_id;
  UPDATE group_members SET role = 'admin' WHERE group_id = p_group_id AND user_id = p_new_owner_id;
END;
$$;
