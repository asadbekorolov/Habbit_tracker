-- ============================================================
-- Traccer - To'liq bazani sozlash (bir marta ishga tushiring)
-- Supabase SQL Editor -> New Query -> paste -> Run
-- ============================================================

-- 1. profiles jadvaliga etishmayotgan ustunlar
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. habits jadvaliga etishmayotgan ustunlar
ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_value integer NOT NULL DEFAULT 1;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. habit_logs jadvaliga etishmayotgan ustunlar
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS value integer NOT NULL DEFAULT 1;

-- 4. Groups jadvallari (agar yo'q bo'lsa)
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  admin_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '⭐',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_habit_id uuid REFERENCES group_habits(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean NOT NULL DEFAULT false,
  reps integer NOT NULL DEFAULT 1,
  UNIQUE(group_habit_id, user_id, log_date)
);

CREATE TABLE IF NOT EXISTS member_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_habit_id uuid REFERENCES group_habits(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  initial_target integer NOT NULL DEFAULT 1,
  current_target integer NOT NULL DEFAULT 1,
  review_interval_days integer NOT NULL DEFAULT 10,
  last_reviewed_at timestamptz,
  UNIQUE(group_habit_id, user_id)
);

-- 5. Duels jadvali (agar yo'q bo'lsa)
CREATE TABLE IF NOT EXISTS duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  challenger_goal text,
  opponent_goal text,
  winner_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 6. Daily notes jadvali (agar yo'q bo'lsa)
CREATE TABLE IF NOT EXISTS daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  mood integer CHECK (mood BETWEEN 1 AND 5),
  sleep_hours numeric(3,1),
  screen_hours numeric(3,1),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, note_date)
);

-- 7. Push subscriptions jadvali (agar yo'q bo'lsa)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text,
  auth text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- FUNKSIYALAR
-- ============================================================

-- increment_score: Ball qo'shish/ayirish
CREATE OR REPLACE FUNCTION increment_score(uid uuid, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET score = GREATEST(0, COALESCE(score, 0) + delta)
  WHERE id = uid;
END;
$$;

-- increment_coins: Tangalarni atomik tarzda qo'shish (spend_coins muvaffaqiyatsiz
-- coin_purchases insert'idan keyin rollback qilish uchun ishlatiladi)
CREATE OR REPLACE FUNCTION increment_coins(uid uuid, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET coins = GREATEST(0, COALESCE(coins, 0) + delta)
  WHERE id = uid;
END;
$$;

-- spend_coins: Tangalarni atomik tarzda yechish (read-then-write race'ining oldini oladi)
CREATE OR REPLACE FUNCTION spend_coins(uid uuid, price integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
  SET coins = coins - price
  WHERE id = uid AND COALESCE(coins, 0) >= price
  RETURNING coins INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Tangalar yetarli emas';
  END IF;

  RETURN new_balance;
END;
$$;

-- get_leaderboard: Reyting ro'yxati
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_color text,
  score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.avatar_color,
      COALESCE(p.score, 0)::integer AS score
    FROM profiles p
    ORDER BY COALESCE(p.score, 0) DESC
    LIMIT 50;
END;
$$;

-- complete_duel: Duelni yakunlash
CREATE OR REPLACE FUNCTION complete_duel(p_duel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duel duels%ROWTYPE;
  v_challenger_score integer;
  v_opponent_score integer;
BEGIN
  SELECT * INTO v_duel FROM duels WHERE id = p_duel_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_challenger_score
  FROM habit_logs
  WHERE user_id = v_duel.challenger_id
    AND log_date BETWEEN v_duel.start_date AND v_duel.end_date
    AND completed = true;

  SELECT COUNT(*) INTO v_opponent_score
  FROM habit_logs
  WHERE user_id = v_duel.opponent_id
    AND log_date BETWEEN v_duel.start_date AND v_duel.end_date
    AND completed = true;

  UPDATE duels SET
    status = 'completed',
    winner_id = CASE
      WHEN v_challenger_score > v_opponent_score THEN v_duel.challenger_id
      WHEN v_opponent_score > v_challenger_score THEN v_duel.opponent_id
      ELSE NULL
    END
  WHERE id = p_duel_id;
END;
$$;

-- toggle_user_ban: Foydalanuvchini bloklash/blokdan chiqarish (admin)
CREATE OR REPLACE FUNCTION toggle_user_ban(p_user_id uuid, p_is_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET is_banned = p_is_banned WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Hamma foydalanuvchi o'z ma'lumotlarini ko'rsin va tahrirlaysin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'profiles') THEN
    CREATE POLICY "allow all" ON profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'habits') THEN
    CREATE POLICY "allow all" ON habits FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'habit_logs') THEN
    CREATE POLICY "allow all" ON habit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'groups') THEN
    CREATE POLICY "allow all" ON groups FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'group_members') THEN
    CREATE POLICY "allow all" ON group_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'group_habits') THEN
    CREATE POLICY "allow all" ON group_habits FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'group_habit_logs') THEN
    CREATE POLICY "allow all" ON group_habit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'member_goals') THEN
    CREATE POLICY "allow all" ON member_goals FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'duels') THEN
    CREATE POLICY "allow all" ON duels FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'daily_notes') THEN
    CREATE POLICY "allow all" ON daily_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow all' AND tablename = 'push_subscriptions') THEN
    CREATE POLICY "allow all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Storage: avatars bucket (agar yo'q bo'lsa)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars public read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
