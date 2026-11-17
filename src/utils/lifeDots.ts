// "Kun va odatlar" vidjeti uchun hisob — Toshkent vaqti. Sof modul.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export interface DayElapsed {
  /** To'liq o'tgan soatlar (0..24) */
  hoursPassed: number;
  /** Joriy soat indeksi (0..23) */
  currentHour: number;
  /** Kunning o'tgan qismi, foizda (0..100) */
  pct: number;
}

export function dayElapsed(now: Date = new Date()): DayElapsed {
  const t = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
  return {
    hoursPassed: Math.floor(minutes / 60),
    currentHour: t.getUTCHours(),
    pct: Math.floor((minutes / 1440) * 100),
  };
}

/** Bugungi odatlar: bajarilganlari oldinda — nuqtalar uchun mantiqiy massiv. */
export function habitDots(done: number, total: number): boolean[] {
  const d = Math.max(0, Math.min(done, total));
  return Array.from({ length: Math.max(0, total) }, (_, i) => i < d);
}
