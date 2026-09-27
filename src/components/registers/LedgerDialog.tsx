/** Shows one subsidiary ledger (deposit / loan / stock) with PDF + Excel downloads of the same rows. */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { Cell } from '@/lib/exportUtils';
import type { LedgerTable } from '@/lib/registers/ledgerTables';

const show = (v: Cell, isNum?: boolean) => (v == null || v === '' ? '' : isNum && typeof v === 'number' ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(v) : String(v));

export function LedgerDialog({ table, hi, onClose, onPdf, onExcel }: { table: LedgerTable | null; hi: boolean; onClose: () => void; onPdf: () => void; onExcel: () => void }) {
  return (
    <Dialog open={!!table} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{table ? (hi ? table.titleHi : table.title) : ''}</DialogTitle>
          <p className="text-sm text-muted-foreground">{table?.subtitle}</p>
        </DialogHeader>
        {table && (
          <>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={onPdf}><Download className="h-4 w-4" />PDF</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={onExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader><TableRow>{table.columns.map((c) => <TableHead key={c.en} className={c.num ? 'text-right whitespace-nowrap' : 'whitespace-nowrap'}>{hi ? c.hi : c.en}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {(hi ? table.rowsHi : table.rowsEn).map((r, i) => (
                    <TableRow key={i}>{r.map((v, j) => <TableCell key={j} className={table.columns[j]?.num ? 'text-right whitespace-nowrap text-sm' : 'text-sm'}>{show(v, table.columns[j]?.num)}</TableCell>)}</TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">{table.totals.map((v, j) => <TableCell key={j} className={table.columns[j]?.num ? 'text-right whitespace-nowrap text-sm' : 'text-sm'}>{j === 1 && hi ? 'योग / अंतिम' : show(v, table.columns[j]?.num)}</TableCell>)}</TableRow>
                </TableBody>
              </Table>
            </div>
            {table.notes.map((n) => <p key={n.en} className="text-xs text-destructive">{hi ? n.hi : n.en}</p>)}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
