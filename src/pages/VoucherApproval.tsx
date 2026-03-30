/**
 * Voucher Approval Queue (Maker-Checker)
 *
 * Admin-only page. Shows all vouchers with approvalStatus === 'pending'.
 * Admin can approve or reject with remarks.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, ClipboardList, Eye, FileSpreadsheet, Download } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

const VOUCHER_TYPE_LABELS: Record<string, { hi: string; en: string }> = {
  receipt: { hi: 'रसीद', en: 'Receipt' },
  payment: { hi: 'भुगतान', en: 'Payment' },
  journal: { hi: 'जर्नल', en: 'Journal' },
  contra:  { hi: 'कोंट्रा', en: 'Contra'  },
};

const VoucherApproval: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { vouchers, accounts, approveVoucher, rejectVoucher } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';

  // ── Filter tabs ───────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const statusFilter = vouchers.filter(v =>
      !v.isDeleted && v.approvalStatus === tab
    );
    if (!search.trim()) return statusFilter;
    const q = search.toLowerCase();
    return statusFilter.filter(v =>
      v.voucherNo.toLowerCase().includes(q) ||
      v.narration.toLowerCase().includes(q) ||
      (v.createdBy ?? '').toLowerCase().includes(q)
    );
  }, [vouchers, tab, search]);

  const pendingCount  = useMemo(() => vouchers.filter(v => !v.isDeleted && v.approvalStatus === 'pending').length,  [vouchers]);
  const approvedCount = useMemo(() => vouchers.filter(v => !v.isDeleted && v.approvalStatus === 'approved').length, [vouchers]);
  const rejectedCount = useMemo(() => vouchers.filter(v => !v.isDeleted && v.approvalStatus === 'rejected').length, [vouchers]);

  // ── Detail / Reject dialog ────────────────────────────────────────────────
  const [detailId,  setDetailId]  = useState<string | null>(null);
  const [rejectId,  setRejectId]  = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const detailVoucher = detailId ? vouchers.find(v => v.id === detailId) : null;

  const getAccName = (id: string) => {
    const a = accounts.find(a => a.id === id);
    return a ? `${a.id} — ${hi ? a.nameHi : a.name}` : id;
  };

  const handleApprove = (id: string) => {
    approveVoucher(id, user?.name ?? 'Admin');
    toast({ title: hi ? 'वाउचर स्वीकृत किया गया' : 'Voucher approved' });
  };

  const handleReject = () => {
    if (!rejectId || !rejectReason.trim()) return;
    rejectVoucher(rejectId, user?.name ?? 'Admin', rejectReason.trim());
    toast({ title: hi ? 'वाउचर अस्वीकृत किया गया' : 'Voucher rejected' });
    setRejectId(null);
    setRejectReason('');
  };

  const handleCSV = () => {
    const headers = ['Voucher No', 'Date', 'Type', 'Debit Account', 'Credit Account', 'Amount', 'Status', 'Narration'];
    const rows = filtered.map(v => [v.voucherNo || '', v.date, v.type, getAccName(v.debitAccountId), getAccName(v.creditAccountId), v.amount, v.approvalStatus || 'pending', v.narration || '']);
    downloadCSV(headers, rows, 'voucher_approval.csv');
  };
  const handleExcel = () => {
    const headers = ['Voucher No', 'Date', 'Type', 'Debit Account', 'Credit Account', 'Amount', 'Status', 'Narration'];
    const rows = filtered.map(v => [v.voucherNo || '', v.date, v.type, getAccName(v.debitAccountId), getAccName(v.creditAccountId), v.amount, v.approvalStatus || 'pending', v.narration || '']);
    downloadExcelSingle(headers, rows, 'voucher_approval.xlsx', 'Voucher Approval');
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-orange-100 rounded-lg">
          <ClipboardList className="h-6 w-6 text-orange-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'वाउचर अनुमोदन कतार (Maker-Checker)' : 'Voucher Approval Queue (Maker-Checker)'}
          </h1>
          <p className="text-sm text-gray-500">
            {hi ? 'लम्बित वाउचरों की समीक्षा और स्वीकृति' : 'Review and approve pending vouchers'}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleExcel} className="gap-1">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['pending',  hi ? 'लम्बित' : 'Pending',  pendingCount,  'bg-amber-100 text-amber-800 border-amber-300'],
          ['approved', hi ? 'स्वीकृत' : 'Approved', approvedCount, 'bg-green-100 text-green-800 border-green-300'],
          ['rejected', hi ? 'अस्वीकृत' : 'Rejected', rejectedCount, 'bg-red-100 text-red-800 border-red-300'],
        ] as const).map(([key, label, count, cls]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              tab === key
                ? cls + ' shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
            {count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold bg-white/60">
                {count}
              </span>
            )}
          </button>
        ))}

        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={hi ? 'खोजें…' : 'Search…'}
          className="ml-auto w-44 h-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">
              {tab === 'pending'
                ? (hi ? 'कोई लम्बित वाउचर नहीं।' : 'No pending vouchers.')
                : (hi ? 'कोई रिकॉर्ड नहीं।' : 'No records.')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead>{hi ? 'डेबिट खाता' : 'Debit Account'}</TableHead>
                  <TableHead>{hi ? 'क्रेडिट खाता' : 'Credit Account'}</TableHead>
                  <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                  <TableHead>{hi ? 'बनाया' : 'Created By'}</TableHead>
                  <TableHead>{hi ? 'विवरण' : 'Narration'}</TableHead>
                  {tab !== 'pending' && <TableHead>{hi ? 'द्वारा' : 'Actioned By'}</TableHead>}
                  {tab === 'rejected' && <TableHead>{hi ? 'कारण' : 'Reason'}</TableHead>}
                  <TableHead>{hi ? 'कार्रवाई' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm font-medium">{v.voucherNo}</TableCell>
                    <TableCell className="text-sm">{fmtDate(v.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {VOUCHER_TYPE_LABELS[v.type]?.[hi ? 'hi' : 'en'] ?? v.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-36 truncate">{getAccName(v.debitAccountId)}</TableCell>
                    <TableCell className="text-xs max-w-36 truncate">{getAccName(v.creditAccountId)}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmt(v.amount)}</TableCell>
                    <TableCell className="text-xs">{v.createdBy}</TableCell>
                    <TableCell className="text-xs max-w-40 truncate">{v.narration || '—'}</TableCell>
                    {tab !== 'pending' && (
                      <TableCell className="text-xs">{v.approvedBy ?? '—'}</TableCell>
                    )}
                    {tab === 'rejected' && (
                      <TableCell className="text-xs max-w-36 truncate">{v.approvalRemarks ?? '—'}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                          onClick={() => setDetailId(v.id)}
                          title={hi ? 'विवरण देखें' : 'View detail'}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {tab === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(v.id)}
                              title={hi ? 'स्वीकृत करें' : 'Approve'}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:bg-red-50"
                              onClick={() => { setRejectId(v.id); setRejectReason(''); }}
                              title={hi ? 'अस्वीकृत करें' : 'Reject'}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailVoucher} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hi ? 'वाउचर विवरण' : 'Voucher Detail'} — {detailVoucher?.voucherNo}
            </DialogTitle>
          </DialogHeader>
          {detailVoucher && (
            <div className="space-y-3 text-sm">
              <Row label={hi ? 'प्रकार' : 'Type'} value={VOUCHER_TYPE_LABELS[detailVoucher.type]?.[hi ? 'hi' : 'en'] ?? detailVoucher.type} />
              <Row label={hi ? 'तिथि' : 'Date'} value={fmtDate(detailVoucher.date)} />
              <Row label={hi ? 'राशि' : 'Amount'} value={fmt(detailVoucher.amount)} />
              <Row label={hi ? 'डेबिट' : 'Debit'} value={getAccName(detailVoucher.debitAccountId)} />
              <Row label={hi ? 'क्रेडिट' : 'Credit'} value={getAccName(detailVoucher.creditAccountId)} />
              <Row label={hi ? 'विवरण' : 'Narration'} value={detailVoucher.narration || '—'} />
              <Row label={hi ? 'बनाया' : 'Created By'} value={detailVoucher.createdBy ?? '—'} />
              {detailVoucher.approvalStatus === 'rejected' && (
                <Row label={hi ? 'अस्वीकृति कारण' : 'Rejection Reason'} value={detailVoucher.approvalRemarks ?? '—'} />
              )}
              <div className="pt-2">
                <Badge className={
                  detailVoucher.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                  detailVoucher.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }>
                  {detailVoucher.approvalStatus === 'pending' ? (hi ? 'लम्बित' : 'Pending') :
                   detailVoucher.approvalStatus === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') :
                   (hi ? 'अस्वीकृत' : 'Rejected')}
                </Badge>
              </div>
            </div>
          )}
          {detailVoucher?.approvalStatus === 'pending' && (
            <DialogFooter className="gap-2 mt-2">
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-800 gap-1.5"
                onClick={() => { handleApprove(detailVoucher.id); setDetailId(null); }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {hi ? 'स्वीकृत' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={() => { setRejectId(detailVoucher.id); setDetailId(null); setRejectReason(''); }}
              >
                <XCircle className="h-3.5 w-3.5" />
                {hi ? 'अस्वीकृत' : 'Reject'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'अस्वीकृति का कारण' : 'Rejection Reason'}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder={hi ? 'कारण लिखें…' : 'Enter reason…'}
            rows={3}
            className="text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              {hi ? 'रद्द' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              {hi ? 'अस्वीकृत करें' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-2">
    <span className="text-gray-500 w-28 shrink-0">{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default VoucherApproval;
