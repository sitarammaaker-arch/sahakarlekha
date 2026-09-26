/**
 * Detailed Audit Trail — who did what, when, to which record, with before → after and reason.
 * Built by the pure lib/auditTrail.ts from the vouchers' own history + the append-only audit_log.
 * Read-only. PDF (English) and Excel of exactly the filtered rows.
 */
import React, { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileSpreadsheet, History } from 'lucide-react';
import { useAuditLogRows } from '@/hooks/useAuditLogRows';
import { actionLabel, auditRowEvents, entityLabel, filterTrail, mergeTrail, voucherEvents, ENTITY_LABEL } from '@/lib/auditTrail';
import { downloadExcelSingle } from '@/lib/exportUtils';
import { addHeader, addPageNumbers, pdfFileName } from '@/lib/pdf';

const SHOW_MAX = 500;
const fmtAt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

const AuditTrail: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { vouchers, accounts, members, society } = useData();
  const fyStart = `20${(society.financialYear || '').split('-')[0].slice(-2)}-04-01`;
  const fyEnd = `20${(society.financialYear || '').split('-')[1]}-03-31`;
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(fyEnd);
  const [entityType, setEntityType] = useState('');
  const [actor, setActor] = useState('');
  const [q, setQ] = useState('');
  const { rows, loading, error, truncated } = useAuditLogRows(from, to);

  const events = useMemo(() => {
    const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
    const refOf = (t: string, id: string) =>
      t === 'voucher' ? (vouchers.find((v) => v.id === id)?.voucherNo ?? id)
        : t === 'member' ? (members.find((m) => m.id === id)?.name ?? id) : id;
    return mergeTrail(voucherEvents(vouchers, accName), auditRowEvents(rows, refOf));
  }, [vouchers, accounts, members, rows]);
  const actors = useMemo(() => [...new Set(events.map((e) => e.actor))].sort(), [events]);
  const types = useMemo(() => [...new Set(events.map((e) => e.entityType))].sort(), [events]);
  const shown = useMemo(() => filterTrail(events, { from, to, entityType: entityType || undefined, actor: actor || undefined, q }), [events, from, to, entityType, actor, q]);

  const headersEn = ['Date & time', 'User', 'Role', 'Action', 'Record type', 'Record', 'Details (before → after)', 'Reason', 'Source'];
  const rowsEn = () => shown.map((e) => [fmtAt(e.at), e.actor, e.role ?? '', actionLabel(e.action, false), entityLabel(e.entityType, false), e.ref, e.details, e.reason ?? '', e.source === 'voucher' ? 'Voucher history' : 'Audit log']);
  const handleExcel = () => downloadExcelSingle(headersEn, rowsEn(), `Audit_Trail_${from}_${to}`, 'Audit Trail');
  const handlePdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const { startY } = addHeader(doc, 'Detailed Audit Trail', society, `${from} to ${to} · ${shown.length} entries`, { reportCode: 'ADT' });
    autoTable(doc, { startY, head: [headersEn], body: rowsEn(), styles: { fontSize: 7, cellPadding: 1.1, overflow: 'linebreak' }, headStyles: { fillColor: [55, 65, 81] }, columnStyles: { 6: { cellWidth: 80 } } });
    addPageNumbers(doc, 'helvetica', society.name);
    doc.save(pdfFileName('Audit_Trail', society, from, to));
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><History className="h-6 w-6" />{hi ? 'विस्तृत ऑडिट ट्रेल' : 'Detailed Audit Trail'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'किसने, कब, किस रिकॉर्ड में क्या किया — पहले → बाद और कारण के साथ।' : 'Who did what, when, to which record — with before → after and the reason.'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={handlePdf} disabled={!shown.length}><Download className="h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel} disabled={!shown.length}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><Label>{hi ? 'से' : 'From'}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>{hi ? 'तक' : 'To'}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <Label>{hi ? 'रिकॉर्ड का प्रकार' : 'Record type'}</Label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">{hi ? 'सभी' : 'All'}</option>
              {types.map((t) => <option key={t} value={t}>{ENTITY_LABEL[t] ? entityLabel(t, hi) : t}</option>)}
            </select>
          </div>
          <div>
            <Label>{hi ? 'उपयोगकर्ता' : 'User'}</Label>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">{hi ? 'सभी' : 'All'}</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div><Label>{hi ? 'खोजें' : 'Search'}</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={hi ? 'वाउचर नं., नाम, विवरण…' : 'Voucher no., name, details…'} /></div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{hi ? `ऑडिट लॉग नहीं पढ़ा जा सका (${error}) — नीचे केवल वाउचर-इतिहास है, सूची अधूरी है।` : `Could not read the audit log (${error}) — only voucher history is shown below; the trail is incomplete.`}</p>}
      {truncated && <p className="text-sm text-destructive">{hi ? 'इस अवधि में बहुत अधिक प्रविष्टियाँ हैं — ऑडिट लॉग की पहली 20,000 ही पढ़ी गईं। तिथि-सीमा छोटी करें।' : 'Too many entries in this period — only the first 20,000 audit-log rows were read. Narrow the date range.'}</p>}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{hi ? 'तिथि व समय' : 'Date & time'}</TableHead>
                <TableHead>{hi ? 'उपयोगकर्ता' : 'User'}</TableHead>
                <TableHead>{hi ? 'कार्य' : 'Action'}</TableHead>
                <TableHead>{hi ? 'रिकॉर्ड' : 'Record'}</TableHead>
                <TableHead>{hi ? 'विवरण (पहले → बाद)' : 'Details (before → after)'}</TableHead>
                <TableHead>{hi ? 'कारण' : 'Reason'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !shown.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{hi ? 'लोड हो रहा है…' : 'Loading…'}</TableCell></TableRow>
              ) : !shown.length ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{hi ? 'इस अवधि में कोई प्रविष्टि नहीं।' : 'No entries in this period.'}</TableCell></TableRow>
              ) : shown.slice(0, SHOW_MAX).map((e, i) => (
                <TableRow key={`${e.source}-${e.entityId}-${e.at}-${i}`}>
                  <TableCell className="text-xs whitespace-nowrap">{fmtAt(e.at)}</TableCell>
                  <TableCell className="text-sm">{e.actor}{e.role && <span className="block text-[11px] text-muted-foreground">{e.role}</span>}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{actionLabel(e.action, hi)}</TableCell>
                  <TableCell className="text-sm">{entityLabel(e.entityType, hi)}<span className="block text-xs text-muted-foreground font-mono">{e.ref}</span></TableCell>
                  <TableCell className="text-xs max-w-[420px] break-words">{e.details || '—'}</TableCell>
                  <TableCell className="text-xs">{e.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {hi
          ? `${shown.length} प्रविष्टियाँ${shown.length > SHOW_MAX ? ` — स्क्रीन पर पहली ${SHOW_MAX}; PDF / Excel में सभी` : ''}। स्रोत: वाउचरों का अपना इतिहास (बनाना, हर बदलाव) और अपरिवर्तनीय ऑडिट लॉग (बाकी सभी बदलाव)। ऑडिट लॉग शुरू होने से पहले के गैर-वाउचर बदलाव इसमें नहीं हो सकते।`
          : `${shown.length} entries${shown.length > SHOW_MAX ? ` — first ${SHOW_MAX} on screen; all in PDF / Excel` : ''}. Sources: the vouchers' own history (creation, every edit) and the append-only audit log (every other change). Non-voucher changes from before the audit log existed may be missing.`}
      </p>
    </div>
  );
};

export default AuditTrail;
