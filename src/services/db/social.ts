// db/social.ts — Obunalar, lenta reaksiyalari, Telegram, push-bildirishnomalar.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { st } from '../../utils/serviceT'
import { tashkentTodayAnchor, toDateStr } from '../../utils/date'

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
    throw new Error(st('svc_push_unsupported'));
  }

  const isWebNotifSupported = typeof window !== 'undefined' && 'Notification' in window && typeof (window as any).Notification === 'function';
  if (!isWebNotifSupported) {
    throw new Error(st('svc_notif_unsupported'));
  }

  let permission: string = 'default';
  try {
    const n = (window as any).Notification;
    if (n && typeof n.requestPermission === 'function') {
      permission = await n.requestPermission();
    }
  } catch (err) {
    console.warn('Browser Notification.requestPermission failed:', err);
    throw new Error(st('svc_notif_perm_error'));
  }

  if (permission !== 'granted') {
    throw new Error(st('svc_notif_denied'));
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY; 
  if (!publicVapidKey) {
    throw new Error(st('svc_vapid_missing'));
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
