/**
 * Compliance Calendar (ECR-13) — statutory due dates for the society.
 *
 * Slice 1: a read-only view of upcoming + recently-passed statutory deadlines (PF/ESI/TDS/
 * GST/24Q/IT return/audit), derived from society config + the clock. Notification channels,
 * role-routed alerts and per-item "filed" tracking are later slices.
 */
import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarClock, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { fmtDate } from '@/lib/dateUtils';
import { buildComplianceCalendar, type ComplianceCategory, type ComplianceStatus } from '@/lib/complianceCalendar';

const CAT_LABEL: Record<ComplianceCategory, { hi: string; en: string; cls: string }> = {
  PF:        { hi: 'भविष्य निधि', en: 'EPF', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  ESI:       { hi: 'ESI', en: 'ESI', cls: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  TDS:       { hi: 'TDS', en: 'TDS', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  GST:       { hi: 'GST', en: 'GST', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  IncomeTax: { hi: 'आयकर', en: 'Income Tax', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
  Audit:     { hi: 'अंकेक्षण', en: 'Audit', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};
const STATUS_META: Record<ComplianceStatus, { hi: string; en: string; cls: string }> = {
  overdue:    { hi: 'बीत गई', en: 'Overdue', cls: 'bg-red-100 text-red-800 border-red-300' },
  'due-soon': { hi: 'जल्द देय', en: 'Due soon', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  upcoming:   { hi: 'आगामी', en: 'Upcoming', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  filed:      { hi: 'फाइल हो गई', en: 'Filed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

const ComplianceCalendar: React.FC = () => {
  const { language } = useLanguage();
  const { society, employees, getComplianceFiledIds, markComplianceFiled, unmarkComplianceFiled } = useData();
  const { can } = useAuth();
  const hi = language === 'hi';
  // ECR-06 17-role: RBAC permission gate, not a hardcoded legacy list. `update` (not `create`)
  // keeps the auditor family — whose `create` is audit-objection-scoped — read-only here;
  // byte-identical for the 4 legacy roles, opens edit to operational roles (delete fail-closes
  // at the data layer).
  const canEdit = can('update');
  const filedIds = getComplianceFiledIds();

  const items = useMemo(() => {
    const asOf = new Date().toISOString().split('T')[0];
    const hasEmployees = (employees || []).some(e => e.status === 'active');
    return buildComplianceCalendar(asOf, {
      hasEmployees,
      tan: !!society.tan?.trim(),
      gstin: !!society.gstin?.trim(),
    }, { filedIds });
  }, [society.tan, society.gstin, employees, filedIds]);

  const overdue = items.filter(i => i.status === 'overdue').length;
  const dueSoon = items.filter(i => i.status === 'due-soon').length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-indigo-100 rounded-lg"><CalendarClock className="h-6 w-6 text-indigo-700" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'अनुपालन कैलेंडर' : 'Compliance Calendar'}</h1>
          <p className="text-sm text-gray-500">{hi ? 'सांविधिक देय तिथियाँ — PF/ESI/TDS/GST/24Q/आयकर/अंकेक्षण' : 'Statutory due dates — PF/ESI/TDS/GST/24Q/IT/Audit'}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'बीत गईं' : 'Overdue'}</p><p className={`text-xl font-bold ${overdue > 0 ? 'text-red-600' : ''}`}>{overdue}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'जल्द देय (7 दिन)' : 'Due soon (7d)'}</p><p className={`text-xl font-bold ${dueSoon > 0 ? 'text-orange-600' : ''}`}>{dueSoon}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{hi ? 'कुल आइटम' : 'Total items'}</p><p className="text-xl font-bold">{items.length}</p></CardContent></Card>
      </div>

      {(overdue > 0 || dueSoon > 0) && (
        <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {hi ? `${overdue} बीत गईं व ${dueSoon} जल्द देय — समय पर फाइल करें, वरना ब्याज/जुर्माना।` : `${overdue} overdue and ${dueSoon} due soon — file on time to avoid interest/penalty.`}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {items.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">{hi ? 'कोई देय आइटम नहीं (society config के अनुसार)।' : 'No due items (per society configuration).'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'श्रेणी' : 'Category'}</TableHead>
                  <TableHead>{hi ? 'अनुपालन' : 'Compliance'}</TableHead>
                  <TableHead>{hi ? 'अवधि' : 'Period'}</TableHead>
                  <TableHead>{hi ? 'देय तिथि' : 'Due date'}</TableHead>
                  <TableHead className="text-right">{hi ? 'शेष दिन' : 'Days left'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  {canEdit && <TableHead className="text-center">{hi ? 'कार्रवाई' : 'Action'}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell><Badge variant="outline" className={CAT_LABEL[it.category].cls}>{hi ? CAT_LABEL[it.category].hi : CAT_LABEL[it.category].en}</Badge></TableCell>
                    <TableCell className="font-medium text-sm">{it.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{it.period}</TableCell>
                    <TableCell className="text-sm">{fmtDate(it.dueDate)}</TableCell>
                    <TableCell className="text-right text-sm">{it.daysLeft < 0 ? `${-it.daysLeft} ${hi ? 'दिन पहले' : 'd ago'}` : `${it.daysLeft} ${hi ? 'दिन' : 'd'}`}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_META[it.status].cls}>{hi ? STATUS_META[it.status].hi : STATUS_META[it.status].en}</Badge></TableCell>
                    {canEdit && (
                      <TableCell className="text-center">
                        {it.status === 'filed' ? (
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={() => unmarkComplianceFiled(it.id)}>
                            <RotateCcw className="h-3.5 w-3.5" />{hi ? 'हटाएं' : 'Undo'}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-emerald-700 hover:bg-emerald-50" onClick={() => markComplianceFiled(it.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />{hi ? 'फाइल हुआ' : 'Mark filed'}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        {hi ? 'नोट: तिथियाँ मानक सांविधिक हैं; society के GSTIN/TAN/कर्मचारी के अनुसार दिखती हैं। SMS/WhatsApp/ईमेल अलर्ट व "फाइल हो गया" ट्रैकिंग अगली slices में।'
            : 'Note: standard statutory dates, shown per the society\'s GSTIN/TAN/employees. SMS/WhatsApp/email alerts and "filed" tracking come in later slices.'}
      </p>
    </div>
  );
};

export default ComplianceCalendar;
