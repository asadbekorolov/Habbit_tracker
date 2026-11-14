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
export async function getPublicProfileStats(userId: string) {
  const [baseProfile, allLogs, habits, tg] = await Promise.all([
    getProfileById(userId),
    getAllTimeLogs(userId),
    getHabits(userId),
    getTelegramContact(userId),
  ])
  // telegram_username endi to'g'ridan-to'g'ri o'qilmaydi: server faqat ruxsat
  // bo'lsa (o'zi / ochiq / so'rov tasdiqlangan) qaytaradi.
  const profile = { ...baseProfile, telegram_username: tg.username, has_telegram: tg.has_telegram }
  const totalCompleted = (allLogs || []).filter((l: any) => l.habits?.type === 'positive').length
  return { profile, totalCompleted, habitsCount: (habits || []).length }
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
