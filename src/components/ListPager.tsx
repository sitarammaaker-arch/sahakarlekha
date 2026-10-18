/**
 * Stage D (member-area re-audit): long registers render one page at a time. A society with 2,000+ members used to
 * put every row (each with ~10 buttons) in the DOM and recompute it on every keystroke. PURE paging helpers +
 * a small Hindi-first pager. Search / filters keep working over the WHOLE list; only the rendering is paged.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { pageSlice, DEFAULT_PAGE_SIZE } from '@/lib/paging';
export { pageSlice, DEFAULT_PAGE_SIZE };

/** Paging state that returns to page 1 whenever `resetKey` (search text, tab, filter…) changes. */
export function usePaged<T>(rows: readonly T[], resetKey: unknown, size = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [resetKey]);
  const slice = useMemo(() => pageSlice(rows, page, size), [rows, page, size]);
  return { ...slice, total: rows.length, setPage };
}

/** Value that settles `ms` after the last change — for search boxes over long lists. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export function ListPager({ page, pages, from, to, total, setPage, hi }: { page: number; pages: number; from: number; to: number; total: number; setPage: (p: number) => void; hi: boolean }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs text-muted-foreground print:hidden">
      <span>{hi ? `${from}–${to} / कुल ${total.toLocaleString('en-IN')}` : `${from}–${to} of ${total.toLocaleString('en-IN')}`}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label={hi ? 'पिछला पन्ना' : 'Previous page'}>
          <ChevronLeft className="h-4 w-4" />{hi ? 'पिछला' : 'Prev'}
        </Button>
        <span className="px-1">{hi ? `पन्ना ${page + 1}/${pages}` : `Page ${page + 1}/${pages}`}</span>
        <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label={hi ? 'अगला पन्ना' : 'Next page'}>
          {hi ? 'अगला' : 'Next'}<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
