import { createContext, useContext } from "react"
import { type Lang, getT, translations } from "../utils/i18n"

type T = ReturnType<typeof getT>

interface LangCtx {
  lang: Lang
  t: T
}

export const LangContext = createContext<LangCtx>({
  lang: "uz",
  t: getT("uz"),
})

export function useLang() {
  return useContext(LangContext)
}

export function buildLangValue(lang: Lang): LangCtx {
  return { lang, t: getT(lang) }
}

export type { T, Lang }
export { translations }
