// db/health.ts — Salomatlik loglari, kundalik yozuvlar, haftalik xulosa, AI murabbiy eslatmasi.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { tashkentTodayAnchor, toDateStr } from '../../utils/date'
import { LOG_LOCKED_MESSAGE, isLogDateLocked } from './habits'

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
