// db/leaderboard.ts — Global reyting va foydalanuvchi o'rni (048).
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { publicName } from '../../utils/publicName'

// ─── GLOBAL REYTING ────────────────────────────────────────
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
  if (!error) return withFullNames((data || []) as LeaderboardEntry[])
  if (error.code === 'PGRST202') {
    const legacy = await supabase.rpc('get_leaderboard')
    if (legacy.error) throw legacy.error
    return withFullNames((legacy.data || []) as LeaderboardEntry[])
  }
  throw error
}

/**
 * Reytingda haqiqiy to'liq ism (full_name / display_name). Yopiq profil
 * (profile_private) — serverdagi qisqartirilgan "Ism F." yorlig'i qoladi.
 * Ismlarni yuklab bo'lmasa — reyting o'zgarishsiz qaytadi.
 */
async function withFullNames(list: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
  const ids = list.filter((u) => !u.is_private).map((u) => u.id)
  if (!ids.length) return list
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, display_name, username, profile_private')
      .in('id', ids.slice(0, 500))
    if (error || !data) return list
    const names = new Map<string, string>()
    for (const p of data as any[]) {
      if (p.profile_private) continue
      const n = publicName(p, '')
      if (n && !n.startsWith('@')) names.set(p.id, n)
    }
    return list.map((u) => (names.has(u.id) ? { ...u, display_label: names.get(u.id)! } : u))
  } catch {
    return list
  }
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
