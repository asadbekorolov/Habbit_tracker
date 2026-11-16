// "Bilasizmi?" maslahatlari — bir vaqtda faqat bittasi; yopilganlari
// qurilmada (localStorage) foydalanuvchi bo'yicha saqlanadi.
export const TIP_IDS = ['freeze', 'minutes', 'routine', 'notes', 'reminder'] as const;
export type TipId = (typeof TIP_IDS)[number];

const storageKey = (uid: string) => `idrok_tips_dismissed_${uid}`;

/** Hali yopilmagan birinchi maslahat (yo'q bo'lsa — null). */
export function pickTip(dismissed: ReadonlySet<string>, order: readonly TipId[] = TIP_IDS): TipId | null {
  return order.find((id) => !dismissed.has(id)) ?? null;
}

export function loadDismissedTips(uid: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): Set<string> {
  try {
    const raw = storage?.getItem(storageKey(uid));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedTips(uid: string, ids: ReadonlySet<string>, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try { storage?.setItem(storageKey(uid), JSON.stringify([...ids])); } catch { /* xotira yopiq */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
