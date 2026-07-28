-- ============================================================
-- 013: Achievements — hardcoded matn o'rniga achievement_key
-- ============================================================
-- Muammo: 012_achievements_and_star.sql'da achievements.title/description
-- to'g'ridan-to'g'ri O'zbek tilida (RPC ichida) yozilgan edi — ko'p tillilik
-- talabini buzadi (rus/ingliz foydalanuvchilar ham shu matnni ko'rar edi).
-- Bu migratsiya title/description'ni barqaror `achievement_key`ga
-- almashtiradi; tarjima endi to'liq client'da src/utils/i18n.ts orqali.

ALTER TABLE achievements ADD COLUMN IF NOT EXISTS achievement_key text;

-- Agar 012 allaqachon ishga tushirilgan bo'lsa va eski title-based qatorlar
-- mavjud bo'lsa, ularni saqlab qolish uchun key'ga o'giramiz (foydalanuvchi
-- allaqachon ochgan yutuqlar yo'qolib qolmasligi kerak).
UPDATE achievements SET achievement_key = CASE title
  WHEN 'Iron Will' THEN 'iron_will'
  WHEN 'Early Bird' THEN 'early_bird'
  WHEN 'Negative Killer' THEN 'negative_killer'
  ELSE lower(regexp_replace(btrim(title), '\s+', '_', 'g'))
END
WHERE achievement_key IS NULL AND title IS NOT NULL;

ALTER TABLE achievements ALTER COLUMN achievement_key SET NOT NULL;

-- Eski (user_id, title) unique constraint'ni (user_id, achievement_key)ga
-- almashtiramiz — nomi 012'dagi CREATE TABLE'ning avtomatik nomlanishiga mos.
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_user_id_title_key;
ALTER TABLE achievements ADD CONSTRAINT achievements_user_id_key_key UNIQUE (user_id, achievement_key);

-- title/description endi kerak emas — matn butunlay client i18n'da.
ALTER TABLE achievements DROP COLUMN IF EXISTS title;
ALTER TABLE achievements DROP COLUMN IF EXISTS description;

-- RETURNS TABLE ustunlari nomi o'zgargani uchun (title -> achievement_key)
-- avval funksiyani butunlay o'chirish kerak (007/012'dagi kabi).
DROP FUNCTION IF EXISTS check_and_unlock_achievements(uuid);

CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_user_id uuid)
RETURNS TABLE(achievement_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_iron_will boolean;
  v_early_bird boolean;
  v_negative_killer boolean;
  v_new_key text;
  v_unlocked text[] := '{}';
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat o''z yutuqlaringizni tekshira olasiz';
  END IF;

  -- "iron_will": istalgan musbat odat bo'yicha 7 kunlik ketma-ket streak
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT hl.habit_id, hl.log_date,
             hl.log_date - (ROW_NUMBER() OVER (PARTITION BY hl.habit_id ORDER BY hl.log_date))::int AS grp
      FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      WHERE hl.user_id = p_user_id AND hl.completed = true AND h.type = 'positive'
        AND hl.log_date >= CURRENT_DATE - INTERVAL '30 days'
    ) s
    GROUP BY habit_id, grp
    HAVING COUNT(*) >= 7 AND MAX(log_date) >= CURRENT_DATE - INTERVAL '1 day'
  ) INTO v_iron_will;

  -- "early_bird": soat 09:00'gacha boshlanadigan musbat (scheduled) odat,
  -- 5 kun ketma-ket bajarilgan
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT hl.habit_id, hl.log_date,
             hl.log_date - (ROW_NUMBER() OVER (PARTITION BY hl.habit_id ORDER BY hl.log_date))::int AS grp
      FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      WHERE hl.user_id = p_user_id AND hl.completed = true AND h.type = 'positive'
        AND h.scheduled_start IS NOT NULL AND h.scheduled_start < '09:00:00'
        AND hl.log_date >= CURRENT_DATE - INTERVAL '30 days'
    ) s
    GROUP BY habit_id, grp
    HAVING COUNT(*) >= 5 AND MAX(log_date) >= CURRENT_DATE - INTERVAL '1 day'
  ) INTO v_early_bird;

  -- "negative_killer": istalgan salbiy odatdan 3 kun ketma-ket saqlanib
  -- qolish (completed=false, lekin yozuv mavjud — ya'ni ataylab "avoided")
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT hl.habit_id, hl.log_date,
             hl.log_date - (ROW_NUMBER() OVER (PARTITION BY hl.habit_id ORDER BY hl.log_date))::int AS grp
      FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      WHERE hl.user_id = p_user_id AND hl.completed = false AND h.type = 'negative'
        AND hl.log_date >= CURRENT_DATE - INTERVAL '30 days'
    ) s
    GROUP BY habit_id, grp
    HAVING COUNT(*) >= 3 AND MAX(log_date) >= CURRENT_DATE - INTERVAL '1 day'
  ) INTO v_negative_killer;

  IF v_iron_will THEN
    v_new_key := NULL;
    INSERT INTO achievements (user_id, achievement_key, icon)
    VALUES (p_user_id, 'iron_will', '🦾')
    ON CONFLICT (user_id, achievement_key) DO NOTHING
    RETURNING achievement_key INTO v_new_key;
    IF v_new_key IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_new_key); END IF;
  END IF;

  IF v_early_bird THEN
    v_new_key := NULL;
    INSERT INTO achievements (user_id, achievement_key, icon)
    VALUES (p_user_id, 'early_bird', '🌅')
    ON CONFLICT (user_id, achievement_key) DO NOTHING
    RETURNING achievement_key INTO v_new_key;
    IF v_new_key IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_new_key); END IF;
  END IF;

  IF v_negative_killer THEN
    v_new_key := NULL;
    INSERT INTO achievements (user_id, achievement_key, icon)
    VALUES (p_user_id, 'negative_killer', '🎯')
    ON CONFLICT (user_id, achievement_key) DO NOTHING
    RETURNING achievement_key INTO v_new_key;
    IF v_new_key IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_new_key); END IF;
  END IF;

  RETURN QUERY SELECT unnest(v_unlocked);
END;
$$;
