// Local (device) calendar date as YYYY-MM-DD — using toISOString() shifts the
// date to UTC and produces the wrong day for users ahead of UTC (e.g. UTC+5)
// during their early morning hours.
export function toDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
