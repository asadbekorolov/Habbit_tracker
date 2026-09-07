-- Migration 042: A'zo chiqarilganda/chiqqanda kichik jamoa (subteam)
-- a'zoligini ham tozalash
--
-- Muammo: kick_member() va leave_group() (031-migratsiya) faqat
-- group_members'dan o'chirardi. group_subteam_members jadvaliga
-- umuman tegilmagani uchun, a'zo "A'zolar" tabidan chiqarib
-- yuborilgandan (yoki o'zi chiqib ketgandan) keyin ham "Jamoalar"
-- (kichik jamoa) ro'yxatida ko'rinishda qolib ketardi — chunki
-- getSubteams() to'g'ridan-to'g'ri group_subteam_members'dan o'qiydi,
-- group_members bilan solishtirmaydi.

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

  DELETE FROM group_subteam_members
  WHERE user_id = p_user_id
    AND subteam_id IN (SELECT id FROM group_subteams WHERE group_id = p_group_id);

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

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

  DELETE FROM group_subteam_members
  WHERE user_id = auth.uid()
    AND subteam_id IN (SELECT id FROM group_subteams WHERE group_id = p_group_id);

  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = auth.uid();
END;
$$;

-- ── Bir martalik tozalash: allaqachon guruhdan chiqarilgan/chiqib
--    ketgan, lekin kichik jamoada "osilib" qolgan yozuvlar ──────────
DELETE FROM group_subteam_members gsm
WHERE NOT EXISTS (
  SELECT 1 FROM group_subteams st
  JOIN group_members gm ON gm.group_id = st.group_id AND gm.user_id = gsm.user_id
  WHERE st.id = gsm.subteam_id
);
