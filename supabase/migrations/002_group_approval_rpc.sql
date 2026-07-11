-- ============================================================
-- Guruh isbot tasdiqlash — xavfsiz RPC funksiyalar
-- Muammo: approveGroupLog/rejectGroupLog klient tomonidan yuborilgan
-- adminId parametriga ishonardi, serverda hech kim uni tekshirmasdi.
-- RLS "allow all" bilan birga bu har qanday foydalanuvchiga (hatto
-- guruh a'zosi bo'lmasa ham) istalgan isbotni tasdiqlash/rad etish
-- imkonini berardi. Bu ikkala funksiya endi auth.uid()ni guruhning
-- haqiqiy admin_id'si bilan serverda solishtiradi.
-- Supabase SQL Editor -> New Query -> paste -> Run
-- ============================================================

CREATE OR REPLACE FUNCTION approve_group_log(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_admin_id uuid;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habit_logs WHERE id = p_log_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT admin_id INTO v_admin_id FROM groups WHERE id = v_group_id;
  IF v_admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat guruh sardori tasdiqlashi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_group_log(p_log_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_admin_id uuid;
BEGIN
  SELECT group_id INTO v_group_id FROM group_habit_logs WHERE id = p_log_id;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Log topilmadi';
  END IF;

  SELECT admin_id INTO v_admin_id FROM groups WHERE id = v_group_id;
  IF v_admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Faqat guruh sardori rad etishi mumkin';
  END IF;

  UPDATE group_habit_logs
  SET approval_status = 'rejected', approved_by = auth.uid(), reject_reason = p_reason
  WHERE id = p_log_id;
END;
$$;

-- Eski, xavfli yo'l orqali to'g'ridan-to'g'ri UPDATE qilinishining oldini olish:
-- keyingi bosqichda group_habit_logs uchun yoziladigan RLS policy approval_status,
-- approved_by, approved_at, reject_reason ustunlarini faqat shu RPC orqali
-- (SECURITY DEFINER RLS'ni chetlab o'tadi) o'zgartirilishini ta'minlaydi —
-- oddiy klient UPDATE'i bu ustunlarni o'zgartira olmaydi.
