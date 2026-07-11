import { useEffect } from "react";
import { Trophy } from "lucide-react";
import { useLang } from "../store/LangContext";

interface LevelUpToastProps {
  level: number;
  levelName: string;
  onClose: () => void;
}

export function LevelUpToast({ level, levelName, onClose }: LevelUpToastProps) {
  const { t } = useLang();
  // 5 soniyadan so'ng avtomatik yopilishi uchun
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm toast-overlay">
      <div className="bg-[var(--card)] border border-[var(--neon-green)] p-8 rounded-3xl flex flex-col items-center gap-4 shadow-[0_0_40px_rgba(74,222,128,0.3)] max-w-sm text-center mx-4 toast-content relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--neon-green)] opacity-5 animate-pulse"></div>
        <div className="relative">
          <div className="absolute inset-0 bg-[var(--neon-green)] blur-2xl opacity-40 rounded-full animate-pulse"></div>
          <Trophy className="w-20 h-20 text-[var(--neon-green)] relative z-10 animate-bounce" />
        </div>
        
        <h2 className="text-3xl font-bold text-[var(--foreground)] mt-2">
          {t('levelup_title')}
        </h2>

        <p className="text-sm text-[var(--muted-foreground)]">
          {t('levelup_body').split(/(\{lvl\}|\{name\})/).map((part, i) => {
            if (part === '{lvl}' || part === '{name}') {
              return (
                <span key={i} className="text-[var(--neon-green)] font-bold text-base">
                  {part === '{lvl}' ? level : levelName}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 bg-[var(--neon-green)] text-black font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all"
        >
          {t('levelup_continue')}
        </button>
      </div>

      <style>{`
        .toast-overlay { animation: fadeIn 0.3s ease-out forwards; }
        .toast-content { animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}