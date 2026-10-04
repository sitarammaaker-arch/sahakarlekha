/**
 * Shared export helpers (T-13).
 *
 * SHAPE: pure builders + thin DOM wrappers. Everything that decides what the bytes look
 * like — CSV escaping, the workbook, the JSON envelope, the README sheet — is a pure
 * function, unit-tested by scripts/test-export-utils.mjs. The wrappers do nothing but
 * hand a Blob to `triggerDownload`.
 *
 * WHY `triggerDownload` IS EXPORTED (gap EXP-21). It used to be private, so six other
 * files re-implemented the same anchor-click boilerplate: BackupRestore, SocietySetup
 * (x2), GstSummary (x2), GSTR9, plus EWayBill, PfEsi and tds26q. Each copy is a place
 * where a download can quietly behave differently.
 *
 * WHY `downloadJSON` DOES NOT WRAP BY DEFAULT. Two of those callers emit STATUTORY
 * payloads that imitate the NIC / GSTN offline-utility shape (GstSummary's GSTR-1 and
 * GSTR-3B, GSTR9's draft). Wrapping them in an envelope would corrupt the very thing
 * they exist to produce. So `downloadJSON(payload, filename)` writes the payload
 * verbatim — byte-identical to the `JSON.stringify(x, null, 2)` those sites hand-roll
 * today — and only wraps when a caller explicitly asks for an envelope.
 *
 * WHY THE README SHEET IS OPT-IN (gap EXP-26). The blueprint wants every XLSX export to
 * carry a README sheet (society, FY, generated-at, filters, row counts). But this module
 * has no access to the society, and 45 existing callers pass none. Silently appending an
 * empty README to all of them would be a behaviour change dressed up as a feature. So it
 * appears only when `meta` is supplied, and it goes LAST, so the sheet Excel opens on is
 * still the data.
 */
import * as XLSX from 'xlsx';
import { standardFileStem, type NamingSociety } from './exportNaming.ts';

/** Bumped when the JSON envelope's shape changes. Consumers key off this. */
export const EXPORT_SCHEMA_VERSION = '1.0';

export type Cell = string | number | null | undefined;

export interface Sheet {
  name: string;
  headers: string[];
  rows: Cell[][];
}

/** Provenance recorded on an export. `generatedAt` is injectable so tests stay deterministic. */
export interface ExportMeta {
  societyName?: string;
  registrationNo?: string;
  financialYear?: string;
  generatedAt?: string;              // ISO 8601
  generatedBy?: string;
  mode?: string;                     // standard | full | redacted | statutory
  filters?: Record<string, unknown>; // date range, includeDeleted, …
}

// ─── Pure builders ───────────────────────────────────────────────────────────────────

/**
 * PURE — CSV/Excel formula-injection guard (audit D-S01). A TEXT cell that starts with
 * = + - @ TAB or CR is executed as a formula when the file is opened in Excel, so a
 * hostile member name or narration could run it. Such strings get a leading apostrophe.
 * Typed numbers and plain numeric-looking strings (e.g. "-1,250.50") are left alone so
 * negative amounts stay numbers.
 */
export function neutraliseFormula(v: Cell): string {
  const str = String(v ?? '');
  if (typeof v === 'number') return str;
  if (!/^[=+\-@\t\r]/.test(str)) return str;
  if (/^[-+]?[\d,]*\.?\d+$/.test(str)) return str;
  return "'" + str;
}

/** PURE — Excel sheet names: max 31 chars, none of \ / ? * [ ] :, not blank. */
export function safeSheetName(name: string, used: Set<string> = new Set()): string {
  const base = (name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet';
  let out = base, n = 2;
  while (used.has(out.toLowerCase())) {
    const suffix = ` (${n++})`;
    out = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(out.toLowerCase());
  return out;
}

/** PURE — drop a trailing extension the caller already supplied (avoids ".csv.csv"). */
export function stripExt(filename: string, ext: string): string {
  return filename.toLowerCase().endsWith('.' + ext) ? filename.slice(0, -(ext.length + 1)) : filename;
}

/** Excel's hard per-cell limit. */
const XLSX_CELL_MAX = 32767;

/**
 * PURE — RFC-4180-ish CSV. Every field is quoted (so commas, newlines and Devanagari
 * need no special casing) and embedded quotes are doubled. Rows joined with CRLF.
 * Does NOT prepend the BOM; `downloadCSV` does, because only the file needs it.
 */
export function buildCsv(headers: string[], rows: Cell[][]): string {
  const escape = (v: Cell) => `"${neutraliseFormula(v).replace(/"/g, '""')}"`;
  return [headers, ...rows]
    .map(row => row.map(escape).join(','))
    .join('\r\n');
}

/**
 * PURE — the README sheet. Two columns, one row per fact, then a row count per data
 * sheet. Returns null when there is nothing worth saying.
 */
export function buildReadmeSheet(meta: ExportMeta, sheets: Sheet[]): Sheet | null {
  const facts: [string, string][] = [];
  const add = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === '') return;
    facts.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
  };

  add('Society', meta.societyName);
  add('Registration No.', meta.registrationNo);
  add('Financial Year', meta.financialYear);
  add('Generated At', meta.generatedAt);
  add('Generated By', meta.generatedBy);
  add('Export Mode', meta.mode);
  if (meta.filters && Object.keys(meta.filters).length > 0) {
    for (const [k, v] of Object.entries(meta.filters)) add(`Filter: ${k}`, v);
  }
  if (facts.length === 0) return null;

  facts.push(['', '']);
  for (const s of sheets) facts.push([`Rows in "${s.name}"`, String(s.rows.length)]);

  return { name: 'README', headers: ['Field', 'Value'], rows: facts as Cell[][] };
}

