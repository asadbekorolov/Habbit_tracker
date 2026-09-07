import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, ChevronUp, ChevronDown, X } from "lucide-react";

interface CustomTimePickerModalProps {
  isOpen: boolean;
  initialTime: string; // e.g. "07:30"
  title?: string;
  onSave: (timeStr: string) => void;
  onClose: () => void;
  isDark?: boolean;
}

export function CustomTimePickerModal({
  isOpen,
  initialTime,
  title = "Vaqtni tanlang",
  onSave,
  onClose,
  isDark = true,
}: CustomTimePickerModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const parts = (initialTime || "09:00").split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      setHour(isNaN(h) ? 9 : h);
      setMinute(isNaN(m) ? 0 : m);
    }
  }, [isOpen, initialTime]);

  if (!isOpen) return null;

  const formattedHour = String(hour).padStart(2, "0");
  const formattedMinute = String(minute).padStart(2, "0");

  const incrementHour = () => setHour((h) => (h + 1) % 24);
  const decrementHour = () => setHour((h) => (h - 1 + 24) % 24);

  const incrementMinute = () => setMinute((m) => (m + 5) % 60);
  const decrementMinute = () => setMinute((m) => (m - 5 + 60) % 60);

  const applyPreset = (h: number, m: number) => {
    setHour(h);
    setMinute(m);
  };

  const handleConfirm = () => {
    onSave(`${formattedHour}:${formattedMinute}`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl overflow-hidden p-6 bg-slate-900 border border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">{title}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close-trigger
            aria-label="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Big Monospace Display & Steppers */}
        <div className="flex items-center justify-center gap-4 py-4 my-2 rounded-2xl bg-slate-950 border border-slate-800/80">
          {/* Hour Column */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={incrementHour}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 active:scale-95 transition-all"
            >
              <ChevronUp size={20} />
            </button>
            <span className="text-4xl font-bold tracking-wider text-emerald-400 font-mono select-none">
              {formattedHour}
            </span>
            <button
              type="button"
              onClick={decrementHour}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 active:scale-95 transition-all"
            >
              <ChevronDown size={20} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Soat</span>
          </div>

          <span className="text-4xl font-bold text-emerald-400 font-mono -mt-5 animate-pulse">:</span>

          {/* Minute Column */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={incrementMinute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 active:scale-95 transition-all"
            >
              <ChevronUp size={20} />
            </button>
            <span className="text-4xl font-bold tracking-wider text-emerald-400 font-mono select-none">
              {formattedMinute}
            </span>
            <button
              type="button"
              onClick={decrementMinute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 active:scale-95 transition-all"
            >
              <ChevronDown size={20} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Daqiqa</span>
          </div>
        </div>

        {/* Quick Presets Strip */}
        <div className="flex items-center justify-between gap-1.5 my-4">
          <button
            type="button"
            onClick={() => applyPreset(7, 0)}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-300 transition-all text-center"
          >
            07:00 <span className="text-[9px] text-slate-400 block">(Ertalab)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset(13, 0)}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-300 transition-all text-center"
          >
            13:00 <span className="text-[9px] text-slate-400 block">(Tushlik)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset(21, 0)}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-300 transition-all text-center"
          >
            21:00 <span className="text-[9px] text-slate-400 block">(Kechqurun)</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            data-modal-close-trigger
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            O'rnatish
          </button>
        </div>
      </motion.div>
    </div>
  );
}
