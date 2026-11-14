// Emoji kalitlari unicode escape ko'rinishida: bazadagi eski odat belgilarini
// (emoji) Lucide ikonkalariga aylantirish uchun. UI'da emoji ko'rsatilmaydi.
import React from 'react';
import {
  Droplets, Moon, Dumbbell, BookOpen,
  Utensils, Apple, Sparkles, Target, Code2, Users,
  PenTool, Sunrise, Gamepad2, Smartphone,
  ShieldAlert
} from 'lucide-react';

export type CategoryType =
  | 'water' | 'workout' | 'reading' | 'health' | 'sleep'
  | 'mindfulness' | 'code' | 'social' | 'selfcare' | 'journal'
  | 'morning' | 'prayer' | 'gaming' | 'digital' | 'discipline'
  | 'default';

export interface CategoryTheme {
  icon: React.ElementType;
  color: string;
  gradient: string;
  border: string;
  shadow: string;
}

export const CATEGORY_THEMES: Record<CategoryType, CategoryTheme> = {
  water: { icon: Droplets, color: '#22D3EE', gradient: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)', border: 'rgba(34, 211, 238, 0.3)', shadow: '0 0 15px rgba(34, 211, 238, 0.25)' },
  workout: { icon: Dumbbell, color: '#FB923C', gradient: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(234, 88, 12, 0.3) 100%)', border: 'rgba(251, 146, 60, 0.3)', shadow: '0 0 15px rgba(251, 146, 60, 0.25)' },
  reading: { icon: BookOpen, color: '#818CF8', gradient: 'linear-gradient(135deg, rgba(129, 140, 248, 0.2) 0%, rgba(79, 70, 229, 0.3) 100%)', border: 'rgba(129, 140, 248, 0.3)', shadow: '0 0 15px rgba(129, 140, 248, 0.25)' },
  health: { icon: Apple, color: '#10B981', gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(13, 148, 136, 0.3) 100%)', border: 'rgba(16, 185, 129, 0.3)', shadow: '0 0 15px rgba(16, 185, 129, 0.25)' },
  sleep: { icon: Moon, color: '#A855F7', gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(147, 51, 234, 0.3) 100%)', border: 'rgba(168, 85, 247, 0.3)', shadow: '0 0 15px rgba(168, 85, 247, 0.25)' },
  mindfulness: { icon: Sparkles, color: '#FB7185', gradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(219, 39, 119, 0.3) 100%)', border: 'rgba(244, 63, 94, 0.3)', shadow: '0 0 15px rgba(244, 63, 94, 0.25)' },
  code: { icon: Code2, color: '#22D3EE', gradient: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(8, 145, 178, 0.3) 100%)', border: 'rgba(34, 211, 238, 0.3)', shadow: '0 0 15px rgba(34, 211, 238, 0.25)' },
  social: { icon: Users, color: '#F472B6', gradient: 'linear-gradient(135deg, rgba(244, 114, 182, 0.2) 0%, rgba(219, 39, 119, 0.3) 100%)', border: 'rgba(244, 114, 182, 0.3)', shadow: '0 0 15px rgba(244, 114, 182, 0.25)' },
  selfcare: { icon: Sparkles, color: '#FBBF24', gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%)', border: 'rgba(251, 191, 36, 0.3)', shadow: '0 0 15px rgba(251, 191, 36, 0.25)' },
  journal: { icon: PenTool, color: '#A78BFA', gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)', border: 'rgba(167, 139, 250, 0.3)', shadow: '0 0 15px rgba(167, 139, 250, 0.25)' },
  morning: { icon: Sunrise, color: '#FDE047', gradient: 'linear-gradient(135deg, rgba(253, 224, 71, 0.2) 0%, rgba(202, 138, 4, 0.3) 100%)', border: 'rgba(253, 224, 71, 0.3)', shadow: '0 0 15px rgba(253, 224, 71, 0.25)' },
  prayer: { icon: Sparkles, color: '#10B981', gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)', border: 'rgba(16, 185, 129, 0.3)', shadow: '0 0 15px rgba(16, 185, 129, 0.25)' },
  gaming: { icon: Gamepad2, color: '#F43F5E', gradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(190, 18, 60, 0.3) 100%)', border: 'rgba(244, 63, 94, 0.3)', shadow: '0 0 15px rgba(244, 63, 94, 0.25)' },
  digital: { icon: Smartphone, color: '#C084FC', gradient: 'linear-gradient(135deg, rgba(192, 132, 252, 0.2) 0%, rgba(147, 51, 234, 0.3) 100%)', border: 'rgba(192, 132, 252, 0.3)', shadow: '0 0 15px rgba(192, 132, 252, 0.25)' },
  discipline: { icon: ShieldAlert, color: '#EF4444', gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)', border: 'rgba(239, 68, 68, 0.3)', shadow: '0 0 15px rgba(239, 68, 68, 0.25)' },
  default: { icon: Target, color: '#2DD4BF', gradient: 'linear-gradient(135deg, rgba(45, 212, 191, 0.2) 0%, rgba(13, 148, 136, 0.3) 100%)', border: 'rgba(45, 212, 191, 0.3)', shadow: '0 0 15px rgba(45, 212, 191, 0.2)' },
};

