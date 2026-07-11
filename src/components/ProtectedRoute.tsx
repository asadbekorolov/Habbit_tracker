import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useEffect, useState } from 'react';

export const ProtectedRoute = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase sessiyasini tekshiramiz
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Sessiya o'zgarganda (log out bo'lsa) avtomatik kuzatish
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E1117]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4ADE80", borderTopColor: "transparent" }} />
      </div>
    );
  }
  
  // Agar sessiya bo'lmasa, login sahifasiga yuboramiz
  return session ? <Outlet /> : <Navigate to="/login" replace />;
};
