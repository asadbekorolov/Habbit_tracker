-- ============================================================================
-- 053: habit_logs.completed_at — odat qachon (soat nechada) bajarilgani
-- ============================================================================
-- "Ko'pincha soat nechada bajariladi?" tahlili uchun. created_at faqat yozuv
-- birinchi marta yaratilgan vaqtni saqlaydi (avval "bajarilmadi", keyin
-- "bajarildi" bo'lsa — noto'g'ri vaqt). completed_at trigger bilan:
-- bajarildi holatiga o'tgan paytda now(); bajarilmagan bo'lsa NULL.
-- Eski yozuvlar: shu kunning o'zida yaratilganlari uchun created_at.
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill trigger'dan oldin (aks holda trigger now() yozib yuboradi)
DROP TRIGGER IF EXISTS habit_logs_completed_at ON public.habit_logs;

-- Eski yozuvlar: faqat o'sha kunning o'zida (Toshkent) belgilanganlari
UPDATE public.habit_logs
   SET completed_at = created_at
 WHERE completed
   AND completed_at IS NULL
   AND created_at IS NOT NULL
   AND (created_at AT TIME ZONE 'Asia/Tashkent')::date = log_date;


CREATE OR REPLACE FUNCTION public._habit_logs_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.completed THEN
    IF TG_OP = 'INSERT' OR NOT COALESCE(OLD.completed, false) OR OLD.completed_at IS NULL THEN
      NEW.completed_at := now();
    ELSE
      NEW.completed_at := OLD.completed_at;   -- qiymat o'zgarsa ham vaqt saqlanadi
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._habit_logs_completed_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER habit_logs_completed_at
  BEFORE INSERT OR UPDATE ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public._habit_logs_completed_at();


CREATE INDEX IF NOT EXISTS habit_logs_habit_completed_idx
  ON public.habit_logs (habit_id, completed_at)
  WHERE completed_at IS NOT NULL;

COMMIT;
