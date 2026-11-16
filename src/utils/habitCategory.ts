// Odat turini nomi/eski emoji bo'yicha aniqlash — React'siz sof modul
// (node testlari bilan tekshiriladi). Ikonka/rang categoryTheme.ts da.

export type CategoryType =
  | 'water' | 'workout' | 'reading' | 'health' | 'sleep'
  | 'mindfulness' | 'code' | 'social' | 'selfcare' | 'journal'
  | 'morning' | 'prayer' | 'gaming' | 'digital' | 'discipline'
  | 'default';

export const getHabitCategory = (name: string, emoji: string): CategoryType => {
  const n = name.toLowerCase();
  const e = emoji;

  if (n.includes('suv') || n.includes('water') || n.includes('hydration') || e === '\u{1F4A7}') return 'water';
  if (n.includes('dasturlash') || n.includes('code') || /\b(it|ish|work|loyiha|biznes)\b/.test(n) || n.includes('kod') || e === '\u{1F4BB}') return 'code';
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

// ─── Yo'nalishlar (Tahlil → "Yo'nalishlar balansi") ─────────────────────
export type HabitDomain = 'Rivojlanish' | "Sog'lik" | 'Ruhiyat' | 'Mehnat';
export const HABIT_DOMAINS: readonly HabitDomain[] = ['Rivojlanish', "Sog'lik", 'Ruhiyat', 'Mehnat'];

const DOMAIN_BY_CATEGORY: Record<CategoryType, HabitDomain> = {
  water: "Sog'lik", workout: "Sog'lik", health: "Sog'lik", sleep: "Sog'lik", morning: "Sog'lik",
  mindfulness: 'Ruhiyat', prayer: 'Ruhiyat', social: 'Ruhiyat', selfcare: 'Ruhiyat', journal: 'Ruhiyat',
  code: 'Mehnat',
  reading: 'Rivojlanish', discipline: 'Rivojlanish', digital: 'Rivojlanish', gaming: 'Rivojlanish',
  default: 'Rivojlanish',
};

export const getHabitDomain = (name: string, emoji: string): HabitDomain =>
  DOMAIN_BY_CATEGORY[getHabitCategory(name, emoji)];
