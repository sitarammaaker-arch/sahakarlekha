import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { getVoucherLines } from '@/lib/voucherUtils';
import { downloadCSV } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookMarked, Download, Search, Edit, Users, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateShareRegisterPDF } from '@/lib/pdf';
import type { Member } from '@/types';
import type { ShareOpType } from '@/lib/shareOps';

const ShareRegister: React.FC = () => {
  const { language } = useLanguage();
  const { members, updateMember, refundShareCapital, purchaseShareCapital, transferShareCapital, shareOperation, getMemberShareReconciliation, society, vouchers } = useData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState({ shareCertNo: '', shareCount: '', shareFaceValue: '', nomineeName: '', nomineeRelation: '', nomineePhone: '' });

  const hi = language === 'hi';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

  const approvedMembers = members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved');
  const filtered = approvedMembers.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.memberId.toLowerCase().includes(search.toLowerCase())
  );

  const totalShares = approvedMembers.reduce((s, m) => s + (m.shareCount || 0), 0);
  const totalCapital = approvedMembers.reduce((s, m) => s + m.shareCapital, 0);
  const withNominee = approvedMembers.filter(m => m.nomineeName).length;

  // ── Share TRANSACTION register — every voucher touching Share Capital 1102,
  //    classified structurally (the 9999 suspense leg marks a member-to-member
  //    transfer): issue/purchase (Cr 1102), refund (Dr 1102), transfer in/out.
  const [txnMemberId, setTxnMemberId] = useState('all');
  type ShareTxnType = 'issue' | 'refund' | 'transfer-in' | 'transfer-out';
  const shareTxns = useMemo(() => {
    const rows: { id: string; date: string; voucherNo: string; memberId?: string; memberName: string; type: ShareTxnType; amountIn: number; amountOut: number; narration: string }[] = [];
    for (const v of vouchers) {
      if (v.isDeleted) continue;
      const lines = getVoucherLines(v);
      const cr = lines.filter(l => l.accountId === '1102' && l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
      const dr = lines.filter(l => l.accountId === '1102' && l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
      if (cr === 0 && dr === 0) continue;
      const viaSuspense = lines.some(l => l.accountId === '9999');
      const type: ShareTxnType = cr > 0 ? (viaSuspense ? 'transfer-in' : 'issue') : (viaSuspense ? 'transfer-out' : 'refund');
      const member = members.find(m => m.id === v.memberId);
      rows.push({
        id: v.id, date: v.date, voucherNo: v.voucherNo || '', memberId: v.memberId,
        memberName: member?.name || '—', type, amountIn: cr, amountOut: dr, narration: v.narration || '',
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo, undefined, { numeric: true }));
  }, [vouchers, members]);
  const filteredTxns = useMemo(
    () => txnMemberId === 'all' ? shareTxns : shareTxns.filter(t => t.memberId === txnMemberId),
    [shareTxns, txnMemberId],
  );
  const txnTotalIn = filteredTxns.reduce((s, t) => s + t.amountIn, 0);
  const txnTotalOut = filteredTxns.reduce((s, t) => s + t.amountOut, 0);

  const TXN_LABEL: Record<ShareTxnType, { hi: string; en: string; cls: string }> = {
    issue: { hi: 'निर्गम/खरीद', en: 'Issue/Purchase', cls: 'bg-green-100 text-green-800 border-green-200' },
    refund: { hi: 'वापसी', en: 'Refund', cls: 'bg-red-100 text-red-800 border-red-200' },
    'transfer-in': { hi: 'स्थानांतरण प्राप्त', en: 'Transfer In', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    'transfer-out': { hi: 'स्थानांतरण भेजा', en: 'Transfer Out', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  };

  const exportTxnCsv = () =>
    downloadCSV(
      ['Date', 'Voucher No', 'Member', 'Type', 'In (Cr)', 'Out (Dr)', 'Narration'],
      filteredTxns.map(t => [t.date, t.voucherNo, t.memberName, TXN_LABEL[t.type].en, t.amountIn, t.amountOut, t.narration]),
      'share-transactions',
    );

  const openEdit = (m: Member) => {
    setEditMember(m);
    setForm({
      shareCertNo: m.shareCertNo || '',
      shareCount: String(m.shareCount || ''),
      shareFaceValue: String(m.shareFaceValue || ''),
      nomineeName: m.nomineeName || '',
      nomineeRelation: m.nomineeRelation || '',
      nomineePhone: m.nomineePhone || '',
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    updateMember(editMember.id, {
      shareCertNo: form.shareCertNo,
      shareCount: Number(form.shareCount) || undefined,
      shareFaceValue: Number(form.shareFaceValue) || undefined,
      nomineeName: form.nomineeName,
      nomineeRelation: form.nomineeRelation,
      nomineePhone: form.nomineePhone,
    });
    toast({ title: hi ? 'अपडेट किया गया' : 'Updated successfully' });
    setEditMember(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookMarked className="h-7 w-7 text-primary" />
            {hi ? 'शेयर रजिस्टर' : 'Share Register'}
          </h1>
          <p className="text-muted-foreground">
            {hi ? 'सदस्यों का शेयर कैपिटल एवं नामांकन विवरण' : 'Member share capital & nominee details'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateShareRegisterPDF(members, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल सदस्य' : 'Total Members'}</p>
            <p className="text-2xl font-bold text-primary">{approvedMembers.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल शेयर कैपिटल' : 'Total Share Capital'}</p>
            <p className="text-xl font-bold text-success">{fmt(totalCapital)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल शेयर' : 'Total Shares'}</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalShares}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'नामांकित' : 'With Nominee'}</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{withNominee}/{approvedMembers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={hi ? 'सदस्य खोजें...' : 'Search members...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Register Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b text-center py-4">
          <CardTitle className="text-lg">{hi ? 'शेयर रजिस्टर' : 'Share Register'}</CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{hi ? 'सदस्य ID' : 'Member ID'}</TableHead>
                <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                <TableHead>{hi ? 'पिता/पति' : 'Father/Husband'}</TableHead>
                <TableHead className="whitespace-nowrap">{hi ? 'प्रमाणपत्र सं.' : 'Cert. No.'}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{hi ? 'शेयर संख्या' : 'Shares'}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{hi ? 'मूल्य/शेयर' : 'Face Value'}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{hi ? 'कुल कैपिटल' : 'Total Capital'}</TableHead>
                <TableHead>{hi ? 'नामांकित' : 'Nominee'}</TableHead>
                <TableHead>{hi ? 'संबंध' : 'Relation'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {hi ? 'कोई सदस्य नहीं मिला' : 'No members found'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m, i) => (
                  <TableRow key={m.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">{m.memberId}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.fatherName || '-'}</TableCell>
                    <TableCell className="font-mono">{m.shareCertNo || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right">{m.shareCount ?? <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right">{m.shareFaceValue ? fmt(m.shareFaceValue) : <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(m.shareCapital)}
                      {(() => {
                        const rec = getMemberShareReconciliation(m.id);
                        return rec && !rec.reconciled ? (
                          <Badge variant="destructive" className="ml-1 text-[10px] py-0" title={hi ? `बही: ${fmt(rec.controlBalance)} · अंतर ${fmt(rec.difference)}` : `Ledger: ${fmt(rec.controlBalance)} · diff ${fmt(rec.difference)}`}>
                            {hi ? 'बेमेल' : 'drift'}
                          </Badge>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell>{m.nomineeName || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{m.nomineeRelation || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                        {m.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <ShareTxnButton member={m} hi={hi} kind="purchase" onSubmit={purchaseShareCapital} />
                        {m.shareCapital > 0 && <ShareTxnButton member={m} hi={hi} kind="refund" onSubmit={refundShareCapital} />}
                        {m.shareCapital > 0 && <TransferShareButton member={m} members={approvedMembers} hi={hi} onTransfer={transferShareCapital} />}
                        <ShareOpButton member={m} hi={hi} onSubmit={shareOperation} />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Share Transaction Register — chronological issue/refund/transfer log ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              {hi ? 'शेयर लेन-देन रजिस्टर' : 'Share Transaction Register'}
              <Badge variant="secondary">{filteredTxns.length}</Badge>
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <select value={txnMemberId} onChange={e => setTxnMemberId(e.target.value)}
                className="h-8 w-44 rounded-md border border-input bg-background px-2 text-xs">
                <option value="all">{hi ? '— सभी सदस्य —' : '— All members —'}</option>
                {approvedMembers.map(m => <option key={m.id} value={m.id}>{m.memberId} · {m.name}</option>)}
              </select>
              <Button variant="outline" size="sm" className="gap-1" onClick={exportTxnCsv} disabled={filteredTxns.length === 0}>
                <Download className="h-4 w-4" />CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                <TableHead>{hi ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                <TableHead>{hi ? 'सदस्य' : 'Member'}</TableHead>
                <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                <TableHead className="text-right">{hi ? 'जमा (₹)' : 'In (₹)'}</TableHead>
                <TableHead className="text-right">{hi ? 'नामे (₹)' : 'Out (₹)'}</TableHead>
                <TableHead>{hi ? 'विवरण' : 'Narration'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTxns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {hi ? 'कोई शेयर लेन-देन नहीं (नए वाउचर यहाँ स्वतः दिखेंगे)' : 'No share transactions yet (new vouchers appear here automatically)'}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredTxns.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{t.voucherNo || '—'}</TableCell>
                      <TableCell className="text-sm">{t.memberName}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] ${TXN_LABEL[t.type].cls}`}>{hi ? TXN_LABEL[t.type].hi : TXN_LABEL[t.type].en}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-green-700">{t.amountIn > 0 ? fmt(t.amountIn) : ''}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{t.amountOut > 0 ? fmt(t.amountOut) : ''}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{t.narration}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>{hi ? 'कुल' : 'Total'}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">{fmt(txnTotalIn)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{fmt(txnTotalOut)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{hi ? 'शुद्ध' : 'Net'}: {fmt(txnTotalIn - txnTotalOut)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={open => !open && setEditMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'शेयर विवरण संपादित करें' : 'Edit Share Details'} — {editMember?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'प्रमाणपत्र सं.' : 'Share Cert. No.'}</Label>
                <Input value={form.shareCertNo} onChange={e => setForm(f => ({ ...f, shareCertNo: e.target.value }))} placeholder="SC-001" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'शेयर संख्या' : 'No. of Shares'}</Label>
                <Input type="number" min="0" value={form.shareCount} onChange={e => setForm(f => ({ ...f, shareCount: e.target.value }))} placeholder="10" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'मूल्य/शेयर (₹)' : 'Face Value (₹)'}</Label>
                <Input type="number" min="0" value={form.shareFaceValue} onChange={e => setForm(f => ({ ...f, shareFaceValue: e.target.value }))} placeholder="100" />
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-3">{hi ? 'नामांकन विवरण' : 'Nominee Details'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{hi ? 'नामांकित का नाम' : 'Nominee Name'}</Label>
                  <Input value={form.nomineeName} onChange={e => setForm(f => ({ ...f, nomineeName: e.target.value }))} placeholder={hi ? 'पूरा नाम' : 'Full name'} />
                </div>
                <div className="space-y-1">
                  <Label>{hi ? 'संबंध' : 'Relation'}</Label>
                  <Select value={form.nomineeRelation} onValueChange={v => setForm(f => ({ ...f, nomineeRelation: v }))}>
                    <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      {['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label>{hi ? 'नामांकित फोन' : 'Nominee Phone'}</Label>
                <Input value={form.nomineePhone} onChange={e => setForm(f => ({ ...f, nomineePhone: e.target.value }))} placeholder="9876543210" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditMember(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function ShareTxnButton({ member, hi, kind, onSubmit }: { member: Member; hi: boolean; kind: 'purchase' | 'refund'; onSubmit: (memberId: string, amount: number, mode: 'cash' | 'bank', date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const val = Number(amt) || 0;
  const isRefund = kind === 'refund';
  const cap = member.shareCapital || 0;
  const overCap = isRefund && val > cap;
  const fmtC = (n: number) => n.toLocaleString('hi-IN', { style: 'currency', currency: 'INR' });
  const btnLabel = isRefund ? (hi ? 'वापसी' : 'Refund') : (hi ? 'शेयर जोड़ें' : 'Add Shares');
  const title = isRefund ? (hi ? 'शेयर पूँजी वापसी' : 'Refund Share Capital') : (hi ? 'अतिरिक्त शेयर पूँजी' : 'Additional Share Capital');
  const help = isRefund
    ? (hi ? 'Dr शेयर पूँजी / Cr नकद-बैंक — मूल रसीद अपरिवर्तित रहेगी।' : 'Posts Dr Share Capital / Cr Cash-Bank; the original receipt stays intact.')
    : (hi ? 'Dr नकद-बैंक / Cr शेयर पूँजी — नई दिनांकित रसीद।' : 'Posts Dr Cash-Bank / Cr Share Capital; a new dated receipt.');

  return (
    <>
      <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>{btnLabel}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{title} — {member.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{hi ? 'वर्तमान शेयर पूँजी:' : 'Current share capital:'} <strong>{fmtC(cap)}</strong></p>
            <div>
              <Label>{isRefund ? (hi ? 'वापसी राशि' : 'Refund Amount') : (hi ? 'राशि' : 'Amount')}</Label>
              <Input type="number" value={amt} onChange={e => setAmt(e.target.value)} {...(isRefund ? { max: cap } : {})} />
            </div>
            <div>
              <Label>{hi ? 'भुगतान विधि' : 'Payment mode'}</Label>
              <select value={mode} onChange={e => setMode(e.target.value as 'cash' | 'bank')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="cash">{hi ? 'नकद' : 'Cash'}</option>
                <option value="bank">{hi ? 'बैंक' : 'Bank'}</option>
              </select>
            </div>
            <div>
              <Label>{hi ? 'तिथि' : 'Date'}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">{help}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button disabled={!(val > 0) || overCap} onClick={() => { onSubmit(member.id, val, mode, date); setOpen(false); setAmt(''); }}>
                {isRefund ? (hi ? 'वापसी दर्ज करें' : 'Post Refund') : (hi ? 'शेयर जोड़ें' : 'Add Shares')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ECR-16 / MS-02: forfeit / surrender / redeem / bonus share operations.
function ShareOpButton({ member, hi, onSubmit }: { member: Member; hi: boolean; onSubmit: (memberId: string, type: ShareOpType, amount: number, opts?: { mode?: 'cash' | 'bank'; reserveAccountId?: string; date?: string; reason?: string }) => boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ShareOpType>('bonus');
  const [amt, setAmt] = useState('');
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const val = Number(amt) || 0;
  const cap = member.shareCapital || 0;
  const isDecrease = type !== 'bonus';
  const usesCash = type === 'redeem' || type === 'surrender';
  const overCap = isDecrease && val > cap;
  const fmtC = (n: number) => n.toLocaleString('hi-IN', { style: 'currency', currency: 'INR' });
  const LABELS: Record<ShareOpType, { hi: string; en: string }> = {
    bonus: { hi: 'बोनस शेयर', en: 'Bonus' },
    forfeit: { hi: 'जब्त (Forfeit)', en: 'Forfeit' },
    redeem: { hi: 'भुनाना (Redeem)', en: 'Redeem' },
    surrender: { hi: 'अभ्यर्पण (Surrender)', en: 'Surrender' },
  };
  return (
    <>
      <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>{hi ? 'संचालन' : 'Ops'}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'शेयर संचालन' : 'Share Operation'} — {member.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{hi ? 'वर्तमान शेयर पूँजी:' : 'Current share capital:'} <strong>{fmtC(cap)}</strong></p>
            <div>
              <Label>{hi ? 'संचालन प्रकार' : 'Operation'}</Label>
              <Select value={type} onValueChange={v => setType(v as ShareOpType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LABELS) as ShareOpType[]).map(k => (
                    <SelectItem key={k} value={k}>{hi ? LABELS[k].hi : LABELS[k].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{hi ? 'राशि (₹)' : 'Amount (₹)'}</Label>
              <Input type="number" value={amt} onChange={e => setAmt(e.target.value)} {...(isDecrease ? { max: cap } : {})} />
              {overCap && <p className="text-[11px] text-destructive mt-1">{hi ? 'राशि शेयर पूँजी से ज़्यादा नहीं हो सकती' : 'Amount cannot exceed share capital'}</p>}
            </div>
            {usesCash && (
              <div>
                <Label>{hi ? 'भुगतान विधि' : 'Payout mode'}</Label>
                <select value={mode} onChange={e => setMode(e.target.value as 'cash' | 'bank')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="cash">{hi ? 'नकद' : 'Cash'}</option>
                  <option value="bank">{hi ? 'बैंक' : 'Bank'}</option>
                </select>
              </div>
            )}
            <div>
              <Label>{hi ? 'कारण' : 'Reason'}</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div>
              <Label>{hi ? 'तिथि' : 'Date'}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {type === 'bonus' && (hi ? 'Dr संचय / Cr शेयर पूँजी — शेयर पूँजी बढ़ेगी (कोई नकद नहीं)।' : 'Dr Reserve / Cr Share Capital — increases capital (no cash).')}
              {type === 'forfeit' && (hi ? 'Dr शेयर पूँजी / Cr संचय — जब्त, कोई नकद नहीं।' : 'Dr Share Capital / Cr Reserve — forfeited, no cash.')}
              {usesCash && (hi ? 'Dr शेयर पूँजी / Cr नकद-बैंक — शेयर पूँजी घटेगी।' : 'Dr Share Capital / Cr Cash-Bank — reduces capital.')}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button disabled={!(val > 0) || overCap} onClick={() => {
                if (onSubmit(member.id, type, val, { mode, date, reason: reason.trim() || undefined })) { setOpen(false); setAmt(''); setReason(''); }
              }}>{hi ? 'दर्ज करें' : 'Post'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransferShareButton({ member, members, hi, onTransfer }: { member: Member; members: Member[]; hi: boolean; onTransfer: (fromId: string, toId: string, amount: number, date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const val = Number(amt) || 0;
  const cap = member.shareCapital || 0;
  const recipients = members.filter(m => m.id !== member.id);

  return (
    <>
      <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>{hi ? 'स्थानांतरण' : 'Transfer'}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'शेयर स्थानांतरण' : 'Transfer Shares'} — {member.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{hi ? 'उपलब्ध शेयर पूँजी:' : 'Available share capital:'} <strong>{cap.toLocaleString('hi-IN', { style: 'currency', currency: 'INR' })}</strong></p>
            <div>
              <Label>{hi ? 'किसे स्थानांतरित करें' : 'Transfer to'}</Label>
              <select value={toId} onChange={e => setToId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{hi ? '— सदस्य चुनें —' : '— Select member —'}</option>
                {recipients.map(m => <option key={m.id} value={m.id}>{m.memberId} · {m.name}</option>)}
              </select>
            </div>
            <div>
              <Label>{hi ? 'राशि' : 'Amount'}</Label>
              <Input type="number" value={amt} onChange={e => setAmt(e.target.value)} max={cap} />
            </div>
            <div>
              <Label>{hi ? 'तिथि' : 'Date'}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">{hi ? 'शेयर पूँजी सदस्यों के बीच स्थानांतरित होगी (कुल अपरिवर्तित); दोनों की बही में दिखेगा।' : 'Moves share capital between members (total unchanged); shows in both member ledgers.'}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button disabled={!toId || !(val > 0) || val > cap} onClick={() => { onTransfer(member.id, toId, val, date); setOpen(false); setAmt(''); setToId(''); }}>
                {hi ? 'स्थानांतरित करें' : 'Transfer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ShareRegister;
