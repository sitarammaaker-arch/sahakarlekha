/**
 * dateUtils.ts — Centralized, timezone-safe date formatting for Sahakarlekha
 *
 * Root problem solved:
 *   new Date("2024-04-01") parses as UTC midnight.
 *   In India (UTC+5:30) this is fine, but toLocaleDateString('hi-IN') can produce
 *   inconsistent results across browsers (e.g. "1/4/204" instead of "01/04/2024").
 *
 * Solution:
 *   Parse YYYY-MM-DD directly from string parts — no Date constructor needed.
 *   This guarantees correct output on every browser, OS and timezone.
 */

const MONTHS_HI = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Parses a YYYY-MM-DD (or ISO timestamp) string into { y, m, d } parts.
 * Returns null if the string is invalid.
 */
function parseDateStr(dateStr: string | undefined | null): { y: number; m: number; d: number } | null {
  if (!dateStr) return null;
  const s = String(dateStr).split('T')[0]; // strip time component if present
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/**
 * fmtDate — Format a stored date string as DD/MM/YYYY.
 *
 * Usage:  fmtDate('2024-04-01')  → '01/04/2024'
 *         fmtDate(undefined)     → '—'
 *
 * Safe: parses directly from string parts — no new Date() constructor,
 * no timezone issues, no locale-dependent output.
 */
export function fmtDate(dateStr: string | undefined | null): string {
  const p = parseDateStr(dateStr);
  if (!p) return dateStr ? String(dateStr) : '—';
  return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
}

/**
 * fmtDateLong — Format a stored date string with weekday, day, month name, year.
 * Used in DayBook headers.
 *
 * Usage:  fmtDateLong('2024-04-01', 'en')  → 'Monday, 01 April 2024'
 *         fmtDateLong('2024-04-01', 'hi')  → 'सोमवार, 01 अप्रैल 2024'
 */
export function fmtDateLong(dateStr: string | undefined | null, locale: 'hi' | 'en' = 'en'): string {
  const p = parseDateStr(dateStr);
  if (!p) return dateStr ? String(dateStr) : '—';
  // Use local Date constructor (year, month-1, day) — no UTC shift
  const dateObj = new Date(p.y, p.m - 1, p.d);
  const dayOfWeek = dateObj.getDay();
  const months = locale === 'hi' ? MONTHS_HI : MONTHS_EN;
  const days   = locale === 'hi' ? DAYS_HI   : DAYS_EN;
  return `${days[dayOfWeek]}, ${String(p.d).padStart(2, '0')} ${months[p.m - 1]} ${p.y}`;
}

/**
 * fmtDateTime — Format an ISO timestamp string as DD/MM/YYYY HH:MM.
 * Used for createdAt / deletedAt display.
 *
 * Usage:  fmtDateTime('2024-04-01T10:30:00.000Z')  → '01/04/2024 16:00' (IST)
 */
export function fmtDateTime(isoStr: string | undefined | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return String(isoStr);
  }
}

/**
 * todayStr — Today's date as YYYY-MM-DD (local time, safe for input[type=date]).
 */
export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
