-- ============================================================
-- Secure Progression System (XP & Leveling) + Critical Fix
-- ============================================================
-- MUHIM: Bu migratsiya ikki qismdan iborat:
--   A) setup.sql'dagi increment_score/increment_coins/spend_coins
--      funksiyalarida auth.uid() tekshiruvi YO'Q edi — SECURITY DEFINER
--      bo'lgani uchun har qanday login qilgan foydalanuvchi browser
--      konsolidan `supabase.rpc('increment_score', { uid: '<boshqa_id>',
--      delta: 999999 })` chaqirib, o'zi yoki boshqa birovning
--      score/coins qiymatini istagancha o'zgartira olar edi. Bu qism
--      shu teshikni yopadi (mavjud funksiya imzosi o'zgarmaydi, shuning
--      uchun client kod o'zgartirilishi shart emas).
--   B) Yangi, server tomonda tasdiqlanadigan XP/Daraja tizimi
--      (add_xp_to_user) — client faqat "men shu odatni bajardim" deb
--      xabar beradi (habit_id), mukofot miqdorini server hal qiladi.

-- ── A) Mavjud RPC'larni "faqat o'zingiz uchun" qoidasi bilan yopish ──

CREATE OR REPLACE FUNCTION increment_score(uid uuid, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat o''z hisobingiz uchun ball o''zgartira olasiz';
  END IF;

  UPDATE profiles
  SET score = GREATEST(0, COALESCE(score, 0) + delta)
  WHERE id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION increment_coins(uid uuid, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat o''z hisobingiz uchun tanga o''zgartira olasiz';
  END IF;

  UPDATE profiles
  SET coins = GREATEST(0, COALESCE(coins, 0) + delta)
  WHERE id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION spend_coins(uid uuid, price integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat o''z hisobingizdan tanga sarflay olasiz';
  END IF;

  UPDATE profiles
  SET coins = coins - price
  WHERE id = uid AND COALESCE(coins, 0) >= price
  RETURNING coins INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Tangalar yetarli emas';
  END IF;

  RETURN new_balance;
END;
$$;

-- ── B) Yangi XP & Daraja tizimi ──

-- 1) Sxema: profiles'ga umr bo'yi XP va joriy daraja
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_xp integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_level integer NOT NULL DEFAULT 1;

-- Bitta bajarilish uchun XP faqat bir marta berilishini kafolatlash
-- (kun ichida checkbox'ni bir necha marta bosib XP "farm" qilishning oldini oladi)
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS xp_awarded boolean NOT NULL DEFAULT false;

-- total_xp/current_level faqat quyidagi SECURITY DEFINER funksiyalar orqali
-- o'zgaradi — 003 migratsiyasidagi kabi to'g'ridan-to'g'ri client UPDATE'ga
-- yopiq bo'lishi kerak (agar hali umumiy UPDATE grant mavjud bo'lsa, cheklang):
REVOKE UPDATE (total_xp, current_level) ON profiles FROM authenticated;

-- 2) Daraja chegaralarini hisoblash — mavjud frontend `getLevel()`
--    (src/utils/levels.ts) bilan bir xil bosqichlar, shunda ikkala
--    tizim (score-based va xp-based) vizual jihatdan mos keladi.
CREATE OR REPLACE FUNCTION calculate_level(xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN xp >= 500 THEN 5
    WHEN xp >= 300 THEN 4
    WHEN xp >= 150 THEN 3
    WHEN xp >= 50  THEN 2
    ELSE 1
  END;
$$;

-- 3) add_xp_to_user: Client faqat habit_id yuboradi. Server:
--    - haqiqatan bugun, shu foydalanuvchi tomonidan, tasdiqlangan
--      bajarilish borligini tekshiradi (habit_logs.completed = true)
--    - shu bajarilish uchun XP avval berilmaganini tekshiradi
--      (xp_awarded = false) — takroriy chaqiruvlarni rad etadi
--    - client yuborgan xp_amount'ga to'liq ishonmaydi — xavfsiz
--      oraliqqa (1-50) qisadi, shuning uchun konsoldan
--      xp_amount=999999 yuborish samarasiz
CREATE OR REPLACE FUNCTION add_xp_to_user(p_habit_id uuid, p_xp_amount integer DEFAULT 10)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_safe_xp integer;
  v_new_total integer;
  v_new_level integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autentifikatsiya talab qilinadi';
  END IF;

  v_safe_xp := LEAST(GREATEST(COALESCE(p_xp_amount, 10), 1), 50);

  UPDATE habit_logs
  SET xp_awarded = true
  WHERE habit_id = p_habit_id
    AND user_id = v_uid
    AND log_date = CURRENT_DATE
    AND completed = true
    AND xp_awarded = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'XP berish uchun tasdiqlangan bajarilish topilmadi yoki allaqachon berilgan';
  END IF;

  UPDATE profiles
  SET total_xp = total_xp + v_safe_xp,
      current_level = calculate_level(total_xp + v_safe_xp)
  WHERE id = v_uid
  RETURNING total_xp, current_level INTO v_new_total, v_new_level;

  RETURN json_build_object('total_xp', v_new_total, 'level', v_new_level, 'xp_gained', v_safe_xp);
END;
$$;