/**
 * PURE — build the workbook. Column widths are sized to the widest cell, as before.
 * Sheet names are truncated to Excel's 31-character limit.
 */
export function buildWorkbook(sheets: Sheet[], meta?: ExportMeta): XLSX.WorkBook {
  const all = [...sheets];
  if (meta) {
    const readme = buildReadmeSheet(meta, sheets);
    if (readme) all.push(readme);   // LAST: Excel opens on the first sheet, keep it data
  }

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const guard = (v: Cell): Cell =>
    typeof v === 'string' ? neutraliseFormula(v).slice(0, XLSX_CELL_MAX) : v;
  for (const sheet of all) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers.map(guard), ...sheet.rows.map(r => r.map(guard))]);
    ws['!cols'] = sheet.headers.map((h, i) => ({
      wch: Math.max(h.length, ...sheet.rows.map(r => String(r[i] ?? '').length)) + 2,
    }));
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet.name, usedNames));
  }
  return wb;
}

/**
 * PURE — wrap a payload in a schema-versioned envelope. This is the shape the future
 * export API serves. Callers that must emit a foreign schema (statutory files) skip it.
 */
export function buildJsonEnvelope(payload: unknown, meta: ExportMeta = {}) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    society: meta.societyName ?? null,
    registrationNo: meta.registrationNo ?? null,
    financialYear: meta.financialYear ?? null,
    generatedBy: meta.generatedBy ?? null,
    mode: meta.mode ?? null,
    filters: meta.filters ?? null,
    data: payload,
  };
}

// ─── Export context (uniform identity on every Excel / CSV) ─────────────────────────────

/**
 * Who/what the current session is, bound once by <ExportContextBinder/>. With it set, every
 * downloadCSV / downloadExcel gets the standard file name (exportNaming.ts) and every Excel gets the
 * README provenance sheet — without touching the ~110 call sites. Unset (tests, logged out) = the legacy
 * behaviour: the page's own name, no README.
 */
export interface ExportContext {
  society: NamingSociety & { financialYear?: string };
  userName?: string;
}
let exportContext: ExportContext | null = null;
export function setExportContext(ctx: ExportContext | null): void { exportContext = ctx; }
export function getExportContext(): ExportContext | null { return exportContext; }

/** PURE — ISO 8601 in LOCAL time with its offset ("2026-10-04T08:41:00+05:30") — what the user's clock showed. */
export function localIso(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

/** PURE — README provenance for the session (callers' own meta wins field by field). */
export function contextMeta(ctx: ExportContext | null, now: Date): ExportMeta | undefined {
  if (!ctx?.society) return undefined;
  return {
    societyName: ctx.society.name,
    registrationNo: ctx.society.registrationNo,
    financialYear: ctx.society.financialYear,
    generatedAt: localIso(now),
    generatedBy: ctx.userName,
  };
}

/** PURE — the downloaded file's name: the standard stem when a session is bound, else the legacy name. */
export function exportFileName(filename: string, ext: 'csv' | 'xlsx', ctx: ExportContext | null, now: Date): string {
  if (!ctx?.society) return stripExt(filename, ext) + '.' + ext;
  return standardFileStem({ base: filename, society: ctx.society, now }) + '.' + ext;
}

// ─── DOM wrappers ────────────────────────────────────────────────────────────────────

/**
 * Hand a Blob to the browser as a download. Exported so nothing re-implements it
 * (gap EXP-21). The object URL is always revoked, including if the click throws.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * Download data as CSV. UTF-8 BOM so Excel opens Hindi correctly.
 * @param filename - without extension
 */
export function downloadCSV(headers: string[], rows: Cell[][], filename: string): void {
  // '\uFEFF' as an escape, not a literal: a bare BOM character is invisible and gets
  // silently eaten by editors and encoding round-trips.
  const blob = new Blob(['\uFEFF' + buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, exportFileName(filename, 'csv', exportContext, new Date()));
}

/**
 * Download data as Excel (.xlsx). Pass several sheets to get a multi-sheet workbook.
 * Supply `meta` to append a README sheet recording who exported what, when.
 */
export function downloadExcel(sheets: Sheet[], filename: string, meta?: ExportMeta): void {
  const now = new Date();
  const base = contextMeta(exportContext, now);
  const merged = base ? { ...base, ...meta } : meta;       // a caller's own meta (e.g. the registry exporter) wins
  XLSX.writeFile(buildWorkbook(sheets, merged), exportFileName(filename, 'xlsx', exportContext, now));
}

/** Convenience: single-sheet Excel. */
export function downloadExcelSingle(
  headers: string[],
  rows: Cell[][],
  filename: string,
  sheetName = 'Report',
  meta?: ExportMeta,
): void {
  downloadExcel([{ name: sheetName, headers, rows }], filename, meta);
}

/**
 * Download a JSON file.
 *
 * By default the payload is written VERBATIM — `JSON.stringify(payload, null, 2)` —
 * because several callers must emit a foreign schema (GSTR-1/3B, GSTR-9, e-Way Bill)
 * that an envelope would corrupt. Pass `meta` only when the file is a SahakarLekha
 * export and should carry provenance.
 *
 * @param filename - without extension
 */
export function downloadJSON(payload: unknown, filename: string, meta?: ExportMeta): void {
  const body = meta ? buildJsonEnvelope(payload, meta) : payload;
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
  triggerDownload(blob, stripExt(filename, 'json') + '.json');
}
