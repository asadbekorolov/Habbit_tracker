-- ============================================================
-- notifications jadvali — mavjud bo'lmagani uchun Admin Panel va
-- boshqa bir qancha funksiyalar (duel taklifi, Telegram so'rovi,
-- ommaviy xabar) "relation does not exist" xatosi bilan ishlamayotgan edi
-- ============================================================
-- MUHIM: Ustun nomlari (`title`, `message`, `read`) so'ralgan sxemadan
-- ATAYLAB farqlanadi. Sabab: `notifications` jadvali aslida frontend'da
-- ALLAQACHON ko'p joyda ishlatilgan — src/services/db.ts (duel
-- so'rovlari, Telegram so'rovlari, send_global_notification RPC) va
-- src/components/NotificationBell.tsx barchasi `user_id, title, body,
-- type, link, is_read, created_at` ustunlarini kutadi. Agar jadval
-- so'ralgan `message`/`read` nomlari bilan yaratilsa, jadval yaratiladi,
-- lekin duel/Telegram bildirishnomalari va NotificationBell komponenti
-- butunlay ishlamay qoladi (ustun topilmadi xatosi). Shuning uchun
-- jadval mavjud kodga mos sxema bilan yaratiladi.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'generic',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

-- Har kim faqat O'ZINING bildirishnomalarini o'qiy oladi
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- INSERT ataylab "admin only" qilinmadi: duel taklifi (createDuelChallenge),
-- duel javobi (updateDuelStatus) va Telegram so'rovlari (sendTelegramRequest,
-- approveTelegramRequest) — bularning barchasi ODDIY foydalanuvchi
-- tomonidan, client kod orqali, BOSHQA foydalanuvchiga bildirishnoma
-- yozadi (masalan, duel raqibiga). Bular SECURITY DEFINER RPC emas,
-- to'g'ridan-to'g'ri client insert. Agar bu yerda "faqat admin insert
-- qila oladi" siyosati qo'yilsa, duel va Telegram bildirishnomalari
-- butunlay buziladi. Haqiqiy xavfsizlik chegarasi — "hammaga OMMAVIY
-- xabar yuborish" — allaqachon alohida himoyalangan: send_global_notification()
-- RPC'si (004_admin_moderation.sql) SECURITY DEFINER va ichida
-- `is_admin = true` tekshiruvini qattiq talab qiladi, RLS'dan mustaqil.
CREATE POLICY "notifications_insert_any" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- O'qilgan deb belgilash / o'chirish — faqat egasi
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Realtime: NotificationBell.tsx `postgres_changes` INSERT eventiga obuna
-- bo'ladi (yangi bildirishnoma kelganda darhol ko'rsatish uchun) — jadval
-- supabase_realtime publication'iga qo'shilishi shart.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
