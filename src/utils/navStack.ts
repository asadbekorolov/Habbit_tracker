// Android "Orqaga" tugmasi uchun sahifalar tarixi (LIFO) va qaror mantiqi.
// Sof modul — node testlari bilan tekshiriladi (tests/navStack.test.ts).

export const HOME_PATH = '/dashboard';
export const EXIT_WINDOW_MS = 2000;
const MAX_DEPTH = 50;

/** Tarixga yozilmaydigan sahifalar (kirish oqimi). */
const UNTRACKED = new Set(['/login', '/auth/callback', '/']);

/** "/analytics/" -> "/analytics"; qidiruv qismi (?section=...) saqlanadi. */
export function normalizePath(pathname: string, search = ''): string {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return p + (search && search !== '?' ? search : '');
}

export function isTracked(path: string): boolean {
  return !UNTRACKED.has(path.split('?')[0] || '/');
}

/** Yangi sahifaga o'tish: ketma-ket bir xil sahifa ikki marta yozilmaydi. */
export function pushVisit(stack: readonly string[], path: string): string[] {
  if (!isTracked(path)) return [...stack];
  if (stack[stack.length - 1] === path) return [...stack];
  const next = [...stack, path];
  return next.length > MAX_DEPTH ? next.slice(next.length - MAX_DEPTH) : next;
}

/** Bir qadam orqaga: joriy sahifa olib tashlanadi, oldingisi — nishon. */
export function popBack(stack: readonly string[]): { stack: string[]; target: string | null } {
  if (stack.length < 2) return { stack: [...stack], target: null };
  const next = stack.slice(0, -1);
  return { stack: next, target: next[next.length - 1] };
}

export type BackAction =
  | { type: 'close-overlay' }
  | { type: 'navigate'; to: string; stack: string[] }
  | { type: 'confirm-exit' }
  | { type: 'exit' };

/**
 * "Orqaga" bosilganda nima qilish kerak:
 * 1) ochiq modal/menyu bo'lsa — eng ustkisini yopish;
 * 2) tarixda oldingi sahifa bo'lsa — unga qaytish;
 * 3) tarix bo'sh, lekin Bosh sahifada emasmiz — Bosh sahifaga;
 * 4) Bosh sahifada — 2 soniya ichida ikkinchi bosishda chiqish.
 */
export function decideBack(params: {
  overlayOpen: boolean;
  stack: readonly string[];
  currentPath: string;
  now: number;
  lastPressAt: number;
}): BackAction {
  if (params.overlayOpen) return { type: 'close-overlay' };
  const { stack, target } = popBack(params.stack);
  if (target) return { type: 'navigate', to: target, stack };
  if (params.currentPath.split('?')[0] !== HOME_PATH) return { type: 'navigate', to: HOME_PATH, stack: [HOME_PATH] };
  return params.now - params.lastPressAt < EXIT_WINDOW_MS ? { type: 'exit' } : { type: 'confirm-exit' };
}
