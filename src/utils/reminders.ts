// Odat eslatmalari qurilmada "reminder_<habitId>" = "HH:MM" ko'rinishida saqlanadi.
// Barcha eslatmalarni o'chirib-yoqishda shu ro'yxat ishlatiladi. Sof modul.
const PREFIX = 'reminder_';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function listHabitReminders(storage: Pick<Storage, 'length' | 'key' | 'getItem'>): { habitId: string; time: string }[] {
  const out: { habitId: string; time: string }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const time = storage.getItem(key) || '';
    if (TIME_RE.test(time)) out.push({ habitId: key.slice(PREFIX.length), time });
  }
  return out.sort((a, b) => a.habitId.localeCompare(b.habitId));
}
