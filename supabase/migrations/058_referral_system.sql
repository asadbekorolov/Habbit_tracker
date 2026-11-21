-- ============================================================================
-- 058: Taklif (referral) tizimi
--
-- 1. profiles.referral_code (unikal, 7 belgi: katta harf + raqam, o'xshash
--    belgilarsiz — 0/O, 1/I/L yo'q) va profiles.referred_by.
--    Mavjud foydalanuvchilarga kod beriladi, yangilariga — BEFORE INSERT trigger.
--    Mijoz bu ustunlarni yozolmaydi va o'qiyolmaydi (047 ustun huquqlari);
--    o'z kodi get_my_referral_info() orqali olinadi.
-- 2. referral_rewards — kim kimni taklif qilgani va berilgan tangalar
--    (referred_id UNIQUE: bitta foydalanuvchi faqat bir marta taklif qilinadi).
--    RLS yoqilgan, mijozga hech qanday huquq yo'q.
-- 3. apply_referral_code(p_code) — atomar:
--    o'zini taklif qilish, ikkinchi marta kod kiritish, ro'yxatdan o'tganiga
--    48 soatdan oshgan akkaunt va o'zaro (A↔B) taklif rad etiladi.
--    Yangi foydalanuvchi +50, taklif qiluvchi +100 tanga va bildirishnoma.
--    Suiiste'moldan himoya: taklif qiluvchi bir sutkada ko'pi bilan 10 marta
--    mukofot oladi (undan keyin do'st baribir +50 oladi, taklif qiluvchi 0).
-- 4. get_my_referral_info() — o'z kodi, kod kiritish mumkinmi, muddati,
--    taklif qilinganlar soni va ishlangan tangalar.
--
-- Qayta ishga tushirishga chidamli.
-- ============================================================================
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid
  REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);

-- Mijoz (hatto o'z qatorida ham) bu ustunlarni o'zgartira olmasin
REVOKE INSERT (referral_code, referred_by), UPDATE (referral_code, referred_by)
  ON public.profiles FROM anon, authenticated;
REVOKE SELECT (referral_code, referred_by) ON public.profiles FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- Kod generatori
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_alphabet CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c_len      CONSTANT integer := 7;
  v_code     text;
  i          integer;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..c_len LOOP
      v_code := v_code || substr(c_alphabet, 1 + floor(random() * length(c_alphabet))::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Mavjud foydalanuvchilar: har bir qator alohida buyruq (oldingi kodlar ko'rinadi)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public._generate_referral_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- Yangi foydalanuvchilar
CREATE OR REPLACE FUNCTION public._profiles_set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := _generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._profiles_set_referral_code();

-- ----------------------------------------------------------------------------
-- Mukofotlar daftari
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id     uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_coins  integer NOT NULL DEFAULT 0,
  referred_coins  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_rewards_not_self CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer
  ON public.referral_rewards (referrer_id, created_at DESC);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_rewards FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Kodni qo'llash
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_referrer_bonus CONSTANT integer := 100;
  c_referred_bonus CONSTANT integer := 50;
  c_window         CONSTANT interval := interval '48 hours';
  c_daily_cap      CONSTANT integer := 10;
  v_uid            uuid := auth.uid();
  v_code           text := upper(btrim(COALESCE(p_code, '')));
  v_referrer       uuid;
  v_me             record;
  v_ref            record;
  v_referrer_coins integer := c_referrer_bonus;
  v_balance        integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_code !~ '^[A-Z0-9]{6,8}$' THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  SELECT id INTO v_referrer FROM profiles WHERE referral_code = v_code;
  IF v_referrer IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  IF v_referrer = v_uid THEN
    RAISE EXCEPTION 'self_referral';
  END IF;

  -- Ikkala foydalanuvchining mukofot o'zgarishlari ketma-ket (doim bir xil tartibda)
  PERFORM _lock_user_rewards(LEAST(v_uid, v_referrer));
  PERFORM _lock_user_rewards(GREATEST(v_uid, v_referrer));

  SELECT id, referred_by, created_at, is_banned INTO v_me FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF COALESCE(v_me.is_banned, false) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF v_me.referred_by IS NOT NULL OR EXISTS (SELECT 1 FROM referral_rewards WHERE referred_id = v_uid) THEN
    RAISE EXCEPTION 'already_referred';
  END IF;
  IF v_me.created_at < now() - c_window THEN
    RAISE EXCEPTION 'referral_window_closed';
  END IF;

  SELECT id, referred_by, is_banned INTO v_ref FROM profiles WHERE id = v_referrer FOR UPDATE;
  IF COALESCE(v_ref.is_banned, false) THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  -- O'zaro taklif (A B ni, B A ni) — ikki yangi akkaunt bilan tanga yig'ishni yopadi
  IF v_ref.referred_by = v_uid THEN
    RAISE EXCEPTION 'mutual_referral';
  END IF;

  IF (SELECT count(*) FROM referral_rewards
      WHERE referrer_id = v_referrer AND referrer_coins > 0
        AND created_at > now() - interval '1 day') >= c_daily_cap THEN
    v_referrer_coins := 0;
  END IF;

  UPDATE profiles
     SET referred_by = v_referrer,
         coins = COALESCE(coins, 0) + c_referred_bonus
   WHERE id = v_uid
  RETURNING coins INTO v_balance;

  IF v_referrer_coins > 0 THEN
    UPDATE profiles SET coins = COALESCE(coins, 0) + v_referrer_coins WHERE id = v_referrer;
  END IF;

  INSERT INTO referral_rewards (referrer_id, referred_id, referrer_coins, referred_coins)
  VALUES (v_referrer, v_uid, v_referrer_coins, c_referred_bonus);

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    v_referrer,
    'Yangi do''st qo''shildi',
    CASE WHEN v_referrer_coins > 0
      THEN 'Do''stingiz taklif kodingiz orqali qo''shildi! +' || v_referrer_coins || ' tanga'
      ELSE 'Do''stingiz taklif kodingiz orqali qo''shildi. Bugungi taklif mukofotlari chegarasiga yetdingiz.'
    END,
    'referral',
    'profile:' || v_uid::text
  );

  RETURN jsonb_build_object(
    'ok', true,
    'bonus', c_referred_bonus,
    'coins', v_balance
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- O'z taklif ma'lumotlari
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_referral_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_me   record;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT referral_code, referred_by, created_at INTO v_me FROM profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_code := v_me.referral_code;
  IF v_code IS NULL THEN
    v_code := _generate_referral_code();
    UPDATE profiles SET referral_code = v_code WHERE id = v_uid AND referral_code IS NULL;
    SELECT referral_code INTO v_code FROM profiles WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'code', v_code,
    'can_apply', v_me.referred_by IS NULL
                 AND NOT EXISTS (SELECT 1 FROM referral_rewards WHERE referred_id = v_uid)
                 AND v_me.created_at >= now() - interval '48 hours',
    'apply_until', v_me.created_at + interval '48 hours',
    'invited_count', (SELECT count(*)::integer FROM referral_rewards WHERE referrer_id = v_uid),
    'earned_coins', (SELECT COALESCE(sum(referrer_coins), 0)::integer FROM referral_rewards WHERE referrer_id = v_uid)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public._generate_referral_code()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._profiles_set_referral_code()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_referral_info()         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_referral_code(text)      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_referral_info()         TO authenticated;

COMMIT;
