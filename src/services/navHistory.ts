// Ilova bo'yicha yagona sahifalar tarixi (LIFO) — Android "Orqaga" tugmasi va
// sahifalardagi orqaga (ArrowLeft) tugmalari shu bitta stekdan foydalanadi.
import { popBack, pushVisit } from '../utils/navStack';

let stack: string[] = [];

export const navHistory = {
  record(path: string) {
    stack = pushVisit(stack, path);
  },
  get(): readonly string[] {
    return stack;
  },
  set(next: string[]) {
    stack = next;
  },
  /** Bir qadam orqaga: nishon sahifa (yo'q bo'lsa null) */
  back(): string | null {
    const r = popBack(stack);
    if (r.target) stack = r.stack;
    return r.target;
  },
  reset() {
    stack = [];
  },
};
