/**
 * NABARD MIS returns for PACS (CAS-2b slice 1): Annexure VII, XVII, XVIII — built by the pure
 * lib/cas/pacsMis.ts from the SAME CAS Balance Sheet the statements show (RULE 2).
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { MIS_POSITION_KEYS, OVERDUE_BUCKETS, OVERDUE_ROWS, type MisPosition, type MisRatios, type OverdueTable } from '@/lib/cas/pacsMis';

const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
const cell = (n: number | null | undefined) => (n == null ? '—' : Math.abs(n) < 0.005 ? '—' : fmt(n));
const pctCell = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(2)}%`);

export interface CasMisProps {
  hi: boolean;
  asOf: string;
  overdue: OverdueTable;
  avgCurrent: MisPosition | null;
  monthsAveraged: number;
  ratios: MisRatios;
}

export function CasMis({ hi, asOf, overdue, avgCurrent, monthsAveraged, ratios }: CasMisProps) {
  const wf = avgCurrent?.workingFunds ?? 0;
  const ofWf = (n: number) => (Math.abs(wf) < 0.005 ? null : Math.round((n / wf) * 10000) / 100);
  return (
    <>
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? `MIS Annexure VII — अतिदेय ऋणों का अवधि-वार वर्गीकरण (${asOf} को)` : `MIS Annexure VII — Period-wise classification of overdues (as on ${asOf})`}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow className="bg-muted/40 text-xs">
                  <TableCell>{hi ? 'ऋण का प्रकार' : 'Type of loan'}</TableCell>
                  {OVERDUE_BUCKETS.map((b) => <TableCell key={b.key} className="text-right">{hi ? b.labelHi : b.label}</TableCell>)}
                </TableRow>
                {OVERDUE_ROWS.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{hi ? r.labelHi : r.label}</TableCell>
                    {OVERDUE_BUCKETS.map((b) => <TableCell key={b.key} className="text-right whitespace-nowrap">{cell(overdue[r.key][b.key])}</TableCell>)}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>{hi ? 'योग' : 'Total'}</TableCell>
                  {OVERDUE_BUCKETS.map((b) => <TableCell key={b.key} className="text-right whitespace-nowrap">{cell(overdue.total[b.key])}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {hi
              ? 'अतिदेय मूल (principal) बकाया, नियत तिथि से बीती अवधि के अनुसार। अतिदेय = नियत तिथि बीत गई और बकाया है, या ऋण "अतिदेय" चिह्नित है (ऐप का एक ही नियम)। सदस्य ऋणों में कृषि / गैर-कृषि दर्ज नहीं होता, इसलिए वे "अन्य" में हैं। राशि ₹ में (प्रारूप ₹ हज़ार माँगता है)।'
              : 'Overdue principal outstanding, by time since the due date. Overdue = due date passed with a balance, or marked overdue (the app\'s one rule). Member loans carry no agri / non-agri tag, so they are under "Others". Amounts in ₹ (the format asks for ₹ \'000).'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'MIS Annexure XVII — तुलन पत्र की संक्षिप्त संरचना (मासिक औसत)' : 'MIS Annexure XVII — Concise structure of the Balance Sheet (monthly average)'}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow className="bg-muted/40 text-xs">
                  <TableCell>{hi ? 'विवरण' : 'Description'}</TableCell>
                  <TableCell className="text-right">{hi ? 'औसत — पिछला वर्ष' : 'Average — previous year'}</TableCell>
                  <TableCell className="text-right">{hi ? 'औसत — चालू वर्ष' : 'Average — current year'}</TableCell>
                  <TableCell className="text-right">{hi ? 'परिवर्तन %' : '% change'}</TableCell>
                  <TableCell className="text-right">{hi ? 'औसत कार्यशील निधि का % — चालू' : '% of avg. working funds — current'}</TableCell>
                </TableRow>
                {MIS_POSITION_KEYS.map((k) => (
                  <TableRow key={k.key}>
                    <TableCell>{hi ? k.labelHi : k.label}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{cell(avgCurrent?.[k.key])}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">{avgCurrent ? pctCell(ofWf(avgCurrent[k.key])) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {hi
              ? `चालू वर्ष का औसत = ${monthsAveraged} माह-अंत शेषों का औसत। पिछले वर्ष का कॉलम तभी भरेगा जब पिछले वर्ष की पुस्तकें ऐप में हों।`
              : `Current-year average = mean of ${monthsAveraged} month-end positions. The previous-year column needs the previous year's books in the app.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">{hi ? 'MIS Annexure XVIII — वित्तीय अनुपात (चालू वर्ष)' : 'MIS Annexure XVIII — Financial ratios (current year)'}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Table>
            <TableBody>
              {[
                { l: hi ? 'NPA अनुपात' : 'NPA Ratio', v: ratios.npaRatio, why: hi ? 'PACS के NPA वर्गीकरण की अवधि-सीमा (circular) अभी ऐप में नहीं है' : 'PACS NPA classification periods (circular) not yet in the app' },
                { l: hi ? 'परिसंपत्तियों पर प्रतिफल (ROA)' : 'Return on Assets', v: ratios.returnOnAssets, why: '' },
                { l: hi ? 'पूँजी पर्याप्तता अनुपात (CAR)' : 'Capital Adequacy Ratio', v: ratios.capitalAdequacy, why: '' },
                { l: hi ? 'ऋण-जमा अनुपात (CD)' : 'Credit Deposit Ratio', v: ratios.creditDeposit, why: hi ? 'जमा शून्य है' : 'no deposits' },
              ].map((r) => (
                <TableRow key={r.l}>
                  <TableCell>{r.l}</TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium">{pctCell(r.v)}{r.v == null && r.why ? <span className="block text-[11px] font-normal text-muted-foreground">{r.why}</span> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            {hi
              ? 'ROA = शुद्ध लाभ ÷ (कुल परिसंपत्ति − प्रतिपक्ष − संचित हानि)। CAR = स्वामित्व निधि ÷ जोखिम-भारित परिसंपत्ति (Handbook का worksheet)। CD = कुल ऋण ÷ कुल जमा।'
              : 'ROA = net profit ÷ (total assets − contra − accumulated loss). CAR = owned funds ÷ risk-weighted assets (Handbook worksheet). CD = total loans ÷ total deposits.'}
            {ratios.rwaAssumptions.length > 0 && <>{' '}{hi ? 'जहाँ ledger में worksheet का बँटवारा नहीं है, वहाँ ऊँचा भार लिया गया है (CAR बढ़ा-चढ़ाकर नहीं दिखता): ' : 'Where the ledger lacks the worksheet\'s split, the higher weight is used (never flatters CAR): '}{ratios.rwaAssumptions.join('; ')}.</>}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
