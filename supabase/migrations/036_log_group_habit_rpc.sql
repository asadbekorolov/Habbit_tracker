-- Migration 036: Guruh odatini belgilash — "permission denied for table
-- group_habit_logs" xatosini tuzatish
--
-- Muammo: logGroupHabit() (client) group_habit_logs jadvaliga to'g'ridan-
-- to'g'ri upsert qilardi va har safar approval_status ustunini ham
-- 'pending' qilib yozardi. 003-migratsiya esa xavfsizlik uchun ataylab
-- "REVOKE UPDATE ... GRANT UPDATE (completed, reps, proof_note)" qo'ygan
-- — ya'ni a'zo o'z qatorining approval_status'ini to'g'ridan-to'g'ri
-- o'zgartira olmasligi kerak (aks holda o'zini-o'zi "tasdiqlangan" qilib
-- qo'yishi mumkin bo'lardi).
--
-- Bu birinchi marta (INSERT) muammosiz ishlaydi — INSERT'da ustun darajasidagi
-- cheklov yo'q. Lekin BIR XIL kun uchun IKKINCHI marta belgilash/tahrirlash
-- (masalan izohni to'g'irlash) upsert'ning ON CONFLICT DO UPDATE yo'liga
-- tushadi — va u yerda approval_status ustuniga yozishga ruxsat yo'q,
-- shuning uchun "permission denied for table group_habit_logs" xatosi
-- chiqadi.
--
-- Yechim: xavfsizlik cheklovini KAMAYTIRISH o'rniga (bu a'zoning o'z-o'zini
-- tasdiqlashiga yo'l ochib qo'yardi), yozishni SECURITY DEFINER RPC orqali
-- qilamiz — u auth.uid()ni tekshiradi va faqat a'zoning O'ZI uchun, faqat
-- ruxsat etilgan maydonlarni (+ har doim approval_status='pending' qilib
-- qayta ko'rib chiqishga yuborish) yozadi. Sana serverning CURRENT_DATE'i
-- emas, client hisoblagan (mahalliy vaqt) sana sifatida parametr orqali
-- keladi — 035-migratsiyada aniqlangan vaqt-zonasi muammosini qaytarmaslik
-- uchun.

CREATE OR REPLACE FUNCTION log_group_habit(
  p_group_habit_id uuid,
  p_group_id uuid,
  p_log_date date,
  p_completed boolean,
  p_reps integer,
  p_proof_note text
)
RETURNS group_habit_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row group_habit_logs;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autentifikatsiya talab qilinadi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Siz bu guruh a''zosi emassiz';
  END IF;

  INSERT INTO group_habit_logs (group_habit_id, group_id, user_id, log_date, completed, reps, proof_note, approval_status)
  VALUES (p_group_habit_id, p_group_id, v_uid, p_log_date, p_completed, GREATEST(1, COALESCE(p_reps, 1)), p_proof_note, 'pending')
  ON CONFLICT (group_habit_id, user_id, log_date)
  DO UPDATE SET
    completed = p_completed,
    reps = GREATEST(1, COALESCE(p_reps, 1)),
    proof_note = p_proof_note,
    -- Qayta yuborish = yangi ko'rib chiqish so'rovi: eski tasdiq/rad
    -- holati va sababi tozalanadi.
    approval_status = 'pending',
    approved_by = NULL,
    approved_at = NULL,
    reject_reason = NULL
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION log_group_habit(uuid, uuid, date, boolean, integer, text) TO authenticated;
