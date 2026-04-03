/**
 * TDS Register — Quarterly TDS tracking + Form 26Q export
 * Auto-imports from purchases, allows manual entries, challan linking, 26Q text export
 */
import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Plus, AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { generate26QText, download26Q, validate26QData, getQuarterFromDate, getQuarterDueDate } from '@/lib/tds26q';
import type { TdsEntry, TdsChallan, TdsSection, TdsDeducteeType, TdsQuarter } from '@/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const TDS_SECTIONS: { value: TdsSection; label: string; rate: string }[] = [
  { value: '192', label: 'Sec 192 — Salary', rate: 'Slab' },
  { value: '194A', label: 'Sec 194A — Interest', rate: '10%' },
  { value: '194C', label: 'Sec 194C — Contractor', rate: '1%/2%' },
  { value: '194H', label: 'Sec 194H — Commission', rate: '2%' },
  { value: '194J', label: 'Sec 194J — Professional', rate: '10%' },
  { value: '194Q', label: 'Sec 194Q — Purchase', rate: '0.1%' },
];

const QUARTERS: { value: TdsQuarter; label: string; months: string }[] = [
  { value: 'Q1', label: 'Q1', months: 'Apr-Jun' },
  { value: 'Q2', label: 'Q2', months: 'Jul-Sep' },
  { value: 'Q3', label: 'Q3', months: 'Oct-Dec' },
  { value: 'Q4', label: 'Q4', months: 'Jan-Mar' },
];

const EMPTY_ENTRY = (): Omit<TdsEntry, 'id' | 'createdAt'> => ({
  date: new Date().toISOString().split('T')[0],
  deducteePan: '',
  deducteeName: '',
  deducteeType: 'individual' as TdsDeducteeType,
  section: '194C' as TdsSection,
  natureOfPayment: '',
  grossAmount: 0,
  tdsRate: 0,
  tdsAmount: 0,
  quarter: getQuarterFromDate(new Date().toISOString().split('T')[0]),
  financialYear: '',
  status: 'pending',
});

const EMPTY_CHALLAN = (): Omit<TdsChallan, 'id' | 'createdAt'> => ({
  bsrCode: '',
  challanDate: new Date().toISOString().split('T')[0],
  challanSerial: '',
  amount: 0,
  bankName: '',
  quarter: getQuarterFromDate(new Date().toISOString().split('T')[0]),
  financialYear: '',
  status: 'pending',
});

