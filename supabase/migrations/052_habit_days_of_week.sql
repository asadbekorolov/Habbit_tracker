-- ============================================================================
-- 052: Odat hafta kunlari (days_of_week)
-- ============================================================================
-- 1 = Dushanba ... 7 = Yakshanba — routines.days_of_week bilan bir xil format.
-- Mavjud odatlar "har kuni" ({1..7}) bo'lib qoladi. Kamida bitta kun shart.
-- RLS o'zgarmaydi: habits_insert_own / habits_update_own (003) yangi ustunni
-- ham qamraydi. Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS days_of_week integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}';

-- Eski yoki buzuq qiymatlar (bo'sh massiv) — har kuni
UPDATE public.habits
   SET days_of_week = '{1,2,3,4,5,6,7}'
 WHERE cardinality(days_of_week) = 0;

ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_days_of_week_check;
ALTER TABLE public.habits
  ADD CONSTRAINT habits_days_of_week_check
  CHECK (
    cardinality(days_of_week) BETWEEN 1 AND 7
    AND days_of_week <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  );

COMMIT;
