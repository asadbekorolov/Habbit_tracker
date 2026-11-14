import { useQuery } from '@tanstack/react-query';
import { fetchRoutines } from '../services/db';
import type { Routine } from '../services/supabase';

export const useRoutines = (userId: string) => {
  const query = useQuery<Routine[], Error>({
    queryKey: ['routines', userId],
    queryFn: async () => {
      console.log('[DEBUG ROUTINES] Executing queryFn for userId:', userId);
      const res = await fetchRoutines(userId);
      console.log('[DEBUG ROUTINES] queryFn returned:', res);
      return res;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache retention
  });

  console.log('[DEBUG ROUTINES] Query status:', {
    userId,
    isLoading: query.isLoading,
    dataLength: query.data?.length,
    routines: query.data,
  });

  return query;
};
