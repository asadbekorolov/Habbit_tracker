// Emoji kalitlari unicode escape ko'rinishida: bazadagi eski odat belgilarini
// (emoji) Lucide ikonkalariga aylantirish uchun. UI'da emoji ko'rsatilmaydi.
import React from 'react';
import {
  Droplets, Footprints, Moon, Dumbbell, BookOpen,
  Utensils, Apple, Flame, Zap, Sparkles, Coins, Trophy,
  Sun, Coffee, Heart, Brain, PenTool, Layout, Monitor,
  Music, Target, Compass, Timer, Shield, Sprout, Gem, Crown, Star,
  Smile, Laugh, Meh, Frown, PartyPopper,
  CheckSquare, Activity, HeartPulse, GraduationCap,
  Mail, Check, CheckCheck, Lock, MessageSquare, UserPlus, Users, Bell,
  Sunrise, Gamepad2, Smartphone, ShieldAlert,
  Cigarette, Beer
} from 'lucide-react';
import { getHabitCategory, getCategoryTheme } from '../utils/categoryTheme';
import { normalizeApostrophes } from '../utils/text';

interface HabitIconProps {
  emoji: string;
  name?: string;
  size?: number;
  className?: string;
  color?: string;
  noWrapper?: boolean;
}

export const EMOJI_MAP: Record<string, React.ElementType> = {
  // Water
  '\u{1F4A7}': Droplets,
  '\u{1F964}': Droplets,
  'Droplets': Droplets,
  // Exercise
  '\u{1F3C3}': Footprints,
  '\u{1F3C3}\u200D\u2642\uFE0F': Footprints,
  '\u{1F6B6}': Footprints,
  '\u{1F6B6}\u200D\u2642\uFE0F': Footprints,
  'Footprints': Footprints,
  '\u{1F3CB}\uFE0F': Dumbbell,
  '\u{1F3CB}\uFE0F\u200D\u2642\uFE0F': Dumbbell,
  '\u{1F4AA}': Dumbbell,
  'Dumbbell': Dumbbell,
  // Sleep
  '\u{1F4A4}': Moon,
  '\u{1F634}': Moon,
  '\u{1F6CC}': Moon,
  'Moon': Moon,
  // Reading/Knowledge
  '\u{1F4DA}': BookOpen,
  '\u{1F4D6}': BookOpen,
  'BookOpen': BookOpen,
  '\u{1F9E0}': Brain,
  'Brain': Brain,
  '\u{1F3A7}': Music,
  '\u{1F399}\uFE0F': Music,
  'Music': Music,
  // Food/Nutrition
  '\u{1F34E}': Apple,
  'Apple': Apple,
  '\u{1F957}': Utensils,
  '\u{1F354}': Utensils,
  '\u{1F35F}': Utensils,
  '\u{1F355}': Utensils,
  'Beer': Beer,
  '\u{1F37A}': Beer,
  '\u{1F373}': Utensils,
  '\u{1F95A}': Utensils,
  'Utensils': Utensils,
  // Morning/Day
  '\u{1F305}': Sunrise,
  '\u2600\uFE0F': Sun,
  'Sunrise': Sunrise,
  'Sun': Sun,
  '\u2615': Coffee,
  'Coffee': Coffee,
  // Mindfulness/Health
  '\u{1F9D8}': Heart,
  '\u{1F9D8}\u200D\u2642\uFE0F': Heart,
  '\u2764\uFE0F': Heart,
  'Heart': Heart,
  '\u{1F33F}': Sparkles,
  'Sparkles': Sparkles,
  // Focus/Knowledge
  '\u{1F3AF}': Target,
  'Target': Target,
  '\u26A1': Zap,
  'Zap': Zap,
  '\u{1F4BB}': Monitor,
  '\u{1F5A5}\uFE0F': Monitor,
  'Monitor': Monitor,
  '\u{1F4F5}': ShieldAlert,
  'ShieldAlert': ShieldAlert,
  '\u270D\uFE0F': PenTool,
  'PenTool': PenTool,
  '\u265F\uFE0F': Layout,
  'Layout': Layout,
  '\u{1F3B5}': Music,
  '\u{1F5D3}\uFE0F': Timer,
  'Timer': Timer,
  'Clock': Timer,
  'Compass': Compass,
  // Level Icons
  '\u{1F331}': Sprout,
  'Sprout': Sprout,
  '\u{1F48E}': Gem,
  'Gem': Gem,
  '\u{1F451}': Crown,
  'Crown': Crown,
  '\u2B50': Star,
  'Star': Star,
  'XP': Zap,
  '\u{1FA99}': Coins,
  'Coins': Coins,
  'COIN': Coins,
  'pts': Zap,
  'Activity': Activity,
  'Flame': Flame,
  'Trophy': Trophy,
  'Mail': Mail,
  'Check': Check,
  'CheckCheck': CheckCheck,
  'Lock': Lock,
  'MessageSquare': MessageSquare,
  'UserPlus': UserPlus,
  'Users': Users,
  'Bell': Bell,
  // Moods
  '\u{1F604}': Laugh,
  'MoodExcellent': Laugh,
  '\u{1F642}': Smile,
  'MoodGood': Smile,
  '\u{1F610}': Meh,
  'MoodNormal': Meh,
  '\u{1F615}': Frown,
  'MoodBad': Frown,
  '\u{1F61E}': Frown,
  'MoodTerrible': Frown,
  '\u{1F389}': PartyPopper,
  'PartyPopper': PartyPopper,
  // Digital
  '\u{1F4F1}': Smartphone,
  'Smartphone': Smartphone,
  '\u{1F3AE}': Gamepad2,
  'Gamepad2': Gamepad2,
  // Bad Habits
  '\u{1F6AC}': Cigarette,
  'Cigarette': Cigarette,
  '\u{1F4B8}': Coins,
  'ShoppingCart': Coins,
  '\u{1F624}': ShieldAlert,
  '\u{1F910}': Lock,
};

export const HabitIcon: React.FC<HabitIconProps> = ({ emoji, name, size = 20, className = "", color, noWrapper = false }) => {
  const category = name ? getHabitCategory(name, emoji) : 'default';
  const theme = getCategoryTheme(category);
  // Try to use mapping, fallback to theme icon
  const Icon = EMOJI_MAP[emoji] || theme.icon;

  if (noWrapper) {
    return <Icon size={size} color={color || theme.color} className={className} strokeWidth={2.5} />;
  }

  return (
    <div
      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden transition-all duration-300 ${className}`}
      style={{
        background: theme.gradient,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow
      }}
    >
      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
      <Icon size={size} color={color || theme.color} strokeWidth={2.5} />
    </div>
  );
};

export function cleanHabitName(name: string): string {
  if (!name) return '';
  // 1. Removes common emojis from the beginning of the string
  let cleaned = name.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '');
  // 2. Removes raw Lucide icon string prefixes if present
  cleaned = cleaned.replace(/^(Sun|BookOpen|Dumbbell|Utensils|Moon|Coffee|Sparkles|Droplets|Footprints|Apple|Brain|Music|Sunrise|Heart|Target|Zap|Monitor|ShieldAlert|PenTool|Smartphone|Gamepad2|CheckSquare|Activity|Timer|Clock|Shield|Flame|Trophy)\s+/i, '');
  // 3. Typo fixes
  cleaned = cleaned.replace(/Universititet/gi, "Universitet");
  // 4. O‘/oʻ/o’ kabi apostroflar ilovadagi standart ' ga keltiriladi
  cleaned = normalizeApostrophes(cleaned);
  return cleaned.trim();
}
