import * as XLSX from 'xlsx';

/**
 * Download data as CSV (UTF-8 BOM for Excel Hindi support).
 * @param headers - Column header strings
 * @param rows    - Data rows (each cell: string | number)
 * @param filename - Without extension
 */
export function downloadCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string
) {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;

  const csvContent = [headers, ...rows]
    .map(row => row.map(escape).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename + '.csv');
}

/**
 * Download data as Excel (.xlsx).
 * Supports multiple sheets: pass array of { name, headers, rows }.
 */
export function downloadExcel(
  sheets: { name: string; headers: string[]; rows: (string | number | null | undefined)[][] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    // Auto column width
    const colWidths = sheet.headers.map((h, i) => ({
      wch: Math.max(
        h.length,
        ...sheet.rows.map(r => String(r[i] ?? '').length)
      ) + 2,
    }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename + '.xlsx');
}

/** Convenience: single-sheet Excel */
export function downloadExcelSingle(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string,
  sheetName = 'Report'
) {
  downloadExcel([{ name: sheetName, headers, rows }], filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
