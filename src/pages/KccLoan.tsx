import { useState, useMemo, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Download, Wheat, AlertTriangle, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KccLoan, CropSeasonType } from '@/types';

const KCC_KEY = 'sahayata_kcc_loans';

function getKccLoans(): KccLoan[] {
  try { return JSON.parse(localStorage.getItem(KCC_KEY) || '[]'); } catch { return []; }
}
function saveKccLoans(loans: KccLoan[]) { localStorage.setItem(KCC_KEY, JSON.stringify(loans)); }

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

const seasonLabel: Record<CropSeasonType, { hi: string; en: string; color: string }> = {
  kharif: { hi: 'खरीफ', en: 'Kharif', color: 'bg-green-100 text-green-800' },
  rabi: { hi: 'रबी', en: 'Rabi', color: 'bg-blue-100 text-blue-800' },
  zaid: { hi: 'जायद', en: 'Zaid', color: 'bg-orange-100 text-orange-800' },
};

const statusColor: Record<string, string> = {
  active: 'bg-yellow-100 text-yellow-800',
  repaid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const emptyForm = {
  memberId: '', memberName: '', cropName: '', cropSeason: 'kharif' as CropSeasonType,
  landAreaHectares: '', sanctionedAmount: '', drawnAmount: '',
  repaidAmount: '', interestRate: '7', disbursementDate: '', dueDate: '', narration: '',
};

export default function KccLoan() {
  const { members, addVoucher, accounts, society } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [loans, setLoans] = useState<KccLoan[]>(getKccLoans);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);

  // Auto-generate loan number
  const nextLoanNo = () => `KCC-${new Date().getFullYear()}-${String(loans.length + 1).padStart(4, '0')}`;

  // Status computation
  const computeStatus = (loan: KccLoan): 'active' | 'repaid' | 'overdue' => {
    if (loan.outstandingAmount <= 0) return 'repaid';
    if (new Date(loan.dueDate) < new Date()) return 'overdue';
    return 'active';
  };

  const enrichedLoans = useMemo(() =>
    loans.map(l => ({ ...l, status: computeStatus(l) as KccLoan['status'] })),
    [loans]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.memberName.trim()) e.memberName = hi ? 'सदस्य आवश्यक है' : 'Member required';
    if (!form.cropName.trim()) e.cropName = hi ? 'फसल नाम आवश्यक है' : 'Crop name required';
    if (!form.sanctionedAmount || isNaN(Number(form.sanctionedAmount))) e.sanctionedAmount = hi ? 'मान्य राशि दर्ज करें' : 'Valid amount required';
    if (!form.disbursementDate) e.disbursementDate = hi ? 'वितरण तिथि आवश्यक है' : 'Disbursement date required';
    if (!form.dueDate) e.dueDate = hi ? 'देय तिथि आवश्यक है' : 'Due date required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    const sanctioned = Number(form.sanctionedAmount);
    const drawn = Number(form.drawnAmount) || sanctioned;
    const repaid = Number(form.repaidAmount) || 0;

    // Find KCC loan account (short-term crop loan) or default to generic loan account
    const loanAccount = accounts.find(a =>
      a.code === '3313' || a.name.toLowerCase().includes('kcc') || a.name.toLowerCase().includes('crop loan')
    );
    const cashAccount = accounts.find(a => a.code === '3301');

    let voucherId: string | undefined;
    if (drawn > 0 && loanAccount && cashAccount) {
      try {
        voucherId = await new Promise<string>((res) => {
          addVoucher({
            date: form.disbursementDate,
            type: 'payment',
            debitAccountId: loanAccount.id,
            creditAccountId: cashAccount.id,
            amount: drawn,
            narration: `KCC Loan disbursed to ${form.memberName} — ${form.cropName} (${hi ? seasonLabel[form.cropSeason].hi : seasonLabel[form.cropSeason].en})`,
            createdBy: user?.name || '',
          }).then((v: any) => res(v?.id || ''));
        });
      } catch { /* ignore voucher errors */ }
    }

    const newLoan: KccLoan = {
      id: `kcc_${Date.now()}`,
      loanNo: nextLoanNo(),
      memberId: form.memberId,
      memberName: form.memberName,
      cropName: form.cropName,
      cropSeason: form.cropSeason,
      landAreaHectares: Number(form.landAreaHectares) || 0,
      sanctionedAmount: sanctioned,
      drawnAmount: drawn,
      repaidAmount: repaid,
      outstandingAmount: drawn - repaid,
      interestRate: Number(form.interestRate) || 7,
      disbursementDate: form.disbursementDate,
      dueDate: form.dueDate,
      status: 'active',
      voucherId,
      narration: form.narration,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || '',
    };

    const updated = [newLoan, ...loans];
    saveKccLoans(updated);
    setLoans(updated);
    setShowDialog(false);
    setForm(emptyForm);
    toast({ title: hi ? 'KCC ऋण दर्ज किया गया' : 'KCC Loan recorded' });
  }, [form, loans, accounts, user, hi]);

  const handleRepayment = useCallback((loanId: string, repayAmt: number) => {
    const updated = loans.map(l => {
      if (l.id !== loanId) return l;
      const newRepaid = l.repaidAmount + repayAmt;
      const newOutstanding = Math.max(0, l.outstandingAmount - repayAmt);
      return { ...l, repaidAmount: newRepaid, outstandingAmount: newOutstanding };
    });
    saveKccLoans(updated);
    setLoans(updated);
    toast({ title: hi ? 'चुकौती दर्ज की गई' : 'Repayment recorded' });
  }, [loans, hi, toast]);

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(14);
    doc.text(society.name, w / 2, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.text(hi ? 'किसान क्रेडिट कार्ड (KCC) ऋण रजिस्टर' : 'Kisan Credit Card (KCC) Loan Register', w / 2, 21, { align: 'center' });

    autoTable(doc, {
      startY: 28,
      head: [[
        hi ? 'ऋण सं.' : 'Loan No.',
        hi ? 'सदस्य' : 'Member',
        hi ? 'फसल' : 'Crop',
        hi ? 'मौसम' : 'Season',
        hi ? 'हेक्टेयर' : 'Hectare',
        hi ? 'स्वीकृत' : 'Sanctioned',
        hi ? 'आहरित' : 'Drawn',
        hi ? 'चुकाया' : 'Repaid',
        hi ? 'बकाया' : 'Outstanding',
        hi ? 'दर %' : 'Rate %',
        hi ? 'देय तिथि' : 'Due Date',
        hi ? 'स्थिति' : 'Status',
      ]],
      body: enrichedLoans.map(l => [
        l.loanNo, l.memberName, l.cropName,
        hi ? seasonLabel[l.cropSeason].hi : seasonLabel[l.cropSeason].en,
        l.landAreaHectares.toFixed(2),
        l.sanctionedAmount.toFixed(0),
        l.drawnAmount.toFixed(0),
        l.repaidAmount.toFixed(0),
        l.outstandingAmount.toFixed(0),
        `${l.interestRate}%`,
        l.dueDate,
        l.status,
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [39, 174, 96] },
    });

    doc.save(`kcc-loans-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const active = enrichedLoans.filter(l => l.status === 'active');
  const overdue = enrichedLoans.filter(l => l.status === 'overdue');
  const repaid = enrichedLoans.filter(l => l.status === 'repaid');
  const totalOutstanding = enrichedLoans.reduce((s, l) => s + l.outstandingAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'KCC / फसल ऋण' : 'KCC / Crop Loan'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'किसान क्रेडिट कार्ड ऋण प्रबंधन (PACS)' : 'Kisan Credit Card Loan Management (PACS)'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
          <Button onClick={() => { setForm(emptyForm); setErrors({}); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />{hi ? 'नया ऋण' : 'New Loan'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल बकाया' : 'Total Outstanding'}</p>
          <p className="font-bold text-lg text-amber-700">{fmt(totalOutstanding)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'सक्रिय' : 'Active'}</p>
          <p className="font-bold text-lg text-yellow-700">{active.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'अतिदेय' : 'Overdue'}</p>
          <p className="font-bold text-lg text-red-700">{overdue.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'चुकाया' : 'Repaid'}</p>
          <p className="font-bold text-lg text-green-700">{repaid.length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{hi ? 'सक्रिय' : 'Active'} ({active.length})</TabsTrigger>
          <TabsTrigger value="overdue" className="text-red-600">{hi ? 'अतिदेय' : 'Overdue'} ({overdue.length})</TabsTrigger>
          <TabsTrigger value="repaid">{hi ? 'चुकाया' : 'Repaid'} ({repaid.length})</TabsTrigger>
          <TabsTrigger value="all">{hi ? 'सभी' : 'All'}</TabsTrigger>
        </TabsList>

        {(['active', 'overdue', 'repaid', 'all'] as const).map(tab => {
          const tabData = tab === 'all' ? enrichedLoans
            : tab === 'active' ? active
            : tab === 'overdue' ? overdue
            : repaid;

          return (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{hi ? 'ऋण सं.' : 'Loan No.'}</TableHead>
                          <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                          <TableHead>{hi ? 'फसल / मौसम' : 'Crop / Season'}</TableHead>
                          <TableHead className="text-right">{hi ? 'स्वीकृत' : 'Sanctioned'}</TableHead>
                          <TableHead className="text-right">{hi ? 'बकाया' : 'Outstanding'}</TableHead>
                          <TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead>
                          <TableHead>{hi ? 'देय तिथि' : 'Due Date'}</TableHead>
                          <TableHead className="text-center">{hi ? 'स्थिति' : 'Status'}</TableHead>
                          {tab !== 'repaid' && <TableHead />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tabData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                              <Wheat className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              {hi ? 'कोई ऋण नहीं' : 'No loans'}
                            </TableCell>
                          </TableRow>
                        ) : tabData.map(l => (
                          <TableRow key={l.id} className={l.status === 'overdue' ? 'bg-red-50' : ''}>
                            <TableCell className="font-mono text-xs">{l.loanNo}</TableCell>
                            <TableCell className="font-medium">{l.memberName}</TableCell>
                            <TableCell>
                              <div>{l.cropName}</div>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${seasonLabel[l.cropSeason].color}`}>
                                {hi ? seasonLabel[l.cropSeason].hi : seasonLabel[l.cropSeason].en}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(l.sanctionedAmount)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{fmt(l.outstandingAmount)}</TableCell>
                            <TableCell className="text-right">{l.interestRate}%</TableCell>
                            <TableCell className={l.status === 'overdue' ? 'text-red-600 font-medium' : ''}>{l.dueDate}</TableCell>
                            <TableCell className="text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[l.status]}`}>
                                {l.status === 'active' ? (hi ? 'सक्रिय' : 'Active')
                                  : l.status === 'overdue' ? (hi ? 'अतिदेय' : 'Overdue')
                                  : (hi ? 'चुकाया' : 'Repaid')}
                              </span>
                            </TableCell>
                            {tab !== 'repaid' && (
                              <TableCell>
                                {l.outstandingAmount > 0 && (
                                  <RepayButton loan={l} hi={hi} onRepay={handleRepayment} />
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* New Loan Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'नया KCC ऋण' : 'New KCC Loan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{hi ? 'सदस्य' : 'Member'} *</Label>
              <Select value={form.memberId} onValueChange={v => {
                const m = activeMembers.find(m => m.id === v);
                setForm(p => ({ ...p, memberId: v, memberName: m?.name || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें' : 'Select member'} /></SelectTrigger>
                <SelectContent>
                  {activeMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.memberId})</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.memberName && <p className="text-xs text-red-600 mt-1">{errors.memberName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{hi ? 'फसल का नाम' : 'Crop Name'} *</Label>
                <Input value={form.cropName} onChange={e => setForm(p => ({ ...p, cropName: e.target.value }))} placeholder={hi ? 'जैसे: गेहूं, धान' : 'e.g. Wheat, Paddy'} />
                {errors.cropName && <p className="text-xs text-red-600 mt-1">{errors.cropName}</p>}
              </div>
              <div>
                <Label>{hi ? 'मौसम' : 'Season'}</Label>
                <Select value={form.cropSeason} onValueChange={v => setForm(p => ({ ...p, cropSeason: v as CropSeasonType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kharif">{hi ? 'खरीफ (जून-नवंबर)' : 'Kharif (Jun-Nov)'}</SelectItem>
                    <SelectItem value="rabi">{hi ? 'रबी (नवंबर-मार्च)' : 'Rabi (Nov-Mar)'}</SelectItem>
                    <SelectItem value="zaid">{hi ? 'जायद (मार्च-जून)' : 'Zaid (Mar-Jun)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{hi ? 'भूमि (हेक्टेयर)' : 'Land (Hectares)'}</Label>
                <Input type="number" step="0.01" value={form.landAreaHectares} onChange={e => setForm(p => ({ ...p, landAreaHectares: e.target.value }))} placeholder="1.50" />
              </div>
              <div>
                <Label>{hi ? 'ब्याज दर %' : 'Interest Rate %'}</Label>
                <Input type="number" step="0.5" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))} />
              </div>
              <div>
                <Label>{hi ? 'स्वीकृत राशि' : 'Sanctioned Amount'} *</Label>
                <Input type="number" value={form.sanctionedAmount} onChange={e => setForm(p => ({ ...p, sanctionedAmount: e.target.value }))} />
                {errors.sanctionedAmount && <p className="text-xs text-red-600 mt-1">{errors.sanctionedAmount}</p>}
              </div>
              <div>
                <Label>{hi ? 'आहरित राशि' : 'Drawn Amount'}</Label>
                <Input type="number" value={form.drawnAmount} onChange={e => setForm(p => ({ ...p, drawnAmount: e.target.value }))} placeholder={hi ? 'स्वीकृत राशि जितना' : 'Same as sanctioned'} />
              </div>
              <div>
                <Label>{hi ? 'वितरण तिथि' : 'Disbursement Date'} *</Label>
                <Input type="date" value={form.disbursementDate} onChange={e => setForm(p => ({ ...p, disbursementDate: e.target.value }))} />
                {errors.disbursementDate && <p className="text-xs text-red-600 mt-1">{errors.disbursementDate}</p>}
              </div>
              <div>
                <Label>{hi ? 'देय तिथि' : 'Due Date'} *</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                {errors.dueDate && <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>}
              </div>
            </div>
            <div>
              <Label>{hi ? 'टिप्पणी' : 'Narration'}</Label>
              <Input value={form.narration} onChange={e => setForm(p => ({ ...p, narration: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
              <Button onClick={handleSave}>{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepayButton({ loan, hi, onRepay }: { loan: KccLoan; hi: boolean; onRepay: (id: string, amt: number) => void }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState('');

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {hi ? 'चुकौती' : 'Repay'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'चुकौती दर्ज करें' : 'Record Repayment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{hi ? 'बकाया:' : 'Outstanding:'} <strong>{loan.outstandingAmount.toLocaleString('hi-IN', { style: 'currency', currency: 'INR' })}</strong></p>
            <Label>{hi ? 'चुकौती राशि' : 'Repayment Amount'}</Label>
            <Input type="number" value={amt} onChange={e => setAmt(e.target.value)} max={loan.outstandingAmount} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={() => { if (Number(amt) > 0) { onRepay(loan.id, Number(amt)); setOpen(false); } }}>
                {hi ? 'सहेजें' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
