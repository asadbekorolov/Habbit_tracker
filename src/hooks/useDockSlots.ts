// Pastki panel bo'limlari (localStorage) — Sozlamalarda o'zgarsa dock darhol yangilanadi.
import { useCallback, useEffect, useState } from 'react';
import { DOCK_STORAGE_KEY, parseDockSlots, type DockSlotId } from '../utils/dockConfig';

const EVENT = 'idrok-dock-change';

function read(): DockSlotId[] {
  try { return parseDockSlots(localStorage.getItem(DOCK_STORAGE_KEY)); } catch { return parseDockSlots(null); }
}

export function useDockSlots(): [DockSlotId[], (next: DockSlotId[]) => void] {
  const [slots, setSlots] = useState<DockSlotId[]>(read);

  useEffect(() => {
    const sync = () => setSlots(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const save = useCallback((next: DockSlotId[]) => {
    try { localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(next)); } catch { /* xotira yo'q */ }
    setSlots(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [slots, save];
}
