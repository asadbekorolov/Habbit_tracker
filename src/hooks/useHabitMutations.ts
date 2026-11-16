// Odat yaratish / tahrirlash / o'chirish / eslatma — yagona joyda
// (Bosh sahifa, odat tafsilotlari oynasi va Odatlarni boshqarish sahifasi).
import { useQueryClient } from '@tanstack/react-query';
import type { Habit } from '../services/supabase';
import { deleteHabit, updateHabit } from '../services/db';
import { notificationService } from '../services/notificationService';
import { habitCache } from './queries';
import { useAddHabit } from './useAddHabit';
import { getHabitOrder, setHabitOrder } from '../utils/habitOrder';
import { trackEvent } from '../utils/analytics';

/** AddHabitModal.onAdd() qaytaradigan shakl */
export interface HabitFormData {
  name: string;
  emoji: string;
  type: 'positive' | 'negative';
  description?: string;
  target_value?: number;
  unit?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  reminder?: string;
}

const reminderKey = (habitId: string) => `reminder_${habitId}`;

/** Eslatma vaqti ("HH:MM") — qurilmada saqlanadi (mahalliy bildirishnoma). */
export function getHabitReminder(habitId: string): string | null {
  try { return localStorage.getItem(reminderKey(habitId)); } catch { return null; }
}

export async function setHabitReminder(habitId: string, habitName: string, time: string | null) {
  if (time) {
    try { localStorage.setItem(reminderKey(habitId), time); } catch { /* yo'q */ }
    await notificationService.initNotifications();
    await notificationService.scheduleHabitReminder(habitId, habitName, time);
  } else {
    try { localStorage.removeItem(reminderKey(habitId)); } catch { /* yo'q */ }
    await notificationService.cancelHabitReminder(habitId);
  }
}

export function useHabitMutations(uid: string) {
  const queryClient = useQueryClient();
  const addMutation = useAddHabit();

  async function create(data: HabitFormData): Promise<Habit> {
    const habit = await addMutation.mutateAsync({ userId: uid, ...data });
    trackEvent('habit_created', { type: data.type }, uid);
    if (data.reminder) await setHabitReminder(habit.id, data.name, data.reminder);
    return habit;
  }

  async function update(habitId: string, data: HabitFormData): Promise<Habit> {
    const updated = await updateHabit(habitId, {
      name: data.name,
      emoji: data.emoji,
      description: data.description,
      target_value: data.target_value,
      unit: data.unit,
      scheduled_start: data.scheduledStart || null,
      scheduled_end: data.scheduledEnd || null,
      ...(data.type ? { type: data.type } : {}),
    } as any);
    habitCache.updated(queryClient, uid, { ...updated, id: habitId });
    await setHabitReminder(habitId, data.name, data.reminder || null);
    return updated;
  }

  async function remove(habitId: string): Promise<void> {
    await deleteHabit(habitId);
    await notificationService.cancelHabitReminder(habitId).catch(() => {});
    try { localStorage.removeItem(reminderKey(habitId)); } catch { /* yo'q */ }
    setHabitOrder(uid, getHabitOrder(uid).filter((id) => id !== habitId));
    habitCache.removed(queryClient, uid, habitId);
  }

  return { create, update, remove, isCreating: addMutation.isPending };
}
