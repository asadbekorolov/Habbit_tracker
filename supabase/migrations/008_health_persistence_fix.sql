-- ============================================================
-- Health/Sleep/Screen ma'lumotlari saqlanmasligi — ildiz sabab
-- ============================================================
-- HealthPage.tsx har bir metrikani (qadam, uyqu, suv, ekran vaqti) ALOHIDA
-- upsert qiladi: `upsertHealthLog(userId, date, { [metricKey]: value })`.
-- Supabase upsert() quyidagi SQL'ga aylanadi:
--   INSERT INTO health_logs (...) VALUES (...)
--   ON CONFLICT (user_id, log_date) DO UPDATE SET ...
-- Agar `health_logs(user_id, log_date)` ustida mos UNIQUE constraint/indeks
-- BO'LMASA, kunning birinchi yozuvi (masalan "qadam") oddiy INSERT sifatida
-- muvaffaqiyatli o'tadi (hali qator yo'q edi), lekin O'SHA KUNI ikkinchi
-- metrikani (masalan "uyqu") saqlashga urinish CONFLICT hosil qiladi va
-- Postgres mos constraint topolmay xato qaytaradi: "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification". Bu xato
-- HealthPage.tsx'da `catch {}` bilan jimgina yutilgani uchun foydalanuvchi
-- hech narsa ko'rmaydi — xuddi "ma'lumot saqlanmagandek" tuyuladi.
--
-- `health_logs` jadvali repo migratsiyalarida yo'q (to'g'ridan-to'g'ri
-- Supabase panelida yaratilgan), shuning uchun mos unique indeks
-- borligini kafolatlab qo'yamiz — bu operatsiya idempotent, agar allaqachon
-- mavjud bo'lsa hech narsani buzmaydi.
CREATE UNIQUE INDEX IF NOT EXISTS health_logs_user_date_key
  ON health_logs (user_id, log_date);

-- daily_notes'da bu constraint setup.sql orqali allaqachon bor
-- (UNIQUE(user_id, note_date)) — shu bilan bir xil ehtiyot chorasi sifatida:
CREATE UNIQUE INDEX IF NOT EXISTS daily_notes_user_date_key
  ON daily_notes (user_id, note_date);
