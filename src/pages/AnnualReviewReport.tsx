/**
 * Annual Review Report — Haryana Marketing Societies (Proforma 1 to 9)
 *
 * Phase 1: Proforma 1 (Income/Expense Summary) — fully implemented.
 * Proforma 2–9: Scaffolded placeholders, implemented in later phases.
 */
import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, AlertTriangle, Construction, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateP1, CROP_LABELS, EXPENSE_BUCKET_LABELS, TURNOVER_BUCKET_LABELS, fmtLacs } from '@/lib/annualReview/p1Calculator';
import { generateP1PDF } from '@/lib/annualReview/p1Pdf';
import { calculateP2 } from '@/lib/annualReview/p2Calculator';
import { generateP2PDF } from '@/lib/annualReview/p2Pdf';
import { calculateP5 } from '@/lib/annualReview/p5Calculator';
import { generateP5PDF } from '@/lib/annualReview/p5Pdf';
import { calculateP6 } from '@/lib/annualReview/p6Calculator';
import { generateP6PDF } from '@/lib/annualReview/p6Pdf';
import { calculateP4 } from '@/lib/annualReview/p4Calculator';
import { generateP4PDF } from '@/lib/annualReview/p4Pdf';
import { calculateP8 } from '@/lib/annualReview/p8Calculator';
import { generateP8PDF } from '@/lib/annualReview/p8Pdf';

const PROFORMAS = [
  { id: 'p1', label: 'P1: Income/Expense', implemented: true },
  { id: 'p2', label: 'P2: Recoverables', implemented: true },
  { id: 'p3', label: 'P3: Financial Result', implemented: false },
  { id: 'p4', label: 'P4: Patronage Rebate', implemented: true },
  { id: 'p5', label: 'P5: Staff & Salary', implemented: true },
  { id: 'p6', label: 'P6: Fixed Assets', implemented: true },
  { id: 'p7', label: 'P7: Rent/Transport', implemented: false },
  { id: 'p8', label: 'P8: Kachi Aarat', implemented: true },
  { id: 'p9', label: 'P9: District Review', implemented: false },
];

