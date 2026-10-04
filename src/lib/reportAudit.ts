/**
 * Server-side trail of generated reports (audit D-17: "~70 page exporters and all PDFs leave no trace").
 *
 * Every PDF that gets a verifiable Report ID (lib/reportId.ts) is announced here at the moment its footer is
 * stamped, so "who produced report SL-BS-…-3F9A21C4B7, and when" is answerable from `audit_log`.
 *
 * WHICH AUDIT CONTRACT (lib/auditLog.ts has two, with OPPOSITE failure modes):
 *   This is the NON-BLOCKING one (`logAudit`, action 'create', entity 'report'). PDF generation is
 *   synchronous and a logging outage must never stop a society printing its Balance Sheet.
 *   It deliberately does NOT use the blocking `export` custody contract, so a PDF that contains member
 *   personal data (Form 1, registers) still has NO blocking custody trail — that remains a separate
 *   decision (it would make PDF generation asynchronous). What this closes is "no trace at all".
 *
 * PRIVACY: the row carries the report code, title, page count and fingerprint — never a figure or a name.
 *
 * The sink is injected (bound once by <ExportContextBinder/>), so this module — and pdf.ts — stay free of the
 * Supabase client and are testable on their own. PURE module state, dependency-free.
 */

export interface ReportGenerated {
  reportId: string;
  code: string;
  title: string;
  pages: number;
}

export type ReportAuditSink = (event: ReportGenerated) => void;

let sink: ReportAuditSink | null = null;

export function setReportAuditSink(next: ReportAuditSink | null): void { sink = next; }

/** Announce a generated report. NEVER throws: a failing sink cannot stop a PDF being produced. */
export function emitReportGenerated(event: ReportGenerated): void {
  if (!sink) return;
  try { sink(event); } catch { /* an audit outage must not break report generation */ }
}

/** PURE — the audit_log input for one generated report (`entityType: 'report'`, `action: 'create'`). */
export function buildReportAuditInput(event: ReportGenerated) {
  return {
    entityType: 'report',
    entityId: event.reportId,
    action: 'create' as const,
    after: { code: event.code, title: event.title, format: 'pdf', pages: event.pages },
    source: 'pdf',
  };
}
