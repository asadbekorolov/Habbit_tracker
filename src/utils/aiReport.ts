// AI murabbiy hisoboti — tuzilgan shakl (kuchli tomonlar / zaif nuqtalar /
// 3 ta harakat), tekshirish va qurilmadagi kesh. React'siz sof modul.

export interface AiReport {
  strengths: string[];
  weaknesses: string[];
  actions: string[];
  /** Eski server (tuzilgan javobdan oldingi) qaytargan oddiy matn */
  summary?: string;
}

export interface CachedAiReport {
  report: AiReport;
  generatedAt: string;
}

const clean = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [];

/**
 * Server javobi (obyekt yoki JSON satr) -> AiReport. Shakl noto'g'ri bo'lsa null.
 * Harakatlar har doim ko'pi bilan 3 ta.
 */
export function parseAiReport(raw: unknown): AiReport | null {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  const report: AiReport = {
    strengths: clean(obj.strengths),
    weaknesses: clean(obj.weaknesses),
    actions: clean(obj.actions).slice(0, 3),
  };
  if (typeof obj.summary === 'string' && obj.summary.trim()) report.summary = obj.summary.trim();
  if (!report.strengths.length && !report.weaknesses.length && !report.actions.length && !report.summary) return null;
  return report;
}

/** Ulashish/eski ko'rinish uchun oddiy matn. */
export function reportToText(r: AiReport): string {
  if (r.summary && !r.strengths.length && !r.weaknesses.length && !r.actions.length) return r.summary;
  const block = (title: string, items: string[]) =>
    items.length ? `${title}:\n${items.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : '';
  return [
    block('Kuchli tomonlar', r.strengths),
    block('Zaif nuqtalar', r.weaknesses),
    block('Harakat rejasi', r.actions),
  ].filter(Boolean).join('\n\n');
}

export const aiCacheKey = (userId: string) => `ai_analysis_last_${userId}`;

type ReadStore = Pick<Storage, 'getItem'> | null;
type WriteStore = Pick<Storage, 'setItem'> | null;

function defaultStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function loadCachedReport(userId: string, storage: ReadStore = defaultStorage()): CachedAiReport | null {
  try {
    const raw = storage?.getItem(aiCacheKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const report = parseAiReport(data?.report);
    if (!report || typeof data?.generatedAt !== 'string') return null;
    return { report, generatedAt: data.generatedAt };
  } catch {
    return null;
  }
}

export function saveCachedReport(userId: string, value: CachedAiReport, storage: WriteStore = defaultStorage()) {
  try { storage?.setItem(aiCacheKey(userId), JSON.stringify(value)); } catch { /* xotira yopiq */ }
}

/** fetch() tarmoq xatosi (internet yo'q, server javob bermadi, CORS). */
export function isNetworkError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; message?: string };
  return err.name === 'TypeError' && /fetch|network|load failed/i.test(err.message || '');
}
