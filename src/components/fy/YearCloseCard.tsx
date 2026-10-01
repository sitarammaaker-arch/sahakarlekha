import React, { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { closeFyMessage, fyEndOf, closingStockMinorFor } from '@/lib/fyClose';

interface ClosingYear { fy_label: string; end_date: string }

/**
 * Phase-2 C (decisions D1–D4) — close a financial year that is 'closing' (rolled over, migration 090).
 * The server (close_financial_year, migration 091) checks, posts the closing-stock journal and the
 * year-transfer into 1208, and marks the year closed — one transaction. This card shows what will
 * happen (surplus, closing stock), takes the board-resolution reference (D4) and calls it.
 */
export const YearCloseCard: React.FC = () => {
  const { society, getProfitLoss, getTradingAccount } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const [years, setYears] = useState<ClosingYear[]>([]);
  const [authority, setAuthority] = useState('');
  const [confirm, setConfirm] = useState<ClosingYear | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    supabase.from('financial_years').select('fy_label, end_date').eq('status', 'closing').order('start_date')
      .then(({ data }) => setYears((data as ClosingYear[] | null) ?? []), () => setYears([]));
  }, []);
  useEffect(() => { load(); }, [load, society.financialYear]);

  if (user?.role !== 'admin' || years.length === 0) return null;

  const preview = (y: ClosingYear) => {
    const end = fyEndOf(y.fy_label) ?? y.end_date;
    let surplus = 0; let stockMinor: number | null = null;
    try { surplus = getProfitLoss(end).netProfit || 0; } catch { surplus = 0; }
    try { stockMinor = closingStockMinorFor(getTradingAccount(end)); } catch { stockMinor = null; }
    return { end, surplus, stockMinor };
  };

  const doClose = async (y: ClosingYear) => {
    setBusy(true);
    const { stockMinor } = preview(y);
    const { data, error } = await supabase.rpc('close_financial_year', { p_fy_label: y.fy_label, p_authority: authority.trim(), p_closing_stock_minor: stockMinor });
    setBusy(false);
    setConfirm(null);
    if (error) {
      toast({ title: hi ? `वर्ष ${y.fy_label} close नहीं हुआ` : `FY ${y.fy_label} not closed`, description: closeFyMessage(error.message), variant: 'destructive', duration: 15000 });
      return;
    }
    const r = data as { netResultMinor?: number } | null;
    toast({
      title: hi ? `✅ वर्ष ${y.fy_label} close हो गया` : `✅ FY ${y.fy_label} closed`,
      description: hi
        ? `परिणाम ₹${((r?.netResultMinor ?? 0) / 100).toLocaleString('en-IN')} "शुद्ध अधिशेष" (1208) में गया। पेज refresh हो रहा है…`
        : `Result ₹${((r?.netResultMinor ?? 0) / 100).toLocaleString('en-IN')} moved to Net Surplus (1208). Refreshing…`,
      duration: 8000,
    });
    setTimeout(() => window.location.reload(), 2500);   // the two server vouchers must load into the app
  };

  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-4 space-y-3">
      {years.map(y => {
        const p = preview(y);
        return (
          <div key={y.fy_label} className="space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />
              {hi ? `वर्ष ${y.fy_label} "closing" है — close करें` : `FY ${y.fy_label} is closing — close it`}
            </div>
            <p className="text-sm text-muted-foreground">
              {hi
                ? `close करने पर: आय-व्यय का परिणाम ₹${p.surplus.toLocaleString('en-IN')} "शुद्ध अधिशेष" (1208) में जाएगा${p.stockMinor !== null ? `, समापन माल ₹${(p.stockMinor / 100).toLocaleString('en-IN')} खाते में दर्ज होगा` : ''}, और ${y.fy_label} में आगे कोई entry नहीं होगी (सुधार नए वर्ष में नए वाउचर से)।`
                : `On close: the result ₹${p.surplus.toLocaleString('en-IN')} moves to Net Surplus (1208)${p.stockMinor !== null ? `, closing stock ₹${(p.stockMinor / 100).toLocaleString('en-IN')} is booked` : ''}, and ${y.fy_label} takes no more entries (corrections go in the new year).`}
            </p>
            <div className="space-y-1">
              <Label htmlFor={`fy-auth-${y.fy_label}`}>{hi ? 'बोर्ड प्रस्ताव का हवाला (संख्या व तिथि)' : 'Board resolution reference (no. & date)'}</Label>
              <Input id={`fy-auth-${y.fy_label}`} value={authority} onChange={e => setAuthority(e.target.value)} placeholder={hi ? 'जैसे: प्रस्ताव सं. 12 दिनांक 10-04-2027' : 'e.g. Resolution 12 dated 10-04-2027'} />
            </div>
            <Button size="sm" disabled={busy || authority.trim().length < 5} onClick={() => setConfirm(y)}>
              {hi ? `वर्ष ${y.fy_label} close करें` : `Close FY ${y.fy_label}`}
            </Button>
          </div>
        );
      })}
      <AlertDialog open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? `वर्ष ${confirm?.fy_label} close करें?` : `Close FY ${confirm?.fy_label}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {hi ? 'यह स्थायी है: close होने के बाद इस वर्ष में कोई entry, बदलाव या cancel नहीं होगा।' : 'This is permanent: after closing, the year takes no entries, edits or cancellations.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{hi ? 'रुकें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); if (confirm) void doClose(confirm); }}>
              {hi ? 'हाँ, close करें' : 'Yes, close'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
