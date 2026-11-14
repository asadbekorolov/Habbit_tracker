import React, { useState, useEffect, useRef } from "react";
import { Clock, X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";
import { useHaptics } from "../hooks/useHaptics";

interface CustomTimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialTime?: string;
  onConfirm?: (timeStr: string) => void;
  onSave?: (timeStr: string) => void;
}

const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_LIST = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function CustomTimePickerModal({
  isOpen,
  onClose,
  title = "Boshlanish vaqti",
  initialTime = "06:30",
  onConfirm,
  onSave,
}: CustomTimePickerModalProps) {
  useScrollLock(isOpen);
  const haptics = useHaptics();

  const [selectedHour, setSelectedHour] = useState(6);
  const [selectedMinute, setSelectedMinute] = useState(30);

  const hoursContainerRef = useRef<HTMLDivElement>(null);
  const minutesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const parts = (initialTime || "06:30").split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const validH = isNaN(h) ? 6 : Math.min(23, Math.max(0, h));
      // Round minute to nearest 5
      const validM = isNaN(m) ? 30 : Math.round(m / 5) * 5 % 60;
      setSelectedHour(validH);
      setSelectedMinute(validM);
    }
  }, [isOpen, initialTime]);

  // Scroll selected items into view when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const hourEl = hoursContainerRef.current?.querySelector(`[data-hour="${selectedHour}"]`);
        if (hourEl) hourEl.scrollIntoView({ block: "center", behavior: "smooth" });

        const minEl = minutesContainerRef.current?.querySelector(`[data-minute="${selectedMinute}"]`);
        if (minEl) minEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 100);
    }
  }, [isOpen, selectedHour, selectedMinute]);

  // Keyboard Escape listener for Android physical back button navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        haptics.impactLight();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedHours = String(selectedHour).padStart(2, "0");
  const formattedMinutes = String(selectedMinute).padStart(2, "0");

  const handleHourSelect = (h: number) => {
    haptics.impactLight();
    setSelectedHour(h);
  };

  const handleMinuteSelect = (m: number) => {
    haptics.impactLight();
    setSelectedMinute(m);
  };

  const applyPreset = (h: number, m: number) => {
    haptics.impactLight();
    setSelectedHour(h);
    setSelectedMinute(m);
  };

  const handleConfirm = () => {
    haptics.impactLight();
    const finalTime = `${formattedHours}:${formattedMinutes}`;
    if (onConfirm) onConfirm(finalTime);
    else if (onSave) onSave(finalTime);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 overscroll-contain touch-none"
      onClick={() => {
        haptics.impactLight();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 overscroll-contain touch-pan-y animate-in fade-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Clock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.impactLight();
              onClose();
            }}
            data-modal-close-trigger
            aria-label="yopish"
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual-Column Scrollable Squircle Selector */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex items-center justify-around relative overflow-hidden">
          {/* Left Column: Hours (00 to 23) */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-['Geist_Mono',monospace] font-mono tracking-widest font-bold text-slate-500 uppercase mb-2">
              SOAT
            </span>
            <div
              ref={hoursContainerRef}
              className="h-44 w-full max-w-[100px] overflow-y-auto no-scrollbar space-y-1.5 p-1 scroll-smooth"
            >
              {HOURS_LIST.map((h) => {
                const isSelected = h === selectedHour;
                const strH = String(h).padStart(2, "0");
                return (
                  <button
                    key={h}
                    data-hour={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={`w-full py-2 px-3 font-['Geist_Mono',monospace] font-mono flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold rounded-xl text-lg shadow-sm shadow-emerald-500/10"
                        : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 rounded-xl text-sm"
                    }`}
                  >
                    {strH}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Middle: Emerald Glowing Colon Separator */}
          <div className="flex items-center justify-center px-2">
            <span className="text-2xl font-['Geist_Mono',monospace] font-mono font-bold text-emerald-400 animate-pulse select-none">
              :
            </span>
          </div>

          {/* Right Column: Minutes (00 to 55 in 5-minute increments) */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-['Geist_Mono',monospace] font-mono tracking-widest font-bold text-slate-500 uppercase mb-2">
              DAQIQA
            </span>
            <div
              ref={minutesContainerRef}
              className="h-44 w-full max-w-[100px] overflow-y-auto no-scrollbar space-y-1.5 p-1 scroll-smooth"
            >
              {MINUTES_LIST.map((m) => {
                const isSelected = m === selectedMinute;
                const strM = String(m).padStart(2, "0");
                return (
                  <button
                    key={m}
                    data-minute={m}
                    type="button"
                    onClick={() => handleMinuteSelect(m)}
                    className={`w-full py-2 px-3 font-['Geist_Mono',monospace] font-mono flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold rounded-xl text-lg shadow-sm shadow-emerald-500/10"
                        : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 rounded-xl text-sm"
                    }`}
                  >
                    {strM}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Presets Row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset(7, 0)}
            className="flex-1 py-2 px-2 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 rounded-2xl text-center transition-all cursor-pointer group"
          >
            <p className="text-xs font-['Geist_Mono',monospace] font-mono font-bold text-white group-hover:text-emerald-400">07:00</p>
            <p className="text-[10px] font-medium text-slate-400">Ertalab</p>
          </button>
          <button
            type="button"
            onClick={() => applyPreset(13, 0)}
            className="flex-1 py-2 px-2 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 rounded-2xl text-center transition-all cursor-pointer group"
          >
            <p className="text-xs font-['Geist_Mono',monospace] font-mono font-bold text-white group-hover:text-emerald-400">13:00</p>
            <p className="text-[10px] font-medium text-slate-400">Tushlik</p>
          </button>
          <button
            type="button"
            onClick={() => applyPreset(21, 0)}
            className="flex-1 py-2 px-2 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 rounded-2xl text-center transition-all cursor-pointer group"
          >
            <p className="text-xs font-['Geist_Mono',monospace] font-mono font-bold text-white group-hover:text-emerald-400">21:00</p>
            <p className="text-[10px] font-medium text-slate-400">Kechqurun</p>
          </button>
        </div>

        {/* Action Footer */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            data-modal-close-trigger
            onClick={() => {
              haptics.impactLight();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-2xl text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer text-center"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-2xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-center"
          >
            Tanlash
          </button>
        </div>
      </div>
    </div>
  );
}
