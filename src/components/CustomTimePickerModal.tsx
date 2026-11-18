// IDROK vaqt tanlagichi — brauzerning <input type="time"> (Android'dagi kulrang
// analog siferblat) o'rniga. Ikki ustun: Soat 00–23 va Daqiqa 00–59; har biri
// barmoq bilan silliq aylantiriladi (scroll-snap) yoki tepa/past o'qlar bilan.
// Oyna document.body'ga portal qilinadi — shunda u har doim DOM'da oxirgi
// bo'ladi va Android "Orqaga" tugmasi (data-modal-close-trigger) avval shu
// oynani yopadi, ostidagi modalni emas.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";
import { useHaptics } from "../hooks/useHaptics";
import { useLang } from "../store/LangContext";

interface CustomTimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialTime?: string | null;
  onConfirm?: (timeStr: string) => void;
  onSave?: (timeStr: string) => void;
  /** Berilsa "Tozalash" tugmasi chiqadi (masalan, eslatmani o'chirish). */
  onClear?: () => void;
}

const ITEM_H = 40; // px — bitta qator balandligi
const VISIBLE = 5; // ko'rinadigan qatorlar soni (o'rtadagisi tanlangan)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

const PRESETS: { h: number; m: number; key: "tp_morning" | "tp_work" | "tp_lunch" | "tp_evening" }[] = [
  { h: 7, m: 0, key: "tp_morning" },
  { h: 9, m: 0, key: "tp_work" },
  { h: 13, m: 0, key: "tp_lunch" },
  { h: 21, m: 0, key: "tp_evening" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function parseTime(s: string | null | undefined): { h: number; m: number } {
  const [hs, ms] = (s || "").split(":");
  const h = parseInt(hs, 10);
  const m = parseInt(ms, 10);
  return {
    h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9,
    m: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function WheelColumn({
  label,
  count,
  value,
  onChange,
  upLabel,
  downLabel,
}: {
  label: string;
  count: number;
  value: number;
  onChange: (v: number) => void;
  upLabel: string;
  downLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Qiymat o'zgarsa (o'q, tezkor tugma) — ro'yxat shu qatorga aylanadi.
  // Birinchi ochilishda animatsiyasiz, keyin silliq.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = value * ITEM_H;
    if (Math.abs(el.scrollTop - target) >= 2) {
      if (mountedRef.current) el.scrollTo({ top: target, behavior: "smooth" });
      else el.scrollTop = target;
    }
    mountedRef.current = true;
  }, [value]);

  useEffect(() => () => window.clearTimeout(settleRef.current), []);

  // Barmoq bilan aylantirish to'xtaganda — o'rtadagi qator tanlanadi
  const onScroll = () => {
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (idx !== valueRef.current) onChange(idx);
    }, 90);
  };

  const step = (d: 1 | -1) => onChange((value + d + count) % count);

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <span className="text-[10px] font-mono tracking-widest font-bold text-slate-500 uppercase mb-1.5">{label}</span>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={upLabel}
        className="w-full max-w-[96px] h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
      <div className="relative w-full max-w-[96px]" style={{ height: VISIBLE * ITEM_H }}>
        {/* Tanlov chizig'i */}
        <div
          className="absolute inset-x-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 pointer-events-none"
          style={{ top: PAD, height: ITEM_H }}
        />
        <div
          ref={ref}
          onScroll={onScroll}
          role="listbox"
          aria-label={label}
          className="relative h-full overflow-y-auto no-scrollbar snap-y snap-mandatory overscroll-contain touch-pan-y"
          style={{ paddingTop: PAD, paddingBottom: PAD }}
        >
          {Array.from({ length: count }, (_, i) => {
            const sel = i === value;
            const dist = Math.abs(i - value);
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => onChange(i)}
                className={`w-full snap-center flex items-center justify-center font-mono tabular-nums transition-all cursor-pointer ${
                  sel
                    ? "text-3xl font-bold text-emerald-400"
                    : dist === 1
                    ? "text-lg text-slate-400"
                    : "text-base text-slate-600"
                }`}
                style={{ height: ITEM_H }}
              >
                {pad2(i)}
              </button>
            );
          })}
        </div>
        {/* Yuqori/pastki xiralash */}
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={downLabel}
        className="w-full max-w-[96px] h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}

export function CustomTimePickerModal({
  isOpen,
  onClose,
  title,
  initialTime,
  onConfirm,
  onSave,
  onClear,
}: CustomTimePickerModalProps) {
  useScrollLock(isOpen);
  const haptics = useHaptics();
  const { t } = useLang();

  const [hour, setHour] = useState(() => parseTime(initialTime).h);
  const [minute, setMinute] = useState(() => parseTime(initialTime).m);
  const [wasOpen, setWasOpen] = useState(isOpen);

  // Har ochilishda boshlang'ich vaqt — render paytida (ustunlar to'g'ridan-to'g'ri
  // kerakli qatorda paydo bo'lsin, 09:00 dan aylanib kelmasin)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const p = parseTime(initialTime);
      setHour(p.h);
      setMinute(p.m);
    }
  }

  // Veb: Escape bilan yopish (Android "Orqaga" — data-modal-close-trigger orqali)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const close = () => {
    haptics.impactLight();
    onClose();
  };
  const pickHour = (h: number) => {
    haptics.impactLight();
    setHour(h);
  };
  const pickMinute = (m: number) => {
    haptics.impactLight();
    setMinute(m);
  };
  const confirm = () => {
    haptics.impactLight();
    const value = `${pad2(hour)}:${pad2(minute)}`;
    if (onConfirm) onConfirm(value);
    else onSave?.(value);
    onClose();
  };
  const clear = () => {
    haptics.impactLight();
    onClear?.();
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || t("tp_title")}
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 overscroll-contain"
      onClick={close}
    >
      <div
        className="w-full max-w-sm bg-[#090d16] border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white truncate">{title || t("tp_title")}</h3>
          </div>
          <span className="font-mono text-lg font-bold text-emerald-400 tabular-nums shrink-0">
            {pad2(hour)}:{pad2(minute)}
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 flex items-center justify-center gap-1">
          <WheelColumn
            label={t("tp_hour")}
            count={24}
            value={hour}
            onChange={pickHour}
            upLabel={t("tp_up")}
            downLabel={t("tp_down")}
          />
          <span className="font-mono text-3xl font-bold text-emerald-400 select-none pt-4">:</span>
          <WheelColumn
            label={t("tp_minute")}
            count={60}
            value={minute}
            onChange={pickMinute}
            upLabel={t("tp_up")}
            downLabel={t("tp_down")}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const active = p.h === hour && p.m === minute;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  haptics.impactLight();
                  setHour(p.h);
                  setMinute(p.m);
                }}
                className={`py-2 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/40"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <p className={`text-xs font-mono font-bold ${active ? "text-emerald-300" : "text-white"}`}>
                  {pad2(p.h)}:{pad2(p.m)}
                </p>
                <p className="text-[10px] text-slate-400 truncate px-1">{t(p.key)}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            data-modal-close-trigger
            onClick={close}
            className="flex-1 py-3 rounded-2xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t("tp_cancel")}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={clear}
              className="flex-1 py-3 rounded-2xl text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/15 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> {t("tp_clear")}
            </button>
          )}
          <button
            type="button"
            onClick={confirm}
            className="flex-1 py-3 rounded-2xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            {t("tp_set")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
