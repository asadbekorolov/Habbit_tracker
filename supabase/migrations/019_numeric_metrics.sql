-- Kunlik Jurnaldagi "Raqamli Ko'rsatkichlar" slaydirlari (Tabiat vaqti,
-- Ijtimoiy tarmoq vaqti) hech qachon saqlanmagan edi (faqat mahalliy
-- component state). Bu ikkisi alohida odat emas, shuning uchun mavjud
-- health_logs jadvaliga (sleep_hours/screen_time_hours bilan bir xil
-- "kunlik sog'liq ko'rsatkichlari" manbasi) qo'shiladi.

ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS nature_time_minutes integer;
ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS social_time_minutes integer;
