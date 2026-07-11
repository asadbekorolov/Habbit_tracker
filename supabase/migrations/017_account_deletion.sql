-- Self-service account deletion — required for App Store / Google Play
-- compliance (users must be able to delete their own account from
-- inside the app, not only by emailing support).
--
-- Relies on ON DELETE CASCADE from profiles(id) -> auth.users(id) (the
-- standard Supabase profile pattern this project already uses) plus
-- every user-owned table's existing "REFERENCES profiles(id) ON DELETE
-- CASCADE" FK — confirmed consistent across every migration in this
-- project (groups.admin_id, group_members, group_habit_logs,
-- achievements, user_feedback, etc.). Deleting the auth.users row
-- therefore cascades through the whole schema in one statement.
--
-- If any table turns out to be missing ON DELETE CASCADE on its
-- profiles(id) FK, this will fail loudly with a foreign-key-violation
-- error instead of silently leaving orphaned rows — which is the safe
-- failure mode. Run supabase/audit_schema.sql and share the FK list if
-- that happens so the missing CASCADE can be added.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autentifikatsiyadan o''tilmagan';
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
