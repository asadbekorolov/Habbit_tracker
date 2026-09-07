import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import { Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const ResetPasswordPage = ({ onComplete }: { onComplete: () => void }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Parollar mos kelmadi");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Parol muvaffaqiyatli yangilandi!");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Parolni yangilashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-6 bg-background dark:bg-background text-foreground">
      <div className="w-full max-w-sm duo-card p-6">
        <div className="w-12 h-12 rounded-2xl bg-duo-green/10 text-duo-green flex items-center justify-center mb-4">
          <Lock className="w-6 h-6"/>
        </div>
        <h2 className="text-xl font-black mb-1">Yangi Parol O'rnatish</h2>
        <p className="text-xs text-duo-text-muted mb-6 font-bold uppercase tracking-wider">Iltimos, hisobingiz uchun yangi xavfsiz parol kiriting</p>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-duo-text-muted mb-1.5 block">Yangi Parol</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl border-2 border-duo-gray dark:border-duo-gray bg-transparent text-sm focus:border-duo-green outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-duo-text-muted mb-1.5 block">Parolni Tasdiqlang</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl border-2 border-duo-gray dark:border-duo-gray bg-transparent text-sm focus:border-duo-green outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="duo-button-primary w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? "Saqlanmoqda..." : "Parolni Yangilash"}
            <ArrowRight className="w-5 h-5"/>
          </button>
        </form>
      </div>
    </div>
  );
};
