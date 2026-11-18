-- Migratsiya testlari uchun baza (tests/db/harness.mjs): Supabase muhitining
-- yaqinlashuvi + 047 dan oldingi public sxemaning soddalashtirilgan nusxasi.
-- Faqat PGlite testlarida ishlatiladi — haqiqiy bazaga QO'LLAMANG.
-- Minimal Supabase-like environment for testing migration 047.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Supabase default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  display_name text,
  avatar_color text,
  avatar_url text,
  bio text,
  score integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  total_xp integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  is_admin boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  phone text,
  telegram_chat_id bigint,
  telegram_username text,
  telegram_private boolean NOT NULL DEFAULT false,
  instagram_username text,
  profile_private boolean NOT NULL DEFAULT false,
  active_frame text,
  username_glow boolean NOT NULL DEFAULT false,
  has_star boolean NOT NULL DEFAULT false,
  star_expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  emoji text DEFAULT 'x',
  type text NOT NULL,
  is_active boolean DEFAULT true,
  target_value integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid REFERENCES habits(id),
  user_id uuid REFERENCES profiles(id),
  log_date date NOT NULL,
  completed boolean DEFAULT false,
  value integer DEFAULT 1,
  xp_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (habit_id, user_id, log_date)
);
CREATE TABLE daily_quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  quest_date date NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_id, quest_date)
);
CREATE TABLE coin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  item_id text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE streak_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  freeze_date date
);
CREATE TABLE groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_id uuid);
CREATE TABLE group_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, user_id uuid, role text DEFAULT 'member');
CREATE TABLE group_habits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid, name text, type text DEFAULT 'positive');
CREATE TABLE group_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_habit_id uuid, group_id uuid, user_id uuid,
  log_date date, completed boolean DEFAULT true, reps integer DEFAULT 1,
  approval_status text DEFAULT 'pending', approved_by uuid, approved_at timestamptz);
CREATE TABLE group_habit_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_habit_id uuid, user_id uuid, habit_id uuid,
  UNIQUE (group_habit_id, user_id));
CREATE TABLE telegram_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requester_id uuid, target_id uuid,
  status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (requester_id, target_id));
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, body text, type text, link text);

-- RLS like 003
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert_own ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY habit_logs_select ON habit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY habit_logs_insert_own ON habit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY habit_logs_update_own ON habit_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY habit_logs_delete_own ON habit_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER TABLE coin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_purchases_owner_all ON coin_purchases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY habits_all ON habits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Pre-existing functions (live DB / repo versions)
CREATE FUNCTION calculate_level(xp integer) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN xp >= 3162 THEN 10 WHEN xp >= 283 THEN 2 ELSE 1 END $$;
CREATE FUNCTION is_group_admin(p_group_id uuid, p_uid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND admin_id = p_uid) $$;
CREATE FUNCTION increment_coins(uid uuid, delta integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'own only'; END IF;
  UPDATE profiles SET coins = GREATEST(0, COALESCE(coins, 0) + delta) WHERE id = uid;
END $$;
CREATE FUNCTION increment_score(uid uuid, delta integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'own only'; END IF;
  UPDATE profiles SET score = GREATEST(0, COALESCE(score, 0) + delta) WHERE id = uid;
END $$;
CREATE FUNCTION spend_coins(uid uuid, price integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance integer;
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'own only'; END IF;
  UPDATE profiles SET coins = coins - price WHERE id = uid AND COALESCE(coins, 0) >= price RETURNING coins INTO new_balance;
  IF new_balance IS NULL THEN RAISE EXCEPTION 'Tangalar yetarli emas'; END IF;
  RETURN new_balance;
END $$;
CREATE FUNCTION add_xp_to_user(p_habit_id uuid, p_xp_amount integer DEFAULT 10) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN '{}'::json; END $$;
CREATE FUNCTION claim_daily_quest(uid uuid, p_quest_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RETURN 0; END $$;
CREATE FUNCTION buy_star(uid uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v timestamptz;
BEGIN
  IF uid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'own only'; END IF;
  PERFORM spend_coins(uid, 500);
  v := now() + interval '30 days';
  UPDATE profiles SET has_star = true, star_expires_at = v WHERE id = uid;
  RETURN v;
END $$;
CREATE FUNCTION link_telegram_account(p_user_id uuid, p_telegram_chat_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN '{}'::jsonb; END $$;
CREATE FUNCTION send_telegram_request(p_target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NULL; END $$;
CREATE FUNCTION respond_telegram_request(p_request_id uuid, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NULL; END $$;
CREATE FUNCTION reconcile_daily_missions(p_user_id uuid, p_date date DEFAULT CURRENT_DATE) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN '{}'::json; END $$;
