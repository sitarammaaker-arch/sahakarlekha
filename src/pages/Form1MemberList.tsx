/**
 * Form 1 — Member List (Cooperative Societies Act Format)
 *
 * Statutory register of members as per the Model Cooperative Societies Act.
 * Prints/exports as a formatted PDF with columns:
 *   S.No | Member ID | Name | Father's Name | Address | Phone |
 *   Share Capital | Share Count | Join Date | Status | Nominee
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Download, Search, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDate } from '@/lib/dateUtils';

const Form1MemberList: React.FC = () => {
  const { language } = useLanguage();
  const { members, society } = useData();

  const hi = language === 'hi';

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [typeFilter,  setTypeFilter]  = useState<'all' | 'member' | 'nominal'>('all');

  const filtered = useMemo(() => {
    let list = members;
    if (statusFilter !== 'all') list = list.filter(m => m.status === statusFilter);
    if (typeFilter   !== 'all') list = list.filter(m => m.memberType === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => a.memberId.localeCompare(b.memberId));
  }, [members, statusFilter, typeFilter, search]);

  const totalShareCapital = filtered.reduce((s, m) => s + (m.shareCapital || 0), 0);
  const totalShares       = filtered.reduce((s, m) => s + (m.shareCount  || 0), 0);

  // ── CSV / Excel ────────────────────────────────────────────────────────────
  const csvHeaders = ['S.No.', 'Member No.', 'Name', "Father's/Spouse Name", 'Address', 'Phone', 'Join Date', 'Type', 'Shares', 'Share Capital', 'Nominee', 'Relation', 'Status'];
  const getCsvRows = () =>
    filtered.map((m, i) => [
      i + 1,
      m.memberId,
      m.name,
      m.fatherName || '—',
      m.address || '—',
      m.phone || '—',
      m.joinDate ? fmtDate(m.joinDate) : '—',
      m.memberType === 'nominal' ? 'Nominal' : 'Regular',
      m.shareCount ?? '—',
      m.shareCapital || 0,
      m.nomineeName || '—',
      m.nomineeRelation || '—',
      m.status === 'active' ? 'Active' : 'Inactive',
    ]);

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'form1-member-list');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'form1-member-list', 'Member List');

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const marginL = 14;
    let y = 12;

    // Title block
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('FORM — 1', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(11);
    doc.text('REGISTER OF MEMBERS', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`[Under the Cooperative Societies Act]`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); y += 6;

    doc.setFontSize(9);
    doc.text(`Society: ${society.name}`, marginL, y);
    doc.text(`Reg. No.: ${society.registrationNo || '—'}`, marginL + 90, y);
    doc.text(`District: ${society.district || '—'}`, marginL + 160, y);
    y += 5;
    doc.text(`Financial Year: ${society.financialYear}`, marginL, y);
    doc.text(`Date of Print: ${new Date().toLocaleDateString('en-IN')}`, marginL + 90, y);
    doc.text(`Total Members: ${filtered.length}`, marginL + 160, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [[
        'S.No.', 'Member No.', 'Name', "Father's / Spouse Name", 'Address',
        'Phone', 'Join Date', 'Type', 'Shares', 'Share Capital (₹)',
        'Nominee', 'Relation', 'Status',
      ]],
      body: filtered.map((m, i) => [
        i + 1,
        m.memberId,
        m.name,
        m.fatherName || '—',
        m.address    || '—',
        m.phone      || '—',
        m.joinDate   ? fmtDate(m.joinDate) : '—',
        m.memberType === 'nominal' ? 'Nominal' : 'Regular',
        m.shareCount ?? '—',
        (m.shareCapital || 0).toLocaleString('en-IN'),
        m.nomineeName     || '—',
        m.nomineeRelation || '—',
        m.status === 'active' ? 'Active' : 'Inactive',
      ]),
      foot: [[
        '', '', '', '', '', '', '', `Total: ${filtered.length}`,
        totalShares.toLocaleString('en-IN'),
        totalShareCapital.toLocaleString('en-IN'),
        '', '', '',
      ]],
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175], fontSize: 7 },
      footStyles: { fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        9:  { halign: 'right' },
        7:  { halign: 'center' },
        12: { halign: 'center' },
      },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.text('Secretary / Manager', marginL + 20, finalY);
    doc.text('President / Chairman', pageW / 2 - 20, finalY);
    doc.text('Registrar / Auditor', pageW - 60, finalY);
    doc.line(marginL, finalY - 5, marginL + 50, finalY - 5);
    doc.line(pageW / 2 - 30, finalY - 5, pageW / 2 + 30, finalY - 5);
    doc.line(pageW - 70, finalY - 5, pageW - 14, finalY - 5);

    doc.save(`form1-member-list-${society.financialYear}.pdf`);
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 print:p-0">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <div className="p-2 bg-blue-100 rounded-lg">
          <ClipboardList className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'प्रपत्र 1 — सदस्य सूची' : 'Form 1 — Register of Members'}
          </h1>
          <p className="text-sm text-gray-500">
            {hi ? 'सहकारी समिति अधिनियम के अनुसार' : 'As per Cooperative Societies Act'}
            {' · '}{society.name}
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button size="sm" className="gap-2" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4" />
            {hi ? 'PDF A3' : 'Download PDF (A3)'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Print header (visible only when printing) */}
      <div className="hidden print:block text-center mb-4">
        <p className="text-lg font-bold">FORM — 1 : REGISTER OF MEMBERS</p>
        <p className="text-sm">{society.name} | Reg. No.: {society.registrationNo || '—'} | FY {society.financialYear}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={hi ? 'सदस्य खोजें…' : 'Search member…'}
            className="h-8 pl-8 w-44"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
            <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
            <SelectItem value="inactive">{hi ? 'निष्क्रिय' : 'Inactive'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी प्रकार' : 'All Types'}</SelectItem>
            <SelectItem value="member">{hi ? 'नियमित' : 'Regular'}</SelectItem>
            <SelectItem value="nominal">{hi ? 'नामिनल' : 'Nominal'}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} {hi ? 'सदस्य' : 'members'} ·
          {hi ? ' अंश पूंजी:' : ' Share Capital:'} ₹{totalShareCapital.toLocaleString('hi-IN')}
        </span>
      </div>

      {/* Society header for screen */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="py-3 px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><span className="text-gray-500">{hi ? 'समिति:' : 'Society:'}</span> <strong>{society.name}</strong></div>
            <div><span className="text-gray-500">{hi ? 'पंजीकरण नं.:' : 'Reg. No.:'}</span> <strong>{society.registrationNo || '—'}</strong></div>
            <div><span className="text-gray-500">{hi ? 'जिला:' : 'District:'}</span> <strong>{society.district || '—'}</strong></div>
            <div><span className="text-gray-500">{hi ? 'वित्तीय वर्ष:' : 'FY:'}</span> <strong>{society.financialYear}</strong></div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-blue-700 text-white">
                <TableHead className="text-white w-10">#</TableHead>
                <TableHead className="text-white">{hi ? 'सदस्य नं.' : 'Member No.'}</TableHead>
                <TableHead className="text-white">{hi ? 'नाम' : 'Name'}</TableHead>
                <TableHead className="text-white">{hi ? 'पिता/पति' : "Father's/Spouse"}</TableHead>
                <TableHead className="text-white">{hi ? 'पता' : 'Address'}</TableHead>
                <TableHead className="text-white">{hi ? 'फोन' : 'Phone'}</TableHead>
                <TableHead className="text-white">{hi ? 'सदस्यता तिथि' : 'Join Date'}</TableHead>
                <TableHead className="text-white text-right">{hi ? 'अंश' : 'Shares'}</TableHead>
                <TableHead className="text-white text-right">{hi ? 'अंश पूंजी' : 'Share Capital'}</TableHead>
                <TableHead className="text-white">{hi ? 'नामिती' : 'Nominee'}</TableHead>
                <TableHead className="text-white">{hi ? 'स्थिति' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                    {hi ? 'कोई सदस्य नहीं मिला' : 'No members found'}
                  </TableCell>
                </TableRow>
              ) : filtered.map((m, i) => (
                <TableRow key={m.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                  <TableCell className="text-gray-400">{i + 1}</TableCell>
                  <TableCell className="font-mono font-medium">{m.memberId}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.fatherName || '—'}</TableCell>
                  <TableCell className="max-w-36 truncate">{m.address || '—'}</TableCell>
                  <TableCell>{m.phone || '—'}</TableCell>
                  <TableCell>{m.joinDate ? fmtDate(m.joinDate) : '—'}</TableCell>
                  <TableCell className="text-right">{m.shareCount ?? '—'}</TableCell>
                  <TableCell className="text-right">₹{(m.shareCapital || 0).toLocaleString('hi-IN')}</TableCell>
                  <TableCell>
                    {m.nomineeName
                      ? <span>{m.nomineeName} <span className="text-gray-400">({m.nomineeRelation || '?'})</span></span>
                      : <span className="text-red-500 text-xs">{hi ? 'लम्बित' : 'Pending'}</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge className={m.status === 'active' ? 'bg-green-100 text-green-800 text-xs' : 'bg-red-100 text-red-800 text-xs'}>
                      {m.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td colSpan={7} className="px-4 py-2 text-xs">{hi ? 'कुल' : 'Total'} ({filtered.length} {hi ? 'सदस्य' : 'members'})</td>
                <td className="px-4 py-2 text-right text-xs">{totalShares.toLocaleString('hi-IN')}</td>
                <td className="px-4 py-2 text-right text-xs">₹{totalShareCapital.toLocaleString('hi-IN')}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>

      {/* Signature line for print */}
      <div className="hidden print:flex justify-between mt-16 text-sm">
        <div className="text-center w-40 border-t pt-2">Secretary / Manager</div>
        <div className="text-center w-40 border-t pt-2">President / Chairman</div>
        <div className="text-center w-40 border-t pt-2">Registrar / Auditor</div>
      </div>
    </div>
  );
};

export default Form1MemberList;
