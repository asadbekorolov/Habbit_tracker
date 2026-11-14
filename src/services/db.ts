import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'
import { supabase } from './supabase'
import type { Profile, Routine, RoutineItem } from './supabase'
import { tashkentTodayAnchor, toDateStr, isTashkentDateOpen } from '../utils/date'
import { fetchAllPages, PAGE_SIZE } from '../utils/pagination'
import { FREE_AVATAR_COLORS } from '../utils/cosmetics'
import { nativeNotificationService } from './nativeNotificationService'

export const HABIT_SUCCESS_COLOR = "#4ADE80"
export const HABIT_FAILURE_COLOR = "#F87171"

export function isHabitLogSuccess(log: { completed: boolean }): boolean {
  return log.completed === true
}

export function getHabitStatusColor(completed: boolean): string {
  return completed ? HABIT_SUCCESS_COLOR : HABIT_FAILURE_COLOR
}

const AVATAR_COLORS = FREE_AVATAR_COLORS

// Kesh: bu fayl faqat serverdan o'qiydi/yozadi. Yagona kesh — React Query
// (src/services/queryClient.ts + src/hooks/queries.ts), localStorage'ga
// persister orqali saqlanadi.

// ─── SAHIFALAB YUKLASH (PostgREST 1000 qator chegarasi) ────
// fetchAllPages: src/utils/pagination.ts (unit-test qilingan).
export { fetchAllPages, PAGE_SIZE }

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

async function getMyProfileOrThrow(): Promise<Profile> {
  const p = await getMyProfile()
  if (!p) throw new Error('Profil topilmadi')
  return p
}

// ─── AUTH ──────────────────────────────────────────────────
export async function signInUser(email: string, password: string): Promise<Profile> {
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  const data = await getMyProfileOrThrow()

  if (data.is_banned) {
    await supabase.auth.signOut();
    throw new Error("Sizning akkauntingiz ma'muriyat tomonidan bloklangan.");
  }

  return data
}

