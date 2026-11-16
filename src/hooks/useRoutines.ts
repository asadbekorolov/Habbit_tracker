import { useQuery } from '@tanstack/react-query';
import { fetchRoutines } from '../services/db';
import type { Routine } from '../services/supabase';

export const useRoutines = (userId: string) =>
  useQuery<Routine[], Error>({
    queryKey: ['routines', userId],
    queryFn: () => fetchRoutines(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
