import { useMemo } from 'react';
import type { Profile } from '../services/supabase';

export type BodyTier = 'slim' | 'athletic' | 'robust';
export type ContextState = 'shoe_tie' | 'morning_stretch' | 'resting' | 'idle';

export interface UseCharacterAvatarOptions {
  profile?: Profile | null;
  activeHabitName?: string | null;
}

export interface UseCharacterAvatarResult {
  bmi: number;
  bmiFormatted: string;
  bodyTier: BodyTier;
  bodyTierLabel: string;
  contextState: ContextState;
  contextLabel: string;
  heightCm: number;
  weightKg: number;
}

export function useCharacterAvatar({
  profile,
  activeHabitName,
}: UseCharacterAvatarOptions = {}): UseCharacterAvatarResult {
  return useMemo(() => {
    const heightCm = profile?.height_cm && profile.height_cm > 50 ? profile.height_cm : 175;
    const weightKg = profile?.weight_kg && profile.weight_kg > 20 ? profile.weight_kg : 70;

    const heightMeters = heightCm / 100;
    const bmiVal = weightKg / (heightMeters * heightMeters);
    const bmi = Math.round(bmiVal * 10) / 10;
    const bmiFormatted = bmi.toFixed(1);

    let bodyTier: BodyTier = 'athletic';
    let bodyTierLabel = 'Atletik qomat';

    if (bmi < 18.5) {
      bodyTier = 'slim';
      bodyTierLabel = 'Yengil vazn';
    } else if (bmi >= 25.0) {
      bodyTier = 'robust';
      bodyTierLabel = 'Mustahkam vazn';
    }

    const now = new Date();
    const hour = now.getHours();

    let contextState: ContextState = 'idle';
    let contextLabel = "Faol intizom";

    const habitLower = (activeHabitName || '').toLowerCase();
    const isSportContext =
      habitLower.includes('sport') ||
      habitLower.includes('yugurish') ||
      habitLower.includes('mashq') ||
      habitLower.includes('trenirovka') ||
      habitLower.includes('gym') ||
      habitLower.includes('turnik') ||
      habitLower.includes('otjimaniye');

    if (isSportContext) {
      contextState = 'shoe_tie';
      contextLabel = "Krasovka bog'lanmoqda";
    } else if (hour >= 5 && hour < 9) {
      contextState = 'morning_stretch';
      contextLabel = "Tetik uyg'onish";
    } else if (hour >= 22 || hour < 5) {
      contextState = 'resting';
      contextLabel = "Tungi dam olish";
    }

    return {
      bmi,
      bmiFormatted,
      bodyTier,
      bodyTierLabel,
      contextState,
      contextLabel,
      heightCm,
      weightKg,
    };
  }, [profile?.height_cm, profile?.weight_kg, activeHabitName]);
}
