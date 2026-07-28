-- ============================================================
-- 011: Guruh sahifasi uchun real-time sinxronlash
-- GroupsPage.tsx endi group_habit_logs va group_members'ga
-- supabase.channel() orqali obuna bo'ladi (a'zo odat bajarganda yoki
-- qo'shilganda/chiqib ketganda barcha ochiq oynalarda darhol yangilanishi
-- uchun) — bu ikki jadval supabase_realtime publication'iga qo'shilishi
-- shart, aks holda postgres_changes hech qanday event yubormaydi.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_habit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_habit_logs;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
  END IF;
END $$;
1