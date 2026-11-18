// db/profile.ts — Profil, ochiq profil, yutuqlar.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { PUBLIC_PROFILE_COLUMNS } from './core'
import { getProfileById } from './auth'
import { getAllTimeLogs, getHabits } from './habits'
import { getTelegramContact } from './social'

// ─── PROFILE ───────────────────────────────────────────────
export async function getOrCreateProfile(username: string, displayName: string) {
  // Avval mavjudini qidirish
  const { data: existing } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('username', username)
    .single()

  if (existing) return existing

  // Yangi yaratish
  const { data, error } = await supabase
    .from('profiles')
    .insert({ username, display_name: displayName })
    .select(PUBLIC_PROFILE_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getGlobalStats() {
  const [
    { count: usersCount },
    { count: habitsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('habits').select('*', { count: 'exact', head: true }),
  ]);
  return {
    users: usersCount || 0,
    habits: habitsCount || 0,
  };
}

export async function touchLastSeen() {
  try { await supabase.rpc('touch_last_seen') } catch { /* best-effort, ignore */ }
}

export type AdminMonitoringStats = {
  dau: number
  top_habits: { name: string; completions: number }[]
}

export async function getAdminMonitoringStats(): Promise<AdminMonitoringStats> {
  const { data, error } = await supabase.rpc('get_admin_monitoring_stats')
  if (error) throw error
  return data as AdminMonitoringStats
}

export type InactiveGroup = {
  group_id: string
  group_name: string
  leader_name: string | null
  last_log_date: string | null
}

export async function getInactiveGroups(): Promise<InactiveGroup[]> {
  const { data, error } = await supabase.rpc('get_inactive_groups')
  if (error) throw error
  return data || []
}

export async function adminDeleteGroup(groupId: string) {
  const { error } = await supabase.rpc('admin_delete_group', { p_group_id: groupId })
  if (error) throw error
}

export async function toggleUserBan(userId: string, isBanned: boolean) {
  const { error } = await supabase.rpc('toggle_user_ban', { p_user_id: userId, p_is_banned: isBanned });
  if (error) throw error;
}

// Har bir a'zo uchun samaradorlik foizini BITTA so'rovda oladi (N+1 emas) —
// { user_id: efficiency_pct } shaklidagi lookup jadvaliga aylantirib qaytaradi.
export async function getAdminUsersEfficiency(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_admin_users_efficiency');
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of (data || []) as { user_id: string; efficiency_pct: number }[]) {
    map[row.user_id] = row.efficiency_pct;
  }
  return map;
}

export async function adminGrantBalance(userId: string, coinsDelta: number, scoreDelta: number) {
  const { error } = await supabase.rpc('admin_grant_balance', {
    p_user_id: userId, p_coins_delta: coinsDelta, p_score_delta: scoreDelta,
  });
  if (error) throw error;
}

export async function getUserHabitsAdmin(userId: string) {
  const { data, error } = await supabase
    .from('habits')
    .select('id, name, emoji, type, target_value, unit, is_active, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── PUBLIC PROFILE ─────────────────────────────────────────
export interface PublicProfileStats {
  profile: any
  /** Yopiq profil — raqamlar ko'rsatilmaydi */
  isPrivate: boolean
  totalCompleted: number
  activeDays: number
  bestStreak: number
  currentStreak: number
  habitsCount: number
}

export type EffectiveCosmetics = { active_frame: string | null; username_glow: boolean }

/**
 * Boshqa foydalanuvchilarning amaldagi (muddati o'tmagan) ramka va
 * yaltirashi (057: get_effective_cosmetics). 057 hali qo'llanmagan bo'lsa
 * yoki xato bo'lsa — bo'sh xarita (chaqiruvchi profiles qiymatini ishlatadi).
 */
export async function getEffectiveCosmetics(userIds: string[]): Promise<Map<string, EffectiveCosmetics>> {
  const map = new Map<string, EffectiveCosmetics>()
  const ids = Array.from(new Set(userIds.filter(Boolean))).slice(0, 500)
  if (!ids.length) return map
  const { data, error } = await supabase.rpc('get_effective_cosmetics', { p_user_ids: ids })
  if (error || !Array.isArray(data)) return map
  for (const r of data as { user_id: string; active_frame: string | null; username_glow: boolean }[]) {
    map.set(r.user_id, { active_frame: r.active_frame, username_glow: !!r.username_glow })
  }
  return map
}

/**
 * Ommaviy profil: faqat yig'ma raqamlar (055: get_public_profile_stats).
 * Odatlar va kunlik belgilar hech qachon yuklanmaydi. 055 hali qo'llanmagan
 * bazada (PGRST202) — faqat o'z profilida loglardan hisoblanadi.
 */
export async function getPublicProfileStats(userId: string): Promise<PublicProfileStats> {
  const [baseProfile, tg, rpc, cosmetics] = await Promise.all([
    getProfileById(userId),
    getTelegramContact(userId),
    supabase.rpc('get_public_profile_stats', { p_user_id: userId }),
    getEffectiveCosmetics([userId]),
  ])
  // telegram_username endi to'g'ridan-to'g'ri o'qilmaydi: server faqat ruxsat
  // bo'lsa (o'zi / ochiq / so'rov tasdiqlangan) qaytaradi.
  // Ramka/yaltirash — faqat muddati o'tmaganlari (057), egasi ilovani
  // ochmaguncha profiles jadvalida eski qiymat qolishi mumkin.
  const eff = cosmetics.get(userId)
  const profile = {
    ...baseProfile,
    ...(eff ? { active_frame: eff.active_frame, username_glow: eff.username_glow } : {}),
    telegram_username: tg.username,
    has_telegram: tg.has_telegram,
  }
  const s: any = rpc.error ? null : rpc.data
  if (s) {
    return {
      profile,
      isPrivate: s.private === true,
      totalCompleted: Number(s.total_completed) || 0,
      activeDays: Number(s.active_days) || 0,
      bestStreak: Number(s.best_streak) || 0,
      currentStreak: Number(s.current_streak) || 0,
      habitsCount: Number(s.habits_count) || 0,
    }
  }
  // Eski server: faqat o'z loglarimiz o'qiladi (051) — boshqalar uchun 0
  const [allLogs, habits] = await Promise.all([getAllTimeLogs(userId).catch(() => []), getHabits(userId).catch(() => [])])
  const done = (allLogs || []).filter((l: any) => l.completed)
  const days = [...new Set(done.map((l: any) => l.log_date as string))].sort()
  let best = 0, run = 0, prev = ''
  for (const d of days) {
    run = prev && Date.parse(d) - Date.parse(prev) === 86_400_000 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return {
    profile,
    isPrivate: false,
    totalCompleted: done.length,
    activeDays: days.length,
    bestStreak: best,
    currentStreak: 0,
    habitsCount: (habits || []).length,
  }
}

export async function sendContactRequest(
  fromUserId: string, toUserId: string,
  fromName: string, fromUsername: string
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: toUserId,
    title: "Telegram aloqa so'rovi",
    body: `@${fromUsername} (${fromName}) siz bilan Telegramda aloqa o'rnatmoqchi`,
    type: 'contact_request',
    link: null,
  })
  if (error) throw error
}

// ─── ACHIEVEMENTS ENGINE ───────────────────────────────────────
export type Achievement = {
  id: string
  user_id: string
  achievement_key: string
  icon: string
  unlocked_at: string
}

export async function getAchievements(userId: string): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Har bir habit_log yozuvidan keyin chaqiriladi (fire-and-forget) — server
// haqiqiy streak/izchillikni o'zi tekshiradi, client faqat "tekshirib ko'r"
// deb so'raydi. Yangi ochilgan yutuqlar sarlavhalari qaytariladi (toast
// ko'rsatish uchun); hech narsa yangi bo'lmasa bo'sh massiv.
export async function checkAndUnlockAchievements(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('check_and_unlock_achievements', { p_user_id: userId })
  if (error) throw error
  return (data || []).map((row: any) => row.achievement_key)
}
