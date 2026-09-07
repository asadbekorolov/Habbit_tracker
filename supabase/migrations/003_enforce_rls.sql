-- ============================================================
-- Traccer — To'liq RLS xavfsizlik migratsiyasi (audit bilan tekshirilgan)
--
-- Manba: 2026-07 sanasidagi schema audit (information_schema.columns) +
-- src/services/db.ts to'liq kod tahlili.
--
-- ESLATMA: audit ba'zi jadvallar uchun TO'LIQ EMAS edi — masalan
-- group_habit_logs'da approval_status/approved_by/approved_at/proof_note/
-- reject_reason, duels'da challenger_goal/opponent_goal/winner_id audit
-- natijasida ko'rinmadi, lekin kodda muqarrar ishlatiladi (eksport kesilgan
-- bo'lishi kerak). Shu ustunlar uchun kod-tahlili ustun qo'yildi.
--
-- notifications va telegram_requests jadvallari audit natijasida umuman
-- ko'rinmadi (ehtimol shu sababdan). Ular DO $$ ... $$ ichida to_regclass
-- bilan mavjudligini tekshirib, faqat mavjud bo'lsa policy qo'yiladi —
-- shuning uchun bu fayl ularning nomi/ustunlari boshqacha chiqsa ham
-- xatosiz ishlaydi.
--
-- leaderboard — RLS qo'yilmadi, chunki ustun shakli (id, display_name,
-- avatar_color, total_completed, active_days, hammasi nullable) VIEW
-- ekanini ko'rsatadi; ALTER TABLE ... ENABLE ROW LEVEL SECURITY VIEW'da
-- ishlamaydi. Agar bu haqiqatda oddiy jadval bo'lsa, ayting.
-- ============================================================

-- ------------------------------------------------------------
-- 0) RLS'ni yoqish (audit bilan tasdiqlangan asosiy jadvallar)
-- ------------------------------------------------------------
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_habits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_habit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_subteams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_subteam_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_freezes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reflections     ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1) Eski "allow all" policy'larni o'chirish
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "allow all" ON profiles;
DROP POLICY IF EXISTS "allow all" ON habits;
DROP POLICY IF EXISTS "allow all" ON habit_logs;
DROP POLICY IF EXISTS "allow all" ON groups;
DROP POLICY IF EXISTS "allow all" ON group_members;
DROP POLICY IF EXISTS "allow all" ON group_habits;
DROP POLICY IF EXISTS "allow all" ON group_habit_logs;
DROP POLICY IF EXISTS "allow all" ON member_goals;
DROP POLICY IF EXISTS "allow all" ON duels;
DROP POLICY IF EXISTS "allow all" ON daily_notes;
DROP POLICY IF EXISTS "allow all" ON push_subscriptions;

-- ------------------------------------------------------------
-- 2) IJTIMOIY jadvallar — SELECT ochiq, yozish faqat egasiga
-- ------------------------------------------------------------

-- profiles (audit: id, username, display_name, avatar_color, created_at, score,
-- avatar_url, is_banned, phone, bio, telegram_username, instagram_username,
-- telegram_private, coins, telegram_chat_id — "role"/"is_pro" mavjud EMAS)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- score/coins/is_banned/telegram_chat_id ustunlarini oddiy UPDATE bilan
-- o'zgartirib bo'lmaydi — faqat SECURITY DEFINER RPC orqali (increment_score,
-- increment_coins, toggle_user_ban, unlink_telegram_bot; bot bog'lash esa
-- service-role bilan ishlaydigan api/telegram.ts orqali, RLS'ga bog'liq emas).
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, username, avatar_url, avatar_color, bio,
  telegram_username, telegram_private, instagram_username, phone) ON profiles TO authenticated;

