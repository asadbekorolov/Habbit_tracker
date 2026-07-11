-- ============================================================
-- 012: Achievements Engine & Global Star Status ("Engagement Phase")
-- ============================================================
-- MUHIM QARORLAR (yozib qo'yilishi kerak):
--
-- 1) `buy_star`/`has_star`/`star_expires_at` ilgari mavjud emas edi —
--    spravka o'rniga bu migratsiya ularni NOLDAN yaratadi (avvalgi
--    so'rovda "Update buy_star RPC" deb yozilgan edi, lekin kodda
--    bunday RPC yo'q edi).
--
-- 2) Bundan oldin CoinShopModal'da "star_badge" degan BUTUNLAY BOSHQA
--    tizim bor edi: bir martalik, 15 tanga, umrbod (coin_purchases
--    jadvali orqali, hasShopBadge() bilan tekshiriladi). Ikkalasini
--    parallel saqlash (bitta ⭐ belgisi, ikki xil narx/muddat) chalkash
--    va gamification nuqtai nazaridan ma'nosiz bo'lardi. Shuning uchun
--    bu migratsiya ESKI star_badge mexanikasini YANGI 30-kunlik obuna
--    bilan ALMASHTIRADI (frontend CoinShopModal ham shunga mos
--    yangilanadi) — coin_purchases'dagi eski "star_badge" yozuvlari
--    bazada saqlanib qoladi (o'chirilmaydi), lekin endi hech narsaga
--    ta'sir qilmaydi.
-- ============================================================

-- ── A) Star Economy ──────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_star boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS star_expires_at timestamptz;

-- Faqat quyidagi SECURITY DEFINER funksiya orqali o'zgarishi kerak —
-- aks holda foydalanuvchi konsoldan o'zini "Star" qilib belgilashi mumkin.
REVOKE UPDATE (has_star, star_expires_at) ON profiles FROM authenticated;

CREATE OR REPLACE FUNCTION buy_star(uid uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat o''z hisobingiz uchun Star sotib olishingiz mumkin';
  END IF;

  -- spend_coins (006_xp_leveling.sql) balansni atomik tekshiradi/yechadi,
  -- yetarli bo'lmasa xato beradi — shu yerda qo'shimcha tekshiruv shart emas.
  PERFORM spend_coins(uid, 500);

  SELECT star_expires_at INTO v_current_expiry FROM profiles WHERE id = uid;
  -- Agar hali amal qiluvchi Star bo'lsa, muddat UNGA QO'SHILADI (cho'zish);
  -- aks holda hozirdan 30 kun.
  v_new_expiry := GREATEST(COALESCE(v_current_expiry, now()), now()) + INTERVAL '30 days';

  UPDATE profiles SET has_star = true, star_expires_at = v_new_expiry WHERE id = uid;

  RETURN v_new_expiry;
END;
$$;

-- Klient (va boshqa RPC'lar) "hozir faolmi" deb shu orqali so'rashi kerak —
-- has_star ustuni "hech bo'lmasa bir marta sotib olganmi" degan tarixiy
-- belgi, muddati tugagach avtomatik false'ga aylanmaydi (cron yo'q),
-- shuning uchun haqiqiy tekshiruv doim expires_at bilan birga bo'lishi shart.
CREATE OR REPLACE FUNCTION is_star_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT has_star AND star_expires_at > now() FROM profiles WHERE id = p_user_id),
    false
  );
$$;

-- get_leaderboard() qaytadigan ustunlar tarkibi o'zgargani uchun (007'dagi
-- kabi) avval funksiyani butunlay o'chirish kerak.
DROP FUNCTION IF EXISTS get_leaderboard();

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE(
  id uuid,
  username text,
  display_label text,
  avatar_url text,
  avatar_color text,
  score integer,
  is_private boolean,
  has_star boolean
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
      COALESCE(p.profile_private, false) AS is_private,
      (p.has_star AND p.star_expires_at > now()) AS has_star
    FROM profiles p
    ORDER BY COALESCE(p.score, 0) DESC
    LIMIT 50;
END;
$$;

-- ── B) Achievement Engine ────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, title)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- O'qish hammaga ochiq (autentifikatsiyalanganlarga) — "globally visible"
-- talabiga mos, boshqa foydalanuvchi profilida ham ko'rsatilishi mumkin
-- bo'lishi uchun (leaderboard/is_private kabi allaqachon ochiq
-- ma'lumotlar bilan bir xil daraja).
CREATE POLICY "achievements_select_all" ON achievements
  FOR SELECT TO authenticated USING (true);

-- Yozish FAQAT check_and_unlock_achievements orqali — to'g'ridan-to'g'ri
-- client INSERT/UPDATE/DELETE huquqi yo'q (soxta yutuq yaratmasin).

CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_user_id uuid)
RETURNS TABLE(title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_iron_will boolean;
  v_early_bird boolean;
  v_negative_killer boolean;
  v_new_title text;
  v_unlocked text[] := '{}';
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat o''z yutuqlaringizni tekshira olasiz';
  END IF;

  -- "Iron Will": istalgan musbat odat bo'yicha 7 kunlik ketma-ket streak
  -- (gaps-and-islands: sana - qator_raqami doim bir xil bo'lsa, ketma-ket)
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

  -- "Early Bird": soat 09:00'gacha boshlanadigan musbat (scheduled) odat,
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

  -- "Negative Killer": istalgan salbiy odatdan 3 kun ketma-ket saqlanib
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
    v_new_title := NULL;
    INSERT INTO achievements (user_id, title, description, icon)
    VALUES (p_user_id, 'Iron Will', '7 kun ketma-ket bitta odatni bajardingiz', '🦾')
    ON CONFLICT (user_id, title) DO NOTHING
    RETURNING title INTO v_new_title;
    IF v_new_title IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_new_title); END IF;
  END IF;

  IF v_early_bird THEN
    v_new_title := NULL;
    INSERT INTO achievements (user_id, title, description, icon)
    VALUES (p_user_id, 'Early Bird', '5 kun ketma-ket ertalabki odatga sodiq qoldingiz', '🌅')
    ON CONFLICT (user_id, title) DO NOTHING
    RETURNING title INTO v_new_title;
    IF v_new_title IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_new_title); END IF;
  END IF;

  IF v_negative_killer THEN
    v_new_title := NULL;
    INSERT INTO achievements (user_id, title, description, icon)
    VALUES (p_user_id, 'Negative Killer', '3 kun ketma-ket yomon odatdan saqlandingiz', '🎯')
    ON CONFLICT (user_id, title) DO NOTHING
    RETURNING title INTO v_new_title;
    IF v_new_title IS NOT NULL THEN v_unlocked := array_append(v_unlocked, v_new_title); END IF;
  END IF;

  RETURN QUERY SELECT unnest(v_unlocked);
END;
$$;

-- Realtime shart emas — achievements sahifa ochilganda/log yozilgandan
-- keyin so'rov orqali o'qiladi, doimiy obuna talab qilinmaydi.
