import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Footprints, Sunrise, Moon, Zap, Edit3 } from 'lucide-react';
import type { Profile } from '../../../services/supabase';
import { useCharacterAvatar, BodyTier, ContextState } from '../../../hooks/useCharacterAvatar';
import { BiometricsModal } from '../../../components/BiometricsModal';

export interface HeroCharacterStageProps {
  profile?: Profile;
  activeHabitName?: string;
  completedCount?: number;
  onProfileUpdate?: (p: Profile) => void;
}

export function HeroCharacterStage({
  profile,
  activeHabitName,
  completedCount = 0,
  onProfileUpdate,
}: HeroCharacterStageProps) {
  const {
    bmiFormatted,
    bodyTier,
    contextState,
    contextLabel,
    heightCm,
    weightKg,
  } = useCharacterAvatar({ profile, activeHabitName });

  const [isBiometricsOpen, setIsBiometricsOpen] = useState(false);
  const [triggerGlowRing, setTriggerGlowRing] = useState(false);
  const [prevCompletedCount, setPrevCompletedCount] = useState(completedCount);
  const [imageError, setImageError] = useState(false);

  // Reset image error state when tier or posture changes so new path is attempted
  useEffect(() => {
    setImageError(false);
  }, [bodyTier, contextState]);

  // Trigger brief 800ms celebratory emerald glow ring on habit completion
  useEffect(() => {
    if (completedCount > prevCompletedCount) {
      setTriggerGlowRing(true);
      const timer = setTimeout(() => setTriggerGlowRing(false), 800);
      setPrevCompletedCount(completedCount);
      return () => clearTimeout(timer);
    }
    setPrevCompletedCount(completedCount);
  }, [completedCount, prevCompletedCount]);

  const imageSrc = `/assets/character/${bodyTier}_${contextState}.png`;

  // Icon corresponding to context posture
  const renderContextIcon = (state: ContextState) => {
    switch (state) {
      case 'shoe_tie':
        return <Footprints className="w-3.5 h-3.5 text-emerald-400 stroke-[2.2]" />;
      case 'morning_stretch':
        return <Sunrise className="w-3.5 h-3.5 text-amber-400 stroke-[2.2]" />;
      case 'resting':
        return <Moon className="w-3.5 h-3.5 text-indigo-400 stroke-[2.2]" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-emerald-400 stroke-[2.2]" />;
    }
  };

  return (
    <>
      <section
        className={`bg-slate-900/50 border border-slate-800/80 rounded-3xl p-4 flex flex-col items-center justify-between min-h-[210px] relative overflow-hidden backdrop-blur-xl shadow-2xl transition-all duration-300 ${
          triggerGlowRing
            ? "ring-2 ring-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.35)] bg-emerald-950/20"
            : ""
        }`}
      >
        {/* Subtle Emerald Radial Pedestal Glow */}
        <div className="absolute bottom-6 w-36 h-10 bg-emerald-500/15 blur-xl rounded-full pointer-events-none" />

        {/* Top Header: BMI Badge (left) & Edit Biometrics trigger (right) */}
        <div className="w-full flex items-center justify-between z-10">
          <button
            type="button"
            onClick={() => setIsBiometricsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 font-['Geist_Mono',monospace] font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>BMI: {bmiFormatted} • {heightCm} sm</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBiometricsOpen(true)}
            aria-label="Antropometriyani tahrirlash"
            className="p-1.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-emerald-500/40 transition-all active:scale-95 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>

        {/* Center: Character Image with SVG Silhouette Fallback & Celebration Scale Pulse */}
        <div className="relative z-10 my-2 flex items-center justify-center h-28 w-28">
          {!imageError ? (
            <motion.img
              src={imageSrc}
              alt="Character Avatar"
              onError={() => setImageError(true)}
              animate={{
                scale: triggerGlowRing ? 1.05 : 1,
              }}
              transition={{ duration: 0.3 }}
              className={`max-h-full max-w-full object-contain transition-all duration-300 ${
                triggerGlowRing
                  ? "drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  : "drop-shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              }`}
            />
          ) : (
            <AvatarSilhouette
              tier={bodyTier}
              posture={contextState}
              isCelebrating={triggerGlowRing}
            />
          )}
        </div>

        {/* Bottom Status Capsule */}
        <div className="z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 border border-emerald-500/30 text-slate-200 text-xs font-medium tracking-wide">
          {renderContextIcon(contextState)}
          <span>{contextLabel}</span>
        </div>
      </section>

      {/* Biometrics Edit Modal */}
      {profile && (
        <BiometricsModal
          isOpen={isBiometricsOpen}
          onClose={() => setIsBiometricsOpen(false)}
          profile={profile}
          onProfileUpdate={onProfileUpdate}
        />
      )}
    </>
  );
}

// Resilient Stylized SVG Silhouette Figure Fallback
function AvatarSilhouette({
  tier,
  posture,
  isCelebrating = false,
}: {
  tier: BodyTier;
  posture: ContextState;
  isCelebrating?: boolean;
}) {
  const headRadius = tier === 'robust' ? 14 : tier === 'slim' ? 11 : 12;
  const torsoWidth = tier === 'robust' ? 36 : tier === 'slim' ? 24 : 30;

  return (
    <motion.svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={{ scale: isCelebrating ? 1.05 : 1 }}
      transition={{ duration: 0.3 }}
      className={`filter transition-all duration-300 ${
        isCelebrating
          ? "drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          : "drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]"
      }`}
    >
      {/* Head */}
      <circle
        cx="48"
        cy={posture === 'shoe_tie' ? '28' : '22'}
        r={headRadius}
        className="fill-emerald-400 stroke-emerald-300"
        strokeWidth="1.5"
      />

      {/* Torso / Body Silhouette */}
      <path
        d={
          posture === 'resting'
            ? "M28 58 C 32 44, 64 44, 68 58 C 64 76, 32 76, 28 58 Z"
            : posture === 'shoe_tie'
            ? `M${48 - torsoWidth / 2} 42 C ${48 - torsoWidth / 2} 36, ${48 + torsoWidth / 2} 36, ${48 + torsoWidth / 2} 42 L 58 72 L 38 72 Z`
            : `M${48 - torsoWidth / 2} 38 C ${48 - torsoWidth / 2} 32, ${48 + torsoWidth / 2} 32, ${48 + torsoWidth / 2} 38 L 54 78 L 42 78 Z`
        }
        className="fill-emerald-500/80 stroke-emerald-400"
        strokeWidth="2"
      />

      {/* Arms / Accent Gestures */}
      {posture === 'morning_stretch' ? (
        <>
          <path d="M32 40 L18 20" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
          <path d="M64 40 L80 20" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : posture === 'shoe_tie' ? (
        <>
          <path d="M38 46 L30 68" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
          <path d="M58 46 L66 68" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M34 42 L22 62" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
          <path d="M62 42 L74 62" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {/* Feet / Pedestal indicator */}
      <ellipse cx="48" cy="84" rx="20" ry="3" fill="#10B981" fillOpacity="0.3" />
    </motion.svg>
  );
}
