// db/admin.ts — Admin statistikasi, fikr-mulohazalar, moderatsiya.
// Eski importlar uchun hammasi src/services/db.ts orqali qayta eksport qilinadi.

import { supabase } from '../supabase'
import { tashkentTodayAnchor, toDateStr } from '../../utils/date'

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

// ─── ADMIN MODERATION (barcha guruhlar bo'yicha) ────────────
export async function getAllPendingApprovals() {
  const { data, error } = await supabase
    .from('group_habit_logs')
    .select('*, profiles!user_id(display_name, full_name, avatar_color, avatar_url, username), group_habits(name, emoji), groups(name)')
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
    .select('*, profiles!user_id(display_name, full_name, avatar_color, avatar_url, username), group_habits(name, emoji), groups(name)')
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
    .select('user_id, log_date, approval_status, completed, reps, group_habit_id, profiles!user_id(display_name, full_name, avatar_color, avatar_url), group_habits(name, emoji)')
    .eq('group_id', groupId)
    .gte('log_date', firstDay)
    .order('log_date')
  if (error) throw error
  return data || []
}