export async function resetUserPassword(email: string) {
  const isMobile = window.location.protocol !== 'http:' && window.location.protocol !== 'https:';
  // Use custom deep-link scheme for native app or production URL for web
  const redirectToUrl = isMobile
    ? 'com.tracker.app://reset-password'
    : `${window.location.origin}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectToUrl,
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
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username, display_name: displayName, avatar_color: color });
  if (error) throw error;
  return getMyProfileOrThrow();
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
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("signOutUser error:", e);
  }
}

export async function getProfileById(userId: string): Promise<Profile> {
  // O'z profili — to'liq (shaxsiy ustunlar bilan); boshqalarniki — faqat ochiq ustunlar.
  const { data: { session } } = await supabase.auth.getSession()
  let data: Profile
  if (session?.user?.id === userId) {
    data = await getMyProfileOrThrow()
  } else {
    const res = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
    if (res.error) throw res.error
    data = res.data as unknown as Profile
  }

  // Merge local cached biometrics if database columns are awaiting schema cache refresh
  try {
    const rawLocal = localStorage.getItem(`user_biometrics_${userId}`);
    if (rawLocal) {
      const localBio = JSON.parse(rawLocal);
      return {
        ...data,
        birth_date: data.birth_date || localBio.birth_date || null,
        height_cm: data.height_cm || localBio.height_cm || null,
        weight_kg: data.weight_kg || localBio.weight_kg || null,
      };
    }
  } catch {}

  return data
}

export async function updateBiometrics(
  userId: string,
  heightCm: number,
  weightKg: number,
  birthDateStr: string
): Promise<Profile> {
  const numHeight = Number(heightCm);
  const numWeight = Number(weightKg);

  // 1. Format date strictly as YYYY-MM-DD
  let formattedDate = birthDateStr;
  let birthYear = 2000;
  try {
    const d = new Date(birthDateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      birthYear = year;
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
  } catch {}

  // Save to local storage cache so local UI profile state retains biometrics immediately
  try {
    localStorage.setItem(`user_biometrics_${userId}`, JSON.stringify({
      height_cm: numHeight,
      weight_kg: numWeight,
      birth_date: formattedDate,
      birth_year: birthYear,
    }));
  } catch (e) {
    console.warn("LocalStorage biometrics caching warning:", e);
  }

  // 2. Update (047 migratsiyasi birth_date/birth_year/height_cm/weight_kg
  //    ustunlari mavjudligini kafolatlaydi). Natija get_my_profile() orqali
  //    o'qiladi — profiles'dan select('*') endi ruxsat etilmaydi.
  try {
    const payload: Record<string, any> = {
      birth_date: formattedDate,
      height_cm: numHeight,
      weight_kg: numWeight,
    };
    if (!isNaN(birthYear) && birthYear > 1900) {
      payload.birth_year = birthYear;
    }

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      console.error("Supabase Biometrics Update Error:", error);
    } else {
      const fresh = await getMyProfile();
      if (fresh) {
        return {
          ...fresh,
          birth_date: formattedDate,
          height_cm: numHeight,
          weight_kg: numWeight,
        };
      }
    }

    // Return locally cached metrics if DB schema rejected column
    return {
      id: userId,
      birth_date: formattedDate,
      height_cm: numHeight,
      weight_kg: numWeight,
    } as any;

  } catch (err: any) {
    console.error("Uncaught Biometrics Update Exception:", err);

    // Return locally augmented profile so user is NEVER blocked from onboarding
    return {
      id: userId,
      birth_date: formattedDate,
      height_cm: numHeight,
      weight_kg: numWeight,
    } as any;
  }
}

export async function ensureProfileForUser(user: any): Promise<Profile> {
  const existingProfile = await getMyProfile().catch(() => null);

  if (existingProfile) {
    if (existingProfile.is_banned) {
      await supabase.auth.signOut();
      throw new Error("Sizning akkauntingiz ma'muriyat tomonidan bloklangan.");
    }
    return existingProfile;
  }

  const meta = user.user_metadata || {};
  const email = user.email || '';
  const rawName = meta.full_name || meta.name || email.split('@')[0] || 'User';
  const cleanUsername = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') + '_' + Math.floor(Math.random() * 1000);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      display_name: rawName,
      full_name: rawName,
      username: cleanUsername,
      avatar_url: meta.avatar_url || meta.picture || null,
      avatar_color: color,
    });

  if (error) throw error;
  return getMyProfileOrThrow();
}

export async function createProfileForGoogleUser(
  user: any,
  displayName: string,
  username: string
): Promise<Profile> {
  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) {
    throw new Error("Bu username allaqachon band. Iltimos, boshqasini tanlang");
  }

  const meta = user.user_metadata || {};
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      display_name: displayName,
      full_name: displayName,
      username: username,
      avatar_url: meta.avatar_url || meta.picture || null,
      avatar_color: color,
    });

  if (error) throw error;

  try {
    await supabase.auth.updateUser({ data: { registration_completed: true } });
  } catch (_) {}

  return getMyProfileOrThrow();
}

// Faqat foydalanuvchi o'zgartira oladigan ustunlar (047 GRANT UPDATE ro'yxati).
// Ramka/unvon — equipCosmetic(), yaltiroq ism — purchaseShopItem() orqali.
export async function updateUserProfile(
  userId: string,
  updates: {
    display_name?: string; full_name?: string; username?: string; avatar_url?: string | null;
    bio?: string | null; telegram_username?: string | null;
    instagram_username?: string | null; telegram_private?: boolean;
    profile_private?: boolean; avatar_color?: string;
    height_cm?: number | null;
    weight_kg?: number | null;
    birth_date?: string | null;
  }
): Promise<Profile> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
  return getMyProfileOrThrow()
}

// Ramka yoki unvonni taqish/yechish — egalik serverda tekshiriladi.
export async function equipCosmetic(kind: 'frame' | 'title', itemId: string | null): Promise<Profile> {
  const { error } = await supabase.rpc('equip_cosmetic', { p_kind: kind, p_item_id: itemId })
  if (error) throw new Error(error.message.includes('not_owned') ? "Bu buyum sizda yo'q yoki muddati tugagan" : error.message)
  return getMyProfileOrThrow()
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

// ─── USER FEEDBACK ──────────────────────────────────────────
export async function submitFeedback(
  userId: string,
  typeOrContent: 'bug' | 'suggestion' | 'feedback' | string,
  message?: string
) {
  let type: 'bug' | 'suggestion' | 'feedback' = 'feedback';
  let content = '';

  if (message !== undefined) {
    type = typeOrContent as 'bug' | 'suggestion' | 'feedback';
    content = message;
  } else {
    content = typeOrContent as string;
  }

  // 1. Try inserting into feedback_reports table
  const { error } = await supabase.from('feedback_reports').insert({
    user_id: userId,
    type,
    message: content,
  });

  if (error) {
    // 2. Fallback to user_feedback table if feedback_reports doesn't exist
    const { error: fallbackErr } = await supabase.from('user_feedback').insert({
      user_id: userId,
      content,
    });
    if (fallbackErr) throw error;
  }
}

export type FeedbackEntry = {
  id: string
  user_id: string
  content: string
  created_at: string
  display_name: string
  username: string
  admin_reply: string | null
  admin_replied_at: string | null
}

export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase.rpc('get_all_feedback');
  if (error) throw error;
  return data || [];
}

export async function replyToFeedback(feedbackId: string, reply: string) {
  const { error } = await supabase.rpc('reply_to_feedback', { p_feedback_id: feedbackId, p_reply: reply });
  if (error) throw error;
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

export type AdminAnalyticsDashboard = {
  users: { total: number; new_today: number; new_week: number; banned: number }
  habits: { active_total: number; positive_count: number; negative_count: number; completion_rate_pct: number; logs_last_30d: number }
  economy: { total_coins: number; total_xp: number; active_frames: number }
  groups: { total_groups: number; avg_members: number; pending_proofs: number; approved_proofs: number }
}

export async function getAdminAnalyticsDashboard(): Promise<AdminAnalyticsDashboard> {
  const { data, error } = await supabase.rpc('get_admin_analytics_dashboard');
  if (error) throw error;
  return data as AdminAnalyticsDashboard;
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
  return data || []
}

/** Barcha odatlar (o'chirilganlari ham) — eski loglarga nom/tur berish uchun. */
export type HabitMeta = { id: string; name: string; emoji: string | null; type: 'positive' | 'negative'; is_active: boolean }
export async function getHabitsMeta(userId: string): Promise<HabitMeta[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('id, name, emoji, type, is_active')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []) as HabitMeta[]
}

export async function addHabit(
  userId: string,
  name: string,
  emoji: string,
  type: 'positive' | 'negative',
  target_value: number = 1,
  unit: string = '',
  scheduledStart?: string,
  scheduledEnd?: string,
  description: string = ''
) {
  const baseData: Record<string, unknown> = { user_id: userId, name, emoji, type };
  if (target_value > 1 || unit) {
    baseData.target_value = target_value;
    baseData.unit = unit;
  }
  if (scheduledStart) baseData.scheduled_start = scheduledStart;
  if (scheduledEnd) baseData.scheduled_end = scheduledEnd;
  if (description) baseData.description = description;

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
  updates: { name?: string; emoji?: string; description?: string; target_value?: number; unit?: string; scheduled_start?: string | null; scheduled_end?: string | null }
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
  return getLogsForDate(userId, toDateStr())
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

// ─── ODAT BELGILASH (047: yagona yo'l — toggle_habit_atomic RPC) ─────
// habit_logs'ga mijoz endi to'g'ridan-to'g'ri yoza olmaydi. Server bitta
// tranzaksiyada: egalik va sana qulfini tekshiradi, logni yozadi/o'chiradi,
// reward_ledger orqali mukofotni beradi yoki qaytarib oladi (qayta-qayta
// belgilash qo'shimcha tanga bermaydi) va kunlik vazifalarni qayta hisoblaydi.
export type HabitStatus = 'done' | 'fail' | 'neutral'

export interface HabitStatusResult {
  status: HabitStatus
  coins: number
  score: number
  total_xp: number
  level: number
  reconciliation?: ReconciliationResult
}

// Navbat (habitSyncQueueCore) xatoni `code` bo'yicha vaqtinchalik yoki doimiy
// deb ajratadi: date_locked/habit_not_found/banned/invalid_status — doimiy,
// network/auth — vaqtinchalik (qayta uriniladi).
export type HabitSyncErrorCode =
  | 'date_locked' | 'habit_not_found' | 'banned' | 'invalid_status'
  | 'auth' | 'network' | 'unknown'

export class HabitSyncError extends Error {
  code: HabitSyncErrorCode
  constructor(code: HabitSyncErrorCode, message: string) {
    super(message)
    this.name = 'HabitSyncError'
    this.code = code
  }
}

function mapHabitRpcError(error: { message?: string; code?: string }): HabitSyncError {
  const msg = error?.message || ''
  const lower = msg.toLowerCase()
  if (msg.includes('date_locked')) return new HabitSyncError('date_locked', LOG_LOCKED_MESSAGE)
  if (msg.includes('habit_not_found')) return new HabitSyncError('habit_not_found', "Odat topilmadi")
  if (msg.includes('banned')) return new HabitSyncError('banned', "Sizning akkauntingiz bloklangan.")
  if (msg.includes('invalid_status')) return new HabitSyncError('invalid_status', "Noto'g'ri holat")
  if (msg.includes('not_authenticated') || error?.code === 'PGRST301' || lower.includes('jwt'))
    return new HabitSyncError('auth', "Qaytadan tizimga kiring.")
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('timeout'))
    return new HabitSyncError('network', "Internet aloqasi yo'q")
  return new HabitSyncError('unknown', msg || "Saqlashda xatolik yuz berdi")
}

export async function setHabitStatus(
  habitId: string,
  status: HabitStatus,
  value: number = 1,
  date?: string
): Promise<HabitStatusResult> {
  const logDate = date || toDateStr()
  if (isLogDateLocked(logDate)) throw new HabitSyncError('date_locked', LOG_LOCKED_MESSAGE)
  let res
  try {
    res = await supabase.rpc('toggle_habit_atomic', {
      p_habit_id: habitId,
      p_date: logDate,
      p_status: status,
      p_value: value,
    })
  } catch (e: any) {
    throw new HabitSyncError('network', e?.message || "Internet aloqasi yo'q")
  }
  if (res.error) throw mapHabitRpcError(res.error)
  return res.data as HabitStatusResult
}

// Eski chaqiruvlar bilan moslik uchun saqlangan o'ram. userId, prevCompleted
// va isNegative endi ishlatilmaydi — hammasini server hal qiladi.
export async function toggleHabitLog(
  habitId: string,
  _userId: string,
  completed: boolean,
  value: number = 1,
  _prevCompleted?: boolean,
  _isNegative: boolean = false,
  date?: string
): Promise<HabitStatusResult> {
  return setHabitStatus(habitId, completed ? 'done' : 'fail', value, date)
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
// Qoida server bilan bir xil (047: is_log_date_open) va Toshkent vaqti bo'yicha
// hisoblanadi — qurilma vaqt zonasi ta'sir qilmaydi.
export const LOG_LOCKED_MESSAGE = "Bu kun uchun belgilash muddati tugagan (ertasi kuni soat 09:00 gacha ochiq edi)."

export function isLogDateLocked(dateStr: string, now: Date = new Date()): boolean {
  return !isTashkentDateOpen(dateStr, now)
}

// "Kutilmoqda" holatiga qaytarish (log qatorini o'chirish) — toggleHabitLog
// bilan bir xil qulflash tekshiruvidan o'tadi, shuning uchun HabitsLog.tsx
// endi bevosita supabase.from('habit_logs').delete() chaqirmaydi.
export async function deleteHabitLog(habitId: string, _userId: string, date?: string): Promise<HabitStatusResult> {
  return setHabitStatus(habitId, 'neutral', 1, date)
}

// Kunlik progress hisob-kitobi — YAGONA MANBA. App.tsx, Dashboard.tsx va HabitsLog.tsx
// bu formula orqali umumiy header foizini (completedToday/totalHabits) hisoblaydi.
// Qoida: Har ikkala odat turida ham (musbat ham, salbiy ham) completed=true muvaffaqiyatni
// (musbat odat bajarilganini yoki salbiy odat saqlanib qolinganini) anglatadi.
export function computeHabitProgress(
  habits: { id: string; type: string }[],
  logs: { habit_id: string; completed: boolean }[]
): { completed: number; total: number } {
  const completedSet = new Set<string>()
  for (const l of logs) {
    if (isHabitLogSuccess(l)) completedSet.add(l.habit_id)
  }
  let completed = 0
  let total = habits.length
  for (const h of habits) {
    if (completedSet.has(h.id)) completed++
  }
  return { completed, total }
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
  active_frame: string | null
  username_glow: boolean
  score: number
  efficiency_pct: number
  /** Davr ichida bajarilgan odatlar soni (048) */
  completed_count?: number
  /** Reytingdagi o'rni (048) */
  rank?: number
  is_private: boolean
  has_star: boolean
}

export type LeaderboardPeriod = 'daily' | 'monthly' | '6months' | 'yearly' | 'all'

// Reyting serverda hisoblanadi (048: get_leaderboard_period) — mijoz endi
// barcha profillar va loglarni yuklamaydi. 048 hali qo'yilmagan bazada
// (PGRST202: funksiya topilmadi) eski 30 kunlik get_leaderboard ishlatiladi.
export async function getLeaderboard(period: LeaderboardPeriod = 'monthly'): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard_period', { p_period: period })
  if (!error) return (data || []) as LeaderboardEntry[]
  if (error.code === 'PGRST202') {
    const legacy = await supabase.rpc('get_leaderboard')
    if (legacy.error) throw legacy.error
    return (legacy.data || []) as LeaderboardEntry[]
  }
  throw error
}

// Joriy foydalanuvchining o'rni (048: get_my_leaderboard_rank). userId faqat
// eski chaqiruvlar bilan moslik uchun — server auth.uid() ni ishlatadi.
export async function getUserRank(userId: string, period: LeaderboardPeriod = 'monthly'): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_leaderboard_rank', { p_period: period })
  if (!error) return (data as number) || 0
  if (error.code === 'PGRST202') {
    const legacy = await supabase.rpc('get_user_rank_efficiency', { p_user_id: userId })
    return legacy.error ? 0 : (legacy.data || 0)
  }
  return 0
}

export async function getAllTimeLogs(userId: string) {
  return fetchAllPages<any>((from, to) =>
    supabase
      .from('habit_logs')
      .select('habit_id, log_date, completed, habits(type)')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('log_date', { ascending: true })
      .order('habit_id', { ascending: true })
      .range(from, to)
  )
}

/**
 * [fromDate, toDate] oralig'idagi loglar — faqat 4 ta ustun, 1000 lik
 * bo'laklarda. (habit_id, log_date) foydalanuvchi uchun noyob, shu sabab
 * tartib barqaror va sahifalar bir-birini takrorlamaydi.
 */
export async function getLogsBetween(userId: string, fromDate: string, toDate: string): Promise<CompactLog[]> {
  return fetchAllPages<CompactLog>((from, to) =>
    supabase
      .from('habit_logs')
      .select(COMPACT_LOG_COLUMNS)
      .eq('user_id', userId)
      .gte('log_date', fromDate)
      .lte('log_date', toDate)
      .order('log_date', { ascending: true })
      .order('habit_id', { ascending: true })
      .range(from, to) as any
  )
}

export async function getLogsByRange(userId: string, days: number) {
  const from = tashkentTodayAnchor();
  from.setDate(from.getDate() - days);
  const startDate = toDateStr(from);
  return fetchAllPages<any>((f, t) =>
    supabase
      .from('habit_logs')
      .select('*, habits(name, emoji, type)')
      .eq('user_id', userId)
      .gte('log_date', startDate)
      .order('log_date', { ascending: false })
      .order('habit_id', { ascending: true })
      .range(f, t)
  )
}

export async function getHealthLogsBetween(userId: string, fromDate: string, toDate: string) {
  return fetchAllPages<any>((from, to) =>
    supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', fromDate)
      .lte('log_date', toDate)
      .order('log_date', { ascending: true })
      .range(from, to)
  )
}

export async function getHealthLogsByRange(userId: string, days: number) {
  const from = tashkentTodayAnchor();
  from.setDate(from.getDate() - days);
  return getHealthLogsBetween(userId, toDateStr(from), toDateStr());
}

export async function getLast30DaysLogs(userId: string) {
  return getLogsByRange(userId, 30)
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

// create_group_habit/update_group_habit/delete_group_habit RPC orqali —
// oddiy INSERT/UPDATE/DELETE emas, chunki bular bir vaqtning o'zida har
// bir a'zoning shaxsiy "Odatlar" ro'yxatidagi bog'langan nusxasini ham
// yaratadi/yangilaydi/deaktivatsiya qiladi (033-migratsiya, group_habit_links).
export async function addGroupHabit(
  groupId: string,
  name: string,
  emoji: string,
  type: 'positive' | 'negative' = 'positive',
  targetValue: number = 1,
  unit: string = ''
) {
  const { data, error } = await supabase.rpc('create_group_habit', {
    p_group_id: groupId, p_name: name, p_emoji: emoji, p_type: type, p_target_value: targetValue, p_unit: unit,
  })
  if (error) throw error
  return data
}

export async function updateGroupHabit(
  habitId: string,
  updates: { name?: string; emoji?: string; type?: 'positive' | 'negative'; target_value?: number; unit?: string }
) {
  const { data, error } = await supabase.rpc('update_group_habit', {
    p_habit_id: habitId,
    p_name: updates.name, p_emoji: updates.emoji, p_type: updates.type,
    p_target_value: updates.target_value, p_unit: updates.unit,
  })
  if (error) throw error
  return data
}

export async function deleteGroupHabit(habitId: string) {
  const { error } = await supabase.rpc('delete_group_habit', { p_habit_id: habitId })
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
    .select('*, profiles!user_id(display_name, avatar_color, avatar_url, username), group_habits(name, emoji)')
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
    .select('*, profiles!user_id(display_name, avatar_color, avatar_url, username), group_habits(name, emoji), groups(name)')
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
    .select('*, profiles!user_id(display_name, avatar_color, avatar_url, username), group_habits(name, emoji), groups(name)')
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
  const now = tashkentTodayAnchor()
  const firstDay = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('user_id, log_date, approval_status, completed, reps, group_habit_id, profiles!user_id(display_name, avatar_color, avatar_url), group_habits(name, emoji)')
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
// AI tahlil narxi (200 tanga) endi faqat serverda yechiladi:
// api/ai-analysis.ts -> spend_coins_for_ai (service_role), AI xato bersa
// o'sha joyda refund_coins_for_ai bilan qaytariladi. Mijoz faqat UI uchun
// balansni oldindan tekshiradi.
export const AI_ANALYSIS_COST = 200

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

  const isWebNotifSupported = typeof window !== 'undefined' && 'Notification' in window && typeof (window as any).Notification === 'function';
  if (!isWebNotifSupported) {
    throw new Error("Bildirishnomalar bu qurilmada qo'llab-quvvatlanmaydi");
  }

  let permission: string = 'default';
  try {
    const n = (window as any).Notification;
    if (n && typeof n.requestPermission === 'function') {
      permission = await n.requestPermission();
    }
  } catch (err) {
    console.warn('Browser Notification.requestPermission failed:', err);
    throw new Error("Bildirishnomalarga ruxsat berishda xatolik");
  }

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

// ─── FOLLOW SYSTEM ───────────────────────────────────────────
export async function followUser(followerId: string, followingId: string, followerName = '') {
  const { error } = await supabase
    .from('followers')
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' })
  if (error) throw error
  supabase.from('notifications').insert({
    user_id: followingId,
    title: 'Yangi kuzatuvchi!',
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
    .rpc('search_users', { p_query: q, p_exclude_id: excludeId || null })
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

  const from = tashkentTodayAnchor()
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
  const from = tashkentTodayAnchor()
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
      const d = tashkentTodayAnchor()
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
// Yozish (yuborish/javob berish) send_telegram_request/respond_telegram_request
// SECURITY DEFINER RPC'lari orqali — jadvalda client uchun to'g'ridan-to'g'ri
// INSERT/UPDATE policy yo'q (037-migratsiya), shuning uchun so'rovchi statusni
// o'zi "approved" qilib qo'ya olmaydi va 2 soatlik sovish muddati serverda
// (client soatiga ishonmasdan) tekshiriladi.
const TELEGRAM_REQUEST_COOLDOWN_MS = 2 * 60 * 60 * 1000

export type TelegramRequestStatus = 'none' | 'pending' | 'approved' | 'cooldown'

export async function getTelegramRequestStatus(
  requesterId: string,
  targetId: string
): Promise<{ status: TelegramRequestStatus; retryAt?: string }> {
  const { data } = await supabase
    .from('telegram_requests')
    .select('status, updated_at')
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .maybeSingle()
  if (!data) return { status: 'none' }
  if (data.status === 'rejected') {
    const retryAtMs = new Date(data.updated_at).getTime() + TELEGRAM_REQUEST_COOLDOWN_MS
    if (Date.now() < retryAtMs) return { status: 'cooldown', retryAt: new Date(retryAtMs).toISOString() }
    return { status: 'none' }
  }
  return { status: data.status as 'pending' | 'approved' }
}

export async function sendTelegramRequest(targetId: string) {
  const { data, error } = await supabase.rpc('send_telegram_request', { p_target_id: targetId })
  if (error) throw error
  return data
}

export async function respondTelegramRequest(requestId: string, status: 'approved' | 'rejected') {
  const { error } = await supabase.rpc('respond_telegram_request', { p_request_id: requestId, p_status: status })
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
  const now = tashkentTodayAnchor()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const { count } = await supabase
    .from('streak_freezes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('freeze_date', monthStart)
  return count || 0
}

// ─── COIN SHOP ───────────────────────────────────────────────
// Narx serverdagi shop_items katalogidan olinadi (mijoz narx yubormaydi).
// purchase_shop_item bitta tranzaksiyada balansni tekshiradi, yechadi,
// coin_purchases'ga yozadi va ramka/unvon/yaltiroq ismni qo'llaydi.
export async function purchaseShopItem(itemId: string): Promise<number> {
  const { data, error } = await supabase.rpc('purchase_shop_item', { p_item_id: itemId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('insufficient_coins')) throw new Error('Tangalar yetarli emas')
    if (msg.includes('already_owned')) throw new Error('Bu buyum sizda allaqachon bor')
    if (msg.includes('unknown_item')) throw new Error('Bu buyum sotuvda yo\'q')
    throw new Error(msg || 'Xarid qilishda xatolik yuz berdi')
  }
  return (data as { coins: number }).coins
}

// ─── KUNLIK VAZIFALAR (Daily Quests & Two-Way Reconciliation) ──────
export interface QuestDelta {
  questId: string;
  rewardCoins: number;
  rewardXp: number;
}

export interface ReconciliationResult {
  coins: number;
  score: number;
  coinsDelta: number;
  xpDelta: number;
  grantedQuests: QuestDelta[];
  revokedQuests: QuestDelta[];
}

export async function getTodayQuestClaims(userId: string): Promise<Set<string>> {
  const today = toDateStr()
  const { data } = await supabase
    .from('daily_quest_claims')
    .select('quest_id')
    .eq('user_id', userId)
    .eq('quest_date', today)
  return new Set((data || []).map((r) => r.quest_id))
}

// Kunlik vazifalar faqat serverda hisoblanadi (reconcile_daily_missions RPC:
// faqat o'zi uchun va faqat ochiq kun uchun). Mijozdagi zaxira hisoblash
// olib tashlandi — u profiles.coins'ni to'g'ridan-to'g'ri yozardi.
export async function reconcileDailyMissions(userId: string, dateStr?: string): Promise<ReconciliationResult> {
  const { data, error } = await supabase.rpc('reconcile_daily_missions', {
    p_user_id: userId,
    p_date: dateStr || toDateStr(),
  })
  if (error) throw error
  const r = (data || {}) as Partial<ReconciliationResult>
  return {
    coins: r.coins ?? 0,
    score: r.score ?? 0,
    coinsDelta: r.coinsDelta ?? 0,
    xpDelta: r.xpDelta ?? 0,
    grantedQuests: r.grantedQuests || [],
    revokedQuests: r.revokedQuests || [],
  }
}

export async function claimDailyQuest(userId: string, _questId: string): Promise<number> {
  const res = await reconcileDailyMissions(userId)
  return res.coins
}

export async function getExtraFreezeCount(userId: string): Promise<number> {
  const now = tashkentTodayAnchor()
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

// Do'kondagi kosmetika (ramka/rang) egaligini bitta so'rovda tekshirish —
// har bir item uchun alohida hasShopBadge chaqirishdan qochish uchun.
export async function getOwnedItemIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('coin_purchases')
    .select('item_id')
    .eq('user_id', userId)
  return new Set((data || []).map((r) => r.item_id))
}

// Ramkalar 30 kunga sotib olinadi (doimiy emas) — har bir frame_* item_id
// uchun ENG SO'NGGI xarid sanasini qaytaradi, shundan CoinShopModal muddat
// tugash sanasini hisoblaydi va "sizda bor" holatini shunga qarab ko'rsatadi.
export async function getFramePurchases(userId: string): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('coin_purchases')
    .select('item_id, purchased_at')
    .eq('user_id', userId)
    .in('item_id', ['frame_bronze', 'frame_silver', 'frame_gold'])
    .order('purchased_at', { ascending: false })
  const map = new Map<string, string>()
  for (const row of data || []) {
    if (!map.has(row.item_id)) map.set(row.item_id, row.purchased_at)
  }
  return map
}

// Foydalanuvchi kirganda yoki do'konni ochganda chaqiriladi — agar hozir
// faollashtirilgan ramkaning xaridi 30 kundan oshgan bo'lsa, serverda
// avtomatik yechib tashlaydi (profiles.active_frame = null) va joriy
// (yechilgandan keyingi) qiymatni qaytaradi.
export async function cleanupExpiredFrame(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('cleanup_expired_frame', { uid: userId })
  if (error) return null
  return data as string | null
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

// Botni ulash: server 15 daqiqalik bir martalik kod beradi, havola
// t.me/<bot>?start=<kod> ko'rinishida bo'ladi. Bot (api/telegram.ts) kodni
// service_role orqali link_telegram_account'ga uzatadi.
export async function createTelegramLinkToken(): Promise<string> {
  const { data, error } = await supabase.rpc('create_telegram_link_token')
  if (error) throw error
  return data as string
}

export async function getTelegramBotLinkUrl(): Promise<string | null> {
  const bot = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
  if (!bot) return null
  const token = await createTelegramLinkToken()
  return `https://t.me/${bot}?start=${token}`
}

