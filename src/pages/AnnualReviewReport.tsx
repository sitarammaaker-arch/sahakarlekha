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
import { FileText, Download, AlertTriangle, Construction } from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateP1, CROP_LABELS, EXPENSE_BUCKET_LABELS, TURNOVER_BUCKET_LABELS, fmtLacs } from '@/lib/annualReview/p1Calculator';
import { generateP1PDF } from '@/lib/annualReview/p1Pdf';
import { calculateP2 } from '@/lib/annualReview/p2Calculator';
import { generateP2PDF } from '@/lib/annualReview/p2Pdf';

const PROFORMAS = [
  { id: 'p1', label: 'P1: Income/Expense', implemented: true },
  { id: 'p2', label: 'P2: Recoverables', implemented: true },
  { id: 'p3', label: 'P3: Financial Result', implemented: false },
  { id: 'p4', label: 'P4: Patronage Rebate', implemented: false },
  { id: 'p5', label: 'P5: Staff & Salary', implemented: false },
  { id: 'p6', label: 'P6: Fixed Assets', implemented: false },
  { id: 'p7', label: 'P7: Rent/Transport', implemented: false },
  { id: 'p8', label: 'P8: Kachi Aarat', implemented: false },
  { id: 'p9', label: 'P9: District Review', implemented: false },
];

const AnnualReviewReport: React.FC = () => {
  const { society, accounts, vouchers, members, employees, recoverables } = useData();
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
