import { useData } from '@/contexts/DataContext';
import { useLabourData } from '@/contexts/LabourDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollText, Printer } from 'lucide-react';

export default function AdvanceRegister() {
  const { society } = useData();
  const { workers, workerAdvances } = useLabourData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
  const workerName = (id: string) => workers.find(w => w.id === id)?.name || (hi ? 'अज्ञात' : 'Unknown');
  const workerCode = (id: string) => workers.find(w => w.id === id)?.workerCode || '';

  const rows = workerAdvances.filter(a => !a.isDeleted).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const tot = rows.reduce((t, a) => ({ amount: t.amount + (a.amount || 0), recovered: t.recovered + (a.recovered || 0) }), { amount: 0, recovered: 0 });
  const totBal = +(tot.amount - tot.recovered).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <style>{`@media print { body * { visibility: hidden !important; } #advance-register, #advance-register * { visibility: visible !important; } #advance-register { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; } .no-print { display: none !important; } }`}</style>

      <div className="flex items-center gap-3 no-print">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ScrollText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'अग्रिम रजिस्टर' : 'Advance Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'श्रमिक अग्रिम व वसूली का सांविधिक रजिस्टर (छपने-योग्य)' : 'Statutory register of worker advances & recovery (printable)'}</p>
        </div>
      </div>

      <div className="no-print">
        <Button onClick={() => window.print()} disabled={rows.length === 0}>
          <Printer className="h-4 w-4 mr-1" />{hi ? 'रजिस्टर प्रिंट करें' : 'Print Register'}
        </Button>
      </div>

      <Card id="advance-register">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-lg">{society?.name || (hi ? 'सहकारी समिति' : 'Cooperative Society')}</CardTitle>
          <p className="text-sm font-medium">{hi ? 'अग्रिम रजिस्टर' : 'Register of Advances'}</p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">{hi ? 'कोई अग्रिम दर्ज नहीं।' : 'No advances recorded.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="text-left font-medium px-2 py-2 w-8">#</th>
                    <th className="text-left font-medium px-2 py-2">{hi ? 'अग्रिम सं.' : 'Adv No'}</th>
                    <th className="text-left font-medium px-2 py-2">{hi ? 'श्रमिक' : 'Worker'}</th>
                    <th className="text-left font-medium px-2 py-2">{hi ? 'तिथि' : 'Date'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'अग्रिम' : 'Advance'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'वसूल' : 'Recovered'}</th>
                    <th className="text-right font-medium px-2 py-2">{hi ? 'बकाया' : 'Balance'}</th>
                    <th className="text-left font-medium px-2 py-2">{hi ? 'स्थिति' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-2">{a.advanceNo}</td>
                      <td className="px-2 py-2">{workerCode(a.workerId) ? `${workerCode(a.workerId)} · ` : ''}{workerName(a.workerId)}</td>
                      <td className="px-2 py-2">{a.date}</td>
                      <td className="px-2 py-2 text-right">{money(a.amount)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{money(a.recovered)}</td>
                      <td className="px-2 py-2 text-right font-medium">{money(+(a.amount - a.recovered).toFixed(2))}</td>
                      <td className="px-2 py-2">{a.status === 'cleared' ? (hi ? 'चुकता' : 'Cleared') : (hi ? 'बकाया' : 'Open')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-2 py-2" colSpan={4}>{hi ? 'कुल' : 'Total'} ({rows.length})</td>
                    <td className="px-2 py-2 text-right">{money(tot.amount)}</td>
                    <td className="px-2 py-2 text-right">{money(tot.recovered)}</td>
                    <td className="px-2 py-2 text-right">{money(totBal)}</td>
                    <td className="px-2 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground p-4 pt-8">
            <span>{hi ? 'तैयारकर्ता' : 'Prepared by'}: ____________</span>
            <span>{hi ? 'अधिकृत हस्ताक्षर' : 'Authorised signatory'}: ____________</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
