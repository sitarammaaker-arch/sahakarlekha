import React from 'react';
import { CheckCircle, AlertTriangle, ClipboardList } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildYearEndChecklist } from '@/lib/reports/yearEndChecklist';
import { useTieOutRows } from '@/components/ReportTieOutCard';
import { Card, CardContent } from '@/components/ui/card';
import type { AccountBalance } from '@/types';

/**
 * Year-end pre-print checklist (NABARD CAS Annexure VI). Informs only - nothing is blocked. Auto-checked rows tie the
 * statements to each other; the rest are reminders for a person.
 */
const YearEndChecklist: React.FC<{ balances: AccountBalance[]; asOnDate: string; bsBalanced: boolean }> = ({ balances, asOnDate, bsBalanced }) => {
  const { getShareCapitalReconciliation, getAssetRegisterReconciliation } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  const closingDr = balances.reduce((s, b) => s + Math.max(b.netBalance, 0), 0);
  const closingCr = balances.reduce((s, b) => s + Math.max(-b.netBalance, 0), 0);
  const tie = useTieOutRows(balances, asOnDate, closingDr, closingCr);
  const items = buildYearEndChecklist({
    tbBalanced: tie.find(r => r.key === 'tb')?.ok ?? true,
    bsBalanced,
    bankTiesToBooks: tie.find(r => r.key === 'bank-bb')?.ok ?? true,
    bankTiesToRP: tie.find(r => r.key === 'bank-rp')?.ok ?? true,
    share: getShareCapitalReconciliation(),
    asset: getAssetRegisterReconciliation(),
  });
  const warn = items.filter(i => i.status === 'warn').length;

  return (
    <Card className={warn === 0 ? 'border-success/30' : 'border-warning/50'}>
      <CardContent className="pt-4 text-sm">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <ClipboardList className="h-4 w-4" />
            {hi ? 'वर्ष-अंत पूर्व-जाँच सूची' : 'Year-end pre-print checklist'}
            <span className={warn === 0 ? 'text-success' : 'text-warning'}>
              {warn === 0 ? (hi ? '— स्वचालित जाँच ठीक' : '— automatic checks agree') : (hi ? `— ${warn} अंतर` : `— ${warn} to look at`)}
            </span>
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {hi
              ? 'यह सूची केवल याद दिलाने के लिए है; कुछ रोकती नहीं। स्रोत: NABARD CAS (PACS) अनुलग्नक VI। अन्य प्रकार की समितियों के लिए यह अच्छे अभ्यास का मानक है, राज्य की निर्धारित प्रक्रिया नहीं।'
              : 'Reminder only - nothing is blocked. Source: NABARD CAS (PACS) Annexure VI. For other society types it is good practice, not the prescribed procedure of that State.'}
          </p>
          <ul className="mt-2 space-y-1">
            {items.map(i => (
              <li key={i.key} className="flex items-start gap-2">
                {i.status === 'ok' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  : i.status === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  : <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-muted-foreground/50" aria-hidden />}
                <span>
                  {hi ? i.hi : i.en}
                  {i.detail && <span className="ml-1 text-warning">({i.detail})</span>}
                  {i.status === 'manual' && <span className="ml-1 text-xs text-muted-foreground">{hi ? '- हाथ से जाँचें' : '- check by hand'}</span>}
                  <span className="ml-1 text-[11px] text-muted-foreground">[{i.cite}]</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
};

export default YearEndChecklist;
