// Pastki navigatsiya paneli (dock) sozlamasi — sof funksiyalar.
// Asosiy va Profil doim joyida; o'rtada ko'pi bilan 3 ta tanlangan bo'lim.

export type DockSlotId = 'journal' | 'groups' | 'analytics' | 'routine' | 'health' | 'leaderboard';

/** Tanlash mumkin bo'lgan bo'limlar (Sozlamalardagi tartib — dockdagi tartib ham shu). */
export const DOCK_OPTIONS: readonly DockSlotId[] = ['journal', 'groups', 'analytics', 'routine', 'health', 'leaderboard'];
export const DEFAULT_DOCK: readonly DockSlotId[] = ['journal', 'groups', 'analytics'];
export const MAX_DOCK_SLOTS = 3;
export const DOCK_STORAGE_KEY = 'idrok_dock_slots_v1';

const isSlot = (v: unknown): v is DockSlotId => typeof v === 'string' && (DOCK_OPTIONS as readonly string[]).includes(v);

/** Saqlangan qiymatni tekshiradi: noto'g'ri/yo'q — standart; takrorlar va ortiqchasi tashlanadi. */
export function parseDockSlots(raw: string | null | undefined): DockSlotId[] {
  if (raw == null) return [...DEFAULT_DOCK];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...DEFAULT_DOCK];
    const picked = new Set(arr.filter(isSlot));
    return DOCK_OPTIONS.filter((id) => picked.has(id)).slice(0, MAX_DOCK_SLOTS);
  } catch {
    return [...DEFAULT_DOCK];
  }
}

/** Yoqish/o'chirish: limitga yetgan bo'lsa yangisi qo'shilmaydi. Tartib — DOCK_OPTIONS bo'yicha. */
export function toggleDockSlot(current: readonly DockSlotId[], id: DockSlotId): DockSlotId[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (current.length >= MAX_DOCK_SLOTS) return [...current];
  const next = new Set([...current, id]);
  return DOCK_OPTIONS.filter((x) => next.has(x));
}