-- habits (audit: id, user_id, name, emoji, type, is_active, created_at,
-- target_value, unit, scheduled_start, scheduled_end)
DROP POLICY IF EXISTS "habits_select" ON habits;
DROP POLICY IF EXISTS "habits_insert_own" ON habits;
DROP POLICY IF EXISTS "habits_update_own" ON habits;
DROP POLICY IF EXISTS "habits_delete_own" ON habits;
CREATE POLICY "habits_select" ON habits FOR SELECT TO authenticated USING (true);
CREATE POLICY "habits_insert_own" ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits_update_own" ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits_delete_own" ON habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- habit_logs (audit: id, habit_id, user_id, log_date, completed, value, created_at)
DROP POLICY IF EXISTS "habit_logs_select" ON habit_logs;
DROP POLICY IF EXISTS "habit_logs_insert_own" ON habit_logs;
DROP POLICY IF EXISTS "habit_logs_update_own" ON habit_logs;
DROP POLICY IF EXISTS "habit_logs_delete_own" ON habit_logs;
CREATE POLICY "habit_logs_select" ON habit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "habit_logs_insert_own" ON habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit_logs_update_own" ON habit_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit_logs_delete_own" ON habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- duels (audit: id, challenger_id, opponent_id, status, start_date, end_date,
-- created_at — challenger_goal/opponent_goal/winner_id kodda ishlatiladi,
-- policy ular bilan bog'liq emas)
DROP POLICY IF EXISTS "duels_select" ON duels;
DROP POLICY IF EXISTS "duels_insert_own" ON duels;
DROP POLICY IF EXISTS "duels_update_participant" ON duels;
CREATE POLICY "duels_select" ON duels FOR SELECT TO authenticated USING (true);
CREATE POLICY "duels_insert_own" ON duels FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "duels_update_participant" ON duels FOR UPDATE TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- groups (audit: id, name, invite_code, admin_id, created_at, telegram_link)
DROP POLICY IF EXISTS "groups_select" ON groups;
DROP POLICY IF EXISTS "groups_insert_own" ON groups;
DROP POLICY IF EXISTS "groups_update_admin" ON groups;
DROP POLICY IF EXISTS "groups_delete_admin" ON groups;
CREATE POLICY "groups_select" ON groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert_own" ON groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "groups_update_admin" ON groups FOR UPDATE TO authenticated USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "groups_delete_admin" ON groups FOR DELETE TO authenticated USING (auth.uid() = admin_id);

-- group_members (audit: id, group_id, user_id, role, joined_at)
DROP POLICY IF EXISTS "group_members_select" ON group_members;
DROP POLICY IF EXISTS "group_members_insert_self" ON group_members;
DROP POLICY IF EXISTS "group_members_delete_self_or_admin" ON group_members;
CREATE POLICY "group_members_select" ON group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_members_insert_self" ON group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_delete_self_or_admin" ON group_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.admin_id = auth.uid())
  );

-- group_habits (audit: id, group_id, name, emoji, created_at, type, target_value, unit)
DROP POLICY IF EXISTS "group_habits_select" ON group_habits;
DROP POLICY IF EXISTS "group_habits_write_admin" ON group_habits;
CREATE POLICY "group_habits_select" ON group_habits FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_habits_write_admin" ON group_habits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_habits.group_id AND g.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_habits.group_id AND g.admin_id = auth.uid()));

-- group_habit_logs (audit: id, group_habit_id, user_id, group_id, log_date,
-- completed, reps, created_at — approval_status/approved_by/approved_at/
-- proof_note/reject_reason audit'da ko'rinmadi, lekin kod ularni ishlatadi;
-- GRANT ro'yxati shu kod-tahliliga asoslangan)
DROP POLICY IF EXISTS "group_habit_logs_select" ON group_habit_logs;
DROP POLICY IF EXISTS "group_habit_logs_insert_own" ON group_habit_logs;
DROP POLICY IF EXISTS "group_habit_logs_update_own" ON group_habit_logs;
CREATE POLICY "group_habit_logs_select" ON group_habit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_habit_logs_insert_own" ON group_habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_habit_logs_update_own" ON group_habit_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- A'zo o'z qatorida faqat mazmun ustunlarini o'zgartira oladi — tasdiqlash
-- maydonlari faqat approve_group_log/reject_group_log RPC orqali o'zgaradi.
REVOKE UPDATE ON group_habit_logs FROM authenticated;
GRANT UPDATE (completed, reps, proof_note) ON group_habit_logs TO authenticated;

-- member_goals (audit: id, group_habit_id, user_id, group_id, initial_target,
-- current_target, review_interval_days, last_reviewed, created_at)
DROP POLICY IF EXISTS "member_goals_select" ON member_goals;
DROP POLICY IF EXISTS "member_goals_write_own" ON member_goals;
CREATE POLICY "member_goals_select" ON member_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_goals_write_own" ON member_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- group_subteams / group_subteam_members (audit tasdiqladi: subteam_members'da
-- alohida id yo'q, PK (subteam_id,user_id))
DROP POLICY IF EXISTS "group_subteams_select" ON group_subteams;
DROP POLICY IF EXISTS "group_subteams_write_admin" ON group_subteams;
CREATE POLICY "group_subteams_select" ON group_subteams FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_subteams_write_admin" ON group_subteams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_subteams.group_id AND g.admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM groups g WHERE g.id = group_subteams.group_id AND g.admin_id = auth.uid()));

DROP POLICY IF EXISTS "group_subteam_members_select" ON group_subteam_members;
DROP POLICY IF EXISTS "group_subteam_members_write_admin" ON group_subteam_members;
CREATE POLICY "group_subteam_members_select" ON group_subteam_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_subteam_members_write_admin" ON group_subteam_members FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_subteams st JOIN groups g ON g.id = st.group_id
    WHERE st.id = group_subteam_members.subteam_id AND g.admin_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_subteams st JOIN groups g ON g.id = st.group_id
    WHERE st.id = group_subteam_members.subteam_id AND g.admin_id = auth.uid()
  ));

