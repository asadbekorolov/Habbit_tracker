-- Migration 034: Guruh↔shaxsiy odat bog'lashda dublikatning oldini olish
--
-- Muammo: 033-migratsiya har bir guruh odati uchun a'zoga HAR DOIM yangi
-- shaxsiy odat yaratardi — agar a'zoda nomi bir xil odat (masalan
-- "Kitob o'qish") ALLAQACHON bo'lsa ham. Natijada aynan oldini olishga
-- harakat qilgan narsamiz — bitta ishni ikki marta hisoblash — teskarisi
-- sifatida ikkita bir xil nomli odat paydo bo'ldi.
--
-- Tuzatish: 1) bundan buyon guruh odati a'zoga bog'langanda, avval uning
-- mavjud FAOL odatlari orasidan nomi bir xil (katta-kichik harf va
-- bo'sh joylarga sezgir emas) odat qidiriladi — topilsa O'SHANGA
-- bog'lanadi, yangisi yaratilmaydi. 2) 033-migratsiya allaqachon
-- yaratib qo'ygan dublikatlarni ham tozalaymiz (eng eskisini — ya'ni
-- foydalanuvchida ilgaridan bor bo'lganini — asosiy sifatida qoldirib,
-- qolganlarini shunga birlashtiramiz).

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
    SELECT id INTO v_personal_habit_id
    FROM habits
    WHERE user_id = v_member.user_id AND is_active = true
      AND lower(btrim(name)) = lower(btrim(v_habit.name))
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_personal_habit_id IS NULL THEN
      INSERT INTO habits(user_id, name, emoji, type, target_value, unit, is_active)
      VALUES (v_member.user_id, v_habit.name, v_habit.emoji, v_habit.type, v_habit.target_value, v_habit.unit, true)
      RETURNING id INTO v_personal_habit_id;
    END IF;

    INSERT INTO group_habit_links(group_habit_id, user_id, habit_id)
    VALUES (v_habit.id, v_member.user_id, v_personal_habit_id)
    ON CONFLICT (group_habit_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_habit;
END;
$$;

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
      SELECT id INTO v_personal_habit_id
      FROM habits
      WHERE user_id = NEW.user_id AND is_active = true
        AND lower(btrim(name)) = lower(btrim(v_gh.name))
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_personal_habit_id IS NULL THEN
        INSERT INTO habits(user_id, name, emoji, type, target_value, unit, is_active)
        VALUES (NEW.user_id, v_gh.name, v_gh.emoji, v_gh.type, v_gh.target_value, v_gh.unit, true)
        RETURNING id INTO v_personal_habit_id;
      END IF;

      INSERT INTO group_habit_links(group_habit_id, user_id, habit_id)
      VALUES (v_gh.id, NEW.user_id, v_personal_habit_id)
      ON CONFLICT (group_habit_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ── Mavjud dublikatlarni tozalash ────────────────────────────────────
-- Har bir (foydalanuvchi, kichik harf+bo'sh joysiz nom) guruhida bir
-- nechta FAOL odat topilsa — eng eskisini (ilgaridan bor bo'lganini)
-- asosiy qilib qoldiramiz, qolganlarining loglarini shunga ko'chiramiz,
-- group_habit_links'ni qayta yo'naltiramiz va dublikatlarni deaktivatsiya
-- qilamiz.
DO $$
DECLARE
  v_dup RECORD;
  v_keeper_id uuid;
  v_rest uuid[];
BEGIN
  FOR v_dup IN
    SELECT user_id, array_agg(id ORDER BY created_at ASC) AS ids
    FROM habits
    WHERE is_active = true
    GROUP BY user_id, lower(btrim(name))
    HAVING COUNT(*) > 1
  LOOP
    v_keeper_id := v_dup.ids[1];
    v_rest := v_dup.ids[2:array_length(v_dup.ids, 1)];

    UPDATE habit_logs hl
    SET habit_id = v_keeper_id
    WHERE hl.habit_id = ANY(v_rest)
      AND NOT EXISTS (
        SELECT 1 FROM habit_logs hl2
        WHERE hl2.habit_id = v_keeper_id AND hl2.log_date = hl.log_date AND hl2.user_id = hl.user_id
      );
    DELETE FROM habit_logs WHERE habit_id = ANY(v_rest);

    UPDATE group_habit_links SET habit_id = v_keeper_id WHERE habit_id = ANY(v_rest);

    UPDATE habits SET is_active = false WHERE id = ANY(v_rest);
  END LOOP;
END $$;
