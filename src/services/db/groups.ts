// db/groups.ts — Guruhlar, guruh odatlari, maqsadlar, guruh reytingi, kichik jamoalar, Telegram havolasi.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { publicName } from '../../utils/publicName'
import { tashkentTodayAnchor, toDateStr } from '../../utils/date'
import { st } from '../../utils/serviceT'
import { PUBLIC_PROFILE_COLUMNS } from './core'
import { isStarActive } from './shop'

// ─── GROUPS ────────────────────────────────────────────────
export async function createGroup(name: string, adminId: string) {
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
  const { data, error } = await supabase
    .from('groups')
    .insert({ name, admin_id: adminId, invite_code: inviteCode })
    .select()
    .single()
  if (error) throw error

  const { error: memberErr } = await supabase.from('group_members').insert({
    group_id: data.id,
    user_id: adminId,
    role: 'admin',
  })
  if (memberErr) {
    // A'zolik yozuvi muvaffaqiyatsiz bo'lsa, egasiz ("a'zosiz") guruh
    // qolib ketmasligi uchun endigina yaratilgan guruhni orqaga qaytaramiz
    await supabase.from('groups').delete().eq('id', data.id)
    throw memberErr
  }

  return data
}

export async function joinGroup(inviteCode: string, userId: string) {
  const { data: group, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()
  if (gErr) throw new Error(st('svc_group_not_found'))

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, role: 'member' })
  if (error) {
    if (error.code === '23505') throw new Error(st('svc_group_already_member'))
    throw new Error(error.message || st('svc_group_join_error'))
  }

  return group
}

// Oddiy a'zo darhol chiqadi. Asosiy sardor uchun: yagona a'zo bo'lsa guruh
// butunlay o'chadi, aks holda server 'owner_must_transfer' xatosini
// qaytaradi — avval Egalikni topshirish kerak.
export async function leaveGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_group', { p_group_id: groupId })
  if (error) throw error
}

// Sardor yoki co-admin chaqira oladi; asosiy sardorni chiqarib bo'lmaydi
// (serverda tekshiriladi).
export async function kickMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('kick_member', { p_group_id: groupId, p_user_id: userId })
  if (error) throw error
}

// Faqat asosiy sardor chaqira oladi — guruhni butunlay o'chiradi (barcha
// odatlar, loglar, a'zolik yozuvlari kaskad orqali tozalanadi).
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_group', { p_group_id: groupId })
  if (error) throw error
}

// Faqat asosiy sardor: biror a'zoni co-admin qiladi yoki co-admin
// huquqini olib tashlaydi.
export async function setGroupMemberRole(groupId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase.rpc('set_group_member_role', { p_group_id: groupId, p_user_id: userId, p_role: role })
  if (error) throw error
}

// Faqat asosiy sardor: guruh egaligini boshqa a'zoga to'liq topshiradi
// (groups.admin_id o'zgaradi, yangi egaga avtomatik co-admin roli beriladi).
export async function transferGroupOwnership(groupId: string, newOwnerId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_group_ownership', { p_group_id: groupId, p_new_owner_id: newOwnerId })
  if (error) throw error
}

export async function getMyGroups(userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, groups(*, admin_profile:profiles!admin_id(id, display_name, username, avatar_url, avatar_color, telegram_private))')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select(`*, profiles(${PUBLIC_PROFILE_COLUMNS})`)
    .eq('group_id', groupId)
  if (error) throw error
  return data
}

// ─── MEMBER GOALS (Adaptiv ball tizimi) ───────────────────
export async function setMemberGoal(
  groupHabitId: string,
  userId: string,
  groupId: string,
  target: number,
  intervalDays = 10
) {
  const { data, error } = await supabase
    .from('member_goals')
    .upsert({
      group_habit_id: groupHabitId,
      user_id: userId,
      group_id: groupId,
      initial_target: target,
      current_target: target,
      review_interval_days: intervalDays,
    }, { onConflict: 'group_habit_id,user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMemberGoals(groupId: string) {
  const { data, error } = await supabase
    .from('member_goals')
    .select('*, profiles(display_name, full_name, username), group_habits(name, emoji)')
    .eq('group_id', groupId)
  if (error) throw error
  return data
}

// ─── GROUP LEADERBOARD ─────────────────────────────────────
export async function getGroupLeaderboard(groupId: string) {
  const members = await getGroupMembers(groupId)
  const { data: logs } = await supabase
    .from('group_habit_logs')
    .select('*, member_goals(current_target)')
    .eq('group_id', groupId)

  const scores: Record<string, { name: string; color: string; avatarUrl: string | null; score: number; completed: number; hasStar: boolean }> = {}

  for (const m of members) {
    scores[m.user_id] = {
      name: publicName(m.profiles),
      color: m.profiles.avatar_color,
      avatarUrl: m.profiles.avatar_url,
      score: 0,
      completed: 0,
      hasStar: isStarActive(m.profiles),
    }
  }

  for (const log of (logs || [])) {
    if (!log.completed || !scores[log.user_id]) continue
    if (log.approval_status && log.approval_status !== 'approved' && log.approval_status !== 'auto') continue
    scores[log.user_id].completed++

    // Adaptiv ball: bajargan / maqsad × 100
    const target = log.member_goals?.current_target || 1
    const points = Math.min(100, Math.round((log.reps / target) * 100))
    scores[log.user_id].score += points
  }

  return Object.entries(scores)
    .map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.score - a.score)
}

// Joriy hafta (Dushanba-Yakshanba) uchun jonli reyting — getGroupLeaderboard
// bilan bir xil mantiq, faqat log_date shu haftaga cheklangan. Tanga
// berilmaydi (faqat ko'rish uchun) — mukofot faqat settleGroupWeek() orqali,
// hafta TUGAGANDA beriladi.
export async function getGroupWeeklyLeaderboard(groupId: string) {
  const now = tashkentTodayAnchor()
  const day = (now.getDay() + 6) % 7 // 0=Dushanba
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - day)
  const weekStartStr = toDateStr(weekStart)

  const members = await getGroupMembers(groupId)
  const { data: logs } = await supabase
    .from('group_habit_logs')
    .select('*, member_goals(current_target)')
    .eq('group_id', groupId)
    .gte('log_date', weekStartStr)

  const scores: Record<string, { name: string; color: string; avatarUrl: string | null; score: number; completed: number; hasStar: boolean }> = {}

  for (const m of members) {
    scores[m.user_id] = {
      name: m.profiles.display_name,
      color: m.profiles.avatar_color,
      avatarUrl: m.profiles.avatar_url,
      score: 0,
      completed: 0,
      hasStar: isStarActive(m.profiles),
    }
  }

  for (const log of (logs || [])) {
    if (!log.completed || !scores[log.user_id]) continue
    if (log.approval_status && log.approval_status !== 'approved' && log.approval_status !== 'auto') continue
    scores[log.user_id].completed++
    const target = log.member_goals?.current_target || 1
    const points = Math.min(100, Math.round((log.reps / target) * 100))
    scores[log.user_id].score += points
  }

  return Object.entries(scores)
    .map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.score - a.score)
}

