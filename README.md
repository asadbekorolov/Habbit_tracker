# Habbit_tracker

# Traccer — Data-Driven Habit Tracker

> **AI AGENTS / DEVELOPERS:** This README is the single source of truth for the project state. Read it fully before making any changes. Both Claude and Gemini are actively working on this project simultaneously.

## Live URL
**Production:** https://habit-tracker-asadbek.vercel.app

## Project Purpose
A full-featured habit tracking web app built for a university presentation, with plans for:
- Production server deployment
- Monetization (premium features)
- Mobile app (React Native)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite) |
| Styling | Tailwind CSS + CSS variables (no component lib used) |
| Icons | Lucide React |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Deployment | Vercel (auto deploy from local: `npx vercel --prod --yes`) |
| Fonts | Inter (body), Geist Mono (numbers/code) |

---

## Environment Variables

Create `.env.local` in the project root:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

These are already set in Vercel. For local dev, get them from Supabase Dashboard → Project Settings → API.

---

## Local Development

```bash
npm install
npm run dev        # starts on http://localhost:5173
npm run build      # production build
npx vercel --prod --yes  # deploy to production
```

---

## Project File Structure

```
src/
├── app/
│   ├── App.tsx                    # Root component: auth state, routing, header, nav
│   └── components/
│       ├── Dashboard.tsx          # Home tab: hero card, quick toggle, weekly chart, insights
│       ├── HabitsLog.tsx          # Logs tab → "Bugungi" view (check off habits)
│       ├── MonthGrid.tsx          # Logs tab → "Oy Jadvali" (month calendar heatmap)
│       ├── DailyNotes.tsx         # Logs tab → "Eslatmalar" (mood, sleep, screen time diary)
│       ├── HabitsManager.tsx      # Habits tab: add/edit/delete/reorder habits + templates
│       ├── Analytics.tsx          # Analytics tab: KPIs, charts, heatmap, weekly comparison
│       ├── Achievements.tsx       # Achievements tab: level progress + badge collection
│       ├── ProfilePage.tsx        # Profile page: avatar, stats, badges, rank
│       ├── SettingsPage.tsx       # Settings: edit name/avatar, password, daily reminder
│       ├── DuelPage.tsx           # Duel tab: challenge users, accept/reject, scores
│       ├── GlobalLeaderboardPage.tsx  # Leaderboard: top 100 users by score
│       ├── GroupsPage.tsx         # Groups: create/join groups, shared habits (needs SQL)
│       ├── NotificationBell.tsx   # Header bell icon: shows unread notifications
│       ├── LoginPage.tsx          # Auth: login / register / forgot password
│       ├── AdminPanel.tsx         # Admin only: ban users, global notifications, stats
│       ├── Sidebar.tsx            # Desktop sidebar navigation
│       └── ui/                    # shadcn/ui base components (mostly unused — prefer inline styles)
├── lib/
│   ├── supabase.ts                # Supabase client + Profile type
│   ├── db.ts                      # ALL database functions (single file, ~700 lines)
│   └── habitOrder.ts              # localStorage-based habit ordering utility
```

---

## Supabase Database Schema

### Tables (all have RLS enabled)

#### `profiles`
```sql
id uuid PRIMARY KEY REFERENCES auth.users
username text UNIQUE NOT NULL
display_name text NOT NULL
avatar_color text           -- CSS gradient string
avatar_url text             -- Supabase Storage public URL (nullable)
score integer DEFAULT 0     -- XP/score for level system
role text DEFAULT 'user'    -- 'user' | 'admin'
is_banned boolean DEFAULT false
phone text
created_at timestamptz DEFAULT now()
```

#### `habits`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES profiles(id)
name text NOT NULL
emoji text DEFAULT '🌅'
type text NOT NULL           -- 'positive' | 'negative'
is_active boolean DEFAULT true
target_value integer DEFAULT 1   -- for count/time metrics
unit text DEFAULT ''             -- 'bet', 'stakan', 'daqiqa', etc.
created_at timestamptz DEFAULT now()
```

#### `habit_logs`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
habit_id uuid REFERENCES habits(id)
user_id uuid REFERENCES profiles(id)
log_date date NOT NULL
completed boolean DEFAULT false
value integer DEFAULT 1
UNIQUE(habit_id, user_id, log_date)
```

