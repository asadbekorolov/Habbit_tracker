// React'dan tashqaridagi kod (src/services/*) uchun tarjima: foydalanuvchi
// tanlagan til (localStorage "lang", App.handleLangChange yozadi) bo'yicha.
// Til lug'ati hali yuklanmagan bo'lsa — o'zbekcha (getT o'zi qaytaradi).
import { getT, type Lang, type TKey } from "./i18n";

export function currentLang(): Lang {
  try {
    const l = localStorage.getItem("lang");
    return l === "ru" || l === "en" ? l : "uz";
  } catch {
    return "uz";
  }
}

/** st('svc_user_not_found') yoki st('svc_upload_failed', { msg }) */
export function st(key: TKey, vars?: Record<string, string | number>): string {
  let s = getT(currentLang())(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