-- feed_reactions (audit: id, reactor_id, item_id, reaction_type, created_at)
DROP POLICY IF EXISTS "feed_reactions_select" ON feed_reactions;
DROP POLICY IF EXISTS "feed_reactions_write_own" ON feed_reactions;
CREATE POLICY "feed_reactions_select" ON feed_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_reactions_write_own" ON feed_reactions FOR ALL TO authenticated
  USING (auth.uid() = reactor_id) WITH CHECK (auth.uid() = reactor_id);

-- followers (audit: id, follower_id, following_id, created_at)
DROP POLICY IF EXISTS "followers_select" ON followers;
DROP POLICY IF EXISTS "followers_write_own" ON followers;
CREATE POLICY "followers_select" ON followers FOR SELECT TO authenticated USING (true);
CREATE POLICY "followers_write_own" ON followers FOR ALL TO authenticated
  USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- ------------------------------------------------------------
-- 2b) notifications / telegram_requests — audit natijasida ko'rinmadi.
-- Kod ularni faol ishlatadi (NotificationBell.tsx, Telegram aloqa oqimi),
-- shuning uchun mavjudligini tekshirib, bo'lsa policy qo'yamiz — nom yoki
-- ustun boshqacha chiqib qolsa ham migratsiya xato bermaydi.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "notifications_select_own" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_insert_any" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_update_own" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "notifications_delete_own" ON notifications';
    -- istalgan user boshqasiga bildirishnoma yarata oladi (follow/duel taklifi),
    -- lekin faqat qabul qiluvchi o'zinikini ko'radi/o'chiradi/o'qilgan belgilaydi
    EXECUTE 'CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "notifications_insert_any" ON notifications FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.telegram_requests') IS NOT NULL THEN
    ALTER TABLE telegram_requests ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "telegram_requests_select_participant" ON telegram_requests';
    EXECUTE 'DROP POLICY IF EXISTS "telegram_requests_insert_own" ON telegram_requests';
    EXECUTE 'DROP POLICY IF EXISTS "telegram_requests_update_target" ON telegram_requests';
    EXECUTE 'CREATE POLICY "telegram_requests_select_participant" ON telegram_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id)';
    EXECUTE 'CREATE POLICY "telegram_requests_insert_own" ON telegram_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id)';
    EXECUTE 'CREATE POLICY "telegram_requests_update_target" ON telegram_requests FOR UPDATE TO authenticated USING (auth.uid() = target_id) WITH CHECK (auth.uid() = target_id)';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) SHAXSIY jadvallar — hamma amal faqat egasiga
-- ------------------------------------------------------------

-- daily_notes (audit: id, user_id, note_date, content, mood, sleep_hours, screen_hours, created_at)
DROP POLICY IF EXISTS "daily_notes_owner_all" ON daily_notes;
CREATE POLICY "daily_notes_owner_all" ON daily_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- weekly_reflections (audit: id, user_id, week_start, went_well, improve_next, created_at, updated_at)
DROP POLICY IF EXISTS "weekly_reflections_owner_all" ON weekly_reflections;
CREATE POLICY "weekly_reflections_owner_all" ON weekly_reflections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- health_logs (audit: id, user_id, log_date, steps, sleep_hours, water_glasses,
-- screen_time_hours, created_at) — Phase 2'da tibbiy ustunlar qo'shilganda ham
-- shu policy amal qiladi, chunki FOR ALL barcha ustunlarni qamrab oladi
DROP POLICY IF EXISTS "health_logs_owner_all" ON health_logs;
CREATE POLICY "health_logs_owner_all" ON health_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- push_subscriptions (audit: id, user_id, endpoint, p256dh, auth, created_at)
DROP POLICY IF EXISTS "push_subscriptions_owner_all" ON push_subscriptions;
CREATE POLICY "push_subscriptions_owner_all" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- coin_purchases (audit: id, user_id, item_id, purchased_at)
DROP POLICY IF EXISTS "coin_purchases_owner_all" ON coin_purchases;
CREATE POLICY "coin_purchases_owner_all" ON coin_purchases FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- streak_freezes (audit: id, user_id, freeze_date, created_at)
DROP POLICY IF EXISTS "streak_freezes_owner_all" ON streak_freezes;
CREATE POLICY "streak_freezes_owner_all" ON streak_freezes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4) Guruh isbot tasdiqlash — xavfsiz RPC
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

-- unlink_telegram_bot: profiles.telegram_chat_id endi client uchun yopiq
-- ustun bo'lgani sababli, "botni uzish" tugmasi shu RPC orqali ishlaydi.
CREATE OR REPLACE FUNCTION unlink_telegram_bot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET telegram_chat_id = NULL WHERE id = auth.uid();
END;
$$;
