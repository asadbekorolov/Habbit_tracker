// db/referral.ts — Taklif tizimi (058). Tangalar faqat serverda beriladi.
import { supabase } from '../supabase'
import { st } from '../../utils/serviceT'
import type { TKey } from '../../utils/i18n'
import { referralErrorCode, type ReferralErrorCode } from '../../utils/referral'

export interface ReferralInfo {
  code: string
  can_apply: boolean
  apply_until: string
  invited_count: number
  earned_coins: number
}

export class ReferralError extends Error {
  constructor(public code: ReferralErrorCode | null, message: string) {
    super(message)
    this.name = 'ReferralError'
  }
}

const ERROR_KEYS: Partial<Record<ReferralErrorCode, TKey>> = {
  invalid_code: 'svc_ref_invalid_code',
  self_referral: 'svc_ref_self',
  already_referred: 'svc_ref_already',
  referral_window_closed: 'svc_ref_window_closed',
  mutual_referral: 'svc_ref_mutual',
  banned: 'svc_banned_short',
  not_authenticated: 'svc_relogin',
  profile_not_found: 'svc_profile_not_found',
}

export async function getMyReferralInfo(): Promise<ReferralInfo> {
  const { data, error } = await supabase.rpc('get_my_referral_info')
  if (error || !data) throw new ReferralError(referralErrorCode(error?.message), st('svc_ref_generic'))
  return data as ReferralInfo
}

/** Muvaffaqiyatda: berilgan bonus va yangi balans */
export async function applyReferralCode(code: string): Promise<{ bonus: number; coins: number }> {
  const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code })
  if (error) {
    const c = referralErrorCode(error.message)
    const key = c ? ERROR_KEYS[c] : undefined
    throw new ReferralError(c, st(key ?? 'svc_ref_generic'))
  }
  const r = (data || {}) as { bonus?: number; coins?: number }
  return { bonus: r.bonus ?? 0, coins: r.coins ?? 0 }
}