export const getCategoryTheme = (category?: string): CategoryTheme => {
  if (!category || !CATEGORY_THEMES[category as CategoryType]) {
    return CATEGORY_THEMES.default;
  }
  return CATEGORY_THEMES[category as CategoryType];
};

export const getHabitCategory = (name: string, emoji: string): CategoryType => {
  const n = name.toLowerCase();
  const e = emoji;

  if (n.includes('suv') || n.includes('water') || n.includes('hydration') || e === '\u{1F4A7}') return 'water';
  if (n.includes('dasturlash') || n.includes('code') || n.includes('it') || n.includes('kod') || e === '\u{1F4BB}') return 'code';
  if (n.includes('kitob') || n.includes('read') || n.includes('study') || n.includes('ta\'lim') || e === '\u{1F4DA}' || e === '\u{1F4D6}' || e === '\u{1F393}') return 'reading';
  if (n.includes('oila') || n.includes('do\'st') || n.includes('friend') || n.includes('family') || n.includes('vaqt') || e === '\u{1F465}' || e === '\u{1F91D}') return 'social';
  if (n.includes('qarash') || n.includes('selfcare') || n.includes('salomatlik') || e === '\u2728' || e === '\u{1F9F4}') return 'selfcare';
  if (n.includes('yozish') || n.includes('journal') || n.includes('kundalik') || e === '\u270D\uFE0F' || e === '\u{1F4D3}') return 'journal';
  if (n.includes('erta turish') || n.includes('uyg\'onish') || n.includes('morning') || e === '\u{1F305}' || e === '\u2600\uFE0F' || e === '\u23F0') return 'morning';
  if (n.includes('namoz') || n.includes('ibodat') || n.includes('prayer') || n.includes('bomdod') || e === '\u{1F54C}' || e === '\u{1F6D0}') return 'prayer';
  if (n.includes('mashq') || n.includes('workout') || n.includes('gym') || n.includes('sport') || n.includes('yugurish') || n.includes('qadam') || n.includes('walk') || n.includes('run') || n.includes('yurish') || n.includes('turnik') || n.includes('adjimaniya') || e === '\u{1F3C3}' || e === '\u{1F6B6}' || e === '\u{1F3CB}\uFE0F' || e === '\u{1F4AA}') return 'workout';
  if (n.includes('erta uxlash') || e === '\u{1F6CC}') return 'sleep';
  if (n.includes('uyqu') || n.includes('sleep') || n.includes('dam olish') || e === '\u{1F634}' || e === '\u{1F4A4}') return 'sleep';
  if (n.includes('meditatsiya') || n.includes('mindfulness') || n.includes('yoga') || n.includes('huzur') || e === '\u{1F9D8}' || e === '\u{1F9D8}\u200D\u2642\uFE0F' || e === '\u2764\uFE0F') return 'mindfulness';
  if (n.includes('o\'yin') || n.includes('game') || e === '\u{1F3AE}') return 'gaming';
  if (n.includes('ijtimoiy tarmoq') || n.includes('social media') || n.includes('telefon') || e === '\u{1F4F1}') return 'digital';
  if (n.includes('no fap') || n.includes('intizom') || n.includes('discipline') || e === '\u{1F6E1}\uFE0F') return 'discipline';
  if (n.includes('ovqat') || n.includes('health') || n.includes('vitamin') || n.includes('meva') || n.includes('fastfood') || e === '\u{1F34E}' || e === '\u{1F957}' || e === '\u{1F48A}') return 'health';

  return 'default';
};
