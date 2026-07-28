-- Migration 033: Guruh va shaxsiy odatlarni integratsiyalash
--
-- Muammo: guruhda yaratilgan odat faqat guruh ichida ko'rinardi. Agar
-- a'zoning shaxsiy "Odatlar" ro'yxatida allaqachon xuddi shunday odat
-- bo'lsa (masalan "Yugurish"), ikkalasini alohida-alohida belgilash
-- kerak edi — bir xil ishni ikki marta hisoblash.
--
-- Yechim ("Avtomatik nusxa"): admin guruhga odat qo'shganda, har bir
-- a'zoning shaxsiy habits ro'yxatiga ham bog'langan nusxa avtomatik
-- yaratiladi (group_habit_links orqali kuzatiladi). Guruhda bajarib,
-- sardor/co-admin tasdiqlasa — bog'langan shaxsiy habit_log ham
-- completed=true bo'ladi va (bugungi kun bo'lsa) ball/tanga/XP ham
-- avtomatik beriladi — alohida ikki marta belgilash shart emas.

CREATE TABLE IF NOT EXISTS group_habit_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_habit_id uuid NOT NULL REFERENCES group_habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_habit_id, user_id)
);

ALTER TABLE group_habit_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_habit_links_select" ON group_habit_links;
CREATE POLICY "group_habit_links_select" ON group_habit_links FOR SELECT TO authenticated USING (true);
-- Yozish faqat quyidagi SECURITY DEFINER funksiyalar orqali — client
-- to'g'ridan-to'g'ri boshqa a'zoga habit/link yarata olmasligi kerak.

-- ── Guruh odati yaratish: endi RPC orqali (avval to'g'ridan-to'g'ri
--    INSERT edi) — hozir har bir mavjud a'zo uchun ham shaxsiy nusxa
--    va bog'lanish yaratadi ──
CREATE OR REPLACE FUNCTION create_group_habit(
  p_group_id uuid, p_name text, p_emoji text, p_type text, p_target_value integer, p_unit text
)
RETURNS group_habits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_habit group_habits;
  v_member RECORD;
  v_personal_habit_id uuid;
