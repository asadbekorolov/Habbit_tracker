import { supabase } from './supabase'
import type { Profile } from './supabase'
import { toDateStr } from '../utils/date'

const AVATAR_COLORS = [
  "linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)",
  "linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #F87171 0%, #EF4444 100%)",
  "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
  "linear-gradient(135deg, #34D399 0%, #059669 100%)",
]

// ─── AUTH ──────────────────────────────────────────────────
export async function signInUser(email: string, password: string): Promise<Profile> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()
  if (error) throw error

  if (data.is_banned) {
    await supabase.auth.signOut();
    throw new Error("Sizning akkauntingiz ma'muriyat tomonidan bloklangan.");
  }

  return data
}

export async function resetUserPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
  if (error) throw error;
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// Ro'yxatdan o'tish endi to'g'ridan-to'g'ri emailga 6 xonali kod
// yuborishdan boshlanadi (avvalgi telefon-SMS OTP oqimi bilan bir xil
// shakl) — parol faqat kod tasdiqlangandan keyin o'rnatiladi, shuning
// uchun tasdiqlanmagan email bilan hech qachon ishlaydigan akkaunt
// yaratilmaydi.
export async function sendEmailOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyEmailOtpAndCreateAccount(
  email: string,
  token: string,
  password: string,
  displayName: string,
  username: string
): Promise<Profile> {
  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) throw new Error("Bu username allaqachon band. Iltimos, boshqasini tanlang");

  const { error: otpError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (otpError) throw otpError;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Foydalanuvchi topilmadi");

  // Agar bu email allaqachon ro'yxatdan o'tgan bo'lsa, signInWithOtp uni
  // shunchaki tizimga kiritadi (login sifatida) — profil borligini
  // tekshirmasak, "ro'yxatdan o'tish" oqimi uning mavjud parolini
  // qayta yozib yuborishi mumkin edi.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (existingProfile) {
    await supabase.auth.signOut();
    throw new Error("Bu email allaqachon ro'yxatdan o'tgan — Kirish tabiga o'ting");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw updateError;

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username, display_name: displayName, avatar_color: color })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

export async function updateUserPassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  await supabase.auth.signOut()
}

