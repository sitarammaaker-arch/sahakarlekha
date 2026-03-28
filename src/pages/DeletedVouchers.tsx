import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import type { VoucherType } from '@/types';

const fmt = (amount: number) =>
  new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const voucherTypeLabel: Record<VoucherType, { hi: string; en: string; color: string }> = {
  receipt:  { hi: 'रसीद',   en: 'Receipt',  color: 'bg-green-100 text-green-800 border-green-200' },
  payment:  { hi: 'भुगतान', en: 'Payment',  color: 'bg-red-100 text-red-800 border-red-200' },
  journal:  { hi: 'जर्नल',  en: 'Journal',  color: 'bg-purple-100 text-purple-800 border-purple-200' },
  contra:   { hi: 'कॉन्ट्रा', en: 'Contra', color: 'bg-orange-100 text-orange-800 border-orange-200' },
};

const DeletedVouchers: React.FC = () => {
  const { language } = useLanguage();
  const { vouchers, accounts, society } = useData();

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const accountName = (id: string) =>
    accounts.find(a => a.id === id)?.name ?? id;

  const deletedVouchers = useMemo(() => {
    return vouchers
      .filter(v => v.isDeleted)
      .filter(v => {
        if (filterFrom && (v.deletedAt ?? '') < filterFrom) return false;
        if (filterTo && (v.deletedAt ?? '') > filterTo + 'T23:59:59') return false;
        if (filterSearch) {
          const q = filterSearch.toLowerCase();
          if (
            !v.voucherNo.toLowerCase().includes(q) &&
            !v.narration.toLowerCase().includes(q) &&
            !(v.deletedReason ?? '').toLowerCase().includes(q) &&
            !(v.deletedBy ?? '').toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  }, [vouchers, filterFrom, filterTo, filterSearch]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <Trash2 className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'hi' ? 'रद्द वाउचर रजिस्टर' : 'Deleted Vouchers Register'}
          </h1>
          <p className="text-sm text-gray-500">{society.name}</p>
        </div>
        <Badge variant="outline" className="ml-auto text-red-700 border-red-200 bg-red-50">
          {deletedVouchers.length} {language === 'hi' ? 'रद्द' : 'deleted'}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'रद्द तिथि से' : 'Deleted From'}</Label>
              <Input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'रद्द तिथि तक' : 'Deleted To'}</Label>
              <Input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{language === 'hi' ? 'खोजें' : 'Search'}</Label>
              <Input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder={language === 'hi' ? 'वाउचर नं / नोट / कारण...' : 'Voucher No / Narration / Reason...'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {language === 'hi' ? 'रद्द वाउचर सूची (Audit Trail)' : 'Deleted Vouchers List (Audit Trail)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'hi' ? 'वाउचर नं.' : 'Voucher No.'}</TableHead>
                <TableHead>{language === 'hi' ? 'प्रकार' : 'Type'}</TableHead>
                <TableHead>{language === 'hi' ? 'वाउचर तिथि' : 'Voucher Date'}</TableHead>
                <TableHead>{language === 'hi' ? 'डेबिट खाता' : 'Dr Account'}</TableHead>
                <TableHead>{language === 'hi' ? 'क्रेडिट खाता' : 'Cr Account'}</TableHead>
                <TableHead className="text-right">{language === 'hi' ? 'राशि' : 'Amount'}</TableHead>
                <TableHead>{language === 'hi' ? 'नोट' : 'Narration'}</TableHead>
                <TableHead>{language === 'hi' ? 'रद्द कारण' : 'Delete Reason'}</TableHead>
                <TableHead>{language === 'hi' ? 'रद्द किया' : 'Deleted By'}</TableHead>
                <TableHead>{language === 'hi' ? 'रद्द तिथि' : 'Deleted At'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deletedVouchers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-gray-400">
                    {language === 'hi' ? 'कोई रद्द वाउचर नहीं मिला' : 'No deleted vouchers found'}
                  </TableCell>
                </TableRow>
              ) : (
                deletedVouchers.map(v => {
                  const typeInfo = voucherTypeLabel[v.type];
                  return (
                    <TableRow key={v.id} className="bg-red-50/30 hover:bg-red-50/60">
                      <TableCell className="font-mono text-sm line-through text-gray-400">
                        {v.voucherNo}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeInfo.color}>
                          {typeInfo[language]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(v.date).toLocaleDateString('hi-IN')}
                      </TableCell>
                      <TableCell className="text-sm">{accountName(v.debitAccountId)}</TableCell>
                      <TableCell className="text-sm">{accountName(v.creditAccountId)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(v.amount)}</TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-[160px] truncate" title={v.narration}>
                        {v.narration || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 max-w-[160px] truncate" title={v.deletedReason}>
                        {v.deletedReason || '—'}
                      </TableCell>
                      <TableCell className="text-sm">{v.deletedBy || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {v.deletedAt
                          ? new Date(v.deletedAt).toLocaleString('hi-IN', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {deletedVouchers.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {language === 'hi'
            ? `कुल ${deletedVouchers.length} रद्द वाउचर — यह डेटा केवल ऑडिट उद्देश्य के लिए है`
            : `Total ${deletedVouchers.length} deleted vouchers — this data is for audit purposes only`}
        </p>
      )}
    </div>
  );
};

export default DeletedVouchers;
