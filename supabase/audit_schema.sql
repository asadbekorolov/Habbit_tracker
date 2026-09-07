-- ============================================================
-- Traccer RLS Audit — Supabase SQL Editor'da ishga tushiring
-- Natijani (barcha qatorlarni) Claude'ga qaytaring
-- ============================================================

-- 1) Har bir jadval: RLS yoqilganmi?
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 2) Har bir jadvaldagi mavjud policy'lar
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Har bir jadvalning ustunlari (setup.sql eskirgan bo'lishi mumkin)
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
