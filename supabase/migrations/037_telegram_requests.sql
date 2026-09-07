-- Migration 037: telegram_requests jadvali — Telegram aloqa so'rovi
--
-- Muammo: PublicProfileModal.tsx va NotificationBell.tsx allaqachon
-- telegram_requests jadvaliga ishonib yozilgan (getTelegramRequestStatus,
-- sendTelegramRequest, approve/rejectTelegramRequest), lekin jadvalning
-- o'zi HECH QACHON yaratilmagan — 003-migratsiya faqat to_regclass(...)
-- IS NOT NULL sharti bilan RLS policy qo'yishga harakat qilgan, jadval
-- yo'qligi sabab bu policy'lar hech qachon amalda qo'yilmagan. Natijada
-- "Could not find the table 'public.telegram_requests'" xatosi.
--
-- Yozish (so'rov yuborish/javob berish) to'g'ridan-to'g'ri client UPDATE
-- emas, ikkita SECURITY DEFINER RPC orqali qilinadi:
--   - "qayta yuborish"da statusni xavfsiz pending'ga qaytarish va 2 soatlik
--     sovish muddatini serverda tekshirish kerak (client soxta vaqt yuborib
--     buni chetlab o'ta olmasligi uchun);
--   - tasdiqlash/rad etishda bildirishnoma yozish bilan status yangilash
--     bitta atomik amalda bo'lishi kerak.

CREATE TABLE IF NOT EXISTS telegram_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_requests_target ON telegram_requests(target_id, status);
CREATE INDEX IF NOT EXISTS idx_telegram_requests_requester ON telegram_requests(requester_id);

ALTER TABLE telegram_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "telegram_requests_select_participant" ON telegram_requests;
DROP POLICY IF EXISTS "telegram_requests_insert_own" ON telegram_requests;
DROP POLICY IF EXISTS "telegram_requests_update_target" ON telegram_requests;
CREATE POLICY "telegram_requests_select_participant" ON telegram_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);
-- Diqqat: bu yerda ataylab INSERT/UPDATE policy YO'Q — yozish faqat
-- pastdagi SECURITY DEFINER RPC'lar orqali (ular RLS'ni chetlab o'tadi,
-- o'z ichida auth.uid() tekshiruvini o'zi bajaradi). Aks holda so'rovchi
-- to'g'ridan-to'g'ri status='approved' qo'yib o'zini-o'zi tasdiqlashi
-- mumkin bo'lardi.

-- ── So'rov yuborish (yoki rad etilgan-u, 2 soatlik sovish muddati
--    o'tgandan keyin qayta yuborish) ──
CREATE OR REPLACE FUNCTION send_telegram_request(p_target_id uuid)
RETURNS telegram_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing telegram_requests;
  v_row telegram_requests;
  v_from_name text;
  v_from_username text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autentifikatsiya talab qilinadi';
  END IF;
  IF v_uid = p_target_id THEN
    RAISE EXCEPTION 'O''zingizga so''rov yubora olmaysiz';
  END IF;

  SELECT * INTO v_existing FROM telegram_requests
  WHERE requester_id = v_uid AND target_id = p_target_id;

  IF v_existing.id IS NOT NULL THEN
    -- Allaqachon tasdiqlangan yoki kutilayotgan bo'lsa — bor holini
    -- qaytaramiz, qayta yozishga hojat yo'q (idempotent).
    IF v_existing.status = 'approved' OR v_existing.status = 'pending' THEN
      RETURN v_existing;
    ELSIF v_existing.status = 'rejected' AND v_existing.updated_at > now() - INTERVAL '2 hours' THEN
      RAISE EXCEPTION 'COOLDOWN';
    END IF;
  END IF;

  SELECT display_name, username INTO v_from_name, v_from_username FROM profiles WHERE id = v_uid;

  INSERT INTO telegram_requests (requester_id, target_id, status, updated_at)
  VALUES (v_uid, p_target_id, 'pending', now())
  ON CONFLICT (requester_id, target_id)
  DO UPDATE SET status = 'pending', updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    p_target_id,
    'Telegram aloqa so''rovi',
    '@' || COALESCE(v_from_username, '?') || ' (' || COALESCE(v_from_name, '?') || ') siz bilan Telegramda aloqa o''rnatmoqchi',
    'telegram_request',
    'telegram_request:' || v_row.id
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION send_telegram_request(uuid) TO authenticated;

-- ── So'rovga javob berish (tasdiqlash yoki rad etish) — faqat qabul
--    qiluvchi (target) o'ziga yuborilgan so'rovga javob bera oladi ──
CREATE OR REPLACE FUNCTION respond_telegram_request(p_request_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req telegram_requests;
  v_approver_tg text;
  v_approver_name text;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Noto''g''ri holat: %', p_status;
  END IF;

  SELECT * INTO v_req FROM telegram_requests WHERE id = p_request_id AND target_id = v_uid;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'So''rov topilmadi';
  END IF;

  UPDATE telegram_requests SET status = p_status, updated_at = now() WHERE id = p_request_id;

  IF p_status = 'approved' THEN
    SELECT telegram_username, display_name INTO v_approver_tg, v_approver_name FROM profiles WHERE id = v_uid;
    INSERT INTO notifications (user_id, title, body, type, link)
    VALUES (
      v_req.requester_id,
      'Telegram so''rovingiz qabul qilindi! 🎉',
      COALESCE(v_approver_name, 'Foydalanuvchi') || ' endi @' || COALESCE(v_approver_tg, '?') || ' orqali Telegramda bog''lanishga ruxsat berdi',
      'telegram_approved',
      'profile:' || v_uid
    );
  ELSE
    INSERT INTO notifications (user_id, title, body, type, link)
    VALUES (
      v_req.requester_id,
      'Telegram so''rovingiz rad etildi',
      '2 soatdan so''ng qayta urinib ko''rishingiz mumkin',
      'telegram_rejected',
      'profile:' || v_uid
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION respond_telegram_request(uuid, text) TO authenticated;
