import { useQuery } from '@tanstack/react-query';
import { getHabits } from '../services/db';
import type { Habit } from '../services/supabase';

// Custom hook - buni istalgan komponentda ishlatishing mumkin
export const useHabits = (userId: string) => {
  return useQuery<Habit[], Error>({
    queryKey: ['habits', userId], // Bu kesh uchun kalit
    queryFn: () => getHabits(userId),
    enabled: !!userId,
  });
};
