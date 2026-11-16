// db/habits.ts — Odatlar, loglar, belgilash (toggle_habit_atomic), muzlatish, kunlik vazifalar, rutinalar.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import type { Routine, RoutineItem } from '../supabase'
import { normalizeApostrophes } from '../../utils/text'
import { tashkentTodayAnchor, toDateStr, isTashkentDateOpen } from '../../utils/date'
import { fetchAllPages } from '../../utils/pagination'
import { nativeNotificationService } from '../nativeNotificationService'
import { COMPACT_LOG_COLUMNS, isHabitLogSuccess, type CompactLog } from './core'

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
  const baseData: Record<string, unknown> = { user_id: userId, name: normalizeApostrophes(name), emoji, type };
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
    .update(updates.name !== undefined ? { ...updates, name: normalizeApostrophes(updates.name) } : updates)
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
      Promise.resolve(
        supabase
          .from('routine_items')
          .update({ is_completed_today: false })
          .in('id', itemsToResetInDb)
      ).catch(() => {});
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
