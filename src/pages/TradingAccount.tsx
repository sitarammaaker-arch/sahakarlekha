import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateTradingAccountPDF } from '@/lib/pdf';
import { useToast } from '@/hooks/use-toast';

const TradingAccount: React.FC = () => {
  const { language } = useLanguage();
  const { getTradingAccount, postClosingStock, society } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';

  const fmt = (n: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

  const {
    salesItems, closingStockItems,
    openingStockItems, purchaseItems, directExpItems,
    totalSales, totalClosingStock,
    totalOpeningStock, totalPurchases, totalDirectExp,
    grossProfit, physicalClosingStock, closingStockPosted,
    activities, unallocated,
  } = getTradingAccount();

  const hasUnallocated =
    Math.abs(unallocated.purchases) > 0.005 ||
    Math.abs(unallocated.directExp) > 0.005 ||
    Math.abs(unallocated.otherSales) > 0.005;

  const handlePostClosingStock = () => {
    const result = postClosingStock();
    if (result.alreadyPosted) {
      toast({ title: hi ? 'समापन माल पहले से पोस्ट है' : 'Closing stock already posted' });
    } else if (result.posted) {
      toast({ title: hi ? `समापन माल जर्नल पोस्ट: ${fmt(result.amount)}` : `Closing stock posted: ${fmt(result.amount)}` });
    } else {
      toast({ title: hi ? 'माल भंडार शून्य है' : 'Stock inventory is zero', variant: 'destructive' });
    }
  };

  const isProfit   = grossProfit >= 0;
  const crTotal    = totalSales + totalClosingStock + (isProfit ? 0 : Math.abs(grossProfit));
  const drTotal    = totalOpeningStock + totalPurchases + totalDirectExp + (isProfit ? grossProfit : 0);
  const grandTotal = Math.max(crTotal, drTotal);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-primary" />
            {hi ? 'व्यापार खाता' : 'Trading Account'}
          </h1>
          <p className="text-muted-foreground">
            {hi
              ? `वित्तीय वर्ष ${society.financialYear} के लिए`
              : `For the Financial Year ${society.financialYear}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {physicalClosingStock > 0 && !closingStockPosted && (
            <Button
              size="sm"
              className="gap-2 bg-amber-600 hover:bg-amber-700"
              onClick={handlePostClosingStock}
              title={hi ? 'समापन माल जर्नल पोस्ट करें (Dr 3403 / Cr 5150)' : 'Post closing stock journal (Dr 3403 / Cr 5150)'}
            >
              <AlertTriangle className="h-4 w-4" />
              {hi ? `समापन माल पोस्ट करें (${fmt(physicalClosingStock)})` : `Post Closing Stock (${fmt(physicalClosingStock)})`}
            </Button>
          )}
          {closingStockPosted && (
            <span className="flex items-center gap-1 text-xs text-green-700 font-medium px-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {hi ? 'समापन माल पोस्ट है' : 'Closing stock posted'}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => generateTradingAccountPDF(
              {
                salesItems:        salesItems.map(i => ({ name: i.name, amount: i.amount })),
                closingStockItems: closingStockItems.map(i => ({ name: i.name, amount: i.amount })),
                openingStockItems: openingStockItems.map(i => ({ name: i.name, amount: i.amount })),
                purchaseItems:     purchaseItems.map(i => ({ name: i.name, amount: i.amount })),
                directExpItems:    directExpItems.map(i => ({ name: i.name, amount: i.amount })),
                totalSales, totalClosingStock, totalOpeningStock, totalPurchases, totalDirectExp,
                grossProfit,
              },
              society
            )}
          >
            <Download className="h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल बिक्री' : 'Total Sales'}</p>
            <p className="text-2xl font-bold text-success">{fmt(totalSales)}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल क्रय + प्रत्यक्ष व्यय' : 'Purchases + Direct Expenses'}</p>
            <p className="text-2xl font-bold text-destructive">{fmt(totalPurchases + totalDirectExp)}</p>
          </CardContent>
        </Card>
        <Card className={cn('border-2', isProfit ? 'bg-success/20 border-success' : 'bg-destructive/20 border-destructive')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isProfit
                    ? (hi ? 'सकल लाभ (Gross Profit)' : 'Gross Profit')
                    : (hi ? 'सकल हानि (Gross Loss)' : 'Gross Loss')}
                </p>
                <p className={cn('text-2xl font-bold', isProfit ? 'text-success' : 'text-destructive')}>
                  {fmt(Math.abs(grossProfit))}
                </p>
              </div>
              {isProfit
                ? <TrendingUp className="h-8 w-8 text-success/50" />
                : <TrendingDown className="h-8 w-8 text-destructive/50" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Note */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {hi
              ? '📋 व्यापार खाता केवल व्यापारिक आय (बिक्री) और प्रत्यक्ष व्यय दिखाता है। सकल लाभ/हानि आय-व्यय खाते में स्थानांतरित होता है।'
              : '📋 Trading Account shows only trading income (sales) and direct expenses. Gross Profit/Loss is transferred to Income & Expenditure Account.'}
          </p>
        </CardContent>
      </Card>

      {/* T-Account Format */}
      <Card className="shadow-card">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-xl">{hi ? 'व्यापार खाता' : 'Trading Account'}</CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
          <p className="text-sm text-muted-foreground">
            {hi
              ? `वित्तीय वर्ष ${society.financialYear} के लिए`
              : `For the Financial Year ${society.financialYear}`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Dr side — Left */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive pb-2 border-b">
                {hi ? 'नाम (Dr)' : 'Debit (Dr)'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    <TableHead className="text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Stock */}
                  {openingStockItems.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground" colSpan={2}>
                          {hi ? 'प्रारंभिक स्टॉक' : 'Opening Stock'}
                        </TableCell>
                      </TableRow>
                      {openingStockItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6 text-sm">{hi ? item.nameHi : item.name}</TableCell>
                          <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell className="pl-6">{hi ? 'कुल प्रारंभिक स्टॉक' : 'Total Opening Stock'}</TableCell>
                        <TableCell className="text-right">{fmt(totalOpeningStock)}</TableCell>
                      </TableRow>
                    </>
                  )}

                  {/* Purchases */}
                  {purchaseItems.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground" colSpan={2}>
                          {hi ? 'क्रय' : 'Purchases'}
                        </TableCell>
                      </TableRow>
                      {purchaseItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6 text-sm">{hi ? item.nameHi : item.name}</TableCell>
                          <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Direct Expenses */}
                  {directExpItems.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground" colSpan={2}>
                          {hi ? 'प्रत्यक्ष व्यय' : 'Direct Expenses'}
                        </TableCell>
                      </TableRow>
                      {directExpItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6 text-sm">{hi ? item.nameHi : item.name}</TableCell>
                          <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Gross Profit transferred to I&E */}
                  {isProfit && grossProfit > 0 && (
                    <TableRow className="bg-success/10 font-semibold">
                      <TableCell className="text-success">
                        {hi ? 'सकल लाभ (आय-व्यय खाते में)' : 'Gross Profit (to I&E Account)'}
                      </TableCell>
                      <TableCell className="text-right text-success">{fmt(grossProfit)}</TableCell>
                    </TableRow>
                  )}

                  {/* Empty state */}
                  {openingStockItems.length === 0 && purchaseItems.length === 0 && directExpItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        {hi ? 'कोई प्रविष्टि नहीं' : 'No entries'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Grand Total */}
                  <TableRow className="bg-primary/10 font-bold text-base">
                    <TableCell>{hi ? 'कुल योग' : 'Grand Total'}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Cr side — Right */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-success pb-2 border-b">
                {hi ? 'जमा (Cr)' : 'Credit (Cr)'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'विवरण' : 'Particulars'}</TableHead>
                    <TableHead className="text-right">{hi ? 'राशि (₹)' : 'Amount (₹)'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Sales */}
                  {salesItems.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground" colSpan={2}>
                          {hi ? 'बिक्री (Trading Income)' : 'Sales (Trading Income)'}
                        </TableCell>
                      </TableRow>
                      {salesItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6 text-sm">{hi ? item.nameHi : item.name}</TableCell>
                          <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell className="pl-6">{hi ? 'कुल बिक्री' : 'Total Sales'}</TableCell>
                        <TableCell className="text-right">{fmt(totalSales)}</TableCell>
                      </TableRow>
                    </>
                  )}

                  {/* Closing Stock */}
                  {closingStockItems.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground" colSpan={2}>
                          {hi ? 'अंतिम स्टॉक' : 'Closing Stock'}
                        </TableCell>
                      </TableRow>
                      {closingStockItems.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6 text-sm">{hi ? item.nameHi : item.name}</TableCell>
                          <TableCell className="text-right">{fmt(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell className="pl-6">{hi ? 'कुल अंतिम स्टॉक' : 'Total Closing Stock'}</TableCell>
                        <TableCell className="text-right">{fmt(totalClosingStock)}</TableCell>
                      </TableRow>
                    </>
                  )}

                  {/* Gross Loss transferred to I&E */}
                  {!isProfit && (
                    <TableRow className="bg-destructive/10 font-semibold">
                      <TableCell className="text-destructive">
                        {hi ? 'सकल हानि (आय-व्यय खाते में)' : 'Gross Loss (to I&E Account)'}
                      </TableCell>
                      <TableCell className="text-right text-destructive">{fmt(Math.abs(grossProfit))}</TableCell>
                    </TableRow>
                  )}

                  {/* Empty state */}
                  {salesItems.length === 0 && closingStockItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        {hi ? 'कोई बिक्री प्रविष्टि नहीं' : 'No sales entries'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Grand Total */}
                  <TableRow className="bg-primary/10 font-bold text-base">
                    <TableCell>{hi ? 'कुल योग' : 'Grand Total'}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Signature row */}
          <div className="mt-8 pt-8 border-t grid grid-cols-3 gap-4 text-center text-sm">
            {[
              hi ? 'लेखाकार' : 'Accountant',
              hi ? 'सचिव' : 'Secretary',
              hi ? 'अध्यक्ष' : 'Chairman',
            ].map(label => (
              <div key={label}>
                <div className="h-16 border-b border-dashed border-muted-foreground/30 mb-2" />
                <p className="font-medium">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit C-7: Activity-wise Trading (NCDC Annexure V) */}
      {(activities.length > 0 || hasUnallocated) && (
        <Card className="shadow-card">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">{hi ? 'गतिविधि-वार व्यापार खाता (NCDC अनुलग्नक V)' : 'Activity-wise Trading Account (NCDC Annexure V)'}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {hi
                ? 'सकल मार्जिन = बिक्री − क्रय (समापन-स्टॉक समायोजन संयुक्त खाते में रहता है)। जिस गतिविधि की खरीद किसी खाते से नहीं जुड़ी, वह नीचे "अनावंटित" में दिखती है।'
                : 'Gross Margin = Sales − Purchases (closing-stock adjustment stays in the combined statement). Purchases not routed to an activity head appear under "Unallocated" below.'}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{hi ? 'गतिविधि' : 'Activity'}</TableHead>
                    <TableHead className="font-semibold text-right">{hi ? 'बिक्री' : 'Sales'}</TableHead>
                    <TableHead className="font-semibold text-right">{hi ? 'क्रय' : 'Purchases'}</TableHead>
                    <TableHead className="font-semibold text-right">{hi ? 'सकल मार्जिन' : 'Gross Margin'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map(a => (
                    <TableRow key={a.salesId} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{hi ? a.keyHi : a.key}</TableCell>
                      <TableCell className="text-right">{a.sales > 0 ? fmt(a.sales) : '—'}</TableCell>
                      <TableCell className="text-right">{a.hasRoutedPurchase ? fmt(a.purchases) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {a.hasRoutedPurchase
                          ? <span className={a.grossMargin >= 0 ? 'text-success' : 'text-destructive'}>{fmt(a.grossMargin)}</span>
                          : <span className="text-[11px] text-amber-600">{hi ? 'खरीद अनावंटित' : 'purchases unrouted'}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {hasUnallocated && (
                    <TableRow className="bg-amber-50 dark:bg-amber-900/20">
                      <TableCell className="font-medium text-amber-800 dark:text-amber-300">
                        {hi ? 'अनावंटित (सामान्य 5101 + प्रत्यक्ष व्यय)' : 'Unallocated (generic 5101 + direct exp.)'}
                      </TableCell>
                      <TableCell className="text-right">{Math.abs(unallocated.otherSales) > 0.005 ? fmt(unallocated.otherSales) : '—'}</TableCell>
                      <TableCell className="text-right">{fmt(unallocated.purchases + unallocated.directExp)}</TableCell>
                      <TableCell className="text-right text-[11px] text-amber-600">{hi ? 'items को खाता दें' : 'route items'}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {hi
                ? '➡ सही per-activity लाभ के लिए Inventory में हर वस्तु का "Purchase A/c" उसकी गतिविधि पर सेट करें — फिर नई खरीद उसी खाते में जाएगी।'
                : '➡ For accurate per-activity profit, set each item\'s "Purchase A/c" to its activity in Inventory — new purchases then post to that head.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TradingAccount;
