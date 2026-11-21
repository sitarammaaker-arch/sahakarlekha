/**
 * PERF-02 (product audit 2026-11-17): the PDF library (jspdf + autotable + html2canvas, ~257 KB gzip) used to be a
 * static import of every page that can print — the voucher screen downloaded it before anyone pressed Print.
 *
 * Pages call these wrappers instead of `@/lib/pdf`: the first call loads the module, later calls reuse it. A page
 * that only PRINTS through a generate*PDF function imports from here; a page that draws its own PDF with jsPDF still
 * needs the library and keeps importing `@/lib/pdf` / `jspdf` directly.
 *
 * A load that fails (offline, or a deploy replaced the chunk) shows one destructive toast and resolves to undefined —
 * nothing is thrown at a click handler, and the wrapper resolves to null.
 *
 * Safari keeps a tap's permission to open the share sheet only until the first await, so the WhatsApp "share PDF"
 * path cannot wait for a download there. It calls preloadPdf() when its menu opens, and builds the file with
 * pdfNow() (synchronous once loaded).
 */
import { toast } from '@/hooks/use-toast';

type PdfModule = typeof import('./pdf');

let modP: Promise<PdfModule> | null = null;
let mod: PdfModule | null = null;

export function preloadPdf(): Promise<PdfModule> {
  if (!modP) {
    modP = import('./pdf').then((m) => { mod = m; return m; });
    modP.catch(() => { modP = null; });   // let a later click retry
  }
  return modP;
}

/** The module if it has already loaded (synchronous) — for the share path; null until then. */
export function pdfNow(): PdfModule | null { return mod; }

function loadFailed(e: unknown) {
  console.error('pdf module load failed:', e);
  const hi = typeof document !== 'undefined' && !document.documentElement.lang.startsWith('en');
  toast({
    title: hi ? 'PDF नहीं बन पाई' : 'Could not make the PDF',
    description: hi
      ? 'PDF बनाने वाला हिस्सा लोड नहीं हुआ — internet देखें और पेज refresh (F5) करके फिर से कोशिश करें।'
      : 'The PDF part of the app did not load — check the internet, refresh the page (F5) and try again.',
    variant: 'destructive',
    duration: 10000,
  });
}

function genFailed() {
  const hi = typeof document !== 'undefined' && !document.documentElement.lang.startsWith('en');
  toast({
    title: hi ? 'PDF नहीं बन पाई' : 'Could not make the PDF',
    description: hi ? 'PDF बनाते समय गड़बड़ी हुई — दोबारा कोशिश करें। बार-बार हो तो Feedback से बताएँ।' : 'Something went wrong while making the PDF — please try again. If it keeps happening, tell us via Feedback.',
    variant: 'destructive',
    duration: 10000,
  });
}

type Fn = (...a: never[]) => unknown;
/** Resolves to the function's own result, or to null when the PDF could not be made (the user was already told). */
type Lazy<F extends Fn> = (...a: Parameters<F>) => Promise<Awaited<ReturnType<F>> | null>;

function lazy<K extends keyof PdfModule>(name: K): PdfModule[K] extends Fn ? Lazy<PdfModule[K]> : never {
  const run = async (...args: unknown[]) => {
    let m: PdfModule;
    try { m = await preloadPdf(); } catch (e) { loadFailed(e); return null; }
    // The call used to throw synchronously into the page's own try / catch. As a promise, an error must not become
    // an unhandled rejection with no message: say so here and resolve to null (a caller that shows a success message checks for it).
    try {
      return await (m[name] as unknown as (...a: unknown[]) => unknown)(...args);
    } catch (e) {
      console.error(`${String(name)} failed:`, e);
      genFailed();
      return null;
    }
  };
  return run as never;
}

export const generateCashBookPDF = lazy('generateCashBookPDF');
export const generateBankBookPDF = lazy('generateBankBookPDF');
export const generateTrialBalancePDF = lazy('generateTrialBalancePDF');
export const generateIncomeExpenditurePDF = lazy('generateIncomeExpenditurePDF');
export const generateReceiptsPaymentsPDF = lazy('generateReceiptsPaymentsPDF');
export const generateBalanceSheetPDF = lazy('generateBalanceSheetPDF');
export const generateLedgerPDF = lazy('generateLedgerPDF');
export const generateMemberPassbookPDF = lazy('generateMemberPassbookPDF');
export const generateShareRegisterPDF = lazy('generateShareRegisterPDF');
export const generateDemandNoticePDF = lazy('generateDemandNoticePDF');
export const generateHousingShareNominationPDF = lazy('generateHousingShareNominationPDF');
export const generateMaintenanceBillPDF = lazy('generateMaintenanceBillPDF');
export const generateMaintenanceReceiptPDF = lazy('generateMaintenanceReceiptPDF');
export const generateLoanRegisterPDF = lazy('generateLoanRegisterPDF');
export const generateAssetRegisterPDF = lazy('generateAssetRegisterPDF');
export const generateAuditRegisterPDF = lazy('generateAuditRegisterPDF');
export const generateDayBookPDF = lazy('generateDayBookPDF');
export const generateTradingAccountPDF = lazy('generateTradingAccountPDF');
export const generateSalarySlipPDF = lazy('generateSalarySlipPDF');
export const generateGstSummaryPDF = lazy('generateGstSummaryPDF');
export const generateBudgetPDF = lazy('generateBudgetPDF');
export const generateSaleRegisterPDF = lazy('generateSaleRegisterPDF');
export const generatePurchaseRegisterPDF = lazy('generatePurchaseRegisterPDF');
export const generateClosingStockPDF = lazy('generateClosingStockPDF');
export const generateDepreciationSchedulePDF = lazy('generateDepreciationSchedulePDF');
export const generateAuditSchedulesPDF = lazy('generateAuditSchedulesPDF');
export const generateMemberApplicationPDF = lazy('generateMemberApplicationPDF');
export const generateSaleInvoicePDF = lazy('generateSaleInvoicePDF');
export const generateSubscriptionInvoicePDF = lazy('generateSubscriptionInvoicePDF');
export const generateVoucherPDF = lazy('generateVoucherPDF');
export const generatePurchaseRecordPDF = lazy('generatePurchaseRecordPDF');
export const generateBlankFormatPDF = lazy('generateBlankFormatPDF');
export const generateGroupSchedulePDF = lazy('generateGroupSchedulePDF');
export const generateMemberRefusalLetterPDF = lazy('generateMemberRefusalLetterPDF');
export const generateShareCertificatePDF = lazy('generateShareCertificatePDF');
export const generateVotersListPDF = lazy('generateVotersListPDF');
export const generateDefaulterListPDF = lazy('generateDefaulterListPDF');