// Boshqa foydalanuvchining Telegram username'i (faqat ruxsat bo'lsa).
export async function getTelegramContact(userId: string): Promise<{ has_telegram: boolean; username: string | null }> {
  const { data, error } = await supabase.rpc('get_telegram_contact', { p_user_id: userId })
  if (error) return { has_telegram: false, username: null }
  return data as { has_telegram: boolean; username: string | null }
}

// ─── SCHOOL21 NISHONLARI (shartlar serverda tekshiriladi) ─────────
export async function getBadgeClaims(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('badge_claims')
    .select('badge_id')
    .eq('user_id', userId)
  return new Set((data || []).map((r: any) => r.badge_id))
}

export async function claimBadgeReward(badgeId: string): Promise<{ coins: number; score: number; rewardXp: number; rewardCoins: number }> {
  const { data, error } = await supabase.rpc('claim_badge_reward', { p_badge_id: badgeId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('already_claimed')) throw new Error('Bu mukofot allaqachon olingan')
    if (msg.includes('not_eligible')) throw new Error("Nishon shartlari hali bajarilmagan")
    throw new Error(msg || 'Mukofotni olishda xatolik yuz berdi')
  }
  return data as { coins: number; score: number; rewardXp: number; rewardCoins: number }
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
  fields: {
    steps?: number | null;
    sleep_hours?: number | null;
    water_glasses?: number | null;
    screen_time_hours?: number | null;
    nature_time_minutes?: number | null;
    social_time_minutes?: number | null;
    calories?: number | null;
    heart_rate?: number | null;
  }
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
  const from = tashkentTodayAnchor()
  from.setDate(from.getDate() - 6)
  const { data } = await supabase
    .from('health_logs')
    .select('log_date, steps, sleep_hours, water_glasses, screen_time_hours, calories, heart_rate')
    .eq('user_id', userId)
    .gte('log_date', toDateStr(from))
    .order('log_date')
  return data || []
}

