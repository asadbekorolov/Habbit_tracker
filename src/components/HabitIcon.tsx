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

interface HabitIconProps {
  emoji: string;
  name?: string;
  size?: number;
  className?: string;
  color?: string;
  noWrapper?: boolean;
}

const EMOJI_MAP: Record<string, React.ElementType> = {
  // Water
  '💧': Droplets,
  '🥤': Droplets,
  'Droplets': Droplets,
  // Exercise
  '🏃': Footprints,
  '🏃‍♂️': Footprints,
  '🚶': Footprints,
  '🚶‍♂️': Footprints,
  'Footprints': Footprints,
  '🏋️': Dumbbell,
  '🏋️‍♂️': Dumbbell,
  '💪': Dumbbell,
  'Dumbbell': Dumbbell,
  // Sleep
  '💤': Moon,
  '😴': Moon,
  '🛌': Moon,
  'Moon': Moon,
  // Reading/Knowledge
  '📚': BookOpen,
  '📖': BookOpen,
  'BookOpen': BookOpen,
  '🧠': Brain,
  'Brain': Brain,
  '🎧': Music,
  '🎙️': Music,
  'Music': Music,
  // Food/Nutrition
  '🍎': Apple,
  'Apple': Apple,
  '🥗': Utensils,
  '🍔': Utensils,
  '🍟': Utensils,
  '🍕': Utensils,
  'Beer': Beer,
  '🍺': Beer,
  '🍳': Utensils,
  '🥚': Utensils,
  'Utensils': Utensils,
  // Morning/Day
  '🌅': Sunrise,
  '☀️': Sun,
  'Sunrise': Sunrise,
  'Sun': Sun,
  '☕': Coffee,
  'Coffee': Coffee,
  // Mindfulness/Health
  '🧘': Heart,
  '🧘‍♂️': Heart,
  '❤️': Heart,
  'Heart': Heart,
  '🌿': Sparkles,
  'Sparkles': Sparkles,
  // Focus/Knowledge
  '🎯': Target,
  'Target': Target,
  '⚡': Zap,
  'Zap': Zap,
  '💻': Monitor,
  '🖥️': Monitor,
  'Monitor': Monitor,
  '📵': ShieldAlert,
  'ShieldAlert': ShieldAlert,
  '✍️': PenTool,
  'PenTool': PenTool,
  '♟️': Layout,
  'Layout': Layout,
  '🎵': Music,
  '🗓️': Timer,
  'Timer': Timer,
  'Clock': Timer,
  'Compass': Compass,
  // Level Icons
  '🌱': Sprout,
  'Sprout': Sprout,
  '💎': Gem,
  'Gem': Gem,
  '👑': Crown,
  'Crown': Crown,
  '⭐': Star,
  'Star': Star,
  'XP': Zap,
  '🪙': Coins,
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
  '😄': Laugh,
  'MoodExcellent': Laugh,
  '🙂': Smile,
  'MoodGood': Smile,
  '😐': Meh,
  'MoodNormal': Meh,
  '😕': Frown,
  'MoodBad': Frown,
  '😞': Frown,
  'MoodTerrible': Frown,
  '🎉': PartyPopper,
  'PartyPopper': PartyPopper,
  // Digital
  '📱': Smartphone,
  'Smartphone': Smartphone,
  '🎮': Gamepad2,
  'Gamepad2': Gamepad2,
  // Bad Habits
  '🚬': Cigarette,
  'Cigarette': Cigarette,
  '💸': Coins,
  'ShoppingCart': Coins,
  '😤': ShieldAlert,
  '🤐': Lock,
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
  // Removes common emojis from the beginning of the string
  return name.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '');
}
