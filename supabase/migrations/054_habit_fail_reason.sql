-- ============================================================================
-- 054: habit_logs.fail_reason — odat nega bajarilmagani
-- ============================================================================
-- Foydalanuvchi "bajarilmadi" (fail) belgilaganda sabab yozadi; AI tahlil
-- shu sabablarni ko'zgu qilib ko'rsatadi.
--   * set_habit_fail_reason(habit, date, reason) — faqat egasi, faqat ochiq
--     kun (is_log_date_open), faqat "bajarilmadi" holatidagi yozuvga.
--     Mijoz navbati (habitSyncQueue) avval holatni (toggle_habit_atomic),
--     keyin sababni yuboradi — tartib saqlanadi.
--   * Trigger: yozuv "bajarildi" bo'lsa sabab avtomatik NULL bo'ladi;
--     belgisiz holatga qaytarilganda yozuv o'chiriladi (047) — sabab ham.
-- Qayta ishga tushirish xavfsiz.
-- ============================================================================

BEGIN;

ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS fail_reason text;

ALTER TABLE public.habit_logs DROP CONSTRAINT IF EXISTS habit_logs_fail_reason_len;
ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_fail_reason_len CHECK (fail_reason IS NULL OR char_length(fail_reason) <= 500);

-- Bajarildi -> sabab tozalanadi
CREATE OR REPLACE FUNCTION public._habit_logs_clear_fail_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.completed THEN
    NEW.fail_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._habit_logs_clear_fail_reason() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS habit_logs_clear_fail_reason ON public.habit_logs;
CREATE TRIGGER habit_logs_clear_fail_reason
  BEFORE INSERT OR UPDATE ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public._habit_logs_clear_fail_reason();

CREATE OR REPLACE FUNCTION public.set_habit_fail_reason(
  p_habit_id uuid,
  p_date date,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := NULLIF(btrim(left(COALESCE(p_reason, ''), 500)), '');
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT is_log_date_open(p_date) THEN
    RAISE EXCEPTION 'date_locked';
  END IF;

  UPDATE habit_logs
     SET fail_reason = v_reason
   WHERE user_id = v_uid
     AND habit_id = p_habit_id
     AND log_date = p_date
     AND completed = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_habit_fail_reason(uuid, date, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_habit_fail_reason(uuid, date, text) TO authenticated;

COMMIT;
