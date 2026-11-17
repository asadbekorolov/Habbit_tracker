-- ============================================================================
-- 051: Admin faqat bitta hisob (asadbekorolov0@gmail.com) + odat yozuvlari maxfiyligi
-- ============================================================================
-- 1) Sayt admini — auth.users dagi tasdiqlangan email bo'yicha. Barcha admin
--    tekshiruvlari (004–047 dagi RPC va RLS) profiles.is_admin ni o'qiydi —
--    shuning uchun is_admin endi trigger orqali FAQAT shu emailga bog'lanadi:
--    hech kim (service_role ham) boshqa hisobni admin qila olmaydi.
-- 2) habit_logs: avval har qanday kirgan foydalanuvchi hammaning yozuvlarini
--    o'qiy olardi (003: USING (true)) — "Lenta" shunga tayanardi. Endi faqat
--    o'zi va admin. Boshqa foydalanuvchilarni ko'rsatadigan joylar (reyting,
--    guruhlar, profil statistikasi) SECURITY DEFINER funksiyalar orqali ishlaydi.
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

-- Ichki: berilgan foydalanuvchi sayt adminimi (mijozga ochilmaydi)
CREATE OR REPLACE FUNCTION public._is_site_admin_uid(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
     WHERE u.id = p_uid
       AND lower(u.email) = 'asadbekorolov0@gmail.com'
       AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE EXECUTE ON FUNCTION public._is_site_admin_uid(uuid) FROM PUBLIC, anon, authenticated;

-- Joriy foydalanuvchi sayt adminimi (RLS siyosatlari va mijoz uchun)
CREATE OR REPLACE FUNCTION public.is_site_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL AND public._is_site_admin_uid(auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_site_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_site_admin() TO authenticated;

-- is_admin har doim email bo'yicha hisoblanadi (qo'lda o'zgartirib bo'lmaydi)
CREATE OR REPLACE FUNCTION public._enforce_site_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  NEW.is_admin := public._is_site_admin_uid(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._enforce_site_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_enforce_site_admin ON public.profiles;
CREATE TRIGGER profiles_enforce_site_admin
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._enforce_site_admin();

-- Mavjud yozuvlarni moslash: boshqa barcha adminlar olib tashlanadi
UPDATE public.profiles
   SET is_admin = public._is_site_admin_uid(id)
 WHERE is_admin IS DISTINCT FROM public._is_site_admin_uid(id);

-- Odat yozuvlari: faqat o'zi va admin
DROP POLICY IF EXISTS "habit_logs_select" ON public.habit_logs;
CREATE POLICY "habit_logs_select" ON public.habit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_site_admin());

COMMIT;
