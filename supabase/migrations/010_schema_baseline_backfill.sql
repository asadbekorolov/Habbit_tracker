-- ============================================================
-- Sxema muvofiqligi — "yashirin" ustunlarni migratsiyalarga qaytarish
-- ============================================================
-- Audit paytida aniqlandi: quyidagi ustunlar hozir jonli bazada MAVJUD
-- (ilova ular bilan ishlab turibdi) va kod ularga to'liq tayanadi, lekin
-- hech qaysi tracked migratsiya faylida `CREATE`/`ALTER` orqali
-- yaratilmagan — faqat 003_enforce_rls.sql'dagi audit izohlarida
-- ("audit: id, ..., coins, ...") tilga olingan, ya'ni ular vaqti-vaqti
-- bilan to'g'ridan-to'g'ri Supabase panelida qo'lda qo'shilgan.
--
-- Xavfi: agar loyiha nolinchi Supabase proyektida shu migratsiyalar
-- ketma-ketligida qayta tiklansa (masalan, disaster recovery yoki yangi
-- muhit), bu ustunlar UMUMAN yaratilmay qoladi va ilova ishga
-- tushmaydi. Bu migratsiya shu bo'shliqni yopadi — barcha buyruqlar
-- `IF NOT EXISTS` bilan, shuning uchun joriy productionda xavfsiz
-- no-op (hech narsani buzmaydi, faqat kelajakdagi tiklash uchun
-- hujjatlashtiradi).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_private boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS telegram_link text;

ALTER TABLE group_habits ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'positive';
ALTER TABLE group_habits ADD COLUMN IF NOT EXISTS target_value integer NOT NULL DEFAULT 1;
ALTER TABLE group_habits ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';

ALTER TABLE habits ADD COLUMN IF NOT EXISTS scheduled_start time;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS scheduled_end time;

-- 008_health_persistence_fix.sql'da topilgan xuddi shu ildiz sabab
-- (upsert onConflict mos UNIQUE constraint'siz) weekly_reflections uchun
-- ham tekshirildi: upsertWeeklyReflection() `onConflict: 'user_id,week_start'`
-- bilan ishlaydi, lekin bu jadval ham hech qaysi migratsiyada CREATE
-- qilinmagan. Xavfsizlik uchun mos unique indeks qo'shiladi — agar allaqachon
-- mavjud bo'lsa, bu buyruq xavfsiz no-op.
CREATE UNIQUE INDEX IF NOT EXISTS weekly_reflections_user_week_key
  ON weekly_reflections (user_id, week_start);
