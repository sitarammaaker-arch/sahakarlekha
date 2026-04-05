/**
 * Nomination Register
 *
 * Shows/edits nominee details for each active member.
 * Data lives on the Member record (nomineeName / nomineeRelation / nomineePhone).
 * Allows bulk view + edit, and PDF download.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Heart, Download, Search, Pencil, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Member } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { addHeader, addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName } from '@/lib/pdf';

const RELATIONS = ['Son', 'Daughter', 'Spouse', 'Father', 'Mother', 'Brother', 'Sister', 'Other'];

const NominationRegister: React.FC = () => {
  const { language } = useLanguage();
  const { members, society, updateMember } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';

  // ── Filter ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'with' | 'without'>('all');

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);

  const filtered = useMemo(() => {
    let list = activeMembers;
    if (filterStatus === 'with')    list = list.filter(m => m.nomineeName?.trim());
    if (filterStatus === 'without') list = list.filter(m => !m.nomineeName?.trim());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        (m.nomineeName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeMembers, search, filterStatus]);

  const withNominee    = activeMembers.filter(m => m.nomineeName?.trim()).length;
  const withoutNominee = activeMembers.length - withNominee;

  // ── Edit dialog ───────────────────────────────────────────────────────────
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [nomName,     setNomName]     = useState('');
  const [nomRelation, setNomRelation] = useState('');
  const [nomPhone,    setNomPhone]    = useState('');

  const openEdit = (m: Member) => {
    setEditMember(m);
    setNomName(m.nomineeName ?? '');
    setNomRelation(m.nomineeRelation ?? '');
    setNomPhone(m.nomineePhone ?? '');
  };

  const handleSave = () => {
    if (!editMember) return;
    updateMember(editMember.id, {
      nomineeName: nomName.trim(),
      nomineeRelation: nomRelation.trim(),
      nomineePhone: nomPhone.trim(),
    });
    toast({ title: hi ? 'नामांकन अपडेट किया गया' : 'Nomination updated' });
    setEditMember(null);
  };

  // ── CSV / Excel ────────────────────────────────────────────────────────────
  const csvHeaders = ['Member ID', 'Member Name', 'Phone', 'Share Capital', 'Nominee Name', 'Relation', 'Nominee Phone', 'Status'];
  const getCsvRows = () =>
    activeMembers.map(m => [
      m.memberId,
      m.name,
      m.phone || '—',
      m.shareCapital || 0,
      m.nomineeName || '—',
      m.nomineeRelation || '—',
      m.nomineePhone || '—',
      m.nomineeName ? 'Nominated' : 'Pending',
    ]);

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'nomination-register');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'nomination-register', 'Nominations');

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const { startY, font } = addHeader(doc, 'Nomination Register', society,
      `Total Active Members: ${activeMembers.length}  |  With Nominee: ${withNominee}`,
      { reportCode: 'NR' });

    autoTable(doc, {
      startY,
      head: [['#', 'Member ID', 'Member Name', 'Phone', 'Share Capital', 'Nominee Name', 'Relation', 'Nominee Phone', 'Status']],
      body: activeMembers.map((m, i) => [
        i + 1,
        m.memberId,
        m.name,
        m.phone,
        `₹${(m.shareCapital || 0).toLocaleString('hi-IN')}`,
        m.nomineeName || '—',
        m.nomineeRelation || '—',
        m.nomineePhone || '—',
        m.nomineeName ? 'Nominated' : 'Pending',
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [236, 72, 153] },
      didParseCell: (data) => {
        if (data.column.index === 8 && data.section === 'body') {
          const val = String(data.cell.text);
          if (val === 'Pending') data.cell.styles.textColor = [220, 38, 38];
          else data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });

    const sigNames = getSignatoryNames(society);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    addSignatureBlock(doc, font, ['Secretary / Manager', 'President / Chairman'], finalY, undefined,
      [sigNames.secretary, sigNames.president]);
    addPageNumbers(doc, font, society?.name);
    doc.save(pdfFileName('NominationRegister', society));
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-pink-100 rounded-lg">
          <Heart className="h-6 w-6 text-pink-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'नामांकन रजिस्टर' : 'Nomination Register'}
          </h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">{hi ? 'कुल सक्रिय सदस्य' : 'Total Active'}</p>
            <p className="text-xl font-bold">{activeMembers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <p className="text-xs text-green-700">{hi ? 'नामांकित' : 'Nominated'}</p>
            <p className="text-xl font-bold text-green-700">{withNominee}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3">
            <p className="text-xs text-red-700">{hi ? 'लम्बित' : 'Pending'}</p>
            <p className="text-xl font-bold text-red-700">{withoutNominee}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={hi ? 'खोजें…' : 'Search…'}
            className="h-8 pl-8 w-44"
          />
        </div>
        {(['all', 'with', 'without'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              filterStatus === s
                ? 'bg-pink-600 text-white border-pink-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'all'     ? (hi ? 'सभी' : 'All') :
             s === 'with'    ? (hi ? 'नामांकित' : 'With Nominee') :
             (hi ? 'लम्बित' : 'Without Nominee')}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} {hi ? 'सदस्य' : 'members'}</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{hi ? 'सदस्य आईडी' : 'Member ID'}</TableHead>
                <TableHead>{hi ? 'सदस्य नाम' : 'Member Name'}</TableHead>
                <TableHead>{hi ? 'फोन' : 'Phone'}</TableHead>
                <TableHead className="text-right">{hi ? 'अंश पूंजी' : 'Share Capital'}</TableHead>
                <TableHead>{hi ? 'नामिती नाम' : 'Nominee Name'}</TableHead>
                <TableHead>{hi ? 'संबंध' : 'Relation'}</TableHead>
                <TableHead>{hi ? 'नामिती फोन' : 'Nominee Phone'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead>{hi ? 'संपादन' : 'Edit'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                    {hi ? 'कोई रिकॉर्ड नहीं' : 'No records found'}
                  </TableCell>
                </TableRow>
              ) : filtered.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-gray-400 text-sm">{i + 1}</TableCell>
                  <TableCell className="font-mono text-sm">{m.memberId}</TableCell>
                  <TableCell className="font-medium text-sm">{m.name}</TableCell>
                  <TableCell className="text-sm">{m.phone || '—'}</TableCell>
                  <TableCell className="text-right text-sm">₹{(m.shareCapital || 0).toLocaleString('hi-IN')}</TableCell>
                  <TableCell className="text-sm">{m.nomineeName || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell className="text-sm">{m.nomineeRelation || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell className="text-sm">{m.nomineePhone || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell>
                    {m.nomineeName?.trim() ? (
                      <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {hi ? 'नामांकित' : 'Nominated'}
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {hi ? 'लम्बित' : 'Pending'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editMember} onOpenChange={() => setEditMember(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {hi ? 'नामांकन संपादित करें' : 'Edit Nomination'}
            </DialogTitle>
          </DialogHeader>
          {editMember && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">
                {editMember.memberId} — {editMember.name}
              </p>
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'नामिती का नाम' : 'Nominee Name'}</Label>
                <Input
                  value={nomName}
                  onChange={e => setNomName(e.target.value)}
                  placeholder={hi ? 'पूरा नाम' : 'Full name'}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'संबंध' : 'Relation'}</Label>
                <Select value={nomRelation} onValueChange={setNomRelation}>
                  <SelectTrigger>
                    <SelectValue placeholder={hi ? 'चुनें' : 'Select'} />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'नामिती फोन' : 'Nominee Phone'}</Label>
                <Input
                  type="tel"
                  value={nomPhone}
                  onChange={e => setNomPhone(e.target.value)}
                  placeholder="9XXXXXXXXX"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1">
                  {hi ? 'सहेजें' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditMember(null)}>
                  {hi ? 'रद्द' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NominationRegister;