const AnnualReviewReport: React.FC = () => {
  const { society, accounts, vouchers, members, employees, recoverables, assets, stockItems, stockMovements, kachiAaratEntries } = useData();
  const { language } = useLanguage();
  const { hasPermission } = useAuth();
  const hi = language === 'hi';

  const canEdit = hasPermission(['admin', 'accountant']);

  const fyEnd = society.financialYearStart
    ? `20${society.financialYear.split('-')[1]}-03-31`
    : '';

  const [fromDate, setFromDate] = useState(society.financialYearStart || '');
  const [toDate, setToDate] = useState(fyEnd);

  // ── Manual overrides (P1) ──
  const [manualPatronage, setManualPatronage] = useState('');
  const [manualPatronageOther, setManualPatronageOther] = useState('');
  const [accumPl, setAccumPl] = useState('');
  const [wholesale, setWholesale] = useState(false);
  const [hafedShare, setHafedShare] = useState('');
  const [hafedFdr, setHafedFdr] = useState('');
  const [otherInv, setOtherInv] = useState('');
  const [lossReasons, setLossReasons] = useState('');

  const activeEmployeeCount = (employees || []).filter(e => e.status === 'active').length;

  const p1 = useMemo(() => calculateP1({
    accounts, vouchers, members, society,
    fromDate, toDate,
    employeeCount: activeEmployeeCount,
    manualOverrides: {
      patronageRebate: manualPatronage ? Number(manualPatronage) : undefined,
      patronageOther:  manualPatronageOther ? Number(manualPatronageOther) : undefined,
      accumulatedProfitLoss: accumPl ? Number(accumPl) : undefined,
      wholesaleFertPesticide: wholesale,
      hafedShareInvestment: hafedShare ? Number(hafedShare) : undefined,
      hafedFdr: hafedFdr ? Number(hafedFdr) : undefined,
      otherInvestment: otherInv ? Number(otherInv) : undefined,
      lossReasons,
    },
  }), [accounts, vouchers, members, society, fromDate, toDate, activeEmployeeCount,
       manualPatronage, manualPatronageOther, accumPl, wholesale, hafedShare, hafedFdr, otherInv, lossReasons]);

  const handleDownloadP1 = () => {
    generateP1PDF(p1, society, fromDate, toDate);
  };

  // ── P2 — Recoverables ──
  const p2 = useMemo(() => calculateP2({ recoverables, fyStartDate: fromDate }), [recoverables, fromDate]);
  const handleDownloadP2 = () => { generateP2PDF(p2, society, fromDate); };
  const p2CaseCount = recoverables.filter(r => !r.isDeleted && r.fyStartDate === fromDate).length;

  // ── P5 — Staff & Salary ──
  const p5 = useMemo(() => calculateP5(employees || [], society), [employees, society]);
  const handleDownloadP5 = () => { generateP5PDF(p5, society, society.financialYear); };

  // ── P6 — Fixed Assets ──
  const p6 = useMemo(() => calculateP6(assets || [], society), [assets, society]);
  const handleDownloadP6 = () => { generateP6PDF(p6, society); };

  // ── P4 — Patronage Rebate quantities ──
  const p4 = useMemo(() => calculateP4({
    stockItems: stockItems || [],
    movements: stockMovements || [],
    fromDate, toDate,
    societyName: society.name,
  }), [stockItems, stockMovements, fromDate, toDate, society.name]);
  const handleDownloadP4 = () => { generateP4PDF(p4, society, fromDate, toDate); };

  // ── P8 — Kachi Aarat ──
  const p8 = useMemo(() => calculateP8({
    entries: kachiAaratEntries || [],
    fyStartDate: fromDate,
    societyName: society.name,
  }), [kachiAaratEntries, fromDate, society.name]);
  const handleDownloadP8 = () => { generateP8PDF(p8, society, fromDate); };

  const Row: React.FC<{ sr: string; label: string; amount?: number; bold?: boolean; manual?: React.ReactNode; indent?: boolean }> = ({ sr, label, amount, bold, manual, indent }) => (
    <div className={`grid grid-cols-[60px_1fr_180px] gap-2 py-1.5 px-2 ${bold ? 'bg-muted font-semibold' : ''} ${indent ? 'pl-6' : ''} border-b border-border/50`}>
      <span className="text-xs text-muted-foreground">{sr}</span>
      <span className="text-sm">{label}</span>
      <div className="text-right text-sm font-mono">
        {manual !== undefined ? manual : (amount !== undefined ? fmtLacs(amount) : '')}
      </div>
    </div>
  );

  const NumInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
    <Input
      type="number"
      step="0.01"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || '0.00'}
      className="h-7 text-xs text-right"
      disabled={!canEdit}
    />
  );

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            {hi ? 'वार्षिक समीक्षा रिपोर्ट' : 'Annual Review Report'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hi
              ? 'हरियाणा विपणन सहकारी समितियों के लिए Proforma 1 से 9'
              : 'Proforma 1 to 9 for Haryana Marketing Cooperative Societies (HAFED)'}
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">From Date</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">To Date</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="p1" className="w-full">
        <TabsList className="grid grid-cols-9 w-full mb-4 h-auto">
          {PROFORMAS.map(p => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs py-2 flex flex-col gap-0.5">
              <span className="uppercase font-semibold">{p.id}</span>
              {!p.implemented && <span className="text-[9px] text-muted-foreground">Soon</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ───────────── P1 ───────────── */}
        <TabsContent value="p1" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Proforma 1 — Annual Review / Inspection Note</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {society.name} · FY {society.financialYear} · (Rs. in Lacs)
                </p>
              </div>
              <Button onClick={handleDownloadP1} size="sm" className="gap-2">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 p-0">
              {/* Row 1 — Commission */}
              <Row sr="1" label="INCOME FROM COMMISSION ON" bold />
              {(Object.entries(CROP_LABELS) as [keyof typeof CROP_LABELS, string][]).map(([key, label], idx) => (
                <Row key={key} sr={String.fromCharCode(105 + idx)} label={`${['i','ii','iii','iv','v','vi','vii','viii','ix'][idx]}) ${label.split(' / ')[0]}`} amount={p1.commission[key]} indent />
              ))}
              <Row sr="2" label="PATRONAGE REBATE (Annexure 4)" manual={<NumInput value={manualPatronage} onChange={setManualPatronage} />} />
              <Row sr="" label="Other if Any" manual={<NumInput value={manualPatronageOther} onChange={setManualPatronageOther} />} indent />
              <Row sr="3" label="TOTAL INCOME COMMISSION + PATRONAGE REBATE (1+2)" amount={p1.totalIncomeCommissionPatronage} bold />
              <Row sr="4" label="MARGIN EARNED ON DISTRIBUTION OF INPUTS" amount={p1.inputMargin} />
              <Row sr="5" label="INCOME FROM SALE OF CONSUMER PRODUCTS" amount={p1.consumerSale} />
              <Row sr="6" label="INCOME FROM OWN PROCESSING UNITS" amount={p1.processingIncome} />
              <Row sr="7" label="INCOME FROM TRUCKS" amount={p1.truckIncome} />
              <Row sr="8" label="RENTAL INCOME OF SOCIETY" amount={p1.rentalIncome} />
              <Row sr="9" label="OTHER INCOME, IF ANY FROM HAFED" amount={p1.hafedOther} />
              <Row sr="10" label="INCOME FROM OTHER THAN HAFED" amount={p1.nonHafedIncome} />
              <Row sr="11" label="TOTAL INCOME (3+4+5+6+7+8+9+10)" amount={p1.totalIncome} bold />

              <Row sr="12" label="EXPENSES" bold />
              {(Object.entries(EXPENSE_BUCKET_LABELS) as [keyof typeof EXPENSE_BUCKET_LABELS, string][]).map(([key, label], i) => (
                <Row key={key} sr={String.fromCharCode(97 + i)} label={`${['a','b','c','d','e','f'][i]}) ${label}`} amount={p1.expenses[key]} indent />
              ))}
              <Row sr="13" label="TOTAL EXP. (a+b+c+d+e+f)" amount={p1.totalExpenses} bold />
              <Row sr="14" label="NET PROFIT / LOSS (11-13)" amount={p1.netProfitLoss} bold />
              <Row sr="15" label="ACCUMULATED PROFIT / LOSS AS PER BALANCE SHEET" manual={<NumInput value={accumPl} onChange={setAccumPl} />} />
              <Row sr="16" label="WHOLESALE BUSINESS OF FERT. & PESTICIDES?" manual={
                <div className="flex items-center justify-end gap-2">
                  <Switch checked={wholesale} onCheckedChange={setWholesale} disabled={!canEdit} />
                  <span className="text-xs">{wholesale ? 'YES' : 'NO'}</span>
                </div>
              } />
              <Row sr="17" label="TURNOVER OF SOCIETY" bold />
              {(Object.entries(TURNOVER_BUCKET_LABELS) as [keyof typeof TURNOVER_BUCKET_LABELS, string][]).map(([key, label], i) => (
                <Row key={key} sr={String.fromCharCode(97 + i)} label={`${['a','b','c','d','e','f'][i]}) ${label}`} amount={p1.turnover[key]} indent />
              ))}
              <Row sr="18" label="TOTAL (a+b+c+d+e+f)" amount={p1.turnoverTotal} bold />
              <Row sr="19" label="DETAIL OF EMPLOYEES (Annexure 5)" amount={p1.employeeCount} />
              <Row sr="20" label="SHARE CAPITAL" amount={p1.shareCapital} />
              <Row sr="21" label="INVESTMENT IN HAFED (SHARE CAPITAL)" manual={<NumInput value={hafedShare} onChange={setHafedShare} />} />
              <Row sr="22" label="FDR's WITH HAFED" manual={<NumInput value={hafedFdr} onChange={setHafedFdr} />} />
              <Row sr="23" label="INVESTMENT OTHER THAN HAFED" manual={<NumInput value={otherInv} onChange={setOtherInv} />} />
              <Row sr="24" label="REASONS OF LOSSES, IF ANY (Manager CMS Comments)" manual={
                <Textarea value={lossReasons} onChange={e => setLossReasons(e.target.value)} rows={2} className="text-xs" disabled={!canEdit} />
              } />
            </CardContent>
          </Card>

          {/* Unclassified accounts warning */}
          {(p1.unclassifiedIncomeAccounts.length > 0 || p1.unclassifiedExpenseAccounts.length > 0) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">
                  {hi ? 'कुछ खाते P1 में classify नहीं हुए हैं — ये राशियाँ report में नहीं आएँगी:' : 'Some accounts are not classified for P1 — these amounts will NOT appear in the report:'}
                </p>
                {p1.unclassifiedIncomeAccounts.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold">Income accounts:</p>
                    <ul className="text-xs pl-4">
                      {p1.unclassifiedIncomeAccounts.map(a => (
                        <li key={a.id}>• {a.name} — ₹{a.amount.toLocaleString('en-IN')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p1.unclassifiedExpenseAccounts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold">Expense accounts:</p>
                    <ul className="text-xs pl-4">
                      {p1.unclassifiedExpenseAccounts.map(a => (
                        <li key={a.id}>• {a.name} — ₹{a.amount.toLocaleString('en-IN')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs mt-2 italic">
                  {hi ? 'ठीक करने के लिए: Ledger Heads → खाता Edit → P1 Classification drop-down।' : 'Fix: Ledger Heads → Edit account → set P1 Classification dropdown.'}
                </p>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* ───────────── P2 ───────────── */}
        <TabsContent value="p2" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Proforma 2 — Recoverable Position</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {society.name} · FY starts {fromDate} · ({p2CaseCount} cases) · (Rs. exact)
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/recoverables"><Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4"/>Manage Cases</Button></Link>
                <Button onClick={handleDownloadP2} size="sm" className="gap-2" disabled={p2CaseCount === 0}><Download className="h-4 w-4" /> Download PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {p2CaseCount === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {hi
                    ? 'इस FY के लिए कोई वसूली केस नहीं है। "Manage Cases" बटन से जोड़ें।'
                    : 'No recoverable cases for this FY. Use "Manage Cases" to add entries.'}
                </div>
              )}
              {p2CaseCount > 0 && (
                <>
                  <Row sr="A)" label={`Opening balance as on ${fromDate}`} bold />
                  <Row sr="1" label="Fertilizer & Pesticide Outstanding" amount={p2.opening.fertPesticide / 100000} indent />
                  <Row sr="2" label="Advances" amount={p2.opening.advance / 100000} indent />
                  <Row sr="3" label="Embezzlements (If Any)" amount={p2.opening.embezzlement / 100000} indent />
                  <Row sr="4" label="Others (if any)" amount={p2.opening.other / 100000} indent />
                  <Row sr="" label="Total (A)" amount={p2.openingTotal / 100000} bold />

                  <Row sr="B)" label="Addition During the Year" bold />
                  <Row sr="1" label="Fertilizer & Pesticide Outstanding" amount={p2.additions.fertPesticide / 100000} indent />
                  <Row sr="2" label="Advances" amount={p2.additions.advance / 100000} indent />
                  <Row sr="3" label="Embezzlements (If Any)" amount={p2.additions.embezzlement / 100000} indent />
                  <Row sr="4" label="Others (if any)" amount={p2.additions.other / 100000} indent />
                  <Row sr="" label="Total (B)" amount={p2.additionsTotal / 100000} bold />

                  <Row sr="C)" label="Recovery Made During the Year" bold />
                  <Row sr="1" label="Fertilizer & Pesticide Outstanding" amount={p2.recoveries.fertPesticide / 100000} indent />
                  <Row sr="2" label="Advances" amount={p2.recoveries.advance / 100000} indent />
                  <Row sr="3" label="Embezzlements (If Any)" amount={p2.recoveries.embezzlement / 100000} indent />
                  <Row sr="4" label="Others (if any)" amount={p2.recoveries.other / 100000} indent />
                  <Row sr="" label="Total (C)" amount={p2.recoveriesTotal / 100000} bold />

                  <Row sr="D)" label="Balance Recoverables (Closing) — split by Legal Stage" bold />
                  <Row sr="1" label="Cases with police" amount={p2.legalStage.police / 100000} indent />
                  <Row sr="2" label="Cases in arbitration" amount={p2.legalStage.arbitration / 100000} indent />
                  <Row sr="3" label="Cases under execution" amount={p2.legalStage.execution / 100000} indent />
                  <Row sr="4" label="Award taken but not sent to execution" amount={p2.legalStage.award / 100000} indent />
                  <Row sr="5" label="Others" indent />
                  <Row sr="" label="   a) Confirmed" amount={(p2.legalStage.confirmed + p2.legalStage.none) / 100000} indent />
                  <Row sr="" label="   b) Un-confirmed" amount={p2.legalStage.unconfirmed / 100000} indent />
                  <Row sr="" label="Total (D)" amount={p2.legalStageTotal / 100000} bold />

                  {Math.abs(p2.closingTotal - p2.legalStageTotal) > 0.01 && (
                    <Alert variant="destructive" className="m-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {hi
                          ? `Section D total (${fmtLacs(p2.legalStageTotal)}) A+B-C (${fmtLacs(p2.closingTotal)}) से मेल नहीं खाता। कानूनी स्थिति जांचें।`
                          : `Section D total (${fmtLacs(p2.legalStageTotal)}) does not match A+B−C (${fmtLacs(p2.closingTotal)}). Review legal stages.`}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── P5 ───────────── */}
        <TabsContent value="p5" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Proforma 5 — Staff & Salary</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {society.name} · FY {society.financialYear} · {p5.summary.totalActive} active employees
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/salary-management"><Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4"/>Manage Staff</Button></Link>
                <Button onClick={handleDownloadP5} size="sm" className="gap-2" disabled={p5.summary.totalActive === 0}><Download className="h-4 w-4" /> Download PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-primary/5"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'स्वीकृत पद' : 'Sanctioned'}</p>
                  <p className="text-xl font-bold text-primary">{p5.summary.sanctionedStrength}</p>
                </CardContent></Card>
                <Card className="bg-green-50 dark:bg-green-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'कुल सक्रिय' : 'Total Active'}</p>
                  <p className="text-xl font-bold text-green-700">{p5.summary.totalActive}</p>
                </CardContent></Card>
                <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'सोसायटी कर्मचारी' : 'Society Employee'}</p>
                  <p className="text-xl font-bold text-blue-700">{p5.summary.societyEmployees}</p>
                </CardContent></Card>
                <Card className="bg-purple-50 dark:bg-purple-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'HAFED डेप्युटेशन' : 'HAFED Deputed'}</p>
                  <p className="text-xl font-bold text-purple-700">{p5.summary.hafedDeputed}</p>
                </CardContent></Card>
                <Card className="bg-amber-50 dark:bg-amber-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'आउटसोर्स' : 'Outsourced'}</p>
                  <p className="text-xl font-bold text-amber-700">{p5.summary.outsourced}</p>
                </CardContent></Card>
              </div>

              {p5.summary.totalActive === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  {hi ? 'कोई सक्रिय कर्मचारी नहीं। Salary Management से जोड़ें।' : 'No active employees. Add via Salary Management.'}
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">S.No</th>
                        <th className="text-left p-2">{hi ? 'कर्मचारी' : 'Employee'}</th>
                        <th className="text-left p-2">{hi ? 'पदनाम' : 'Designation'}</th>
                        <th className="text-center p-2">Cat.</th>
                        <th className="text-left p-2">Pay Scale</th>
                        <th className="text-right p-2">Basic Pay</th>
                        <th className="text-center p-2">HAFED Dep.</th>
                        <th className="text-center p-2">Society</th>
                        <th className="text-center p-2">Outsrc.</th>
                        <th className="text-right p-2">HAFED Paid</th>
                        <th className="text-right p-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p5.rows.map(r => (
                        <tr key={r.sNo} className="border-t">
                          <td className="p-2">{r.sNo}</td>
                          <td className="p-2 font-medium">{r.employeeName}</td>
                          <td className="p-2">{r.designation}</td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-xs">{r.category}</Badge>
                          </td>
                          <td className="p-2">{r.payScale}</td>
                          <td className="p-2 text-right font-mono">{r.basicPay.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-center">{r.isHafedDeputed ? '✓' : '—'}</td>
                          <td className="p-2 text-center">{r.isSocietyEmployee ? '✓' : '—'}</td>
                          <td className="p-2 text-center">{r.isOutsourced ? '✓' : '—'}</td>
                          <td className="p-2 text-right font-mono">{r.hafedSalaryPaid ? r.hafedSalaryPaid.toLocaleString('en-IN') : '—'}</td>
                          <td className="p-2 text-right">{r.hafedSalaryPercent ? `${r.hafedSalaryPercent}%` : '—'}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted font-semibold">
                        <td className="p-2" colSpan={5}>TOTAL</td>
                        <td className="p-2 text-right font-mono">{p5.summary.totalBasicPay.toLocaleString('en-IN')}</td>
                        <td className="p-2 text-center">{p5.summary.hafedDeputed}</td>
                        <td className="p-2 text-center">{p5.summary.societyEmployees}</td>
                        <td className="p-2 text-center">{p5.summary.outsourced}</td>
                        <td className="p-2 text-right font-mono">{p5.summary.totalHafedSalaryPaid.toLocaleString('en-IN')}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {!society.sanctionedStrength && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {hi
                      ? 'स्वीकृत पद संख्या (Sanctioned Strength) सेट नहीं है। Society Setup से सेट करें।'
                      : 'Sanctioned strength is not set. Please configure in Society Setup.'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── P6 ───────────── */}
        <TabsContent value="p6" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Proforma 6 — Detail of Assets (Working / Non-Working)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {society.name} · FY {society.financialYear}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/asset-register"><Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4"/>Manage Assets</Button></Link>
                <Button onClick={handleDownloadP6} size="sm" className="gap-2" disabled={p6.groups.every(g => g.rows.length === 0)}><Download className="h-4 w-4" /> Download PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'कुल मूल लागत' : 'Total Original Cost'}</p>
                  <p className="text-lg font-bold text-blue-700">₹{p6.grandTotalOriginal.toLocaleString('en-IN')}</p>
                </CardContent></Card>
                <Card className="bg-amber-50 dark:bg-amber-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'WDV' : 'Total WDV'}</p>
                  <p className="text-lg font-bold text-amber-700">₹{p6.grandTotalWdv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </CardContent></Card>
                <Card className="bg-green-50 dark:bg-green-950/20"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{hi ? 'बाजार मूल्य' : 'Market Value'}</p>
                  <p className="text-lg font-bold text-green-700">₹{p6.grandTotalMarket.toLocaleString('en-IN')}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Condition</p>
                  <p className="text-sm font-bold"><span className="text-green-700">✓ {p6.serviceableCount}</span> · <span className="text-red-700">✗ {p6.unserviceableCount}</span></p>
                </CardContent></Card>
              </div>

              {/* Untagged warning */}
              {p6.untagged.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {hi
                      ? `${p6.untagged.length} संपत्ति P6 श्रेणी के बिना है — Asset Register में "P6 Category" सेट करें:`
                      : `${p6.untagged.length} asset(s) without P6 category — set "P6 Category" in Asset Register:`}
                    <ul className="pl-4 mt-1">
                      {p6.untagged.slice(0, 8).map(a => <li key={a.id}>• {a.name}</li>)}
                      {p6.untagged.length > 8 && <li>... and {p6.untagged.length - 8} more</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Category tables */}
              {p6.groups.map((group, gi) => (
                <div key={group.category} className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Badge variant="outline">{gi + 1}</Badge>
                    {group.label}
                    <span className="text-xs text-muted-foreground ml-2">({group.rows.length} items)</span>
                  </h3>
                  {group.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-6 italic">(no assets classified)</p>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 w-8"></th>
                            <th className="text-left p-2">Name</th>
                            {group.category === 'godown' && <th className="text-right p-2">Capacity (MT)</th>}
                            <th className="text-right p-2">Original Cost</th>
                            <th className="text-right p-2">WDV</th>
                            <th className="text-right p-2">Market Value</th>
                            <th className="text-center p-2">Condition</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((r, ri) => (
                            <tr key={r.id} className="border-t">
                              <td className="p-2">{String.fromCharCode(65 + ri)}</td>
                              <td className="p-2 font-medium">{r.name}</td>
                              {group.category === 'godown' && <td className="p-2 text-right font-mono">{r.capacityMT ? r.capacityMT.toFixed(2) : '—'}</td>}
                              <td className="p-2 text-right font-mono">{r.originalCost.toLocaleString('en-IN')}</td>
                              <td className="p-2 text-right font-mono">{r.wdv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right font-mono">{r.marketValue.toLocaleString('en-IN')}</td>
                              <td className="p-2 text-center">
                                {r.condition === 'serviceable' && <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">Serviceable</Badge>}
                                {r.condition === 'unserviceable' && <Badge variant="outline" className="bg-red-100 text-red-700 text-xs">Unserviceable</Badge>}
                                {r.condition === 'unknown' && <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t bg-muted/60 font-semibold">
                            <td colSpan={group.category === 'godown' ? 2 : 2} className="p-2">Sub-total</td>
                            {group.category === 'godown' && <td className="p-2 text-right font-mono">{group.totalCapacity.toFixed(2)}</td>}
                            <td className="p-2 text-right font-mono">{group.totalOriginal.toLocaleString('en-IN')}</td>
                            <td className="p-2 text-right font-mono">{group.totalWdv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="p-2 text-right font-mono">{group.totalMarket.toLocaleString('en-IN')}</td>
                            <td className="p-2"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── P4 ───────────── */}
        <TabsContent value="p4" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Proforma 4 — Patronage Rebate (MT)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {society.name} · {fromDate} to {toDate} · All quantities in MT (Metric Tonnes)
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/inventory"><Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4"/>Manage Stock Items</Button></Link>
                <Button onClick={handleDownloadP4} size="sm" className="gap-2"><Download className="h-4 w-4" /> Download PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Govt format — 5-column table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">S.No</th>
                      <th className="text-left p-2">{hi ? 'सोसायटी' : 'Society'}</th>
                      <th className="text-right p-2">DAP Sold (MT)</th>
                      <th className="text-right p-2">Urea Sold (MT)</th>
                      <th className="text-right p-2">Wheat Proc. (MT)</th>
                      <th className="text-right p-2">Barley Proc. (MT)</th>
                      <th className="text-right p-2">Gram Proc. (MT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">1</td>
                      <td className="p-2 font-medium">{p4.society}</td>
                      <td className="p-2 text-right font-mono">{p4.totals.dap.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{p4.totals.urea.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{p4.totals.wheatProc.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{p4.totals.barleyProc.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">{p4.totals.gramProc.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Additional crops — not in the 5-column govt grid but society may have data */}
              <div>
                <h3 className="text-sm font-semibold mb-2">{hi ? 'अतिरिक्त' : 'Additional Categories'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Paddy Proc.</p>
                    <p className="text-lg font-bold">{p4.totals.paddyProc.toFixed(2)} MT</p>
                  </CardContent></Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Mustard Proc.</p>
                    <p className="text-lg font-bold">{p4.totals.mustardProc.toFixed(2)} MT</p>
                  </CardContent></Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Sunflower Proc.</p>
                    <p className="text-lg font-bold">{p4.totals.sunflowerProc.toFixed(2)} MT</p>
                  </CardContent></Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/20"><CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Other Procurement</p>
                    <p className="text-lg font-bold">{p4.totals.otherProc.toFixed(2)} MT</p>
                  </CardContent></Card>
                  <Card className="bg-green-50 dark:bg-green-950/20"><CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Other Fertilizer</p>
                    <p className="text-lg font-bold">{p4.totals.otherFert.toFixed(2)} MT</p>
                  </CardContent></Card>
                </div>
              </div>

              {/* Untagged warning */}
              {p4.untaggedItems.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {hi
                      ? `${p4.untaggedItems.length} स्टॉक आइटम पर P4 श्रेणी नहीं है — इनकी quantity Proforma 4 में नहीं आएगी।`
                      : `${p4.untaggedItems.length} stock item(s) have movements but no P4 category — their quantities won't appear in Proforma 4.`}
                    <ul className="pl-4 mt-1">
                      {p4.untaggedItems.slice(0, 8).map(it => <li key={it.id}>• {it.name} ({it.unit})</li>)}
                      {p4.untaggedItems.length > 8 && <li>... and {p4.untaggedItems.length - 8} more</li>}
                    </ul>
                    <p className="mt-2 italic">
                      {hi ? 'ठीक करने के लिए: Inventory → आइटम Edit → HAFED Proforma 4 Category।' : 'Fix: Inventory → Edit item → set HAFED Proforma 4 Category.'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {hi
                    ? 'मात्राएं Inventory → स्टॉक चाल (Stock Movements) से ली जाती हैं। Unit: kg / quintal / MT स्वचालित रूप से MT में बदलती है। bag/piece/liter आदि इकाइयाँ शून्य दिखाएंगी।'
                    : 'Quantities are pulled from Inventory → Stock Movements within the date range. Units kg / quintal / MT are auto-converted to MT. Items in bag/piece/liter etc. show 0 — set item unit correctly.'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── P8 ───────────── */}
        <TabsContent value="p8" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Proforma 8 — Kachi Aarat</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {society.name} · FY starts {fromDate} · ({p8.entryCount} entries)
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/kachi-aarat"><Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4"/>Manage Entries</Button></Link>
                <Button onClick={handleDownloadP8} size="sm" className="gap-2" disabled={p8.entryCount === 0}><Download className="h-4 w-4" /> Download PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Govt main table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">S.No</th>
                      <th className="text-left p-2">{hi ? 'सोसायटी का नाम' : 'Name of CMS'}</th>
                      <th className="text-right p-2">{hi ? 'व्यापार मूल्य (₹)' : 'Value of Business (₹)'}</th>
                      <th className="text-right p-2">{hi ? 'दामी अर्जित (₹)' : 'Dami Earned (₹)'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">1</td>
                      <td className="p-2 font-medium">{p8.society}</td>
                      <td className="p-2 text-right font-mono">{p8.totalBusinessValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">{p8.totalDamiEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Crop split (for P9 input) */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  {hi ? 'फसल-वार दामी विभाजन' : 'Dami Earned — Split by Crop'}
                  <Badge variant="outline" className="text-[10px]">for Proforma 9</Badge>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(['mustardSeed','gram','barley','wheat','paddy','other'] as const).map(crop => (
                    <Card key={crop}><CardContent className="p-3">
                      <p className="text-xs text-muted-foreground capitalize">{crop === 'mustardSeed' ? 'Mustard Seed' : crop}</p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Business: </span>
                        <span className="font-mono">{p8.businessByCrop[crop].toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Dami: </span>
                        <span className="font-mono font-semibold text-green-700">{p8.damiByCrop[crop].toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </p>
                    </CardContent></Card>
                  ))}
                </div>
              </div>

              {p8.entryCount === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {hi
                      ? 'कोई कच्ची आढ़त एंट्री नहीं। "Manage Entries" बटन से जोड़ें।'
                      : 'No Kachi Aarat entries yet. Use "Manage Entries" to add transactions (one row per farmer/crop).'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── P3–P9 Placeholders ───────────── */}
        {PROFORMAS.filter(p => !p.implemented).map(p => (
          <TabsContent key={p.id} value={p.id}>
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <Construction className="h-12 w-12 text-muted-foreground" />
                <p className="font-semibold">{p.label}</p>
                <Badge variant="secondary">{hi ? 'जल्द आ रहा है' : 'Coming in next phase'}</Badge>
                <p className="text-xs text-muted-foreground max-w-md">
                  {hi
                    ? 'यह प्रोफॉर्मा अगले चरण में लागू किया जाएगा। P1 (Income/Expense) पूर्ण है।'
                    : 'This proforma will be implemented in the next phase. P1 (Income/Expense) is complete and ready to export.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AnnualReviewReport;
