-- ============================================================
-- Global Leaderboard — Anonimlik va Maxfiylik
-- ============================================================
-- Muammo: get_leaderboard() `display_name` ustunini (haqiqiy "Ism va
-- Familiya") to'g'ridan-to'g'ri qaytarardi, u global reytingda barcha
-- foydalanuvchilarga ko'rinardi. Bu migratsiya:
--   1) profiles'ga profile_private (yuqori maxfiylik) ustuni qo'shadi
--   2) get_leaderboard()'ni "Ism + Familiya bosh harfi" (masalan,
--      "Asadbek O.") formatida anonimlashtirilgan label qaytaradigan
--      qilib qayta yozadi, xom display_name'ni butunlay qaytarmaydi
--   3) har bir qatorda is_private flag qaytaradi — frontend shu orqali
--      "Profilni ko'rish" havolasini begonalar uchun o'chirib qo'yadi

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_private boolean NOT NULL DEFAULT false;

-- get_leaderboard()'ning qaytadigan ustunlar tarkibi (RETURNS TABLE) o'zgargani
-- uchun CREATE OR REPLACE yetarli emas — Postgres funksiya OUT parametrlarini
-- o'zgartirishga ruxsat bermaydi, avval eski funksiyani butunlay o'chirish kerak.
DROP FUNCTION IF EXISTS get_leaderboard();

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE(
  id uuid,
  username text,
  display_label text,
  avatar_url text,
  avatar_color text,
  score integer,
  is_private boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.username,
      CASE
        WHEN p.display_name IS NULL OR btrim(p.display_name) = '' THEN p.username
        WHEN split_part(btrim(p.display_name), ' ', 2) = '' THEN split_part(btrim(p.display_name), ' ', 1)
        ELSE split_part(btrim(p.display_name), ' ', 1) || ' ' || left(split_part(btrim(p.display_name), ' ', 2), 1) || '.'
      END AS display_label,
      p.avatar_url,
      p.avatar_color,
      COALESCE(p.score, 0)::integer AS score,
      COALESCE(p.profile_private, false) AS is_private
    FROM profiles p
    ORDER BY COALESCE(p.score, 0) DESC
    LIMIT 50;
END;
$$;

-- profile_private'ni faqat egasi o'zgartira olishi kerak — profiles_update_own
-- (003 migratsiyasi) allaqachon `auth.uid() = id` bilan cheklaydi, bu ustun
-- esa umumiy UPDATE grant ro'yxatida (003'dagi
-- "phone, telegram_username, ..." GRANT) allaqachon yo'q, shuning uchun
-- alohida ruxsat qo'shish kerak:
GRANT UPDATE (profile_private) ON profiles TO authenticated;
