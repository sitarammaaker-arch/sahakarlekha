import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, Truck, Copy, CheckCircle2 } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

interface EWayEntry {
  id: string;
  type: 'sale' | 'purchase';
  docNo: string;
  date: string;
  partyName: string;
  partyGst?: string;
  items: Array<{ name: string; hsn: string; qty: number; unit: string; taxable: number; gstRate: number }>;
  totalTaxable: number;
  totalGst: number;
  grandTotal: number;
  transportMode: string;
  vehicleNo: string;
  distance: number;
  ewbNo: string;
}

const EWAYBILL_KEY = 'sahayata_ewaybills';

function getEWayBills(): EWayEntry[] {
  try { return JSON.parse(localStorage.getItem(EWAYBILL_KEY) || '[]'); } catch { return []; }
}
function saveEWayBills(e: EWayEntry[]) { localStorage.setItem(EWAYBILL_KEY, JSON.stringify(e)); }

const transportModes = ['Road', 'Rail', 'Air', 'Ship'];

export default function EWayBill() {
  const { sales, purchases, stockItems, society } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [savedBills, setSavedBills] = useState<EWayEntry[]>(getEWayBills);
  const [mode, setMode] = useState<'list' | 'generate'>('list');
  const [sourceType, setSourceType] = useState<'sale' | 'purchase'>('sale');
  const [selectedDoc, setSelectedDoc] = useState('');
  const [transportMode, setTransportMode] = useState('Road');
  const [vehicleNo, setVehicleNo] = useState('');
  const [distance, setDistance] = useState('');
  const [generatedJson, setGeneratedJson] = useState<string>('');

  const eligibleSales = useMemo(() =>
    sales.filter(s => !(s as any).isDeleted && s.grandTotal >= 50000),
    [sales]);

  const eligiblePurchases = useMemo(() =>
    purchases.filter(p => !(p as any).isDeleted && p.grandTotal >= 50000),
    [purchases]);

  const currentList = sourceType === 'sale' ? eligibleSales : eligiblePurchases;

  const handleGenerate = () => {
    const doc = sourceType === 'sale'
      ? sales.find(s => s.id === selectedDoc)
      : purchases.find(p => p.id === selectedDoc);

    if (!doc) return;

    const isSale = sourceType === 'sale';
    const s = doc as any;

    const itemList = (s.items || []).map((item: any) => {
      const stockItem = stockItems.find(si => si.id === item.itemId);
      return {
        name: item.itemName,
        hsn: stockItem?.hsnCode || stockItem?.sacCode || '9999',
        qty: item.qty,
        unit: item.unit,
        taxable: item.amount,
        gstRate: s.cgstPct * 2 || s.igstPct || 0,
      };
    });

    const payload = {
      version: '1.0.1',
      billLists: [{
        fromGstin: society.gstNo || 'GSTIN_NOT_SET',
        fromTrdName: society.name,
        fromAddr1: society.address || '',
        fromPinCode: society.pincode || '000000',
        fromStateCode: society.stateCode || '09',
        toGstin: isSale ? (s.customerGst || 'URP') : (s.supplierGst || 'URP'),
        toTrdName: isSale ? s.customerName : s.supplierName,
        toAddr1: '',
        toPinCode: '000000',
        toStateCode: society.stateCode || '09',
        transactionType: isSale ? 1 : 2,
        supplyType: isSale ? 'O' : 'I',
        subSupplyType: 1,
        docType: 'INV',
        docNo: isSale ? s.saleNo : s.purchaseNo,
        docDate: s.date,
        totalValue: s.totalAmount,
        cgstValue: s.cgstAmount || 0,
        sgstValue: s.sgstAmount || 0,
        igstValue: s.igstAmount || 0,
        cessValue: 0,
        totInvValue: s.grandTotal,
        transMode: transportModes.indexOf(transportMode) + 1,
        transDistance: parseInt(distance) || 0,
        vehicleNo: vehicleNo.toUpperCase(),
        vehicleType: 'R',
        itemList,
      }],
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    setGeneratedJson(jsonStr);

    // Save record
    const entry: EWayEntry = {
      id: `ewb_${Date.now()}`,
      type: sourceType,
      docNo: isSale ? s.saleNo : s.purchaseNo,
      date: s.date,
      partyName: isSale ? s.customerName : s.supplierName,
      items: itemList,
      totalTaxable: s.netAmount,
      totalGst: s.taxAmount,
      grandTotal: s.grandTotal,
      transportMode,
      vehicleNo: vehicleNo.toUpperCase(),
      distance: parseInt(distance) || 0,
      ewbNo: '',
    };
    const updated = [entry, ...savedBills];
    saveEWayBills(updated);
    setSavedBills(updated);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eway-bill-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedJson);
    toast({ title: hi ? 'JSON कॉपी हुआ' : 'JSON copied to clipboard' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'e-Way Bill' : 'e-Way Bill'}</h1>
          <p className="text-muted-foreground text-sm">
            {hi ? 'NIC पोर्टल के लिए JSON पेलोड बनाएं (₹50,000+ के लेनदेन)' : 'Generate JSON payload for NIC portal (transactions ≥ ₹50,000)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={mode === 'list' ? 'default' : 'outline'} onClick={() => setMode('list')}>
            {hi ? 'बिल सूची' : 'Bill List'}
          </Button>
          <Button variant={mode === 'generate' ? 'default' : 'outline'} onClick={() => { setMode('generate'); setGeneratedJson(''); }}>
            <Truck className="h-4 w-4 mr-2" />{hi ? 'नया बनाएं' : 'Generate New'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'पात्र बिक्री' : 'Eligible Sales'}</p>
          <p className="font-bold text-lg">{eligibleSales.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'पात्र खरीद' : 'Eligible Purchases'}</p>
          <p className="font-bold text-lg">{eligiblePurchases.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'बने हुए JSON' : 'Generated'}</p>
          <p className="font-bold text-lg">{savedBills.length}</p>
        </CardContent></Card>
      </div>

      {mode === 'generate' && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'e-Way Bill JSON बनाएं' : 'Generate e-Way Bill JSON'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{hi ? 'प्रकार' : 'Document Type'}</Label>
                <Select value={sourceType} onValueChange={v => { setSourceType(v as any); setSelectedDoc(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{hi ? 'बिक्री' : 'Sale'}</SelectItem>
                    <SelectItem value="purchase">{hi ? 'खरीद' : 'Purchase'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'दस्तावेज़ चुनें' : 'Select Document'}</Label>
                <Select value={selectedDoc} onValueChange={setSelectedDoc}>
                  <SelectTrigger><SelectValue placeholder={hi ? 'चुनें...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {currentList.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {sourceType === 'sale' ? d.saleNo : d.purchaseNo} — {sourceType === 'sale' ? d.customerName : d.supplierName} — {fmt(d.grandTotal)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'परिवहन माध्यम' : 'Transport Mode'}</Label>
                <Select value={transportMode} onValueChange={setTransportMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {transportModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'वाहन संख्या' : 'Vehicle Number'}</Label>
                <Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="UP32AB1234" />
              </div>
              <div>
                <Label>{hi ? 'दूरी (km)' : 'Distance (km)'}</Label>
                <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="100" />
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={!selectedDoc}>
              {hi ? 'JSON बनाएं' : 'Generate JSON'}
            </Button>

            {generatedJson && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{hi ? 'JSON तैयार है' : 'JSON ready'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-1" />{hi ? 'कॉपी' : 'Copy'}
                    </Button>
                    <Button size="sm" onClick={handleDownloadJson}>
                      <Download className="h-4 w-4 mr-1" />{hi ? 'डाउनलोड' : 'Download'}
                    </Button>
                  </div>
                </div>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-h-64 font-mono">
                  {generatedJson}
                </pre>
                <p className="text-xs text-muted-foreground">
                  {hi ? '* इस JSON को NIC e-Way Bill पोर्टल पर अपलोड करें: ewaybillgst.gov.in' : '* Upload this JSON to NIC e-Way Bill portal: ewaybillgst.gov.in'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'list' && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'बनाए गए e-Way Bills' : 'Generated e-Way Bills'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead>{hi ? 'दस्तावेज़' : 'Document'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'पार्टी' : 'Party'}</TableHead>
                  <TableHead className="text-right">{hi ? 'कुल' : 'Total'}</TableHead>
                  <TableHead>{hi ? 'वाहन' : 'Vehicle'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {hi ? 'कोई e-Way Bill नहीं बनाया गया' : 'No e-Way Bills generated yet'}
                    </TableCell>
                  </TableRow>
                ) : savedBills.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge variant={b.type === 'sale' ? 'default' : 'secondary'} className="text-xs">
                        {b.type === 'sale' ? (hi ? 'बिक्री' : 'Sale') : (hi ? 'खरीद' : 'Purchase')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{b.docNo}</TableCell>
                    <TableCell>{b.date}</TableCell>
                    <TableCell>{b.partyName}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.grandTotal)}</TableCell>
                    <TableCell className="font-mono text-xs">{b.vehicleNo || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
