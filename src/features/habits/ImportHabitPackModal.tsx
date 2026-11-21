// Do'st yuborgan odatlar to'plamini ko'rish va tanlanganlarini o'ziga
// mustaqil nusxa qilib olish (059: get_habit_pack / import_habit_pack).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Package, Check, Loader2, AlertTriangle, Download, Users, Clock, CalendarDays, Info } from "lucide-react";
import { useLang } from "../../store/LangContext";
import { useProfile } from "../../store/UserContext";
import { useScrollLock } from "../../hooks/useScrollLock";
import { getHabitPack, importHabitPack, HabitPackError, type HabitPackItem } from "../../services/db";
import { queryClient, queryKeys } from "../../services/queryClient";
import { HabitIcon, cleanHabitName } from "../../components/HabitIcon";
import { DAYS_SHORT } from "../../utils/i18n";

interface ImportHabitPackModalProps {
  code: string;
  onClose: () => void;
}

function useItemMeta() {
  const { t, lang } = useLang();
  return (item: HabitPackItem): string[] => {
    const meta: string[] = [];
    if ((item.target_value ?? 1) > 1) meta.push(`${item.target_value}${item.unit ? ` ${item.unit}` : ""}`);
    const days = item.days_of_week ?? [];
    if (days.length > 0 && days.length < 7) meta.push(days.map((d) => DAYS_SHORT[lang][d % 7]).join(" "));
    if (item.scheduled_start) meta.push(item.scheduled_start.slice(0, 5));
    if (item.type === "negative") meta.push(t("pack_negative_note"));
    return meta;
  };
}

export function ImportHabitPackModal({ code, onClose }: ImportHabitPackModalProps) {
  const { t } = useLang();
  const profile = useProfile();
  useScrollLock(true);
  const metaOf = useItemMeta();
  const packQ = useQuery({
    queryKey: ["habitPack", code],
    queryFn: () => getHabitPack(code),
    retry: (n, e) => !(e instanceof HabitPackError && e.code) && n < 2,
    meta: { persist: false },
  });
  const pack = packQ.data;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  // To'plam yuklangach — hammasi belgilangan (foydalanuvchi keraksizini olib tashlaydi)
  useEffect(() => {
    if (pack) setSelected(new Set(pack.items.map((_, i) => i)));
  }, [pack]);

  const allOn = !!pack && selected.size === pack.items.length;

  function toggle(i: number) {
    setError("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function handleImport() {
    if (!pack || importing || selected.size === 0) return;
    setImporting(true);
    setError("");
    try {
      const indices = allOn ? null : Array.from(selected).sort((a, b) => a - b);
      const r = await importHabitPack(code, indices);
      // Yangi odatlar darhol Bosh sahifa va Odatlar ro'yxatida ko'rinsin
      await queryClient.invalidateQueries({ queryKey: queryKeys.habits(profile.id) });
      toast.success(t("pack_imported_toast").replace("{n}", String(r.imported)));
      onClose();
    } catch (e: any) {
      setError(e?.message || t("svc_pack_import_error"));
      setImporting(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={() => !importing && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-800/80"
        style={{ background: "#0d121c", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <Package size={16} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white truncate">{t("pack_import_modal_title")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close-trigger
            disabled={importing}
            aria-label={t("ref_close")}
            className="p-1.5 rounded-lg bg-white/[0.07]"
          >
            <X size={15} className="text-slate-400" />
          </button>
        </div>

        {packQ.isPending ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-emerald-400" /></div>
        ) : !pack ? (
          <div className="px-5 pb-5">
            <div className="rounded-2xl p-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{(packQ.error as Error)?.message || t("svc_pack_load_error")}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 shrink-0">
              <div className="rounded-3xl p-4 bg-emerald-500/[0.06] border border-emerald-500/25">
                <div className="text-base font-bold text-white leading-snug break-words">{pack.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{t("pack_from")} <span className="text-slate-200 font-semibold">{pack.creator_name}</span></span>
                  <span className="flex items-center gap-1"><Package size={11} /> <span className="font-mono">{pack.items.length}</span> {t("pack_habits_count")}</span>
                  {pack.imports_count > 0 && (
                    <span className="flex items-center gap-1"><Users size={11} /> <span className="font-mono">{pack.imports_count}</span> {t("pack_imports_count")}</span>
                  )}
                </div>
              </div>
              {pack.is_own ? (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-300/90 leading-relaxed">
                  <Info size={12} className="shrink-0 mt-px" /> {t("svc_pack_own")}
                </p>
              ) : (
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{t("pack_import_hint")}</span>
                  <button
                    type="button"
                    onClick={() => setSelected(allOn ? new Set() : new Set(pack.items.map((_, i) => i)))}
                    className="font-semibold text-emerald-300"
                  >
                    {allOn ? t("pack_select_none") : t("pack_select_all")}
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-3 space-y-1.5 overflow-y-auto overscroll-contain touch-pan-y min-h-0">
              {pack.items.map((item, i) => {
                const on = selected.has(i);
                const meta = metaOf(item);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => !pack.is_own && toggle(i)}
                    disabled={importing || pack.is_own}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all ${
                      on && !pack.is_own ? "bg-emerald-500/[0.07] border-emerald-500/30" : "bg-slate-900/50 border-slate-800/80"
                    }`}
                  >
                    <HabitIcon emoji={item.emoji} name={item.name} size={16} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{cleanHabitName(item.name)}</span>
                      {meta.length > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                          {item.scheduled_start ? <Clock size={10} className="shrink-0" /> : <CalendarDays size={10} className="shrink-0" />}
                          <span className="font-mono truncate">{meta.join(" · ")}</span>
                        </span>
                      )}
                    </span>
                    {!pack.is_own && (
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${on ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}>
                        {on && <Check size={13} className="text-[#05210f]" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5 pt-3 space-y-2 shrink-0 border-t border-white/[0.05]">
              {error && (
                <p className="text-xs px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="shrink-0" />{error}
                </p>
              )}
              {pack.is_own ? (
                <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold bg-slate-800/80 text-slate-200 border border-slate-700/60">
                  {t("ref_close")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || selected.size === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-emerald-500 text-[#05210f] disabled:opacity-50 active:scale-[0.99]"
                >
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {t("pack_import_btn")} <span className="font-mono">({selected.size})</span>
                </button>
              )}
              <p className="text-[10px] text-slate-500 text-center">{t("pack_import_note")}</p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