BEGIN
  IF NOT is_group_admin(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Faqat sardor yoki admin odat qo''sha oladi';
  END IF;

  INSERT INTO group_habits(group_id, name, emoji, type, target_value, unit)
  VALUES (p_group_id, p_name, p_emoji, COALESCE(p_type, 'positive'), COALESCE(p_target_value, 1), COALESCE(p_unit, ''))
  RETURNING * INTO v_habit;

  FOR v_member IN SELECT user_id FROM group_members WHERE group_id = p_group_id LOOP
    INSERT INTO habits(user_id, name, emoji, type, target_value, unit, is_active)
    VALUES (v_member.user_id, v_habit.name, v_habit.emoji, v_habit.type, v_habit.target_value, v_habit.unit, true)
    RETURNING id INTO v_personal_habit_id;

    INSERT INTO group_habit_links(group_habit_id, user_id, habit_id)
    VALUES (v_habit.id, v_member.user_id, v_personal_habit_id)
    ON CONFLICT (group_habit_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_habit;
END;
$$;

-- ── Guruh odatini tahrirlash: bog'langan barcha shaxsiy odatlarga ham
--    o'zgarish tarqaladi ──
CREATE OR REPLACE FUNCTION update_group_habit(
  p_habit_id uuid, p_name text, p_emoji text, p_type text, p_target_value integer, p_unit text
)
RETURNS group_habits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_habit group_habits;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habits WHERE id = p_habit_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Odat topilmadi';
  END IF;
  IF NOT is_group_admin(v_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Faqat sardor yoki admin tahrirlay oladi';
  END IF;

  UPDATE group_habits
  SET name = p_name, emoji = p_emoji, type = COALESCE(p_type, 'positive'),
      target_value = COALESCE(p_target_value, 1), unit = COALESCE(p_unit, '')
  WHERE id = p_habit_id
  RETURNING * INTO v_habit;

  UPDATE habits h
  SET name = v_habit.name, emoji = v_habit.emoji, type = v_habit.type,
      target_value = v_habit.target_value, unit = v_habit.unit
  FROM group_habit_links gl
  WHERE gl.group_habit_id = p_habit_id AND gl.habit_id = h.id;

  RETURN v_habit;
END;
$$;

-- ── Guruh odatini o'chirish: bog'langan shaxsiy odatlar butunlay
--    o'chirilmaydi (tarixi/loglari yo'qolmasin), faqat deaktivatsiya
--    qilinadi — xuddi shaxsiy "Odatni o'chirish" bilan bir xil qoida ──
CREATE OR REPLACE FUNCTION delete_group_habit(p_habit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habits WHERE id = p_habit_id;
  IF v_group_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT is_group_admin(v_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Faqat sardor yoki admin o''chira oladi';
  END IF;

  UPDATE habits h
  SET is_active = false
  FROM group_habit_links gl
  WHERE gl.group_habit_id = p_habit_id AND gl.habit_id = h.id;

  DELETE FROM group_habits WHERE id = p_habit_id;
END;
$$;

-- ── Yangi a'zo guruhga qo'shilganda, mavjud guruh odatlariga ham
--    avtomatik bog'lanadi (join_group qanday chaqirilishidan qat'i
--    nazar ishlaydi, chunki trigger jadval darajasida) ──
CREATE OR REPLACE FUNCTION provision_group_habits_for_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gh RECORD;
  v_personal_habit_id uuid;
BEGIN
  FOR v_gh IN SELECT * FROM group_habits WHERE group_id = NEW.group_id LOOP
    IF NOT EXISTS (SELECT 1 FROM group_habit_links WHERE group_habit_id = v_gh.id AND user_id = NEW.user_id) THEN
      INSERT INTO habits(user_id, name, emoji, type, target_value, unit, is_active)
      VALUES (NEW.user_id, v_gh.name, v_gh.emoji, v_gh.type, v_gh.target_value, v_gh.unit, true)
      RETURNING id INTO v_personal_habit_id;

      INSERT INTO group_habit_links(group_habit_id, user_id, habit_id)
      VALUES (v_gh.id, NEW.user_id, v_personal_habit_id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_group_habits ON group_members;
CREATE TRIGGER trg_provision_group_habits
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION provision_group_habits_for_new_member();

-- ── approve_group_log: endi tasdiqlashda bog'langan shaxsiy habit_log
--    ham completed=true qilinadi, va bugungi kun uchun (retroaktiv emas)
--    ball/tanga/XP shaxsiy odatdagi bilan bir xil qoidada beriladi ──
CREATE OR REPLACE FUNCTION approve_group_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_group_habit_id uuid;
  v_member_id uuid;
  v_log_date date;
  v_reps integer;
  v_is_site_admin boolean;
  v_habit_type text;
  v_linked_habit_id uuid;
  v_prev_completed boolean;
  v_safe_xp integer;
BEGIN
  SELECT ghl.group_id, ghl.group_habit_id, ghl.user_id, ghl.log_date, ghl.reps, gh.type
    INTO v_group_id, v_group_habit_id, v_member_id, v_log_date, v_reps, v_habit_type
  FROM group_habit_logs ghl
  JOIN group_habits gh ON gh.id = ghl.group_habit_id
  WHERE ghl.id = p_log_id;

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

  SELECT habit_id INTO v_linked_habit_id
  FROM group_habit_links WHERE group_habit_id = v_group_habit_id AND user_id = v_member_id;

  IF v_linked_habit_id IS NOT NULL THEN
    SELECT completed INTO v_prev_completed
    FROM habit_logs WHERE habit_id = v_linked_habit_id AND user_id = v_member_id AND log_date = v_log_date;

    INSERT INTO habit_logs (habit_id, user_id, log_date, completed, value)
    VALUES (v_linked_habit_id, v_member_id, v_log_date, true, GREATEST(1, COALESCE(v_reps, 1)))
    ON CONFLICT (habit_id, user_id, log_date)
    DO UPDATE SET completed = true, value = GREATEST(1, COALESCE(v_reps, 1));

    -- Shaxsiy odatlardagi bilan bir xil qoida: faqat salbiy bo'lmagan,
    -- BUGUNGI va avval bajarilmagan holat uchun mukofot beriladi.
    IF v_habit_type IS DISTINCT FROM 'negative' AND v_log_date = CURRENT_DATE AND COALESCE(v_prev_completed, false) = false THEN
      UPDATE profiles SET score = COALESCE(score, 0) + 1, coins = COALESCE(coins, 0) + 1 WHERE id = v_member_id;

      UPDATE habit_logs SET xp_awarded = true
      WHERE habit_id = v_linked_habit_id AND user_id = v_member_id AND log_date = v_log_date AND xp_awarded = false;
      IF FOUND THEN
        v_safe_xp := 10;
        UPDATE profiles
        SET total_xp = total_xp + v_safe_xp, current_level = calculate_level(total_xp + v_safe_xp)
        WHERE id = v_member_id;
      END IF;
    END IF;
  END IF;
END;
$$;

-- ── Backfill: mavjud guruhlar/odatlar/a'zolar uchun ham retroaktiv
--    bog'lanish yaratamiz (bu migratsiyadan oldin qo'shilgan odatlar) ──
DO $$
DECLARE
  v_gh RECORD;
  v_gm RECORD;
  v_personal_habit_id uuid;
BEGIN
  FOR v_gh IN SELECT * FROM group_habits LOOP
    FOR v_gm IN SELECT user_id FROM group_members WHERE group_id = v_gh.group_id LOOP
      IF NOT EXISTS (SELECT 1 FROM group_habit_links WHERE group_habit_id = v_gh.id AND user_id = v_gm.user_id) THEN
        INSERT INTO habits(user_id, name, emoji, type, target_value, unit, is_active)
        VALUES (v_gm.user_id, v_gh.name, v_gh.emoji, COALESCE(v_gh.type, 'positive'), COALESCE(v_gh.target_value, 1), COALESCE(v_gh.unit, ''), true)
        RETURNING id INTO v_personal_habit_id;

        INSERT INTO group_habit_links(group_habit_id, user_id, habit_id)
        VALUES (v_gh.id, v_gm.user_id, v_personal_habit_id);
      END IF;
    END LOOP;
  END LOOP;
END $$;
