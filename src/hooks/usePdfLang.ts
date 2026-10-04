import { useSyncExternalStore } from 'react';
import { getPdfLang, setPdfLang, subscribePdfLang, type PdfLang } from '@/lib/pdfLang';

/** The language downloaded report PDFs are published in (English default; Hindi; or both). Persisted. */
export function usePdfLang(): [PdfLang, (l: PdfLang) => void] {
  const lang = useSyncExternalStore(subscribePdfLang, getPdfLang, getPdfLang);
  return [lang, setPdfLang];
}