export async function getProfileById(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateUserProfile(
  userId: string,
  updates: {
    display_name?: string; username?: string; avatar_url?: string | null;
    bio?: string | null; telegram_username?: string | null;
    instagram_username?: string | null; telegram_private?: boolean;
    profile_private?: boolean;
  }
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("Rasm hajmi 2MB dan oshmasligi kerak")
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext))
    throw new Error("Faqat JPG, PNG yoki WebP formatdagi rasmlar qabul qilinadi")

  const fileName = `${userId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })

  if (uploadError) {
    const msg = (uploadError.message || '').toLowerCase()
    if (msg.includes('bucket') || msg.includes('not found'))
      throw new Error("'avatars' storage bucket topilmadi. Supabase Dashboard → Storage → New Bucket: \"avatars\" (Public: ✓)")
    if (msg.includes('policy') || msg.includes('permission') || msg.includes('unauthorized') || msg.includes('403'))
      throw new Error("Storage ruxsati yo'q. Supabase Dashboard → Storage → avatars → Policies da INSERT ruxsatini bering.")
    throw new Error("Yuklashda xatolik: " + uploadError.message)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
  return data.publicUrl
}

// ─── PROFILE ───────────────────────────────────────────────
export async function getOrCreateProfile(username: string, displayName: string) {
  // Avval mavjudini qidirish
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (existing) return existing

  // Yangi yaratish
  const { data, error } = await supabase
    .from('profiles')
    .insert({ username, display_name: displayName })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getGlobalStats() {
  const [
    { count: usersCount },
    { count: habitsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
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

// ─── USER FEEDBACK ──────────────────────────────────────────
export async function submitFeedback(userId: string, content: string) {
  const { error } = await supabase.from('user_feedback').insert({ user_id: userId, content });
  if (error) throw error;
}

export type FeedbackEntry = {
  id: string
  user_id: string
  content: string
  created_at: string
  display_name: string
  username: string
}

export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase.rpc('get_all_feedback');
  if (error) throw error;
  return data || [];
}

// ─── ADMIN — ALL HABITS (CSV export analysis) ───────────────
export type AdminHabitEntry = {
  id: string
  user_id: string
  name: string
  emoji: string
  type: 'positive' | 'negative'
  target_value: number | null
  unit: string | null
  is_active: boolean
  created_at: string
  profiles: { display_name: string; username: string } | null
}

export async function getAllHabitsAdmin(): Promise<AdminHabitEntry[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('id, user_id, name, emoji, type, target_value, unit, is_active, created_at, profiles(display_name, username)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AdminHabitEntry[];
}

// ─── ADMIN — ANALYTICS SUMMARY ───────────────────────────────
export type AnalyticsSummaryRow = {
  event_name: string
  total_count: number
  unique_users: number
  unique_sessions: number
}

export async function getAnalyticsSummary(days = 30): Promise<AnalyticsSummaryRow[]> {
  const { data, error } = await supabase.rpc('get_analytics_summary', { p_days: days });
  if (error) throw error;
  return data || [];
}

export async function resetAllData() {
  const { error } = await supabase.rpc('reset_all_data');
  if (error) throw error;
}

export async function sendGlobalNotification(title: string, body: string) {
  const { error } = await supabase.rpc('send_global_notification', { p_title: title, p_body: body });
  if (error) throw error;
}

// ─── HABITS ────────────────────────────────────────────────
export async function getHabits(userId: string) {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addHabit(
  userId: string,
  name: string,
  emoji: string,
  type: 'positive' | 'negative',
  target_value: number = 1,
  unit: string = '',
  scheduledStart?: string,
  scheduledEnd?: string
) {
  const baseData: Record<string, unknown> = { user_id: userId, name, emoji, type };
  if (target_value > 1 || unit) {
    baseData.target_value = target_value;
    baseData.unit = unit;
  }
  if (scheduledStart) baseData.scheduled_start = scheduledStart;
  if (scheduledEnd) baseData.scheduled_end = scheduledEnd;

  const { data, error } = await supabase
    .from('habits')
    .insert(baseData)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHabit(
  habitId: string,
  updates: { name?: string; emoji?: string; target_value?: number; unit?: string; scheduled_start?: string | null; scheduled_end?: string | null }
) {
  const { data, error } = await supabase
    .from('habits')
    .update(updates)
    .eq('id', habitId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHabit(habitId: string) {
  const { error } = await supabase
    .from('habits')
    .update({ is_active: false })
    .eq('id', habitId)
  if (error) throw error
}

// ─── HABIT LOGS ────────────────────────────────────────────
export async function getTodayLogs(userId: string) {
  const today = toDateStr()
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', today)
  if (error) throw error
  return data
}

export async function getLogsForDate(userId: string, date: string) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
  if (error) throw error
  return data
}

export async function toggleHabitLog(
  habitId: string,
  userId: string,
  completed: boolean,
  value: number = 1,
  prevCompleted?: boolean,
  isNegative: boolean = false,
  date?: string
) {
  const today = toDateStr()
  const logDate = date || today
  if (isLogDateLocked(logDate)) throw new Error(LOG_LOCKED_MESSAGE)
  const { data, error } = await supabase
    .from('habit_logs')
    .upsert({
      habit_id: habitId,
      user_id: userId,
      log_date: logDate,
      completed,
      value,
    }, { onConflict: 'habit_id,user_id,log_date' })
    .select()
    .single()
  if (error) throw error

  // Score + Coins: faqat bugungi ijobiy odatlar uchun +1/-1 (kunlik, ikki
  // tomonlama qaytariladigan reyting hisoblagichi — mavjud leaderboard/getLevel
  // tizimi shunga tayanadi)
  if (!isNegative && logDate === today && prevCompleted !== undefined && prevCompleted !== completed) {
    const delta = completed ? 1 : -1
    try { await supabase.rpc('increment_score', { uid: userId, delta }) } catch { /* server-side tekshiruv rad etsa, jim o'tkazamiz */ }
    try { await supabase.rpc('increment_coins', { uid: userId, delta }) } catch {}
  }

  // XP + Daraja: umr bo'yi, qaytarilmaydigan progress hisoblagichi (kelajakdagi
  // avatar tizimi uchun). Faqat bajarilgan (completed=true) holatda, server
  // habit_logs'ni o'zi tekshirib mukofot beradi — client XP miqdorini
  // to'g'ridan-to'g'ri belgilay olmaydi.
  if (!isNegative && logDate === today && completed && prevCompleted !== completed) {
    try { await addXpToUser(habitId) } catch { /* allaqachon berilgan yoki tasdiqlanmagan bo'lishi mumkin */ }
  }

  return data
}

// Kunlik Jurnal — qat'iy qulflash: har bir kun uchun belgilash/o'zgartirish
// oynasi shu kun 00:00'dan ertasi kuni soat 09:00'gacha ochiq (masalan
// "Uyqu" kabi kechayarimdan keyin tugaydigan odatlar uchun ham yetarli
// muhlat qoldiradi). Bu muddat o'tgach — hatto allaqachon belgilangan
// yozuv bo'lsa ham — kun butunlay qulflanadi: yangi belgilash, mavjud
// belgini bekor qilish yoki qiymatini o'zgartirish endi mumkin emas. Bu
// sof vaqt matematikasi (serverda cron yoki avtomatik yozuv shart emas)
// va universal — barcha odat turlariga (vaqtli/vaqtsiz/musbat/salbiy)
// bab-baravar qo'llaniladi, faqat sanaga bog'liq.
const LOCK_GRACE_HOUR = 9
export const LOG_LOCKED_MESSAGE = "Bu kun uchun belgilash muddati tugagan (ertasi kuni soat 09:00 gacha ochiq edi)."

export function isLogDateLocked(dateStr: string, now: Date = new Date()): boolean {
  const windowStart = new Date(dateStr + 'T00:00:00')
  const windowEnd = new Date(windowStart)
  windowEnd.setDate(windowEnd.getDate() + 1)
  windowEnd.setHours(LOCK_GRACE_HOUR, 0, 0, 0)
  return !(now >= windowStart && now < windowEnd)
}

// "Kutilmoqda" holatiga qaytarish (log qatorini o'chirish) — toggleHabitLog
// bilan bir xil qulflash tekshiruvidan o'tadi, shuning uchun HabitsLog.tsx
// endi bevosita supabase.from('habit_logs').delete() chaqirmaydi.
export async function deleteHabitLog(habitId: string, userId: string, date: string) {
  if (isLogDateLocked(date)) throw new Error(LOG_LOCKED_MESSAGE)
  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .eq('log_date', date)
  if (error) throw error
}

// Kunlik progress hisob-kitobi — YAGONA MANBA. App.tsx (login'da boshlang'ich
// hisoblash), Dashboard.tsx va HabitsLog.tsx bu formula orqali umumiy
// header foizini (completedToday/totalHabits) hisoblaydi. Avval har biri
// o'zicha (faqat musbat odatlar bo'yicha) hisoblardi — salbiy odatlar
// (masalan "chekmaslik") umuman hisobga olinmasdi, shuning uchun ular hali
// "hal qilinmagan" bo'lsa ham progress 100% ko'rsatishi mumkin edi.
// Qoida: musbat odat — bajarilgan (completed=true) bo'lsa hisoblanadi;
// salbiy odat — "saqlanib qolingan" (log yozuvi bor, lekin completed=false,
// ya'ni "buzilmagan") bo'lsa hisoblanadi.
export function computeHabitProgress(
  habits: { id: string; type: string }[],
  logs: { habit_id: string; completed: boolean }[]
): { completed: number; total: number } {
  const completedSet = new Set<string>()
  const loggedSet = new Set<string>()
  for (const l of logs) {
    loggedSet.add(l.habit_id)
    if (l.completed) completedSet.add(l.habit_id)
  }
  let completed = 0
  let total = 0
  for (const h of habits) {
    if (h.type === 'positive') {
      total++
      if (completedSet.has(h.id)) completed++
    } else if (h.type === 'negative') {
      total++
      if (loggedSet.has(h.id) && !completedSet.has(h.id)) completed++
    }
  }
  return { completed, total }
}

export type XpResult = { total_xp: number; level: number; xp_gained: number }

export async function addXpToUser(habitId: string, xpAmount = 10): Promise<XpResult> {
  const { data, error } = await supabase.rpc('add_xp_to_user', { p_habit_id: habitId, p_xp_amount: xpAmount })
  if (error) throw error
  return data as XpResult
}

export async function getMonthLogs(userId: string, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, completed')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to)
  if (error) throw error
  return data
}

export type LeaderboardEntry = {
  id: string
  username: string
  display_label: string
  avatar_color: string
  avatar_url: string | null
  score: number
  is_private: boolean
  has_star: boolean
}

// Anonimlashtirilgan reyting: RPC har doim "Ism + Familiya bosh harfi"
// (masalan, "Asadbek O.") formatidagi display_label qaytaradi — xom
// display_name (to'liq F.I.Sh.) client'ga hech qachon kelmaydi. Shu sababli
// bu yerda profiles jadvalidan to'g'ridan-to'g'ri o'qishga qaytadigan
// fallback yo'q — bunday fallback anonimlikni chetlab o'tgan bo'lardi.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard')
  if (error) throw error
  return data || []
}

export async function getUserRank(userId: string): Promise<number> {
  const { data } = await supabase
    .from('profiles')
    .select('id, score')
    .order('score', { ascending: false })
  if (!data) return 0
  const idx = data.findIndex((p) => p.id === userId)
  return idx >= 0 ? idx + 1 : 0
}

export async function getAllTimeLogs(userId: string) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, completed, habits(type)')
    .eq('user_id', userId)
    .eq('completed', true)
  if (error) throw error
  return data
}

export async function getLast30DaysLogs(userId: string) {
  const from = new Date()
  from.setDate(from.getDate() - 30)
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*, habits(name, emoji, type)')
    .eq('user_id', userId)
    .gte('log_date', toDateStr(from))
    .order('log_date', { ascending: false })
  if (error) throw error
  return data
}

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
  if (gErr) throw new Error("Guruh topilmadi. Invite kod noto'g'ri.")

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, role: 'member' })
  if (error) {
    if (error.code === '23505') throw new Error('Siz allaqachon bu guruhdasiz.')
    throw new Error(error.message || "Guruhga qo'shilishda xatolik yuz berdi.")
  }

  return group
}

export async function getMyGroups(userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, groups(*, admin_profile:profiles!admin_id(id, display_name, username, avatar_url, avatar_color, telegram_username, telegram_private))')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profiles(*)')
    .eq('group_id', groupId)
  if (error) throw error
  return data
}

// ─── GROUP HABITS ──────────────────────────────────────────
export async function getGroupHabits(groupId: string) {
  const { data, error } = await supabase
    .from('group_habits')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addGroupHabit(
  groupId: string,
  name: string,
  emoji: string,
  type: 'positive' | 'negative' = 'positive',
  targetValue: number = 1,
  unit: string = ''
) {
  const { data, error } = await supabase
    .from('group_habits')
    .insert({ group_id: groupId, name, emoji, type, target_value: targetValue, unit })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGroupHabit(habitId: string) {
  const { error } = await supabase
    .from('group_habits')
    .delete()
    .eq('id', habitId)
  if (error) throw error
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
    .select('*, profiles(display_name), group_habits(name, emoji)')
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

  const scores: Record<string, { name: string; color: string; score: number; completed: number; hasStar: boolean }> = {}

  for (const m of members) {
    scores[m.user_id] = {
      name: m.profiles.display_name,
      color: m.profiles.avatar_color,
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


// ─── GROUP LOGS ────────────────────────────────────────────
export async function logGroupHabit(
  groupHabitId: string,
  groupId: string,
  userId: string,
  completed: boolean,
  reps = 1,
  proofNote?: string
) {
  const today = toDateStr()
  const { data, error } = await supabase
    .from('group_habit_logs')
    .upsert({
      group_habit_id: groupHabitId,
      group_id: groupId,
      user_id: userId,
      log_date: today,
      completed,
      reps,
      proof_note: proofNote || null,
      approval_status: 'pending',
    }, { onConflict: 'group_habit_id,user_id,log_date' })
    .select()
    .single()
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
    .select('*, profiles(display_name, avatar_color, avatar_url, username), group_habits(name, emoji)')
    .eq('group_id', groupId)
    .eq('approval_status', 'pending')
    .eq('completed', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ─── ADMIN MODERATION (barcha guruhlar bo'yicha) ────────────
export async function getAllPendingApprovals() {
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('*, profiles(display_name, avatar_color, avatar_url, username), group_habits(name, emoji), groups(name)')
    .eq('approval_status', 'pending')
    .eq('completed', true)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data || []
}

export async function getRecentRejections(limitCount = 30) {
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('*, profiles(display_name, avatar_color, avatar_url, username), group_habits(name, emoji), groups(name)')
    .eq('approval_status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(limitCount)
  if (error) throw error
  return data || []
}

export async function approveGroupLog(logId: string) {
  // approve_group_log RPC serverda auth.uid()ni guruhning haqiqiy admin_id'si
  // bilan solishtiradi — klient endi "men adminman" deb da'vo qila olmaydi.
  const { error } = await supabase.rpc('approve_group_log', { p_log_id: logId })
  if (error) throw error
}

export async function rejectGroupLog(logId: string, reason: string) {
  const { error } = await supabase.rpc('reject_group_log', { p_log_id: logId, p_reason: reason })
  if (error) throw error
}

export async function getGroupMembersMonthlyStats(groupId: string) {
  const now = new Date()
  const firstDay = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('user_id, log_date, approval_status, completed, profiles(display_name, avatar_color)')
    .eq('group_id', groupId)
    .gte('log_date', firstDay)
    .order('log_date')
  if (error) throw error
  return data || []
}

// ─── DAILY NOTES ────────────────────────────────────────────
export async function getDailyNote(userId: string, date: string) {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('note_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertDailyNote(userId: string, date: string, content: string, mood?: number) {
  // Uyqu/ekran vaqti endi shu yerda saqlanmaydi — yagona manba health_logs
  // (upsertHealthLog), HealthPage va DailyNotes ikkalasi ham o'shandan
  // o'qiydi/yozadi, aks holda ikki joyda ikki xil qiymat ko'rinib qolardi.
  const { data, error } = await supabase
    .from('daily_notes')
    .upsert(
      { user_id: userId, note_date: date, content, mood },
      { onConflict: 'user_id,note_date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMonthNotes(userId: string, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('daily_notes')
    .select('note_date, content, mood, sleep_hours, screen_hours')
    .eq('user_id', userId)
    .gte('note_date', from)
    .lte('note_date', to)
  if (error) throw error
  return data
}

// ─── WEEKLY REFLECTION ─────────────────────────────────────
export async function getWeeklyReflection(userId: string, weekStart: string) {
  const { data } = await supabase
    .from('weekly_reflections')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()
  return data
}

export async function upsertWeeklyReflection(
  userId: string,
  weekStart: string,
  wentWell: string,
  improveNext: string
) {
  const { data, error } = await supabase
    .from('weekly_reflections')
    .upsert({
      user_id: userId,
      week_start: weekStart,
      went_well: wentWell,
      improve_next: improveNext,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── AI COACH NOTE (cached, generated on-demand via api/ai-coach.ts) ──
export type CoachNote = { note: string; generated_at: string }

export async function getCoachNote(userId: string): Promise<CoachNote | null> {
  const { data, error } = await supabase
    .from('ai_coach_notes')
    .select('note, generated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertCoachNote(userId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('ai_coach_notes')
    .upsert({ user_id: userId, note, generated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}

// ─── AI ANALYSIS — COIN-GATED ────────────────────────────────
// Har bir AI tahlil (Coach Note) generatsiyasi 50 tanga turadi — bu
// api/ai-coach.ts orqali sarflanadigan haqiqiy LLM chaqiruvi xarajatini
// cheklaydi. spend_coins RPC (setup.sql/006_xp_leveling.sql) allaqachon
// bitta atomik UPDATE ichida balansni tekshirib yechadi — xuddi
// purchaseCoinItem'da ishlatilgani kabi — shu bilan ikkita bir vaqtdagi
// so'rov (double-tap, 2 tab) bir xil boshlang'ich balansni o'qib,
// bir-birini bosib ketishining oldini oladi.
export const AI_ANALYSIS_COST = 50

export async function spendCoinsForAnalysis(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('spend_coins', { uid: userId, price: AI_ANALYSIS_COST })
  return !error
}

// AI chaqiruvi texnik sababdan (tarmoq, API xatosi, "not_configured" va h.k.)
// muvaffaqiyatsiz bo'lsa, foydalanuvchi tangasini abadiy yo'qotmasligi
// uchun — purchaseCoinItem'dagi refund naqshiga mos.
export async function refundAnalysisCoins(userId: string): Promise<void> {
  try { await supabase.rpc('increment_coins', { uid: userId, delta: AI_ANALYSIS_COST }) } catch { /* best-effort */ }
}

// ─── PUSH NOTIFICATIONS ────────────────────────────────────
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("Bu brauzer Push xabarlarni qo'llab-quvvatlamaydi");
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error("Bildirishnomalarga ruxsat berilmadi");
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY; 
  if (!publicVapidKey) {
    throw new Error("VAPID kaliti (VITE_VAPID_PUBLIC_KEY) topilmadi");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
  });

  const subJson = subscription.toJSON();

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys?.p256dh,
    auth: subJson.keys?.auth
  }, { onConflict: 'endpoint' });

  if (error) throw error;
}

// ─── PUBLIC PROFILE ─────────────────────────────────────────
export async function getPublicProfileStats(userId: string) {
  const [profile, allLogs, habits] = await Promise.all([
    getProfileById(userId),
    getAllTimeLogs(userId),
    getHabits(userId),
  ])
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

// ─── FOLLOW SYSTEM ───────────────────────────────────────────
export async function followUser(followerId: string, followingId: string, followerName = '') {
  const { error } = await supabase
    .from('followers')
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' })
  if (error) throw error
  supabase.from('notifications').insert({
    user_id: followingId,
    title: '👥 Yangi kuzatuvchi!',
    body: `${followerName || 'Foydalanuvchi'} sizi kuzatishni boshladi`,
    type: 'follow',
    link: 'profile',
  }).then(() => {})
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
}

export async function checkFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('followers')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return !!data
}

export async function getFollowCounts(userId: string) {
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase.from('followers').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('followers').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followersCount || 0, following: followingCount || 0 }
}

export async function getFollowersList(userId: string) {
  const { data, error } = await supabase
    .from('followers')
    .select('follower:profiles!follower_id(id, display_name, username, avatar_url, avatar_color, score)')
    .eq('following_id', userId)
  if (error) throw error
  return (data || []).map((r: any) => r.follower).filter(Boolean)
}

export async function getFollowingList(userId: string) {
  const { data, error } = await supabase
    .from('followers')
    .select('following:profiles!following_id(id, display_name, username, avatar_url, avatar_color, score)')
    .eq('follower_id', userId)
  if (error) throw error
  return (data || []).map((r: any) => r.following).filter(Boolean)
}

export async function searchUsers(query: string, excludeId?: string) {
  const q = query.trim();
  if (!q) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, avatar_color, score')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq('id', excludeId || '00000000-0000-0000-0000-000000000000')
    .limit(8)
  if (error) throw error
  return data || []
}

export async function getFollowingFeed(userId: string) {
  const { data: followingData } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId)

  if (!followingData || followingData.length === 0) return []

  const followingIds = followingData.map((f: any) => f.following_id)

  const from = new Date()
  from.setDate(from.getDate() - 7)

  const { data, error } = await supabase
    .from('habit_logs')
    .select('*, habits(name, emoji, type), profiles(id, display_name, username, avatar_color, avatar_url)')
    .in('user_id', followingIds)
    .eq('completed', true)
    .gte('log_date', toDateStr(from))
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) throw error
  return (data || []).filter((l: any) => l.habits?.type === 'positive')
}

export async function getFollowingStreaks(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {}
  const from = new Date()
  from.setDate(from.getDate() - 60)
  const { data } = await supabase
    .from('habit_logs')
    .select('user_id, log_date')
    .in('user_id', userIds)
    .eq('completed', true)
    .gte('log_date', toDateStr(from))
  if (!data) return {}
  const userDates: Record<string, Set<string>> = {}
  for (const row of data) {
    if (!userDates[row.user_id]) userDates[row.user_id] = new Set()
    userDates[row.user_id].add(row.log_date)
  }
  const result: Record<string, number> = {}
  const todayStr = toDateStr()
  for (const [uid, dates] of Object.entries(userDates)) {
    let streak = 0
    const startI = dates.has(todayStr) ? 0 : 1
    for (let i = startI; i <= 60; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      if (dates.has(toDateStr(d))) streak++
      else break
    }
    if (streak > 0) result[uid] = streak
  }
  return result
}

export async function getFollowingNewHabits(userId: string) {
  const { data: followingData } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId)
  if (!followingData || followingData.length === 0) return []
  const followingIds = followingData.map((f: any) => f.following_id)
  const from = new Date()
  from.setDate(from.getDate() - 7)
  const { data } = await supabase
    .from('habits')
    .select('id, name, emoji, created_at, user_id, profiles(id, display_name, username, avatar_color, avatar_url)')
    .in('user_id', followingIds)
    .eq('is_active', true)
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

// ─── FEED REACTIONS ─────────────────────────────────────────
export async function getFeedReactions(itemIds: string[]) {
  if (itemIds.length === 0) return []
  const { data } = await supabase
    .from('feed_reactions')
    .select('item_id, reaction_type, reactor_id')
    .in('item_id', itemIds)
  return data || []
}

export async function toggleFeedReaction(
  reactorId: string,
  itemId: string,
  reactionType: 'fire' | 'clap'
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('feed_reactions')
    .select('id')
    .eq('reactor_id', reactorId)
    .eq('item_id', itemId)
    .eq('reaction_type', reactionType)
    .maybeSingle()
  if (existing) {
    await supabase.from('feed_reactions').delete().eq('id', existing.id)
    return false
  }
  await supabase.from('feed_reactions').insert({ reactor_id: reactorId, item_id: itemId, reaction_type: reactionType })
  return true
}

// ─── TELEGRAM REQUESTS ───────────────────────────────────────
export async function getTelegramRequestStatus(
  requesterId: string,
  targetId: string
): Promise<'none' | 'pending' | 'approved'> {
  const { data } = await supabase
    .from('telegram_requests')
    .select('status')
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .maybeSingle()
  return (data?.status as 'pending' | 'approved') || 'none'
}

export async function sendTelegramRequest(
  requesterId: string,
  targetId: string,
  fromName: string,
  fromUsername: string
) {
  const { data: req, error } = await supabase
    .from('telegram_requests')
    .upsert(
      { requester_id: requesterId, target_id: targetId, status: 'pending' },
      { onConflict: 'requester_id,target_id' }
    )
    .select()
    .single()
  if (error) throw error
  await supabase.from('notifications').insert({
    user_id: targetId,
    title: "Telegram aloqa so'rovi",
    body: `@${fromUsername} (${fromName}) siz bilan Telegramda aloqa o'rnatmoqchi`,
    type: 'telegram_request',
    link: `telegram_request:${req.id}`,
  })
  return req
}