#### `daily_notes`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES profiles(id)
note_date date NOT NULL
content text DEFAULT ''
mood integer                 -- 1-5 scale
sleep_hours numeric(3,1)
screen_hours numeric(3,1)
UNIQUE(user_id, note_date)
```

#### `duels`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
challenger_id uuid REFERENCES profiles(id)
opponent_id uuid REFERENCES profiles(id)
start_date date
end_date date
status text DEFAULT 'pending'   -- 'pending' | 'active' | 'completed' | 'rejected'
challenger_goal text
opponent_goal text
created_at timestamptz DEFAULT now()
```

#### `notifications`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES profiles(id)
title text NOT NULL
body text
is_read boolean DEFAULT false
type text DEFAULT 'info'    -- 'info' | 'duel' | 'achievement'
created_at timestamptz DEFAULT now()
```

#### `groups` (SQL not yet run by user — see PENDING SQL below)
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
admin_id uuid REFERENCES profiles(id)
invite_code text UNIQUE
created_at timestamptz DEFAULT now()
```

#### `group_members`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
group_id uuid REFERENCES groups(id)
user_id uuid REFERENCES profiles(id)
role text DEFAULT 'member'   -- 'admin' | 'member'
UNIQUE(group_id, user_id)
```

#### `group_habits`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
group_id uuid REFERENCES groups(id)
name text NOT NULL
emoji text DEFAULT '🎯'
created_at timestamptz DEFAULT now()
```

