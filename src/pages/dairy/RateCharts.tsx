import { useState, useMemo } from 'react';
import { useDairyData } from '@/contexts/DairyDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Table2, Trash2, Calculator } from 'lucide-react';
import type { DairyRateBand } from '@/types';

// "3.0,3.5,4.0,4.5" → bands [3-3.5),[3.5-4),[4-4.5)
function parseBands(csv: string): DairyRateBand[] {
  const b = Array.from(new Set(csv.split(',').map(s => Number(s.trim())).filter(n => isFinite(n)))).sort((x, y) => x - y);
  const bands: DairyRateBand[] = [];
  for (let i = 0; i < b.length - 1; i++) bands.push({ min: b[i], max: b[i + 1] });
  return bands;
}
const fmtBand = (b: DairyRateBand) => `${b.min}–${b.max}`;

export default function RateCharts() {
  const { rateCharts, addRateChart, deleteRateChart, resolveMilkRate } = useDairyData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [season, setSeason] = useState('');
  const [fatCsv, setFatCsv] = useState('3.0,3.5,4.0,4.5,5.0,5.5,6.0');
  const [snfCsv, setSnfCsv] = useState('8.0,8.3,8.5,8.7,9.0');
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [built, setBuilt] = useState(false);

  const fatBands = useMemo(() => parseBands(fatCsv), [fatCsv]);
  const snfBands = useMemo(() => parseBands(snfCsv), [snfCsv]);

  const buildGrid = () => {
    if (fatBands.length < 1 || snfBands.length < 1) { toast({ title: hi ? 'कम से कम 2 सीमाएँ दें' : 'Give at least 2 boundaries per axis', variant: 'destructive' }); return; }
    setMatrix(fatBands.map(() => snfBands.map(() => 0)));
    setBuilt(true);
  };

  const setCell = (fi: number, si: number, v: string) => {
    const n = Number(v);
    setMatrix(prev => prev.map((row, r) => r === fi ? row.map((c, s) => (s === si ? (isFinite(n) ? n : 0) : c)) : row));
  };

  const save = () => {
    if (!name.trim()) { toast({ title: hi ? 'नाम आवश्यक' : 'Name required', variant: 'destructive' }); return; }
    if (!built || matrix.length !== fatBands.length || (matrix[0]?.length ?? 0) !== snfBands.length) {
      toast({ title: hi ? 'पहले ग्रिड बनाएँ' : 'Build the grid first', description: hi ? 'सीमाएँ बदलने पर ग्रिड दोबारा बनाएँ।' : 'Rebuild the grid after changing boundaries.', variant: 'destructive' }); return;
    }
    const c = addRateChart({ name: name.trim(), basis: 'fat_snf', effectiveFrom, season: season.trim() || undefined, fatBands, snfBands, matrix });
    if (c.id) { toast({ title: hi ? 'रेट चार्ट सेव हुआ' : 'Rate chart saved', description: `${c.name} · ${fatBands.length}×${snfBands.length}` }); setName(''); setSeason(''); setBuilt(false); setMatrix([]); }
  };

  const list = rateCharts.filter(c => !c.isDeleted).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  // Live preview against the currently-effective chart
  const [pFat, setPFat] = useState('4.0');
  const [pSnf, setPSnf] = useState('8.5');
  const [pQty, setPQty] = useState('10');
  const preview = resolveMilkRate({ fat: Number(pFat) || 0, snf: Number(pSnf) || 0, qty: Number(pQty) || 0 });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Table2 className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'दुग्ध रेट चार्ट (Fat + SNF)' : 'Milk Rate Charts (Fat + SNF)'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'Fat × SNF दो-अक्ष रेट टेबल — प्रभावी तिथि के अनुसार' : 'Fat × SNF two-axis rate table — effective-dated'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया रेट चार्ट' : 'New Rate Chart'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{hi ? 'नाम' : 'Name'} *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={hi ? 'जैसे जुलाई 2026' : 'e.g. July 2026'} /></div>
            <div className="space-y-2"><Label>{hi ? 'प्रभावी तिथि से' : 'Effective From'}</Label><Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'सीज़न (वैकल्पिक)' : 'Season (optional)'}</Label><Input value={season} onChange={e => setSeason(e.target.value)} placeholder={hi ? 'flush / lean' : 'flush / lean'} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{hi ? 'Fat सीमाएँ (कॉमा से)' : 'Fat boundaries (comma)'}</Label><Input value={fatCsv} onChange={e => { setFatCsv(e.target.value); setBuilt(false); }} /><p className="text-xs text-muted-foreground">{fatBands.length} {hi ? 'बैंड' : 'bands'}</p></div>
            <div className="space-y-2"><Label>{hi ? 'SNF सीमाएँ (कॉमा से)' : 'SNF boundaries (comma)'}</Label><Input value={snfCsv} onChange={e => { setSnfCsv(e.target.value); setBuilt(false); }} /><p className="text-xs text-muted-foreground">{snfBands.length} {hi ? 'बैंड' : 'bands'}</p></div>
          </div>
          <Button variant="secondary" onClick={buildGrid}>{hi ? 'ग्रिड बनाएँ' : 'Build grid'} ({fatBands.length}×{snfBands.length})</Button>

          {built && matrix.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b border-r bg-muted text-xs font-medium sticky left-0">{hi ? 'Fat \\ SNF' : 'Fat \\ SNF'}</th>
                    {snfBands.map((s, si) => <th key={si} className="p-2 border-b text-xs font-medium whitespace-nowrap">{fmtBand(s)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {fatBands.map((f, fi) => (
                    <tr key={fi}>
                      <td className="p-2 border-r bg-muted text-xs font-medium whitespace-nowrap sticky left-0">{fmtBand(f)}</td>
                      {snfBands.map((_, si) => (
                        <td key={si} className="p-1 border-t">
                          <Input type="number" step="0.01" className="h-8 w-20 text-right" value={matrix[fi]?.[si] ?? 0} onChange={e => setCell(fi, si, e.target.value)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button onClick={save} className="w-full">{hi ? 'रेट चार्ट सेव करें' : 'Save Rate Chart'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" />{hi ? 'रेट जाँचें (प्रभावी चार्ट)' : 'Test rate (effective chart)'}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label className="text-xs">Fat %</Label><Input type="number" step="0.1" className="w-24" value={pFat} onChange={e => setPFat(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">SNF %</Label><Input type="number" step="0.1" className="w-24" value={pSnf} onChange={e => setPSnf(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">{hi ? 'लीटर' : 'Litres'}</Label><Input type="number" step="0.1" className="w-24" value={pQty} onChange={e => setPQty(e.target.value)} /></div>
            <div className="text-sm">
              {preview.rate == null
                ? <Badge variant="destructive">{hi ? 'कोई प्रभावी चार्ट नहीं' : 'No effective chart'}</Badge>
                : <span>{hi ? 'दर' : 'Rate'} <b>₹{preview.rate}/L</b> · {hi ? 'राशि' : 'Amount'} <b>₹{preview.amount.toLocaleString('en-IN')}</b></span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'रेट चार्ट' : 'Rate Charts'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई चार्ट नहीं।' : 'No charts yet.'}</p>}
          {list.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{c.name}</span>
                  <Badge variant="outline">{c.fatBands.length}×{c.snfBands.length}</Badge>
                  {c.season && <Badge variant="secondary">{c.season}</Badge>}
                </div>
                <div className="text-muted-foreground">{hi ? 'प्रभावी' : 'Effective'} {c.effectiveFrom}</div>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? `चार्ट "${c.name}" हटाएँ?` : `Delete chart "${c.name}"?`)) deleteRateChart(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
