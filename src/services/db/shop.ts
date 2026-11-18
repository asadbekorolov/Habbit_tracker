// db/shop.ts — Do'kon, yulduz, School21 nishonlari, AI tahlil narxi.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { st } from '../../utils/serviceT'

// ─── AI ANALYSIS — COIN-GATED ────────────────────────────────
// AI tahlil narxi (200 tanga) endi faqat serverda yechiladi:
// api/ai-analysis.ts -> spend_coins_for_ai (service_role), AI xato bersa
// o'sha joyda refund_coins_for_ai bilan qaytariladi. Mijoz faqat UI uchun
// balansni oldindan tekshiradi.
export const AI_ANALYSIS_COST = 200

// ─── COIN SHOP ───────────────────────────────────────────────
// Narx serverdagi shop_items katalogidan olinadi (mijoz narx yubormaydi).
// purchase_shop_item bitta tranzaksiyada balansni tekshiradi, yechadi,
// coin_purchases'ga yozadi va ramka/unvon/yaltiroq ismni qo'llaydi.
export async function purchaseShopItem(itemId: string): Promise<number> {
  const { data, error } = await supabase.rpc('purchase_shop_item', { p_item_id: itemId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('insufficient_coins')) throw new Error(st('svc_insufficient_coins'))
    if (msg.includes('already_owned')) throw new Error(st('svc_already_owned'))
    if (msg.includes('already_active')) throw new Error('already_active') // Do'kon t('store_already_active') ga almashtiradi
    if (msg.includes('unknown_item')) throw new Error(st('svc_unknown_item'))
    throw new Error(msg || st('svc_purchase_error'))
  }
  return (data as { coins: number }).coins
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
    if (msg.includes('already_claimed')) throw new Error(st('svc_already_claimed'))
    if (msg.includes('not_eligible')) throw new Error(st('svc_not_eligible'))
    throw new Error(msg || st('svc_claim_error'))
  }
  return data as { coins: number; score: number; rewardXp: number; rewardCoins: number }
}
