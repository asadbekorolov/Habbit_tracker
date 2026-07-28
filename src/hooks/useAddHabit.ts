import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addHabit } from '../services/db';
import type { Habit } from '../services/supabase';
import { toast } from 'sonner';

interface NewHabitArgs {
  userId: string;
  name: string;
  emoji: string;
  type: 'positive' | 'negative';
  target_value?: number;
  unit?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export const useAddHabit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: NewHabitArgs) => {
      const data = await addHabit(
        args.userId,
        args.name,
        args.emoji,
        args.type,
        args.target_value ?? 1,
        args.unit ?? '',
        args.scheduledStart,
        args.scheduledEnd
      );
      return data;
    },
    // 1. "Optimistic" qism: so'rov ketishi bilan keshni yangilash
    onMutate: async (newHabit) => {
      // Barcha habits so'rovlarini bekor qilamiz
      await queryClient.cancelQueries({ queryKey: ['habits', newHabit.userId] });

      // Avvalgi ma'lumotlarni keshdan olib qo'yamiz (rollback uchun)
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits', newHabit.userId]) || [];
      
      const optimisticHabit: Habit = {
        id: String(Date.now()), // vaqtincha ID
        user_id: newHabit.userId,
        name: newHabit.name,
        emoji: newHabit.emoji,
        type: newHabit.type,
        target_value: newHabit.target_value ?? 1,
        unit: newHabit.unit ?? '',
        scheduled_start: newHabit.scheduledStart ?? null,
        scheduled_end: newHabit.scheduledEnd ?? null,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      // Keshni optimistic ma'lumot bilan yangilaymiz
      queryClient.setQueryData<Habit[]>(['habits', newHabit.userId], (old) => {
        return [...(old || []), optimisticHabit];
      });
      
      return { previousHabits };
    },
    // 2. Agar xatolik bo'lsa, avvalgi holatga qaytarish (rollback)
    onError: (err: any, newHabit, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits', newHabit.userId], context.previousHabits);
      }
      toast.error("Odatni qo'shib bo'lmadi", {
        description: err?.message || String(err),
      });
    },
    // 3. Muvaffaqiyatli bo'lsa, xabar ko'rsatish
    onSuccess: (data, variables) => {
      toast.success(`"${variables.name}" odati muvaffaqiyatli qo'shildi!`);
    },
    // 4. Yakunlanganda keshni serverdan qayta yuklash (refetch)
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['habits', variables.userId] });
    },
  });
};