export async function approveTelegramRequest(requestId: string, approverId: string) {
  const { data: req } = await supabase
    .from('telegram_requests')
    .select('requester_id, target_id')
    .eq('id', requestId)
    .eq('target_id', approverId)
    .single()
  if (!req) throw new Error('Request not found')
  const { error: updateErr } = await supabase.from('telegram_requests').update({ status: 'approved' }).eq('id', requestId)
  if (updateErr) throw updateErr
  const { data: approver } = await supabase
    .from('profiles')
    .select('telegram_username, display_name')
    .eq('id', approverId)
    .single()
  await supabase.from('notifications').insert({
    user_id: req.requester_id,
    title: "Telegram so'rovingiz qabul qilindi! 🎉",
    body: `Endi @${approver?.telegram_username} ning telegramiga o'ta olasiz`,
    type: 'telegram_approved',
    link: null,
  })
}

export async function rejectTelegramRequest(requestId: string, approverId: string) {
  const { error } = await supabase
    .from('telegram_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('target_id', approverId)
  if (error) throw error
}

// ─── STREAK FREEZE ───────────────────────────────────────────
// Oyiga bepul muzlatishlar soni — yagona manba. Bu son ilgari Dashboard.tsx
// (1) va HabitsLog.tsx (2) ichida alohida-alohida qattiq yozilgan bo'lib,
// ikki ekranda "qolgan muzlatish" soni har xil ko'rinardi. Endi faqat
// HabitsLog (Jurnal) shu doimiyni ishlatadi — muzlatish amali yagona shu
// yerda.
export const FREE_FREEZES_PER_MONTH = 2

export async function getStreakFreezes(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('streak_freezes')
    .select('freeze_date')
    .eq('user_id', userId)
  return (data || []).map((r: any) => r.freeze_date)
}

export async function getMonthlyFreezeCount(userId: string): Promise<number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const { count } = await supabase
    .from('streak_freezes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('freeze_date', monthStart)
  return count || 0
}

export async function useStreakFreeze(userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('streak_freezes')
    .insert({ user_id: userId, freeze_date: date })
  if (error) throw error
}

// ─── COIN SHOP ───────────────────────────────────────────────
export async function purchaseCoinItem(userId: string, itemId: string, price: number): Promise<number> {
  // spend_coins RPC bitta atomik UPDATE ichida balansni tekshiradi va yechadi,
  // shu bilan ikkita bir vaqtdagi xarid (double-tap, 2 tab) bir xil boshlang'ich
  // balansni o'qib, bir-birini bosib ketishining oldini oladi.
  const { data: newBalance, error: rpcErr } = await supabase.rpc('spend_coins', { uid: userId, price })
  if (rpcErr) throw new Error(rpcErr.message.includes('yetarli') ? rpcErr.message : 'Tangalar yetarli emas')
  const { error } = await supabase.from('coin_purchases').insert({ user_id: userId, item_id: itemId })
  if (error) {
    try { await supabase.rpc('increment_coins', { uid: userId, delta: price }) } catch {}
    throw error
  }
  return newBalance as number
}

export async function getExtraFreezeCount(userId: string): Promise<number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const { count } = await supabase
    .from('coin_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('item_id', 'streak_freeze')
    .gte('purchased_at', monthStart)
  return count || 0
}

export async function hasShopBadge(userId: string, itemId: string): Promise<boolean> {
  const { data } = await supabase
    .from('coin_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle()
  return !!data
}

// ─── STAR STATUS (30 kunlik obuna, 500 tanga) ─────────────────
// buy_star RPC balansni atomik tekshiradi/yechadi va star_expires_at'ni
// yangilaydi (agar hali faol Star bo'lsa, muddat cho'ziladi, aks holda
// hozirdan 30 kun) — qaytadigan qiymat yangi tugash sanasi.
export async function buyStar(userId: string): Promise<string> {
  const { data, error } = await supabase.rpc('buy_star', { uid: userId })
  if (error) throw error
  return data as string
}

export function isStarActive(profile: { has_star?: boolean; star_expires_at?: string | null }): boolean {
  return !!profile.has_star && !!profile.star_expires_at && new Date(profile.star_expires_at) > new Date()
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

// ─── GROUP TELEGRAM LINK ──────────────────────────────────────
export async function updateGroupTelegramLink(groupId: string, link: string | null) {
  const { error } = await supabase
    .from('groups')
    .update({ telegram_link: link })
    .eq('id', groupId)
  if (error) throw error
}

// ─── TELEGRAM BOT ────────────────────────────────────────────
export async function unlinkTelegramBot(_userId: string) {
  // telegram_chat_id endi to'g'ridan-to'g'ri update qilib bo'lmaydigan ustun —
  // faqat bot backend (service role) uni bog'lay oladi. Uzish uchun RPC ishlatamiz.
  const { error } = await supabase.rpc('unlink_telegram_bot')
  if (error) throw error
}

// ─── GROUP SUBTEAMS ───────────────────────────────────────────
export async function getGroupSubteams(groupId: string) {
  const { data, error } = await supabase
    .from('group_subteams')
    .select(`id, name, emoji, created_by, created_at,
      group_subteam_members(user_id, profiles(id, display_name, avatar_color, avatar_url, username))`)
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

// ─── HEALTH LOGS ──────────────────────────────────────────────
export async function getHealthLog(userId: string, date: string) {
  const { data } = await supabase
    .from('health_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
    .maybeSingle()
  return data
}

export async function upsertHealthLog(
  userId: string,
  date: string,
  fields: { steps?: number | null; sleep_hours?: number | null; water_glasses?: number | null; screen_time_hours?: number | null; nature_time_minutes?: number | null; social_time_minutes?: number | null }
) {
  const { error } = await supabase
    .from('health_logs')
    .upsert({ user_id: userId, log_date: date, ...fields }, { onConflict: 'user_id,log_date' })
  if (error) throw error
}

// Kunlik Jurnaldagi "Raqamli Ko'rsatkichlar" slaydiri (Tabiat/Ijtimoiy
// tarmoq vaqti) uchun tor qavatlash — bular alohida odat emas (habit_id
// yo'q), shuning uchun health_logs'dagi mos ustunga yoziladi, xuddi
// sleep_hours/screen_time_hours kabi boshqa kunlik sog'liq
// ko'rsatkichlari bilan bir xil "yagona manba" jadvalida.
export type HabitMetricKey = 'nature_time_minutes' | 'social_time_minutes'

export async function upsertHabitMetric(
  userId: string,
  metricKey: HabitMetricKey,
  logDate: string,
  value: number
): Promise<void> {
  if (isLogDateLocked(logDate)) throw new Error(LOG_LOCKED_MESSAGE)
  await upsertHealthLog(userId, logDate, { [metricKey]: value })
}

export async function getMonthHealthLogs(userId: string, year: number, month: number): Promise<any[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('health_logs')
    .select('log_date, sleep_hours, screen_time_hours')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to)
  if (error) throw error
  return data || []
}

export async function getWeeklyHealthLogs(userId: string): Promise<any[]> {
  const from = new Date()
  from.setDate(from.getDate() - 6)
  const { data } = await supabase
    .from('health_logs')
    .select('log_date, steps, sleep_hours, water_glasses, screen_time_hours')
    .eq('user_id', userId)
    .gte('log_date', toDateStr(from))
    .order('log_date')
  return data || []
}