export type GroupWeekWinner = { user_id: string; display_name: string; score: number; reward: number; already_settled: boolean }

// O'tgan (tugagan) haftaning g'olibini hisoblab, hali yozilmagan bo'lsa
// bonus tanga beradi — a'zo guruh sahifasini ochganda chaqiriladi (cron
// shart emas, cleanup_expired_frame() bilan bir xil o'z-o'zini tuzatish
// naqshi). Hech kim faol bo'lmagan hafta uchun null qaytaradi.
export async function settleGroupWeek(groupId: string): Promise<GroupWeekWinner | null> {
  const { data, error } = await supabase.rpc('settle_group_week', { p_group_id: groupId })
  if (error) return null
  return (data && data[0]) || null
}

// ─── GROUP LOGS ────────────────────────────────────────────
// log_group_habit RPC orqali — oddiy upsert emas, chunki approval_status
// ustuniga to'g'ridan-to'g'ri yozish (003-migratsiyadagi xavfsizlik
// GRANT'i tufayli) faqat INSERT'da ishlaydi, EDIT/qayta yuborishda
// "permission denied" beradi. RPC serverda auth.uid()ni tekshirib, har
// safar approval_status'ni 'pending'ga qaytaradi (qayta ko'rib chiqish).
export async function logGroupHabit(
  groupHabitId: string,
  groupId: string,
  _userId: string,
  completed: boolean,
  reps = 1,
  proofNote?: string
) {
  const today = toDateStr()
  const { data, error } = await supabase.rpc('log_group_habit', {
    p_group_habit_id: groupHabitId,
    p_group_id: groupId,
    p_log_date: today,
    p_completed: completed,
    p_reps: reps,
    p_proof_note: proofNote || null,
  })
  if (error) throw error
  return data
}

export async function getTodayGroupLogs(groupId: string, userId: string) {
  const today = toDateStr()
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('log_date', today)
  if (error) throw error
  return data
}

export async function getPendingGroupApprovals(groupId: string) {
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('*, profiles!user_id(display_name, full_name, avatar_color, avatar_url, username), group_habits(name, emoji)')
    .eq('group_id', groupId)
    .eq('approval_status', 'pending')
    .eq('completed', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ─── GROUP TELEGRAM LINK ──────────────────────────────────────
export async function updateGroupTelegramLink(groupId: string, link: string | null) {
  const { error } = await supabase
    .from('groups')
    .update({ telegram_link: link })
    .eq('id', groupId)
  if (error) throw error
}

// ─── GROUP SUBTEAMS ───────────────────────────────────────────
export async function getGroupSubteams(groupId: string) {
  const { data, error } = await supabase
    .from('group_subteams')
    .select(`id, name, emoji, created_by, created_at,
      group_subteam_members(user_id, profiles(id, display_name, full_name, avatar_color, avatar_url, username))`)
    .eq('group_id', groupId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createSubteam(groupId: string, name: string, emoji: string, createdBy: string) {
  const { data, error } = await supabase
    .from('group_subteams')
    .insert({ group_id: groupId, name, emoji, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addSubteamMember(subteamId: string, userId: string) {
  const { error } = await supabase
    .from('group_subteam_members')
    .insert({ subteam_id: subteamId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function removeSubteamMember(subteamId: string, userId: string) {
  const { error } = await supabase
    .from('group_subteam_members')
    .delete()
    .eq('subteam_id', subteamId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteSubteam(subteamId: string) {
  const { error } = await supabase
    .from('group_subteams')
    .delete()
    .eq('id', subteamId)
  if (error) throw error
}