#### `group_habit_logs`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
group_habit_id uuid REFERENCES group_habits(id)
group_id uuid REFERENCES groups(id)
user_id uuid REFERENCES profiles(id)
log_date date NOT NULL
completed boolean DEFAULT false
reps integer DEFAULT 1
UNIQUE(group_habit_id, user_id, log_date)
```

---

## SQL Functions (must be run in Supabase SQL Editor)

### ✅ Already working (assumed run):
```sql
-- Atomic score update (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_score(uid uuid, delta integer)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET score = GREATEST(COALESCE(score, 0) + delta, 0)
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql;
```

### ⚠️ MUST RUN — Leaderboard (bypasses RLS to read all profiles):
```sql
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE(id uuid, username text, display_name text, avatar_color text, avatar_url text, score integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_color, p.avatar_url, COALESCE(p.score, 0)
  FROM profiles p
  ORDER BY COALESCE(p.score, 0) DESC
  LIMIT 100;
END;
$$;
```

### ⚠️ MUST RUN — Groups tables (GroupsPage won't work without these):
```sql
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  admin_id uuid REFERENCES profiles(id),
  invite_code text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  role text DEFAULT 'member',
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text DEFAULT '🎯',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_habit_id uuid REFERENCES group_habits(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id),
  user_id uuid REFERENCES profiles(id),
  log_date date NOT NULL,
  completed boolean DEFAULT false,
  reps integer DEFAULT 1,
  UNIQUE(group_habit_id, user_id, log_date)
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_habit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can read group" ON groups FOR SELECT TO authenticated USING (
  id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Anyone can join group" ON group_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members read" ON group_members FOR SELECT TO authenticated USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Members read habits" ON group_habits FOR SELECT TO authenticated USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Members log" ON group_habit_logs FOR ALL TO authenticated USING (user_id = auth.uid());
```

### ⚠️ MUST RUN — Duel auto-complete:
```sql
CREATE OR REPLACE FUNCTION complete_duel(p_duel_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE duels SET status = 'completed' WHERE id = p_duel_id AND status = 'active';
END;
$$;
```

### ⚠️ MUST RUN — Admin functions:
```sql
CREATE OR REPLACE FUNCTION toggle_user_ban(p_user_id uuid, p_is_banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET is_banned = p_is_banned WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION send_global_notification(p_title text, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications(user_id, title, body, type)
  SELECT id, p_title, p_body, 'info' FROM profiles;
END;
$$;
```

---

## Supabase Storage Setup (for avatar upload)

1. Go to Supabase Dashboard → **Storage** → **New bucket**
2. Name: `avatars`, make it **Public**
3. Add policies:
```sql
-- Allow authenticated users to upload
CREATE POLICY "Auth upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow public read
CREATE POLICY "Public read" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Allow users to update/delete their own
CREATE POLICY "Own files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## Score & Level System

Score is stored in `profiles.score`. The `getLevel(score)` function (exported from `App.tsx`) determines level:

| Level | Name | Emoji | Score threshold |
|---|---|---|---|
| 1 | Yangi | 🌱 | 0+ |
| 2 | Izlanuvchi | ⚡ | 50+ |
| 3 | Barqaror | 🔥 | 150+ |
| 4 | Usta | 💎 | 300+ |
| 5 | Chempion | 👑 | 500+ |

**Score rules:**
- +1 when completing a positive habit (`toggleHabitLog` → `increment_score` RPC)
- -1 when un-completing (undo)
- Score never goes below 0 (`GREATEST(..., 0)` in SQL)

---

## Key Implementation Details

### Habit Ordering
- **No SQL column** — order stored in `localStorage` with key `habit_order_{userId}`
- `src/lib/habitOrder.ts` exports: `getHabitOrder`, `setHabitOrder`, `sortByOrder`
- `sortByOrder` is applied in: `Dashboard.tsx`, `HabitsLog.tsx`, `HabitsManager.tsx`

### Habit Metrics (3 types)
- `check` — simple done/not done (target_value=1, unit='')
- `count` — e.g. "8 stakan suv" (target_value=8, unit='stakan')
- `time` — e.g. "30 daqiqa sport" (target_value=30, unit='daqiqa')
- Numeric habits (count/time) cannot be toggled from Dashboard quick-toggle, they redirect to Jurnal

### Dark/Light Mode
- Toggled via `isDark` state in App.tsx
- CSS variables in `index.css`: `--background`, `--foreground`, `--muted-foreground`, `--card`, `--neon-green`, `--coral-red`
- Default: dark mode

### Daily Reminder (Browser Notifications)
- Settings stored in `localStorage` key `notif_{userId}` as `{ enabled: boolean, time: "HH:MM" }`
- Scheduled via `setTimeout` on app load (in App.tsx `useEffect`)
- Uses `completedTodayRef` and `totalHabitsRef` (refs, not state) to read latest values at fire time
- Requires browser Notification API permission

### Smart Insights (Dashboard)
- Calculated in `Dashboard.tsx` useMemo from existing `logs` state — **no extra DB query**
- 3 types: warning (🔥 streak at risk), tip (⚠️ missed days), cheer (🎯 near milestone)
- Max 3 insights shown at once

### Drag & Drop (HabitsManager)
- Uses native HTML5 Drag API — no library
- `dragId`, `dragOverId` state controls visual feedback
- On drop: splice array, call `setHabitOrder` to persist

### Habit Templates
- Defined as constants `TEMPLATES_POS` and `TEMPLATES_NEG` in `HabitsManager.tsx`
- "Shablonlar" button in add form toggles template picker
- Clicking a template calls `applyTemplate(t)` which fills form fields

---

## Features Status

### ✅ Complete & Deployed
- Authentication (login, register, forgot password, email confirm)
- Dashboard (hero progress, smart insights, quick habit toggle, weekly bar chart, active duels)
- Kunlik Jurnal / HabitsLog (check off habits, value input for count/time habits)
- Oy Jadvali / MonthGrid (calendar heatmap of completions)
- Kundalik Eslatmalar / DailyNotes (mood 1-5, sleep hours, screen time, text diary)
- Odatlar / HabitsManager (add/edit/delete habits, drag-to-reorder, habit templates)
- Analytics (KPIs, weekly % chart, 30-day heatmap, per-habit breakdown, PDF export)
- Achievements (level card, 5-level progress, badge collection)
- Profile Page (avatar, stats, global rank, all-time data, earned badges)
- Settings (display name, avatar upload, password change, daily reminder toggle)
- Duel System (challenge by QR/link, accept/reject, live score, auto-complete)
- Global Leaderboard (top 100, podium for top 3, highlights current user)
- Groups (code complete, needs SQL tables run — see PENDING SQL above)
- Notification Bell (header, shows unread count, marks as read)
- Admin Panel (ban/unban users, send global notification, view stats)
- Score system (+1/-1 per habit, atomic via RPC)
- Level/XP system (5 levels, shown in header + achievements)
- Habit ordering via localStorage + drag & drop
- Negative habit UX improvement ("Saqlandi / Buzildi" toggle)
- Level-up toast notification (when score crosses a level threshold)

### 🔄 In Progress
*(none — all previously in-progress items are now complete)*

### ⏳ Planned / Not Started
- Streak milestone celebrations (toast when 7/14/21/30 day streak reached)
- Onboarding flow for new users (guided first-time experience)
- Push notifications via Service Worker (currently only works while page is open)
- Weekly email summary (needs backend/edge function)
- Mobile app (React Native — future phase)
- Paid features / premium tier (future phase)

---

## Navigation Structure

```
App.tsx (root)
├── Sidebar (desktop, left) + Mobile bottom nav
├── Header (greeting, level badge, dark/light toggle, notification bell, progress bar)
└── Main content (tab-based):
    ├── "dashboard"     → Dashboard.tsx
    ├── "logs"          → HabitsLog.tsx / MonthGrid.tsx / DailyNotes.tsx (sub-tabs)
    ├── "habits"        → HabitsManager.tsx
    ├── "analytics"     → Analytics.tsx
    ├── "duel"          → DuelPage.tsx
    ├── "groups"        → GroupsPage.tsx
    ├── "leaderboard"   → GlobalLeaderboardPage.tsx
    ├── "achievements"  → Achievements.tsx
    ├── "profile"       → ProfilePage.tsx
    ├── "settings"      → SettingsPage.tsx
    └── "admin"         → AdminPanel.tsx (role === 'admin' only)
```

---

## Important Conventions

1. **No component library** — all UI is handwritten with inline `style={}` + Tailwind classes. Do NOT introduce shadcn components into main views (the `ui/` folder exists but is unused in features).
2. **CSS variables for theming** — always use `var(--foreground)`, `var(--muted-foreground)`, `var(--neon-green)`, `var(--coral-red)`, `var(--background)`, `var(--card)` instead of hardcoded colors.
3. **Single `db.ts` file** — all Supabase queries go in `src/lib/db.ts`. Do not make inline Supabase calls in components (except `GlobalLeaderboardPage` legacy, already fixed).
4. **Uzbek language** — all user-facing text is in Uzbek. Keep this consistent.
5. **Mobile-first** — sidebar is `hidden md:flex`, bottom nav is `md:hidden`. Test layouts at mobile width.
6. **Optimistic UI** — for habit toggles: update state immediately, then call DB, revert on error.
7. **No external drag library** — HTML5 native Drag API only.
8. **Geist Mono for numbers** — all numeric values (scores, percentages, streaks) use `fontFamily: "'Geist Mono', monospace"`.

---

## Known Issues / Bugs (as of last update: 2026-06-12)

| Issue | Status | Notes |
|---|---|---|
| Groups tab shows empty | Needs SQL | Run the groups SQL block above in Supabase |
| Avatar upload fails | Config needed | Create `avatars` bucket in Supabase Storage (see setup above) |
| Leaderboard empty for some users | Fixed in code | Requires `get_leaderboard()` SQL function to be run |
| `TEMPLATES_POS`/`NEG` declared but not used | ✅ Fixed | Templates UI fully implemented in HabitsManager form |
| `weeklyComparison` declared but not rendered | ✅ Fixed | Weekly Comparison card added to Analytics |
| `setUsername` declared but unused | Minor | `username` field in Settings is read-only by design |

---

## What To Work On Next (Priority Order)

1. **[NEXT]** Streak milestone toasts — when a habit streak reaches 7, 14, 21, or 30 days after toggle, show a celebration toast (similar to `allDoneToast` in App.tsx).

2. **[LATER]** Run the Groups SQL and test GroupsPage end-to-end.

3. **[LATER]** Onboarding flow — first-time user (0 habits) should see a guided modal with habit templates.

---

## Deployment Checklist

Before every deploy:
```bash
npm run build          # must succeed with no errors (warnings OK)
npx vercel --prod --yes
```

The deploy URL alias is always: **https://habit-tracker-asadbek.vercel.app**

---

## Project Owner
- Email: vectorronel21@gmail.com
- Goal: University presentation → production server → mobile app
