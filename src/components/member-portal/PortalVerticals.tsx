/**
 * Member Portal S4b — the member's dairy / housing / consumer sections. Pure presentation of
 * buildVerticalViews (lib/memberPortalVerticals), which runs the staff functions. A section renders
 * only when the member has data in that vertical.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate } from '@/lib/dateUtils';
import type { VerticalViews, DistributionItem } from '@/lib/memberPortalVerticals';

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtyFmt = (n: number) => (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Distributions({ items, hi, title }: { items: DistributionItem[]; hi: boolean; title: string }) {
  if (!items.length) return null;
  const kindLabel = (k: string) => (hi
    ? ({ bonus: 'बोनस', dividend: 'लाभांश', patronage: 'संरक्षण छूट (patronage)' } as Record<string, string>)[k]
    : ({ bonus: 'Bonus', dividend: 'Dividend', patronage: 'Patronage rebate' } as Record<string, string>)[k]) ?? k;
  return (
    <div className="overflow-x-auto">
      <p className="text-sm font-medium mb-1">{title}</p>
      <Table>
        <TableHeader><TableRow>
          <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead><TableHead>{hi ? 'अवधि' : 'Period'}</TableHead>
          <TableHead className="text-right">{hi ? 'आधार' : 'Base'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{items.map((d) => (
          <TableRow key={d.id}>
            <TableCell>{kindLabel(d.kind)}</TableCell><TableCell>{d.period || '—'}</TableCell>
            <TableCell className="text-right">{qtyFmt(d.base)}</TableCell><TableCell className="text-right font-semibold">{money(d.amount)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

export function PortalVerticals({ views, hi }: { views: VerticalViews; hi: boolean }) {
  const { dairy, housing, consumer } = views;
  return (
    <>
      {dairy && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'दूध का हिसाब' : 'Milk account'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={hi ? 'भुगतान बाकी' : 'Payment due'} value={money(dairy.passbook.totalOutstanding)} />
              <Stat label={hi ? 'कुल भुगतान मिला' : 'Total paid'} value={money(dairy.passbook.totalPaid)} />
              <Stat label={hi ? `दूध (${dairy.milkFrom ? fmtDate(dairy.milkFrom) + ' से' : 'इस वर्ष'})` : `Milk (since ${dairy.milkFrom ? fmtDate(dairy.milkFrom) : 'this year'})`} value={`${qtyFmt(dairy.passbook.totalQty)} ${hi ? 'लीटर' : 'L'}`} />
              <Stat label={hi ? 'आहार/आदान बाकी' : 'Inputs due'} value={money(dairy.inputs.outstanding)} />
            </div>

            {dairy.passbook.settlements.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-sm font-medium mb-1">{hi ? 'भुगतान चक्र' : 'Payment cycles'}</p>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'अवधि' : 'Period'}</TableHead><TableHead className="text-right">{hi ? 'कुल' : 'Gross'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कटौती' : 'Deductions'}</TableHead><TableHead className="text-right">{hi ? 'देय' : 'Net'}</TableHead>
                    <TableHead className="text-right">{hi ? 'मिला' : 'Paid'}</TableHead><TableHead className="text-right">{hi ? 'बाकी' : 'Due'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{[...dairy.passbook.settlements].reverse().map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(s.from)} – {fmtDate(s.to)}</TableCell>
                      <TableCell className="text-right">{money(s.gross)}</TableCell>
                      <TableCell className="text-right">{money(s.gross - s.netPayable)}</TableCell>
                      <TableCell className="text-right">{money(s.netPayable)}</TableCell>
                      <TableCell className="text-right">{money(s.amountPaid)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(Math.max(0, s.netPayable - s.amountPaid))}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}

            {dairy.passbook.collections.length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {hi ? `दूध की entries (${dairy.passbook.collections.length})` : `Milk entries (${dairy.passbook.collections.length})`}
                </summary>
                <div className="overflow-x-auto mt-2">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'पाली' : 'Shift'}</TableHead>
                      <TableHead className="text-right">{hi ? 'लीटर' : 'Litres'}</TableHead><TableHead className="text-right">Fat</TableHead>
                      <TableHead className="text-right">SNF</TableHead><TableHead className="text-right">{hi ? 'दर' : 'Rate'}</TableHead>
                      <TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{[...dairy.passbook.collections].reverse().map((e, i) => (
                      <TableRow key={`${e.date}-${e.shift}-${i}`}>
                        <TableCell className="whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                        <TableCell>{hi ? (e.shift === 'morning' ? 'सुबह' : 'शाम') : e.shift}</TableCell>
                        <TableCell className="text-right">{qtyFmt(e.qty)}</TableCell><TableCell className="text-right">{e.fat}</TableCell>
                        <TableCell className="text-right">{e.snf}</TableCell><TableCell className="text-right">{money(e.rate)}</TableCell>
                        <TableCell className="text-right">{money(e.amount)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </details>
            )}

            {dairy.inputIssues.length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {hi ? `आहार/आदान उधार (${dairy.inputIssues.length}) · वसूल ${money(dairy.inputs.recovered)}` : `Inputs on credit (${dairy.inputIssues.length}) · recovered ${money(dairy.inputs.recovered)}`}
                </summary>
                <div className="overflow-x-auto mt-2">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'वस्तु' : 'Item'}</TableHead>
                      <TableHead className="text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead><TableHead className="text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{dairy.inputIssues.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(i.date)}</TableCell><TableCell>{i.itemName || i.inputType}</TableCell>
                        <TableCell className="text-right">{i.qty != null ? qtyFmt(i.qty) : '—'}</TableCell><TableCell className="text-right">{money(i.amount)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </details>
            )}

            <Distributions items={dairy.distributions} hi={hi} title={hi ? 'बोनस / लाभांश (स्वीकृत)' : 'Bonus / dividend (approved)'} />
          </CardContent>
        </Card>
      )}

      {housing && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'रखरखाव (Maintenance)' : 'Maintenance'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {housing.flats.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {hi ? 'फ़्लैट:' : 'Flat:'} {/* Same label as the staff Member Statement: "flatNo · blockNo". */}
                {housing.flats.map((f) => `${f.flatNo}${f.blockNo ? ` · ${f.blockNo}` : ''}`).join(', ')}
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={hi ? 'चालू बकाया' : 'Outstanding'} value={money(housing.statement.outstanding)} />
              <Stat label={hi ? 'कुल माँग' : 'Demanded'} value={money(housing.statement.totalDemanded)} />
              <Stat label={hi ? 'ब्याज' : 'Interest'} value={money(housing.statement.totalInterest)} />
              <Stat label={hi ? 'कुल जमा किया' : 'Paid'} value={money(housing.statement.totalReceived)} />
            </div>
            {housing.statement.rows.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    <TableHead className="text-right">{hi ? 'माँग' : 'Debit'}</TableHead><TableHead className="text-right">{hi ? 'जमा' : 'Credit'}</TableHead>
                    <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{housing.statement.rows.map((r, i) => (
                    <TableRow key={`${r.ref}-${i}`}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell><TableCell>{r.particulars}</TableCell>
                      <TableCell className="text-right">{r.debit ? money(r.debit) : '—'}</TableCell>
                      <TableCell className="text-right">{r.credit ? money(r.credit) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{money(r.balance)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {consumer && (
        <Card>
          <CardHeader><CardTitle className="text-base">{hi ? 'दुकान का उधार' : 'Store credit'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label={hi ? 'कुल उधार बाकी' : 'Outstanding'} value={money(consumer.outstanding)} />
              <Stat label={hi ? '0–30 दिन' : '0–30 days'} value={money(consumer.ageing.b0_30)} />
              <Stat label={hi ? '31–60 दिन' : '31–60 days'} value={money(consumer.ageing.b31_60)} />
              <Stat label={hi ? '61–90 दिन' : '61–90 days'} value={money(consumer.ageing.b61_90)} />
              <Stat label={hi ? '90+ दिन' : '90+ days'} value={money(consumer.ageing.b90plus)} />
            </div>
            {consumer.ledger.length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">{hi ? `उधार खाता (${consumer.ledger.length})` : `Credit ledger (${consumer.ledger.length})`}</summary>
                <div className="overflow-x-auto mt-2">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead><TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead><TableHead>{hi ? 'संदर्भ' : 'Ref'}</TableHead>
                      <TableHead className="text-right">{hi ? 'उधार' : 'Debit'}</TableHead><TableHead className="text-right">{hi ? 'जमा' : 'Credit'}</TableHead>
                      <TableHead className="text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{consumer.ledger.map((r, i) => (
                      <TableRow key={`${r.ref}-${i}`}>
                        <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                        <TableCell>{hi
                          ? ({ sale: 'उधार बिक्री', recovery: 'वसूली', return: 'बिक्री वापसी' } as Record<string, string>)[r.kind]
                          : ({ sale: 'Credit sale', recovery: 'Recovery', return: 'Sales return' } as Record<string, string>)[r.kind]}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                        <TableCell className="text-right">{r.dr ? money(r.dr) : '—'}</TableCell>
                        <TableCell className="text-right">{r.cr ? money(r.cr) : '—'}</TableCell>
                        <TableCell className="text-right font-semibold">{money(r.balance)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </details>
            )}
            <Distributions items={consumer.distributions} hi={hi} title={hi ? 'संरक्षण छूट / लाभांश (स्वीकृत)' : 'Patronage rebate / dividend (approved)'} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
