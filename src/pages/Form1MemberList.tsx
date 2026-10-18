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
import { fmtDate, todayStr } from '@/lib/dateUtils';
import { memberStatusLabel, memberTypeLabel } from '@/lib/memberLifecycle';
import { isExit } from '@/lib/members/cessation';
import { isHaryana } from '@/lib/members/admission';
import { addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName, registerReportIdentity } from '@/lib/pdf';

const Form1MemberList: React.FC = () => {
  const { language } = useLanguage();
  const { members, society } = useData();

  const hi = language === 'hi';

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [typeFilter,  setTypeFilter]  = useState<'all' | 'member' | 'nominal' | 'associate'>('all');

  const filtered = useMemo(() => {
    let list = members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved');
    if (statusFilter === 'active') list = list.filter(m => m.status === 'active');
    else if (statusFilter === 'inactive') list = list.filter(m => m.status !== 'active');   // U4: every non-active state
    if (typeFilter   !== 'all') list = list.filter(m => m.memberType === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.address.toLowerCase().includes(q)
      );
    }
    // Natural order: 2, 11, 100, M924 — a plain string sort printed 100, 101, 11, 110 (the register looked shuffled).
    return [...list].sort((a, b) => a.memberId.localeCompare(b.memberId, 'en', { numeric: true, sensitivity: 'base' }));
  }, [members, statusFilter, typeFilter, search]);

  const totalShareCapital = filtered.reduce((s, m) => s + (m.shareCapital || 0), 0);
  const totalShares       = filtered.reduce((s, m) => s + (m.shareCount  || 0), 0);

  // ── The register of members (Haryana Rules r.22): name, address, OCCUPATION, shares, date of entry, date of
  //    CEASING, nominees — one column set for CSV, Excel and PDF (M5). ─────────────────────────────────────────
  const csvHeaders = ['S.No.', 'Member No.', 'Name', "Father's/Spouse Name", 'Gender', 'Occupation', 'Address', 'Phone', 'Admission Date', 'Type', 'Shares', 'Share Capital', 'Nominee', 'Relation', 'Status', 'Ceased On'];
  const GENDER = { female: 'Female', male: 'Male', other: 'Other' } as const;
  // A dummy number (9999999999, 0000000000…) typed only to get past the form is not a phone — print "—" in the register.
  const realPhone = (p?: string) => {
    const d = (p || '').replace(/\D/g, '');
    return !d || /^(\d)\1+$/.test(d) ? '—' : p!;
  };
  const registerRow = (m: typeof filtered[number], i: number, money: (n: number) => string | number) => [
    i + 1,
    m.memberId,
    m.name,
    m.fatherName || '—',
    m.gender ? GENDER[m.gender] : '—',
    m.occupation || '—',
    m.address || '—',
    realPhone(m.phone),
    (m.admissionDate || m.joinDate) ? fmtDate(m.admissionDate || m.joinDate) : '—',
    m.memberType && m.memberType !== 'member' ? memberTypeLabel(m.memberType) : 'Regular',
    m.shareCount ?? '—',
    money(m.shareCapital || 0),
    m.nomineeName || '—',
    m.nomineeRelation || '—',
    memberStatusLabel(m.status),
    isExit(m.status) && m.statusChangedAt ? fmtDate(m.statusChangedAt) : '—',
  ];
  const getCsvRows = () => filtered.map((m, i) => registerRow(m, i, n => n));

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'form1-member-list');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'form1-member-list', 'Member List');

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const marginL = 14;
    let y = 12;

    const pageW = doc.internal.pageSize.getWidth();
    const haryana = isHaryana(society.state);

    // Title block — the register of members is r.22 of the Haryana Rules, 1989 (there "Form 1" is the registration
    // application, r.5), so the printed heading no longer says "FORM — 1".
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('REGISTER OF MEMBERS', pageW / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(haryana
      ? '[Rule 22, Haryana Co-operative Societies Rules, 1989]'
      : '[Under the Co-operative Societies Act and Rules]', pageW / 2, y, { align: 'center' }); y += 7;

    // Society name on its own full-width line: a long name used to run over "Reg. No." placed at a fixed offset.
    doc.setFont('helvetica', 'bold');
    const nameLines: string[] = doc.splitTextToSize(`Society: ${society.name}`, pageW - marginL * 2);
    doc.text(nameLines, marginL, y); y += 5 * nameLines.length;
    doc.setFont('helvetica', 'normal');
    const col = (pageW - marginL * 2) / 3;
    doc.text(`Reg. No.: ${society.registrationNo || '—'}`, marginL, y);
    doc.text(`District: ${society.district || '—'}`, marginL + col, y);
    doc.text(`Financial Year: ${society.financialYear}`, marginL + col * 2, y);
    y += 5;
    doc.text(`Date of Print: ${fmtDate(todayStr())}`, marginL, y);
    doc.text(`Total Members: ${filtered.length}`, marginL + col, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [csvHeaders.map(h => (h === 'Share Capital' ? 'Share Capital (Rs.)' : h))],
      body: filtered.map((m, i) => registerRow(m, i, n => n.toLocaleString('en-IN'))),
      foot: [[
        '', '', '', '', '', '', '', '', '', `Total: ${filtered.length}`,
        { content: totalShares.toLocaleString('en-IN'), styles: { halign: 'right' } },
        { content: totalShareCapital.toLocaleString('en-IN'), styles: { halign: 'right' } },
        '', '', '', '',
      ]],
      // The grand total only once, under the last row — on every page it read as that page's total.
      showFoot: 'lastPage',
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175], fontSize: 7 },
      footStyles: { fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        10: { halign: 'right' },
        11: { halign: 'right' },
        9:  { halign: 'center' },
        14: { halign: 'center' },
      },
    });

    // Footer — signature block via shared helper
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const sigNames = getSignatoryNames(society);
    addSignatureBlock(doc, 'helvetica', ['Secretary / Manager', 'President / Chairman', 'Registrar / Auditor'], finalY, undefined,
      [sigNames.secretary, sigNames.president, '']);
    // Stage C: titled by Rules 1989 r.22 (in those Rules "Form 1" is the registration application, r.5). The Report ID
    // code stays 'F1' so reports issued earlier still verify.
    registerReportIdentity(doc, 'F1', society, 'Register of Members (Rule 22)');
    addPageNumbers(doc, 'helvetica', society?.name);

    doc.save(pdfFileName('Form1_MemberList', society));
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
            {hi ? 'सदस्य रजिस्टर (नियम 22)' : 'Register of Members (Rule 22)'}
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
        <p className="text-lg font-bold">REGISTER OF MEMBERS (Rule 22)</p>
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
            <SelectItem value="inactive">{hi ? 'सक्रिय नहीं' : 'Not active'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी प्रकार' : 'All Types'}</SelectItem>
            <SelectItem value="member">{hi ? 'नियमित' : 'Regular'}</SelectItem>
            <SelectItem value="nominal">{hi ? 'नाममात्र' : 'Nominal'}</SelectItem>
            <SelectItem value="associate">{hi ? 'सहयोगी' : 'Associate'}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} {hi ? 'सदस्य' : 'members'} ·
          {hi ? ' शेयर कैपिटल:' : ' Share Capital:'} ₹{totalShareCapital.toLocaleString('hi-IN')}
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
                <TableHead className="text-white">{hi ? 'व्यवसाय' : 'Occupation'}</TableHead>
                <TableHead className="text-white">{hi ? 'पता' : 'Address'}</TableHead>
                <TableHead className="text-white">{hi ? 'फोन' : 'Phone'}</TableHead>
                <TableHead className="text-white">{hi ? 'दाख़िला तिथि' : 'Admission Date'}</TableHead>
                <TableHead className="text-white text-right">{hi ? 'शेयर' : 'Shares'}</TableHead>
                <TableHead className="text-white text-right">{hi ? 'शेयर कैपिटल' : 'Share Capital'}</TableHead>
                <TableHead className="text-white">{hi ? 'नामिती' : 'Nominee'}</TableHead>
                <TableHead className="text-white">{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead className="text-white">{hi ? 'समाप्ति तिथि' : 'Ceased On'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                    {hi ? 'कोई सदस्य नहीं मिला' : 'No members found'}
                  </TableCell>
                </TableRow>
              ) : filtered.map((m, i) => (
                <TableRow key={m.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                  <TableCell className="text-gray-400">{i + 1}</TableCell>
                  <TableCell className="font-mono font-medium">{m.memberId}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.fatherName || '—'}</TableCell>
                  <TableCell>{m.occupation || '—'}</TableCell>
                  <TableCell className="max-w-36 truncate">{m.address || '—'}</TableCell>
                  <TableCell>{m.phone || '—'}</TableCell>
                  <TableCell>{(m.admissionDate || m.joinDate) ? fmtDate(m.admissionDate || m.joinDate) : '—'}</TableCell>
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
                      {memberStatusLabel(m.status, hi)}
                    </Badge>
                  </TableCell>
                  <TableCell>{isExit(m.status) && m.statusChangedAt ? fmtDate(m.statusChangedAt) : '—'}</TableCell>
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
