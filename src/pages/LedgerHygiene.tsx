/**
 * Ledger Hygiene (ECR-28) — read-only diagnostic for the chart of accounts.
 * Flags dangling voucher references, deleted-party accounts (removable vs retained),
 * unused heads, duplicate names, empty groups and blank names. No mutation — remediation
 * (delete / merge / rename) is done on the Ledger Heads page.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, AlertTriangle, AlertOctagon, Trash2, Info, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVoucherLines } from '@/lib/voucherUtils';
import { analyzeLedgerHygiene, hygieneSummary, type HygieneCategory, type HygieneSeverity, type LedgerUsage } from '@/lib/ledgerHygiene';

const SEV_CLS: Record<HygieneSeverity, string> = {
  error: 'bg-red-100 text-red-800 border-red-300',
  warning: 'bg-amber-100 text-amber-800 border-amber-300',
  cleanup: 'bg-blue-100 text-blue-800 border-blue-300',
  info: 'bg-slate-100 text-slate-700 border-slate-300',
};

const CAT: Record<HygieneCategory, { hi: string; en: string; hintHi: string; hintEn: string }> = {
  'dangling-reference': { hi: 'लटकते संदर्भ', en: 'Dangling references', hintHi: 'इन वाउचरों का खाता गायब है — डेटा असंगति। खाता दोबारा बनाएँ या वाउचर ठीक करें।', hintEn: 'These vouchers point at a missing account — data inconsistency. Recreate the account or fix the vouchers.' },
  'deleted-removable': { hi: 'हटाए गए पक्ष — सुरक्षित रूप से हटाने योग्य', en: 'Deleted parties — safe to remove', hintHi: 'कोई live वाउचर नहीं, शून्य शेष। Ledger Heads पर जाकर हटा सकते हैं।', hintEn: 'No live vouchers, zero balance. Safe to delete on the Ledger Heads page.' },
  'deleted-retained': { hi: 'हटाए गए पक्ष — रखे गए', en: 'Deleted parties — retained', hintHi: 'ये खाते अब भी वाउचरों में हैं — audit के लिए सही से रखे गए (RULE-3)। कुछ न करें।', hintEn: 'Still referenced by live vouchers — correctly kept for audit (RULE-3). No action needed.' },
  'unused-head': { hi: 'अप्रयुक्त खाता शीर्ष', en: 'Unused heads', hintHi: 'कोई ओपनिंग/लेन-देन/पक्ष नहीं। ज़रूरत न हो तो Ledger Heads पर हटाएँ।', hintEn: 'No opening balance, transactions or linked party. Delete on Ledger Heads if not needed.' },
  'duplicate-name': { hi: 'दोहरे नाम', en: 'Duplicate names', hintHi: 'एक ही नाम के कई खाते — भ्रम का जोखिम। Ledger Heads पर merge करें।', hintEn: 'Several accounts share a name — ambiguity risk. Merge them on Ledger Heads.' },
  'empty-group': { hi: 'खाली समूह', en: 'Empty groups', hintHi: 'इस समूह/शीर्ष के अंदर कोई खाता नहीं। child जोड़ें या समूह हटाएँ।', hintEn: 'This group/header has no child account. Add a child or remove the group.' },
  'blank-name': { hi: 'रिक्त नाम', en: 'Blank names', hintHi: 'नाम या हिंदी नाम खाली है। Ledger Heads पर भरें।', hintEn: 'Missing English or Hindi name. Fill it in on Ledger Heads.' },
};

const SEV_ICON: Record<HygieneSeverity, React.ReactNode> = {
  error: <AlertOctagon className="h-4 w-4 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  cleanup: <Trash2 className="h-4 w-4 text-blue-600" />,
  info: <Info className="h-4 w-4 text-slate-500" />,
};

const LedgerHygiene: React.FC = () => {
  const { accounts, vouchers, suppliers, customers, getAccountBalance } = useData();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const hi = language === 'hi';

  // Usage snapshot — voucher-line references (incl. legacy Dr/Cr via getVoucherLines),
  // balances, and party links. Structural sub-ledgers (parentId 2101/3303 — suppliers,
  // customers, labour depts) are marked linked so they are not mistaken for unused heads.
  const usage: LedgerUsage = useMemo(() => {
    const voucherRefCount: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.isDeleted) continue;
      for (const l of getVoucherLines(v)) if (l.accountId) voucherRefCount[l.accountId] = (voucherRefCount[l.accountId] || 0) + 1;
    }
    const balance: Record<string, number> = {};
    for (const a of accounts) balance[a.id] = getAccountBalance(a.id);
    const linkedParty: Record<string, string> = {};
    for (const s of suppliers) if (s.accountId) linkedParty[s.accountId] = `Supplier: ${s.name}`;
    for (const c of customers) if (c.accountId) linkedParty[c.accountId] = `Customer: ${c.name}`;
    for (const a of accounts) if ((a.parentId === '2101' || a.parentId === '3303') && !linkedParty[a.id]) linkedParty[a.id] = 'Sub-ledger';
    return { voucherRefCount, balance, linkedParty };
  }, [accounts, vouchers, suppliers, customers, getAccountBalance]);

  const findings = useMemo(() => analyzeLedgerHygiene(accounts, usage), [accounts, usage]);
  const summary = useMemo(() => hygieneSummary(findings), [findings]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><Stethoscope className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'लेजर हाइजीन' : 'Ledger Hygiene'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'खाता-सूची (COA) की जाँच — orphan, अप्रयुक्त, दोहरे व त्रुटिपूर्ण खाते। केवल जाँच; सुधार Ledger Heads पर।' : 'Chart-of-accounts health — orphan, unused, duplicate and malformed accounts. Diagnostic only; fix on Ledger Heads.'}</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">{hi ? 'कुल फ़्लैग' : 'Total flagged'}</div><div className="text-2xl font-bold">{summary.total}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertOctagon className="h-3.5 w-3.5 text-red-600" />{hi ? 'त्रुटि' : 'Errors'}</div><div className="text-2xl font-bold text-red-700">{summary.errors}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />{hi ? 'चेतावनी' : 'Warnings'}</div><div className="text-2xl font-bold text-amber-700">{summary.warnings}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><Trash2 className="h-3.5 w-3.5 text-blue-600" />{hi ? 'सफ़ाई' : 'Cleanup'}</div><div className="text-2xl font-bold text-blue-700">{summary.cleanups}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3.5 w-3.5 text-slate-500" />{hi ? 'सूचना' : 'Info'}</div><div className="text-2xl font-bold text-slate-600">{summary.infos}</div></CardContent></Card>
      </div>

      {findings.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          {hi ? 'लेजर स्वच्छ है — कोई समस्या नहीं मिली।' : 'Ledger is clean — no issues found.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {findings.map(f => {
            const meta = CAT[f.category];
            return (
              <Card key={f.category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {SEV_ICON[f.severity]}
                    <span>{hi ? meta.hi : meta.en}</span>
                    <Badge variant="outline" className={cn('text-[10px] ml-1', SEV_CLS[f.severity])}>{f.accounts.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground pl-6">{hi ? meta.hintHi : meta.hintEn}</p>
                </CardHeader>
                <CardContent className="pl-6">
                  <div className="flex flex-wrap gap-2">
                    {f.accounts.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                        <span className="font-mono text-muted-foreground">{a.id.length > 10 ? a.id.slice(0, 8) + '…' : a.id}</span>
                        <span className="font-medium">{a.name}</span>
                        {a.detail && <span className="text-muted-foreground">· {a.detail}</span>}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/ledger-heads')}>
              {hi ? 'Ledger Heads पर सुधारें' : 'Fix on Ledger Heads'}<ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerHygiene;
