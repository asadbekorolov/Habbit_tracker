// db/habitPacks.ts — Odatlar to'plamini ulashish (059).
import { supabase } from '../supabase'
import { st } from '../../utils/serviceT'
import type { TKey } from '../../utils/i18n'
import { habitPackErrorCode, type HabitPackErrorCode } from '../../utils/habitPack'

export interface HabitPackItem {
  name: string
  emoji: string
  type: 'positive' | 'negative'
  target_value: number
  unit: string
  days_of_week: number[]
  scheduled_start: string | null
  scheduled_end: string | null
}

export interface HabitPackPreview {
  code: string
  title: string
  creator_name: string
  items: HabitPackItem[]
  imports_count: number
  created_at: string
  is_own: boolean
}

export class HabitPackError extends Error {
  constructor(public code: HabitPackErrorCode | null, message: string) {
    super(message)
    this.name = 'HabitPackError'
  }
}

const ERROR_KEYS: Record<HabitPackErrorCode, TKey> = {
  pack_not_found: 'svc_pack_not_found',
  own_pack: 'svc_pack_own',
  habit_not_owned: 'svc_pack_not_owned',
  no_habits: 'svc_pack_no_habits',
  too_many_habits: 'svc_pack_too_many',
  invalid_title: 'svc_pack_invalid_title',
  invalid_selection: 'svc_pack_no_habits',
  rate_limited: 'svc_pack_rate_limited',
  banned: 'svc_banned_short',
  not_authenticated: 'svc_relogin',
}

function toError(message: string | undefined, fallback: TKey): HabitPackError {
  const c = habitPackErrorCode(message)
  return new HabitPackError(c, st(c ? ERROR_KEYS[c] : fallback))
}

export async function createHabitPack(title: string, habitIds: string[]): Promise<{ code: string; count: number }> {
  const { data, error } = await supabase.rpc('create_habit_pack', { p_title: title, p_habit_ids: habitIds })
  if (error || !data) throw toError(error?.message, 'svc_pack_create_error')
  return data as { code: string; count: number }
}

export async function getHabitPack(code: string): Promise<HabitPackPreview> {
  const { data, error } = await supabase.rpc('get_habit_pack', { p_code: code })
  if (error || !data) throw toError(error?.message, 'svc_pack_load_error')
  return data as HabitPackPreview
}

/** indices — items ichidagi tartib raqamlari (0 dan); null — hammasi */
export async function importHabitPack(code: string, indices: number[] | null): Promise<{ imported: number; habit_ids: string[] }> {
  const { data, error } = await supabase.rpc('import_habit_pack', { p_code: code, p_selected_indices: indices })
  if (error || !data) throw toError(error?.message, 'svc_pack_import_error')
  return data as { imported: number; habit_ids: string[] }
}
