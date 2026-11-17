// ─── Sana yordamchilari — YAGONA MANBA ──────────────────────────────────────
// Ilova kunlari Asia/Tashkent (UTC+5) bo'yicha hisoblanadi — server ham xuddi
// shunday ishlaydi (047: tashkent_today(), is_log_date_open()). Toshkentda
// yozgi vaqt yo'q (1991 yildan beri doimiy UTC+5), shuning uchun Intl'ga
// bog'lanmasdan qat'iy siljish ishlatiladi — har qanday qurilma vaqt
// zonasida bir xil natija beradi.
//
// Qoidalar:
//   * "Bugun", "kecha", "N kun oldin" — getTashkentToday() + addDays().
//   * UI'da Date obyekti kerak bo'lsa (hafta kuni, oy nomi, setDate bilan
//     kalendar yurish) — "hozir" o'rniga tashkentTodayAnchor() ishlating.
//   * Ma'lum sana satridan Date olish — parseDateStr().

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Kun belgilash oynasi: shu kun 00:00 dan ertasi kuni shu soatgacha ochiq. */
export const LOG_GRACE_HOUR = 9;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Toshkent bo'yicha bugungi sana, "YYYY-MM-DD". */
export function getTashkentToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Toshkent bo'yicha hozirgi soat (0–23). */
export function getTashkentHour(now: Date = new Date()): number {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).getUTCHours();
}

/** Toshkent bo'yicha hozirgi vaqt, "HH:MM". */
export function getTashkentTimeHM(now: Date = new Date()): string {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(11, 16);
}

/** "YYYY-MM-DD" sananing hafta kuni, ISO: 1 = dushanba … 7 = yakshanba. */
export function isoWeekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Toshkent bo'yicha hafta kuni, ISO: 1 = dushanba … 7 = yakshanba. */
export function getTashkentIsoWeekday(now: Date = new Date()): number {
  const d = new Date(now.getTime() + TASHKENT_OFFSET_MS).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Sana satriga n kun qo'shadi (manfiy bo'lishi mumkin). Vaqt zonasidan mustaqil. */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Ikki sana orasidagi kunlar soni (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** Sana satrini mahalliy Date'ga aylantiradi (kun o'rtasi — DST'dan xavfsiz). */
export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * "Hozir"ning o'rnini bosuvchi Date: qurilmadagi kalendar sanasi Toshkentdagi
 * bugungi sanaga teng (kun o'rtasi). getDay()/getDate()/setDate() va
 * toDateStr(d) bilan xavfsiz ishlatiladi.
 */
export function tashkentTodayAnchor(now: Date = new Date()): Date {
  return parseDateStr(getTashkentToday(now));
}

/**
 * Belgilash oynasi ochiqmi: bugun yoki (kecha va Toshkent vaqti bilan soat
 * 09:00 dan oldin). Server is_log_date_open() bilan aynan bir xil qoida.
 */
export function isTashkentDateOpen(dateStr: string, now: Date = new Date()): boolean {
  const today = getTashkentToday(now);
  if (dateStr === today) return true;
  return dateStr === addDays(today, -1) && getTashkentHour(now) < LOG_GRACE_HOUR;
}

/**
 * Argumentsiz — Toshkent bo'yicha bugungi sana.
 * Date bilan — shu Date'ning qurilmadagi kalendar sanasi (kalendar
 * katakchalari kabi mahalliy yaratilgan sanalarni formatlash uchun).
 */
export function toDateStr(d?: Date): string {
  if (!d) return getTashkentToday();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
