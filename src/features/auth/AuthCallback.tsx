import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../../services/supabase";

// Veb Google OAuth qaytish manzili (authService.ts: redirectTo=/auth/callback).
// supabase-js URL'dagi token/kodni o'zi o'qiydi; getSession() shu jarayon
// tugashini kutadi, so'ng foydalanuvchi Bosh sahifaga (yoki login'ga) o'tadi.
export function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) navigate(data.session ? "/dashboard" : "/login", { replace: true }); })
      .catch(() => { if (alive) navigate("/login", { replace: true }); });
    return () => { alive = false; };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#090d16]">
      <Loader2 size={28} className="animate-spin text-emerald-400" />
    </div>
  );
}
