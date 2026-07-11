import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kiwrqzetpyobaemrsquq.supabase.co'
const SUPABASE_KEY = 'sb_publishable_-FM3LPMANMViaqDZ1IW2dw_vYOAJv1z'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Types
export type Profile = {
  id: string
  username: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  phone?: string
  is_admin?: boolean
  score?: number
  coins?: number
  total_xp?: number
  current_level?: number
  is_banned?: boolean
  is_pro?: boolean
  bio?: string | null
  telegram_username?: string | null
  instagram_username?: string | null
  telegram_private?: boolean
  profile_private?: boolean
  telegram_chat_id?: number | null
  has_star?: boolean
  star_expires_at?: string | null
  last_seen_at?: string | null
  created_at: string
}

export type Habit = {
  id: string
  user_id: string
  name: string
  emoji: string
  type: 'positive' | 'negative'
  target_value?: number
  unit?: string
  scheduled_start?: string | null
  scheduled_end?: string | null
  is_active: boolean
  created_at: string
}

export type HabitLog = {
  id: string
  habit_id: string
  user_id: string
  log_date: string
  completed: boolean
  value: number
}

export type Group = {
  id: string
  name: string
  invite_code: string
  admin_id: string
  created_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
}

export type GroupHabit = {
  id: string
  group_id: string
  name: string
  emoji: string
  created_at: string
}

export type MemberGoal = {
  id: string
  group_habit_id: string
  user_id: string
  group_id: string
  initial_target: number
  current_target: number
  review_interval_days: number
  last_reviewed: string
}

