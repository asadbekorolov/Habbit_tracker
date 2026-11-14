export type Lang = 'uz' | 'ru' | 'en'

import { uz, type Dict } from '../i18n/uz'

// O'zbekcha darhol; rus va ingliz tillari alohida bo'lak bo'lib, faqat
// tanlanganda yuklanadi (asosiy bundle'ni yengillashtirish uchun).
const dicts: Partial<Record<Lang, Dict>> = { uz }
const loaders: Record<Exclude<Lang, 'uz'>, () => Promise<Dict>> = {
  ru: () => import('../i18n/ru').then((m) => m.ru),
  en: () => import('../i18n/en').then((m) => m.en),
}

export function isLangLoaded(lang: Lang): boolean {
  return !!dicts[lang]
}

/** Tilni yuklaydi (bir marta). Xato bo'lsa — o'zbekchada qolinadi. */
export async function loadLang(lang: Lang): Promise<void> {
  if (dicts[lang] || lang === 'uz') return
  try {
    dicts[lang] = await loaders[lang]()
  } catch (e) {
    console.warn('Til yuklanmadi:', lang, e)
  }
}

export type TKey = keyof Dict

export function getT(lang: Lang) {
  const dict = dicts[lang] ?? uz
  return function t(key: TKey, fallback?: string): string {
    return (dict as any)[key] ?? (uz as any)[key] ?? fallback ?? key
  }
}


// ── Shared calendar labels (kalendar oy/kun nomlari uchun umumiy eksport) ──
export const MONTHS_FULL: Record<Lang, string[]> = {
  uz: ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"],
  ru: ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
}

export const MONTHS_SHORT: Record<Lang, string[]> = {
  uz: ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"],
  ru: ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"],
  en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
}

export const DAYS_FULL: Record<Lang, string[]> = {
  uz: ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"],
  ru: ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"],
  en: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
}

export const DAYS_SHORT: Record<Lang, string[]> = {
  uz: ["Ya","Du","Se","Ch","Pa","Ju","Sh"],
  ru: ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"],
  en: ["Su","Mo","Tu","We","Th","Fr","Sa"],
}
