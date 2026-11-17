// Android bosh ekran vidjeti uchun ma'lumot (JSON) — sof modul.
// Native tomon (IdrokWidgetProvider.java) aynan shu shaklni o'qiydi.

export interface WidgetHabit {
  name: string;
  done: boolean;
}

export interface WidgetData {
  v: 1;
  /** Toshkent bo'yicha sana — vidjet eski kunni ko'rsatmasligi uchun */
  date: string;
  done: number;
  total: number;
  pct: number;
  streak: number;
  /** Ko'pi bilan 4 ta: bajarilmaganlar oldinda */
  habits: WidgetHabit[];
  /** Ilova tilidagi yozuvlar (vidjet tizim tilini emas, ilova tilini ko'rsatadi) */
  labels: { days: string; empty: string; stale: string };
}

export const WIDGET_MAX_HABITS = 4;

export function buildWidgetData(params: {
  date: string;
  habits: { name: string; done: boolean }[];
  streak: number;
  labels: WidgetData['labels'];
}): WidgetData {
  const total = params.habits.length;
  const done = params.habits.filter((h) => h.done).length;
  const ordered = [...params.habits.filter((h) => !h.done), ...params.habits.filter((h) => h.done)];
  return {
    v: 1,
    date: params.date,
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    streak: Math.max(0, Math.floor(params.streak)),
    habits: ordered.slice(0, WIDGET_MAX_HABITS).map((h) => ({ name: h.name.trim().slice(0, 40), done: h.done })),
    labels: params.labels,
  };
}
