/**
 * Group Schedule / समूह अनुसूची (2026-10-16) — "LIST OF <GROUP> AS ON <DATE>": the party-wise list of any group's
 * ledgers (opening, period Dr/Cr, closing) that the cooperative audit attaches to the Balance Sheet. Figures are the
 * Trial Balance's own rows (lib/reports/groupSchedule); the page shows the tie-out against the TB group subtotal.
 * PDF + Excel for one group, or every Balance Sheet head at once (a page / a sheet per head).
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTree, Download, FileSpreadsheet, Files, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate } from '@/lib/dateUtils';
import { fyStartOf } from '@/lib/fyPeriod';
import { downloadExcel } from '@/lib/exportUtils';
import { generateGroupSchedulePDF } from '@/lib/pdf';
import {
  buildGroupSchedule, allBalanceSheetSchedules, balanceSheetHeads, trialBalanceGroupTotals, scheduleSheetRows, SCHEDULE_HEADERS,
  type GroupSchedule as Schedule,
} from '@/lib/reports/groupSchedule';
import type { LedgerAccount } from '@/types';

const TYPE_ORDER: LedgerAccount['type'][] = ['liability', 'equity', 'asset', 'income', 'expense'];

const GroupSchedule: React.FC = () => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { can } = useAuth();
  const canExport = can('export');
  const { accounts, society, getTrialBalance } = useData();
  const navigate = useNavigate();

  const fyEnd = `20${(society.financialYear || '').split('-')[1]}-03-31`;
  const today = new Date().toISOString().slice(0, 10);
  const [asOn, setAsOn] = useState(today < fyEnd ? today : fyEnd);
  const fyStart = fyStartOf(asOn);

  // Groups for the picker: Balance Sheet heads first, then every other group, indented by depth.
  const depthOf = useMemo(() => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return (a: LedgerAccount) => { let d = 0, p = a.parentId, guard = 0; while (p && guard++ < 20) { d++; p = byId.get(p)?.parentId; } return d; };
  }, [accounts]);
  const groups = useMemo(() => accounts.filter((a) => a.isGroup)
    .sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type)), [accounts]);
  const heads = useMemo(() => balanceSheetHeads(accounts), [accounts]);
  const [groupId, setGroupId] = useState<string>('');
  const selected = groupId || heads[0]?.id || groups[0]?.id || '';

  const trialBalance = useMemo(() => getTrialBalance(asOn), [getTrialBalance, asOn]);
  const schedule: Schedule | null = useMemo(() => (selected ? buildGroupSchedule(trialBalance, accounts, selected) : null), [trialBalance, accounts, selected]);
  const tb = useMemo(() => (selected ? trialBalanceGroupTotals(trialBalance, accounts, selected) : null), [trialBalance, accounts, selected]);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const ties = !!(schedule && tb && near(schedule.grand.opening, tb.opening) && near(schedule.grand.debit, tb.debit) && near(schedule.grand.credit, tb.credit) && near(schedule.grand.closing, tb.closing));

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const drCr = (n: number) => (Math.abs(n) < 0.005 ? '—' : <>{fmt(Math.abs(n))} <span className={`text-[10px] ${n > 0 ? 'text-info' : 'text-warning'}`}>{n > 0 ? 'Dr' : 'Cr'}</span></>);
  const plain = (n: number) => (Math.abs(n) < 0.005 ? '—' : fmt(n));
  const name = (en: string, hiName: string) => (
    <>
      <span>{en}</span>
      {hiName && hiName.trim() !== en.trim() && <span className="block text-xs text-muted-foreground">{hiName}</span>}
    </>
  );

  const stem = (s: Schedule) => `GroupSchedule_${s.titleEn.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40)}`;
  const pdfOne = () => schedule && generateGroupSchedulePDF([schedule], society, asOn, fyStart, stem(schedule));
  const excelOne = () => schedule && downloadExcel([{ name: schedule.titleEn, headers: SCHEDULE_HEADERS, rows: scheduleSheetRows(schedule) }], stem(schedule));
  const all = () => allBalanceSheetSchedules(trialBalance, accounts);
  const pdfAll = () => { const a = all(); if (a.length) generateGroupSchedulePDF(a, society, asOn, fyStart, 'GroupSchedules_All'); };
  const excelAll = () => { const a = all(); if (a.length) downloadExcel(a.map((s) => ({ name: s.titleEn, headers: SCHEDULE_HEADERS, rows: scheduleSheetRows(s) })), 'GroupSchedules_All'); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ListTree className="h-7 w-7 text-primary" />{hi ? 'समूह अनुसूची' : 'Group Schedule'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'किसी भी समूह के खातों की पार्टी-वार सूची — ऑडिट में बैलेंस शीट के साथ लगने वाली' : 'Party-wise list of a group\'s ledgers — the schedule attached to the Balance Sheet in the audit'}</p>
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={pdfOne} disabled={!schedule?.ledgerCount}><Download className="h-4 w-4" />PDF</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={excelOne} disabled={!schedule?.ledgerCount}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
            <Button size="sm" className="gap-2" onClick={pdfAll}><Files className="h-4 w-4" />{hi ? 'सारी schedules — PDF' : 'All schedules — PDF'}</Button>
            <Button size="sm" variant="secondary" className="gap-2" onClick={excelAll}><Files className="h-4 w-4" />{hi ? 'सारी schedules — Excel' : 'All schedules — Excel'}</Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="gs-group">{hi ? 'समूह (Group)' : 'Group'}</Label>
            <Select value={selected} onValueChange={(v) => { if (v) setGroupId(v); }}>
              <SelectTrigger id="gs-group"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span style={{ paddingLeft: `${depthOf(g) * 0.75}rem` }}>{hi ? (g.nameHi || g.name) : g.name}{heads.some((h) => h.id === g.id) ? ' ★' : ''}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{hi ? '★ = बैलेंस शीट का head' : '★ = a Balance Sheet head'}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gs-date">{hi ? 'दिनांक तक (As on)' : 'As on'}</Label>
            <Input id="gs-date" type="date" value={asOn} onChange={(e) => e.target.value && setAsOn(e.target.value)} className="w-44" />
            <p className="text-xs text-muted-foreground">{hi ? `अवधि: ${fmtDate(fyStart)} से ${fmtDate(asOn)}` : `Period: ${fmtDate(fyStart)} to ${fmtDate(asOn)}`}</p>
          </div>
        </CardContent>
      </Card>

      {schedule && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="text-center">
              <p className="font-semibold">{society.name}</p>
              <p className="text-xs text-muted-foreground">Reg. No: {society.registrationNo} | FY: {society.financialYear}</p>
              <h2 className="font-bold mt-1">LIST OF {schedule.titleEn.toUpperCase()} AS ON {fmtDate(asOn)}</h2>
              {schedule.titleHi !== schedule.titleEn && <p className="text-sm">{schedule.titleHi} की सूची — {fmtDate(asOn)} तक</p>}
            </div>

            {tb && (
              <div className={`flex items-start gap-2 rounded-md border p-2 text-sm ${ties ? 'border-success/40 bg-success/5 text-success' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
                {ties ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{ties
                  ? (hi ? 'Trial Balance से मिलान ✓ — इस समूह का Opening, Debit, Credit और Closing वही है जो Trial Balance में है।' : 'Ties to the Trial Balance ✓ — opening, debit, credit and closing equal the TB group subtotal.')
                  : (hi ? `Trial Balance से अंतर — TB: Closing ${fmt(tb.closing)}` : `Does not tie — TB closing ${fmt(tb.closing)}`)}</span>
              </div>
            )}

            {schedule.ledgerCount === 0 ? (
              <p className="text-center text-muted-foreground py-8">{hi ? 'इस समूह में दिखाने लायक कोई खाता नहीं (सबका शेष शून्य)।' : 'No ledger with any balance or movement in this group.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{hi ? 'क्रम' : 'Sr'}</TableHead>
                      <TableHead className="min-w-[14rem]">{hi ? 'नाम (English / हिंदी)' : 'Name (English / Hindi)'}</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">{hi ? 'Debit (अवधि)' : 'Debit (period)'}</TableHead>
                      <TableHead className="text-right">{hi ? 'Credit (अवधि)' : 'Credit (period)'}</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.sections.map((sec) => (
                      <React.Fragment key={sec.id}>
                        <TableRow className="bg-primary/5"><TableCell colSpan={6} className="font-bold uppercase text-sm">{name(sec.titleEn, sec.titleHi)}</TableCell></TableRow>
                        {sec.rows.map((r) => r.kind === 'subhead' ? (
                          <TableRow key={'s' + r.accountId} className="bg-muted/40 italic font-semibold">
                            <TableCell />
                            <TableCell style={{ paddingLeft: `${0.5 + r.depth}rem` }}>{name(r.nameEn, r.nameHi)} <span className="text-xs font-normal">({hi ? 'उप-योग' : 'sub-total'})</span></TableCell>
                            <TableCell className="text-right">{drCr(r.opening)}</TableCell>
                            <TableCell className="text-right">{plain(r.debit)}</TableCell>
                            <TableCell className="text-right">{plain(r.credit)}</TableCell>
                            <TableCell className="text-right">{drCr(r.closing)}</TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={r.accountId} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/ledger?account=${r.accountId}`)} title={hi ? 'लेजर देखें' : 'View ledger'}>
                            <TableCell className="text-muted-foreground">{r.serial}</TableCell>
                            <TableCell style={{ paddingLeft: `${0.5 + r.depth}rem` }}>{name(r.nameEn, r.nameHi)}</TableCell>
                            <TableCell className="text-right tabular-nums">{drCr(r.opening)}</TableCell>
                            <TableCell className="text-right tabular-nums">{plain(r.debit)}</TableCell>
                            <TableCell className="text-right tabular-nums">{plain(r.credit)}</TableCell>
                            <TableCell className="text-right tabular-nums">{drCr(r.closing)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold border-t-2">
                          <TableCell />
                          <TableCell>{hi ? `योग — ${sec.titleHi}` : `Total — ${sec.titleEn}`}</TableCell>
                          <TableCell className="text-right">{drCr(sec.total.opening)}</TableCell>
                          <TableCell className="text-right">{plain(sec.total.debit)}</TableCell>
                          <TableCell className="text-right">{plain(sec.total.credit)}</TableCell>
                          <TableCell className="text-right">{drCr(sec.total.closing)}</TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                    <TableRow className="bg-primary/15 font-bold">
                      <TableCell />
                      <TableCell>{hi ? `कुल योग — ${schedule.titleHi}` : `GRAND TOTAL — ${schedule.titleEn}`}</TableCell>
                      <TableCell className="text-right">{drCr(schedule.grand.opening)}</TableCell>
                      <TableCell className="text-right">{plain(schedule.grand.debit)}</TableCell>
                      <TableCell className="text-right">{plain(schedule.grand.credit)}</TableCell>
                      <TableCell className="text-right">{drCr(schedule.grand.closing)}</TableCell>
                    </TableRow>
                    <TableRow className="text-xs text-muted-foreground">
                      <TableCell />
                      <TableCell>{hi ? 'कुल Dr / कुल Cr' : 'Gross Dr / Gross Cr'}</TableCell>
                      <TableCell className="text-right">{fmt(schedule.grand.openingDr)} Dr / {fmt(schedule.grand.openingCr)} Cr</TableCell>
                      <TableCell /><TableCell />
                      <TableCell className="text-right">{fmt(schedule.grand.closingDr)} Dr / {fmt(schedule.grand.closingCr)} Cr</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GroupSchedule;