// ─── ROUTINES & ROUTINE ITEMS ──────────────────────────────────────────────

export async function fetchRoutines(userId: string): Promise<Routine[]> {
  try {
    const authUser = (await supabase.auth.getUser()).data.user?.id;
    console.log('[DEBUG ROUTINES] Current auth user:', authUser);
    console.log('[DEBUG ROUTINES] fetchRoutines requested for userId:', userId);

    const { data, error } = await supabase
      .from('routines')
      .select('*, routine_items(*)')
      .eq('user_id', userId)
      .order('time_start', { ascending: true });

    console.log('[DEBUG ROUTINES] fetchRoutines query result:', { dataLength: data?.length, data, error });

    if (error) {
      console.warn('Silent routines fetch fallback:', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    const todayStr = toDateStr();
    const itemsToResetInDb: string[] = [];

    const routines = data.map((r: any) => {
      const rawItems = r.routine_items || r.items || [];
      const items = rawItems
        .map((item: any) => {
          let completedToday = item.is_completed_today;
          if (completedToday && item.updated_at) {
            const itemUpdateDateStr = toDateStr(new Date(item.updated_at));
            if (itemUpdateDateStr !== todayStr) {
              completedToday = false;
              itemsToResetInDb.push(item.id);
            }
          }
          return {
            ...item,
            is_completed_today: completedToday
          };
        })
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

      return {
        ...r,
        items
      };
    });

    if (itemsToResetInDb.length > 0) {
      supabase
        .from('routine_items')
        .update({ is_completed_today: false })
        .in('id', itemsToResetInDb)
        .then(() => {})
        .catch(() => {});
    }

    return routines;
  } catch (err) {
    console.warn('Routines network error:', err);
    return [];
  }
}

export async function createRoutine(
  userId: string,
  routineData: { title: string; time_start: string; time_end: string; icon_name?: string; days_of_week?: number[]; is_active?: boolean },
  items: { title: string; habit_id?: string | null; order_index?: number }[] = []
): Promise<Routine> {
  let uid = userId;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      uid = user.id;
    }
  } catch {}

  const formattedStart = routineData.time_start.length === 5 ? `${routineData.time_start}:00` : routineData.time_start;
  const formattedEnd = routineData.time_end.length === 5 ? `${routineData.time_end}:00` : routineData.time_end;

  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .insert({
      user_id: uid,
      title: routineData.title,
      time_start: formattedStart,
      time_end: formattedEnd,
      icon_name: routineData.icon_name || 'Sun',
      days_of_week: routineData.days_of_week || [1, 2, 3, 4, 5, 6, 7],
      is_active: routineData.is_active ?? true,
    })
    .select('*')
    .single();

  if (routineError) {
    console.error('PostgreSQL/Supabase error creating routine:', routineError.message);
    throw routineError;
  }

  let createdItems: RoutineItem[] = [];
  if (items.length > 0) {
    const itemsToInsert = items.map((it, idx) => ({
      routine_id: routine.id,
      title: it.title,
      habit_id: it.habit_id || null,
      order_index: it.order_index ?? idx,
      is_completed_today: false,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('routine_items')
      .insert(itemsToInsert)
      .select('*');

    if (itemsError) {
      console.warn('PostgreSQL error creating routine_items:', itemsError.message);
    }
    createdItems = insertedItems || [];
  }

  const result: Routine = { ...routine, items: createdItems };

  try {
    await nativeNotificationService.scheduleRoutineNotifications(result);
  } catch (notifErr) {
    console.warn('Non-critical background warning scheduling routine notifications:', notifErr);
  }

  return result;
}

export async function updateRoutine(
  routineId: string,
  routineData: Partial<Routine>,
  items?: { id?: string; title: string; habit_id?: string | null; order_index?: number }[]
): Promise<Routine> {
  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .update({
      ...(routineData.title ? { title: routineData.title } : {}),
      ...(routineData.time_start ? { time_start: routineData.time_start } : {}),
      ...(routineData.time_end ? { time_end: routineData.time_end } : {}),
      ...(routineData.icon_name ? { icon_name: routineData.icon_name } : {}),
      ...(routineData.days_of_week ? { days_of_week: routineData.days_of_week } : {}),
      ...(routineData.is_active !== undefined ? { is_active: routineData.is_active } : {}),
    })
    .eq('id', routineId)
    .select('*')
    .single();

  if (routineError) throw routineError;

  let updatedItems: RoutineItem[] = [];
  if (items !== undefined) {
    try {
      await supabase.from('routine_items').delete().eq('routine_id', routineId);
    } catch (delErr) {
      console.warn('Non-critical background warning deleting routine items:', delErr);
    }

    if (items.length > 0) {
      try {
        const itemsToInsert = items.map((it, idx) => ({
          routine_id: routineId,
          title: it.title,
          habit_id: it.habit_id || null,
          order_index: it.order_index ?? idx,
          is_completed_today: false,
        }));

        const { data: insertedItems, error: itemsError } = await supabase
          .from('routine_items')
          .insert(itemsToInsert)
          .select('*');

        if (itemsError) {
          console.warn('PostgreSQL error updating routine_items:', itemsError.message);
        }
        updatedItems = insertedItems || [];
      } catch (itemErr) {
        console.warn('Non-critical background warning updating routine items:', itemErr);
      }
    }
  } else {
    try {
      const { data: existingItems } = await supabase
        .from('routine_items')
        .select('*')
        .eq('routine_id', routineId)
        .order('order_index', { ascending: true });
      updatedItems = existingItems || [];
    } catch (fetchErr) {
      console.warn('Non-critical background warning fetching routine items:', fetchErr);
    }
  }

  const result: Routine = { ...routine, items: updatedItems };

  try {
    await nativeNotificationService.scheduleRoutineNotifications(result);
  } catch (err) {
    console.warn('Failed to schedule routine notification:', err);
  }

  return result;
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId);

  if (error) console.warn('Supabase deleteRoutine error:', error.message);

  try {
    await nativeNotificationService.cancelRoutineNotifications(routineId);
  } catch (err) {
    console.warn('Failed to cancel routine notifications:', err);
  }
}

export async function toggleRoutineItemCompletion(
  itemId: string,
  isCompleted: boolean,
  habitId?: string | null,
  userId?: string,
  isNegative: boolean = false
): Promise<void> {
  if (!itemId.startsWith('local_')) {
    try {
      const { error } = await supabase
        .from('routine_items')
        .update({
          is_completed_today: isCompleted,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) {
        console.warn('PostgreSQL error updating routine_items completion:', error.message);
      }
    } catch (err) {
      console.warn('Non-critical background warning in toggleRoutineItemCompletion:', err);
    }
  }

  if (habitId && userId) {
    try {
      await toggleHabitLog(habitId, userId, isCompleted, 1, !isCompleted, isNegative);
    } catch (e) {
      console.warn('Failed to toggle habit log from routine item:', e);
    }
  }
}
