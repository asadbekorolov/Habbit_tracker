import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Calendar, Ruler, Scale, ArrowRight, Loader2, X, Plus, Minus, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Profile } from '../services/supabase';
import { supabase } from '../services/supabase';
import { updateBiometrics } from '../services/db';
import { useScrollLock } from '../hooks/useScrollLock';

export interface BiometricsOnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  profile: Profile;
  onProfileUpdate?: (p: Profile) => void;
  allowDismiss?: boolean;
}

export const BiometricsOnboardingModal: React.FC<BiometricsOnboardingModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdate,
  allowDismiss = true,
}) => {
  useScrollLock(isOpen);

  const [birthDate, setBirthDate] = useState<string>(profile.birth_date || '2003-01-01');
  const [heightCm, setHeightCm] = useState<number>(profile.height_cm || 175);
  const [weightKg, setWeightKg] = useState<number>(profile.weight_kg || 70);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBirthDate(profile.birth_date || '2003-01-01');
      setHeightCm(profile.height_cm || 175);
      setWeightKg(profile.weight_kg || 70);
      setError('');
    }
  }, [isOpen, profile.birth_date, profile.height_cm, profile.weight_kg]);

  // Compute Age dynamically
  const age = useMemo(() => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    if (isNaN(birth.getTime())) return null;

    let computedAge = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      computedAge--;
    }
    return computedAge >= 0 && computedAge <= 120 ? computedAge : null;
  }, [birthDate]);

  // Live BMI calculation
  const heightM = heightCm / 100;
  const bmiVal = heightM > 0 ? weightKg / (heightM * heightM) : 0;
  const bmiFormatted = bmiVal.toFixed(1);

  let bmiCategory = "Normal";
  let bmiColor = "text-emerald-400 border-emerald-500/30 bg-emerald-950/40";

  if (bmiVal < 18.5) {
    bmiCategory = "Yengil vazn";
    bmiColor = "text-amber-400 border-amber-500/30 bg-amber-950/40";
  } else if (bmiVal >= 25.0) {
    bmiCategory = "Mustahkam vazn";
    bmiColor = "text-blue-400 border-blue-500/30 bg-blue-950/40";
  }

  const handleSave = async () => {
    if (!birthDate) {
      setError("Tug'ilgan sanani kiriting");
      return;
    }
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

    // Inspect & fallback auth user ID
    let targetUserId: string | undefined = profile?.id;
    if (!targetUserId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData.user?.id;
      } catch (err) {
        console.error("Auth user retrieval error:", err);
      }
    }

    if (!targetUserId) {
      console.error("No authenticated user ID available for biometrics update.");
      setError("Foydalanuvchi seansi topilmadi. Qayta kiring.");
      setSaving(false);
      return;
    }

    try {
      const updatedProfile = await updateBiometrics(
        targetUserId,
        heightCm,
        weightKg,
        birthDate
      );

      // Record biometrics completion flag in localStorage
      try {
        localStorage.setItem(`biometrics_completed_${targetUserId}`, 'true');
      } catch {}

      // Trigger light haptic impact on success
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.impact({ style: ImpactStyle.Light });
        } catch {}
      }

      // Merge updated profile into parent/UserContext state
      const mergedProfile: Profile = {
        ...profile,
        ...updatedProfile,
        height_cm: heightCm,
        weight_kg: weightKg,
        birth_date: birthDate,
      };

      onProfileUpdate?.(mergedProfile);
      if (onClose) onClose();
    } catch (e: any) {
      console.error("Biometrics update submission error:", e);
      // Fallback: save flag locally and update UI state anyway so user is not stuck
      try {
        localStorage.setItem(`biometrics_completed_${targetUserId}`, 'true');
      } catch {}
      onProfileUpdate?.({
        ...profile,
        height_cm: heightCm,
        weight_kg: weightKg,
        birth_date: birthDate,
      });
      if (onClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (profile?.id) {
      try {
        localStorage.setItem(`biometrics_completed_${profile.id}`, 'true');
      } catch {}
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shaxsiy ko'rsatkichlar"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d16]/95 backdrop-blur-2xl touch-none overscroll-contain"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-sm rounded-3xl p-6 sm:p-7 bg-slate-900/90 border border-slate-800/90 text-white shadow-2xl space-y-5 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                <UserCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 tracking-wide leading-snug">
                  Shaxsiy ko'rsatkichlar
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Odatlar va intizomingizni aniq hisoblash uchun kiritiladi
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Yopish"
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4 pt-1">
            {/* Field 1: Birth Date & Computed Age */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tug'ilgan sana</span>
                </label>
                {age !== null && (
                  <span className="text-xs font-bold font-['Geist_Mono',monospace] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    {age} yosh
                  </span>
                )}
              </div>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-emerald-400 font-['Geist_Mono',monospace] font-mono font-bold text-base focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Field 2: Height (cm) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bo'y uzunligi (sm)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHeightCm((prev) => Math.max(50, prev - 1))}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="flex-1 rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-center text-emerald-400 font-['Geist_Mono',monospace] font-mono font-bold text-lg focus:border-emerald-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setHeightCm((prev) => Math.min(250, prev + 1))}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Field 3: Weight (kg) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vazn (kg)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeightKg((prev) => Math.max(20, Math.round((prev - 0.5) * 10) / 10))}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <input
                  type="number"
                  step={0.5}
                  min={20}
                  max={300}
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="flex-1 rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3 text-center text-emerald-400 font-['Geist_Mono',monospace] font-mono font-bold text-lg focus:border-emerald-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setWeightKg((prev) => Math.min(300, Math.round((prev + 0.5) * 10) / 10))}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Live Preview Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 font-['Geist_Mono',monospace] font-mono text-xs font-bold text-slate-300">
              <span className="text-slate-500 uppercase tracking-widest text-[10px]">BMI:</span>
              <span className="text-emerald-400 text-sm">{bmiFormatted}</span>
            </div>

            <span className={`text-xs font-bold font-['Geist_Mono',monospace] font-mono px-3 py-0.5 rounded-full border ${bmiColor}`}>
              {bmiCategory}
            </span>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium text-center"><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}</p>}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
            ) : (
              <>
                <span>Saqlash va davom etish</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
