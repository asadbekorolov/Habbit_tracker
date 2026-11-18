// db/core.ts — Umumiy: ranglar, sahifalab yuklash, ochiq profil ustunlari.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import type { Profile } from '../supabase'
import { FREE_AVATAR_COLORS } from '../../utils/cosmetics'
import { st } from '../../utils/serviceT'
export { fetchAllPages, PAGE_SIZE } from '../../utils/pagination'

export const HABIT_SUCCESS_COLOR = "#4ADE80"
export const HABIT_FAILURE_COLOR = "#F87171"

export function isHabitLogSuccess(log: { completed: boolean }): boolean {
  return log.completed === true
}

export function getHabitStatusColor(completed: boolean): string {
  return completed ? HABIT_SUCCESS_COLOR : HABIT_FAILURE_COLOR
}

export const AVATAR_COLORS = FREE_AVATAR_COLORS

// Kesh: bu fayl faqat serverdan o'qiydi/yozadi. Yagona kesh — React Query
// (src/services/queryClient.ts + src/hooks/queries.ts), localStorage'ga
// persister orqali saqlanadi.

// ─── SAHIFALAB YUKLASH (PostgREST 1000 qator chegarasi) ────
// fetchAllPages: src/utils/pagination.ts (unit-test qilingan).

/** Analytics va statistikalar uchun ixcham log qatori. */
export type CompactLog = { habit_id: string; log_date: string; completed: boolean; value: number | null }
export const COMPACT_LOG_COLUMNS = 'habit_id, log_date, completed, value'

// ─── PROFIL USTUNLARI (047: shaxsiy ustunlar boshqalarga yopiq) ─────
// profiles jadvalida endi ustun darajasidagi ruxsatlar bor: phone,
// telegram_chat_id, telegram_username, is_admin, is_banned, last_seen_at,
// height_cm, weight_kg, birth_date, birth_year faqat egasiga ochiq va
// faqat get_my_profile() RPC orqali o'qiladi. Shu sabab profiles'dan
// HECH QACHON select('*') qilmang — quyidagi ro'yxatni ishlating.
export const PUBLIC_PROFILE_COLUMNS =
  'id, username, display_name, full_name, avatar_url, avatar_color, bio, score, coins, total_xp, current_level, active_frame, active_title, username_glow, has_star, star_expires_at, profile_private, telegram_private, instagram_username, is_pro, created_at'

// Joriy foydalanuvchining to'liq profili (shaxsiy ustunlar bilan).
export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw error
  return (data as Profile) || null
}

export async function getMyProfileOrThrow(): Promise<Profile> {
  const p = await getMyProfile()
  if (!p) throw new Error(st('svc_profile_not_found'))
  return p
}
