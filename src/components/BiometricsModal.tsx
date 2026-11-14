import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, X, Check, Loader2, Scale, Ruler } from 'lucide-react';
import type { Profile } from '../services/supabase';
import { updateUserProfile } from '../services/db';
import { useScrollLock } from '../hooks/useScrollLock';

interface BiometricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileUpdate?: (p: Profile) => void;
}

export const BiometricsModal: React.FC<BiometricsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdate,
}) => {
  useScrollLock(isOpen);

  const [heightCm, setHeightCm] = useState<number>(profile.height_cm || 175);
  const [weightKg, setWeightKg] = useState<number>(profile.weight_kg || 70);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setHeightCm(profile.height_cm || 175);
      setWeightKg(profile.weight_kg || 70);
      setError('');
    }
  }, [isOpen, profile.height_cm, profile.weight_kg]);

  // Live BMI calculation
  const heightM = heightCm / 100;
  const bmiVal = heightM > 0 ? weightKg / (heightM * heightM) : 0;
  const bmiFormatted = bmiVal.toFixed(1);

  let bmiCategory = "Me'yoriy";
  let bmiColor = "text-emerald-400 border-emerald-500/30 bg-emerald-950/40";

  if (bmiVal < 18.5) {
    bmiCategory = "Yengil vazn";
    bmiColor = "text-amber-400 border-amber-500/30 bg-amber-950/40";
  } else if (bmiVal >= 25.0) {
    bmiCategory = "Mustahkam vazn";
    bmiColor = "text-blue-400 border-blue-500/30 bg-blue-950/40";
  }

  const handleSave = async () => {
    if (heightCm < 50 || heightCm > 250) {
      setError("Bo'yingizni to'g'ri kiriting (50 - 250 sm)");
      return;
    }
    if (weightKg < 20 || weightKg > 300) {
      setError("Vazningizni to'g'ri kiriting (20 - 300 kg)");
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Natija get_my_profile() orqali qaytadi (profiles'dan select('*') yopiq).
      const data = await updateUserProfile(profile.id, {
        height_cm: heightCm,
        weight_kg: weightKg,
      });

      const updatedProfile = { ...profile, ...data, height_cm: heightCm, weight_kg: weightKg };
      onProfileUpdate?.(updatedProfile);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Ma'lumotlarni saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Antropometrik ko'rsatkichlar"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm rounded-3xl p-6 bg-slate-900 border border-slate-800 text-white shadow-2xl space-y-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Activity className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-slate-100 tracking-wide">
                Antropometriya
              </h3>
            </div>
            <button
              type="button"
              data-modal-close-trigger
              onClick={onClose}
              aria-label="Yopish"
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* Live BMI Display Card */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-['Geist_Mono',monospace] font-mono uppercase tracking-widest text-slate-400 block">
                Tana Massasi Indeksi (BMI)
              </span>
              <span className="text-2xl font-bold font-['Geist_Mono',monospace] font-mono text-emerald-400">
                {bmiFormatted}
              </span>
            </div>

            <span className={`text-xs font-bold font-['Geist_Mono',monospace] font-mono px-3 py-1 rounded-full border ${bmiColor}`}>
              {bmiCategory}
            </span>
          </div>

          {/* Inputs for Height & Weight */}
          <div className="space-y-4">
            {/* Height Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bo'y uzunligi (sm)</span>
              </label>
              <input
                type="number"
                min={50}
                max={250}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-emerald-400 font-['Geist_Mono',monospace] font-mono font-bold text-lg focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Weight Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vazn (kg)</span>
              </label>
              <input
                type="number"
                min={20}
                max={300}
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-emerald-400 font-['Geist_Mono',monospace] font-mono font-bold text-lg focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium text-center">⚠ {error}</p>}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
              <span>Saqlash</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
