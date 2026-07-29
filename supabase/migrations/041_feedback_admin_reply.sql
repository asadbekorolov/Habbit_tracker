-- Migration 041: Fikr-mulohazaga admin javob berishi
--
-- Jadval nomi haqiqatda `user_feedback` (016-migratsiya) — "feedbacks"
-- emas. `admin_reply`/`admin_replied_at` ustunlari qo'shiladi,
-- `get_all_feedback()` ularni ham qaytaradigan qilib yangilanadi, va
-- yangi `reply_to_feedback()` RPC javobni yozadi + foydalanuvchiga
-- bildirishnoma yuboradi (get_all_feedback bilan bir xil naqsh:
-- to'g'ridan-to'g'ri client UPDATE emas, admin ekanini serverda
-- tekshiradigan SECURITY DEFINER funksiya orqali).

ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS admin_replied_at timestamptz;

CREATE OR REPLACE FUNCTION get_all_feedback()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  display_name text,
  username text,
  admin_reply text,
  admin_replied_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;

  RETURN QUERY
    SELECT f.id, f.user_id, f.content, f.created_at, p.display_name, p.username,
           f.admin_reply, f.admin_replied_at
    FROM user_feedback f
    JOIN profiles p ON p.id = f.user_id
    ORDER BY f.created_at DESC;
END;
$$;

-- ── Fikr-mulohazaga javob berish (faqat sayt admini) ──
CREATE OR REPLACE FUNCTION reply_to_feedback(p_feedback_id uuid, p_reply text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true) THEN
    RAISE EXCEPTION 'Faqat sayt admini bu amalni bajara oladi';
  END IF;
  IF p_reply IS NULL OR btrim(p_reply) = '' THEN
    RAISE EXCEPTION 'Javob matni bo''sh bo''lishi mumkin emas';
  END IF;

  SELECT user_id INTO v_author_id FROM user_feedback WHERE id = p_feedback_id;
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Fikr-mulohaza topilmadi';
  END IF;

  UPDATE user_feedback
  SET admin_reply = btrim(p_reply), admin_replied_at = now()
  WHERE id = p_feedback_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    v_author_id,
    'Fikr-mulohazangizga javob keldi 💬',
    btrim(p_reply),
    'feedback_reply',
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reply_to_feedback(uuid, text) TO authenticated;
