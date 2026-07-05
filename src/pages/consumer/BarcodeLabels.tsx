import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScanBarcode, Printer, Search } from 'lucide-react';
import { code39Svg, sanitizeCode39 } from '@/lib/consumer/barcode';
import { useToast } from '@/hooks/use-toast';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BarcodeLabels: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { stockItems, society } = useData();
  const { toast } = useToast();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return stockItems.filter(s => s.isActive && (!query ||
      s.name.toLowerCase().includes(query) || (s.nameHi ?? '').includes(q.trim()) || (s.itemCode ?? '').toLowerCase().includes(query)));
  }, [stockItems, q]);

  // The scannable content: item's barcode if set, else its item code.
  const codeFor = (s: { barcodeValue?: string; itemCode?: string; id: string }) =>
    sanitizeCode39((s.barcodeValue || s.itemCode || s.id).toString());

  const totalLabels = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

  const printLabels = () => {
    const chosen = stockItems.filter(s => (counts[s.id] || 0) > 0);
    if (chosen.length === 0) { toast({ title: hi ? 'कोई वस्तु चुनें' : 'Select at least one item', variant: 'destructive' }); return; }
    const labelHtml = (s: typeof stockItems[number]) => {
      const code = codeFor(s);
      const svg = code39Svg(code, { unit: 2, height: 38 });
      return `<div class="label"><div class="soc">${escapeHtml(society.name || '')}</div><div class="nm">${escapeHtml(hi ? (s.nameHi || s.name) : s.name)}</div><div class="pr">${fmt(s.saleRate || 0)}</div>${svg}<div class="cd">${escapeHtml(code)}</div></div>`;
    };
    const labels: string[] = [];
    for (const s of chosen) for (let i = 0; i < (counts[s.id] || 0); i++) labels.push(labelHtml(s));

    const win = window.open('', '_blank');
    if (!win) { toast({ title: hi ? 'पॉपअप ब्लॉक है' : 'Popup blocked', description: hi ? 'इस साइट के लिए पॉपअप allow करें।' : 'Allow popups for this site.', variant: 'destructive' }); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${hi ? 'बारकोड लेबल' : 'Barcode Labels'}</title><style>
      @page { margin: 8mm; }
      body { font-family: system-ui, Arial, sans-serif; margin: 0; }
      .sheet { display: flex; flex-wrap: wrap; gap: 3mm; }
      .label { width: 48mm; border: 1px dashed #bbb; border-radius: 2px; padding: 2mm; box-sizing: border-box; text-align: center; page-break-inside: avoid; }
      .soc { font-size: 8px; color: #666; }
      .nm { font-weight: 600; font-size: 11px; line-height: 1.1; margin: 1px 0; }
      .pr { font-size: 13px; font-weight: 700; margin-bottom: 1px; }
      .cd { font-family: monospace; font-size: 9px; letter-spacing: 1px; }
      svg { max-width: 100%; height: 34px; display: block; margin: 0 auto; }
    </style></head><body onload="window.print()"><div class="sheet">${labels.join('')}</div></body></html>`);
    win.document.close();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg"><ScanBarcode className="h-6 w-6 text-slate-700" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'बारकोड लेबल' : 'Barcode Labels'}</h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
        <Button onClick={printLabels} disabled={totalLabels === 0} className="gap-2">
          <Printer className="h-4 w-4" />{hi ? `प्रिंट (${totalLabels})` : `Print (${totalLabels})`}
        </Button>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        {hi
          ? 'हर वस्तु के सामने कितने लेबल चाहिए वो संख्या डालें → "प्रिंट"। लेबल पर नाम, दाम और scannable बारकोड छपेगा (वस्तु का barcode, या न हो तो item-code)। यही बारकोड POS पर scan होगा।'
          : 'Set how many labels each item needs → "Print". Each label shows the name, price and a scannable barcode (the item barcode, or its item-code). This same barcode scans at the POS.'}
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'वस्तुएं' : 'Items'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder={hi ? 'नाम / कोड खोजें…' : 'Search name / code…'} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                  <TableHead>{hi ? 'कोड / बारकोड' : 'Code / Barcode'}</TableHead>
                  <TableHead className="text-right">{hi ? 'दाम' : 'Price'}</TableHead>
                  <TableHead className="w-40 text-center">{hi ? 'कितने लेबल' : 'Labels'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400">{hi ? 'कोई वस्तु नहीं' : 'No items'}</TableCell></TableRow>
                ) : items.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{hi ? (s.nameHi || s.name) : s.name}<span className="text-xs text-muted-foreground ml-1">/ {s.unit}</span></TableCell>
                    <TableCell className="font-mono text-xs">{codeFor(s) || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(s.saleRate || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setCounts(c => ({ ...c, [s.id]: Math.max(0, (c[s.id] || 0) - 1) }))}>−</Button>
                        <Input type="number" min={0} value={counts[s.id] || 0} onChange={e => setCounts(c => ({ ...c, [s.id]: Math.max(0, Number(e.target.value)) }))} className="w-16 h-7 text-center" />
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setCounts(c => ({ ...c, [s.id]: (c[s.id] || 0) + 1 }))}>+</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BarcodeLabels;
