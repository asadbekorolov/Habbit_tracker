-- Migration 032: group_habit_logs — yetishmayotgan tasdiqlash ustunlari
--
-- approve_group_log/reject_group_log RPC'lari (002/003/004-migratsiyalar)
-- va frontend (db.ts logGroupHabit, GroupsPage.tsx) approval_status,
-- approved_by, approved_at, proof_note, reject_reason ustunlarini
-- ANCHADAN BERI ishlatadi, lekin ularni haqiqatda ADD COLUMN qiladigan
-- migratsiya fayli hech qachon yozilmagan (ehtimol boshqa muhitda qo'lda
-- qo'shilgan). Shu sabab PostgREST "Could not find the 'approval_status'
-- column ... in schema cache" xatosini beradi. IF NOT EXISTS bilan xavfsiz.

ALTER TABLE group_habit_logs ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';
ALTER TABLE group_habit_logs ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id);
ALTER TABLE group_habit_logs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE group_habit_logs ADD COLUMN IF NOT EXISTS proof_note text;
ALTER TABLE group_habit_logs ADD COLUMN IF NOT EXISTS reject_reason text;

-- PostgREST'ning sxema keshini darhol yangilash — aks holda keyingi
-- avtomatik yangilanishgacha yana shu xato chiqishi mumkin.
NOTIFY pgrst, 'reload schema';
