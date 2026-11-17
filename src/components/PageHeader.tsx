// Ichki sahifalar uchun yagona sarlavha: orqaga (yagona tarix stekidan bir
// qadam), nom, izoh va ixtiyoriy o'ng tomondagi amallar.
import { ArrowLeft } from "lucide-react";
import { useNavBack } from "../hooks/useNavBack";
import { useLang } from "../store/LangContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** O'ng tomondagi tugmalar */
  actions?: React.ReactNode;
  /** Dock sahifalarida orqaga tugmasi kerak emas */
  hideBack?: boolean;
  onBack?: () => void;
}

export function PageHeader({ title, subtitle, actions, hideBack, onBack }: PageHeaderProps) {
  const { t } = useLang();
  const goBack = useNavBack();
  return (
    <div className="flex items-center gap-3 mb-5">
      {!hideBack && (
        <button
          type="button"
          onClick={onBack ?? goBack}
          aria-label={t("st_back")}
          className="w-10 h-10 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-200 shrink-0 active:scale-95 cursor-pointer hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-white leading-tight truncate">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
