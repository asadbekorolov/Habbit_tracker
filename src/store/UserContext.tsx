import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Profile } from '../services/supabase';

interface UserContextType {
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  refreshUserProfile: () => Promise<void>;
  updateCoins: (newCoins: number) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem('user_profile_latest');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setProfile(data);
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(data));
      localStorage.setItem('user_profile_latest', JSON.stringify(data));
    }
    setLoading(false);
  }, []);

  const updateCoins = useCallback((newCoins: number) => {
    setProfile(prev => {
      if (!prev) return null;
      const updated = { ...prev, coins: newCoins };
      localStorage.setItem(`user_profile_${prev.id}`, JSON.stringify(updated));
      localStorage.setItem('user_profile_latest', JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    refreshUserProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        refreshUserProfile();
      } else {
        setProfile(null);
        localStorage.removeItem('user_profile_latest');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshUserProfile]);

  return (
    <UserContext.Provider value={{ profile, setProfile, refreshUserProfile, updateCoins, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