const TdsRegister: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { purchases, suppliers, society } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';
  const fy = society.financialYear;

  // State
  const [entries, setEntries] = useState<TdsEntry[]>([]);
  const [challans, setChallans] = useState<TdsChallan[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<TdsQuarter>(() => getQuarterFromDate(new Date().toISOString().split('T')[0]));
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddChallan, setShowAddChallan] = useState(false);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY());
  const [challanForm, setChallanForm] = useState(EMPTY_CHALLAN());

  // Auto-import from purchases with TDS
  const purchaseTdsEntries = useMemo((): TdsEntry[] => {
    return purchases
      .filter(p => !(p as any).isDeleted && p.tdsAmount > 0)
      .map(p => {
        const supplier = suppliers.find(s => s.id === p.supplierId);
        return {
          id: `pur-${p.id}`,
          date: p.date,
          deducteePan: supplier?.gstNo?.substring(2, 12) || '',
          deducteeName: p.supplierName || supplier?.name || '',
          deducteeType: 'firm' as TdsDeducteeType,
          section: '194Q' as TdsSection,
          natureOfPayment: 'Purchase of Goods',
          grossAmount: p.netAmount,
          tdsRate: p.tdsPct || 0.1,
          tdsAmount: p.tdsAmount,
          quarter: getQuarterFromDate(p.date),
          financialYear: fy,
          status: 'pending' as const,
          purchaseId: p.id,
          createdAt: p.createdAt,
        };
      });
  }, [purchases, suppliers, fy]);

  // Combined entries (auto + manual)
  const allEntries = useMemo(() => [...purchaseTdsEntries, ...entries], [purchaseTdsEntries, entries]);
  const quarterEntries = allEntries.filter(e => e.quarter === selectedQuarter && e.financialYear === fy);
  const quarterChallans = challans.filter(c => c.quarter === selectedQuarter && c.financialYear === fy);

  // Stats
  const totalDeducted = quarterEntries.reduce((s, e) => s + e.tdsAmount, 0);
  const totalDeposited = quarterChallans.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPending = totalDeducted - totalDeposited;
  const dueDate = getQuarterDueDate(selectedQuarter, fy);

  // Add manual entry
  const handleAddEntry = () => {
    const entry: TdsEntry = {
      ...entryForm,
      id: crypto.randomUUID(),
      financialYear: fy,
      quarter: getQuarterFromDate(entryForm.date),
      tdsAmount: +(entryForm.grossAmount * entryForm.tdsRate / 100).toFixed(2),
      createdAt: new Date().toISOString(),
    };
    setEntries(prev => [...prev, entry]);
    setShowAddEntry(false);
    setEntryForm(EMPTY_ENTRY());
    toast({ title: hi ? 'TDS प्रविष्टि जोड़ी गई' : 'TDS entry added' });
  };

  // Add challan
  const handleAddChallan = () => {
    const challan: TdsChallan = {
      ...challanForm,
      id: crypto.randomUUID(),
      financialYear: fy,
      quarter: selectedQuarter,
      createdAt: new Date().toISOString(),
    };
    setChallans(prev => [...prev, challan]);
    setShowAddChallan(false);
    setChallanForm(EMPTY_CHALLAN());
    toast({ title: hi ? 'चालान जोड़ा गया' : 'Challan added' });
  };

  // 26Q Export
  const handleExport26Q = () => {
    const errors = validate26QData(quarterEntries, quarterChallans, society);
    if (errors.length > 0) {
      toast({
        title: hi ? '26Q निर्यात त्रुटि' : '26Q Export Validation Errors',
        description: errors.slice(0, 3).join('; '),
        variant: 'destructive',
      });
      return;
    }
    const text = generate26QText({
      entries: quarterEntries,
      challans: quarterChallans,
      society,
      quarter: selectedQuarter,
      financialYear: fy,
    });
    download26Q(text, society, selectedQuarter, fy);
    toast({ title: hi ? '26Q फ़ाइल डाउनलोड हो गई' : '26Q file downloaded' });
  };

  // CSV/Excel export
  const exportHeaders = ['Date', 'Deductee PAN', 'Deductee Name', 'Section', 'Nature', 'Gross Amt', 'Rate %', 'TDS Amt', 'Status'];
  const exportRows = () => quarterEntries.map(e => [
    fmtDate(e.date), e.deducteePan, e.deducteeName, e.section, e.natureOfPayment,
    e.grossAmount, e.tdsRate, e.tdsAmount, e.status,
  ]);
  const handleCSV = () => downloadCSV(exportHeaders, exportRows(), `tds-register-${selectedQuarter}-${fy}`);
  const handleExcel = () => downloadExcelSingle(exportHeaders, exportRows(), `tds-register-${selectedQuarter}-${fy}`, 'TDS Register');

  const statusBadge = (status: string) => {
    if (status === 'filed') return <Badge className="bg-success/20 text-success border-success/30">Filed</Badge>;
    if (status === 'deposited') return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Deposited</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            {hi ? 'TDS रजिस्टर / 26Q निर्यात' : 'TDS Register / 26Q Export'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {hi ? `वित्तीय वर्ष ${fy} | TAN: ${society.tan || 'सेटअप में भरें'}` : `FY ${fy} | TAN: ${society.tan || 'Set in Society Setup'}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" className="gap-1 bg-primary" onClick={handleExport26Q}>
            <FileText className="h-4 w-4" /> 26Q Export
          </Button>
        </div>
      </div>

      {/* Quarter Selector */}
      <div className="flex gap-2 flex-wrap">
        {QUARTERS.map(q => (
          <Button
            key={q.value}
            variant={selectedQuarter === q.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedQuarter(q.value)}
            className="gap-1"
          >
            <Calendar className="h-3 w-3" />
            {q.label} ({q.months})
          </Button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल TDS काटा' : 'Total Deducted'}</p>
            <p className="text-xl font-bold text-blue-700">{fmt(totalDeducted)}</p>
            <p className="text-xs text-muted-foreground">{quarterEntries.length} {hi ? 'प्रविष्टियां' : 'entries'}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'जमा किया' : 'Deposited'}</p>
            <p className="text-xl font-bold text-green-700">{fmt(totalDeposited)}</p>
            <p className="text-xs text-muted-foreground">{quarterChallans.filter(c => c.status === 'paid').length} {hi ? 'चालान' : 'challans'}</p>
          </CardContent>
        </Card>
        <Card className={`${totalPending > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'लंबित जमा' : 'Pending Deposit'}</p>
            <p className={`text-xl font-bold ${totalPending > 0 ? 'text-amber-700' : 'text-green-700'}`}>{fmt(Math.max(0, totalPending))}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'फाइलिंग नियत तिथि' : 'Filing Due Date'}</p>
            <p className="text-xl font-bold text-purple-700">{dueDate ? fmtDate(dueDate) : '—'}</p>
            <p className="text-xs text-muted-foreground">{selectedQuarter} — {fy}</p>
          </CardContent>
        </Card>
      </div>

      {/* TAN/PAN Warning */}
      {(!society.tan || !society.entityPan) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              {hi
                ? 'TAN और PAN Society Setup में भरें — 26Q निर्यात के लिए आवश्यक है'
                : 'Please set TAN and PAN in Society Setup — required for 26Q export'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Entries + Challans */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries" className="gap-1">
            <FileText className="h-4 w-4" />
            {hi ? 'TDS प्रविष्टियां' : 'TDS Entries'} ({quarterEntries.length})
          </TabsTrigger>
          <TabsTrigger value="challans" className="gap-1">
            <CheckCircle2 className="h-4 w-4" />
            {hi ? 'चालान' : 'Challans'} ({quarterChallans.length})
          </TabsTrigger>
        </TabsList>

        {/* TDS Entries Tab */}
        <TabsContent value="entries">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{hi ? 'TDS कटौती' : 'TDS Deductions'} — {selectedQuarter}</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setShowAddEntry(true)}>
                <Plus className="h-4 w-4" /> {hi ? 'मैन्युअल जोड़ें' : 'Add Manual'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'कटौतीधारक (PAN)' : 'Deductee (PAN)'}</TableHead>
                    <TableHead>{hi ? 'धारा' : 'Section'}</TableHead>
                    <TableHead>{hi ? 'प्रकृति' : 'Nature'}</TableHead>
                    <TableHead className="text-right">{hi ? 'सकल राशि' : 'Gross Amt'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दर %' : 'Rate %'}</TableHead>
                    <TableHead className="text-right">{hi ? 'TDS राशि' : 'TDS Amt'}</TableHead>
                    <TableHead>{hi ? 'स्रोत' : 'Source'}</TableHead>
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {hi ? 'इस तिमाही में कोई TDS प्रविष्टि नहीं' : 'No TDS entries for this quarter'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    quarterEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{fmtDate(entry.date)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{entry.deducteeName}</p>
                            <p className="text-xs font-mono text-muted-foreground">{entry.deducteePan || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{entry.section}</Badge></TableCell>
                        <TableCell className="text-sm max-w-32 truncate">{entry.natureOfPayment}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(entry.grossAmount)}</TableCell>
                        <TableCell className="text-right">{entry.tdsRate}%</TableCell>
                        <TableCell className="text-right font-bold text-primary">{fmt(entry.tdsAmount)}</TableCell>
                        <TableCell>
                          {entry.purchaseId
                            ? <Badge variant="outline" className="text-xs bg-blue-50">Auto</Badge>
                            : <Badge variant="outline" className="text-xs bg-amber-50">Manual</Badge>
                          }
                        </TableCell>
                        <TableCell>{statusBadge(entry.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {quarterEntries.length > 0 && (
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell>
                      <TableCell className="text-right">{fmt(quarterEntries.reduce((s, e) => s + e.grossAmount, 0))}</TableCell>
                      <TableCell />
                      <TableCell className="text-right text-primary">{fmt(totalDeducted)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Section-wise Summary */}
          {quarterEntries.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{hi ? 'धारा-वार सारांश' : 'Section-wise Summary'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {TDS_SECTIONS.map(sec => {
                    const secEntries = quarterEntries.filter(e => e.section === sec.value);
                    const secTotal = secEntries.reduce((s, e) => s + e.tdsAmount, 0);
                    return (
                      <div key={sec.value} className={`p-3 rounded-lg border ${secTotal > 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                        <p className="text-xs font-medium">{sec.value}</p>
                        <p className="text-sm font-bold">{fmt(secTotal)}</p>
                        <p className="text-xs text-muted-foreground">{secEntries.length} {hi ? 'प्रविष्टियां' : 'entries'}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Challans Tab */}
        <TabsContent value="challans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{hi ? 'TDS चालान' : 'TDS Challans'} — {selectedQuarter}</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setShowAddChallan(true)}>
                <Plus className="h-4 w-4" /> {hi ? 'चालान जोड़ें' : 'Add Challan'}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BSR Code</TableHead>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                    <TableHead>{hi ? 'क्रमांक' : 'Serial No.'}</TableHead>
                    <TableHead>{hi ? 'बैंक' : 'Bank'}</TableHead>
                    <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quarterChallans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {hi ? 'कोई चालान नहीं' : 'No challans for this quarter'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    quarterChallans.map(ch => (
                      <TableRow key={ch.id}>
                        <TableCell className="font-mono">{ch.bsrCode}</TableCell>
                        <TableCell>{fmtDate(ch.challanDate)}</TableCell>
                        <TableCell>{ch.challanSerial}</TableCell>
                        <TableCell>{ch.bankName}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(ch.amount)}</TableCell>
                        <TableCell>
                          <Badge className={ch.status === 'paid' ? 'bg-success/20 text-success' : 'bg-amber-100 text-amber-700'}>
                            {ch.status === 'paid' ? (hi ? 'भुगतान' : 'Paid') : (hi ? 'लंबित' : 'Pending')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Manual Entry Dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'TDS प्रविष्टि जोड़ें' : 'Add TDS Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'तिथि' : 'Date'}</Label>
                <Input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value, quarter: getQuarterFromDate(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'धारा' : 'Section'}</Label>
                <Select value={entryForm.section} onValueChange={v => setEntryForm(f => ({ ...f, section: v as TdsSection }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TDS_SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'कटौतीधारक नाम' : 'Deductee Name'}</Label>
                <Input value={entryForm.deducteeName} onChange={e => setEntryForm(f => ({ ...f, deducteeName: e.target.value }))} placeholder="Name" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'PAN' : 'Deductee PAN'}</Label>
                <Input value={entryForm.deducteePan} onChange={e => setEntryForm(f => ({ ...f, deducteePan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'भुगतान प्रकृति' : 'Nature of Payment'}</Label>
              <Input value={entryForm.natureOfPayment} onChange={e => setEntryForm(f => ({ ...f, natureOfPayment: e.target.value }))} placeholder="e.g. Audit Fee, Contractor Payment" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'सकल राशि (₹)' : 'Gross Amount (₹)'}</Label>
                <Input type="number" min={0} value={entryForm.grossAmount || ''} onChange={e => setEntryForm(f => ({ ...f, grossAmount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'TDS दर (%)' : 'TDS Rate (%)'}</Label>
                <Input type="number" min={0} step={0.01} value={entryForm.tdsRate || ''} onChange={e => setEntryForm(f => ({ ...f, tdsRate: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'TDS राशि (₹)' : 'TDS Amount (₹)'}</Label>
                <Input type="number" readOnly value={(entryForm.grossAmount * entryForm.tdsRate / 100).toFixed(2)} className="bg-muted" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAddEntry(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={handleAddEntry} disabled={!entryForm.deducteeName || entryForm.grossAmount <= 0}>
                {hi ? 'जोड़ें' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Challan Dialog */}
      <Dialog open={showAddChallan} onOpenChange={setShowAddChallan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'TDS चालान जोड़ें' : 'Add TDS Challan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>BSR Code (7 digits)</Label>
                <Input value={challanForm.bsrCode} onChange={e => setChallanForm(f => ({ ...f, bsrCode: e.target.value.replace(/\D/g, '').slice(0, 7) }))} placeholder="1234567" maxLength={7} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'चालान तिथि' : 'Challan Date'}</Label>
                <Input type="date" value={challanForm.challanDate} onChange={e => setChallanForm(f => ({ ...f, challanDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'क्रमांक' : 'Serial No.'}</Label>
                <Input value={challanForm.challanSerial} onChange={e => setChallanForm(f => ({ ...f, challanSerial: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label>
                <Input type="number" min={0} value={challanForm.amount || ''} onChange={e => setChallanForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'बैंक' : 'Bank Name'}</Label>
              <Input value={challanForm.bankName} onChange={e => setChallanForm(f => ({ ...f, bankName: e.target.value }))} placeholder="SBI, PNB..." />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAddChallan(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={handleAddChallan} disabled={!challanForm.bsrCode || challanForm.amount <= 0}>
                {hi ? 'जोड़ें' : 'Add Challan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TdsRegister;
