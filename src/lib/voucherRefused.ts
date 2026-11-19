/**
 * X-1 (product audit 2026-11-17): a domain record (bill, settlement, payment, return…) is written ONLY in the
 * voucher's onSaved. When the server refuses the voucher late (closed year, period lock, permission) DataContext has
 * already rolled the voucher back and shown the server's reason; the domain screen adds this one line so the operator
 * knows the record itself was not made either. One wording for Housing, Dairy, Consumer and Labour.
 */
import { tr } from '@/lib/uiLang';

type ToastFn = (t: { title: string; description?: string; variant?: 'default' | 'destructive'; duration?: number }) => unknown;

/** X-1: a second click while the first save is still with the server. */
export function inFlightToast(toast: ToastFn): void {
  toast({
    title: tr('पिछला अभी सेव हो रहा है', 'The previous save is still in progress'),
    description: tr('सर्वर का जवाब आने दें — फिर ज़रूरत हो तो दोबारा करें।', 'Let the server answer first — then try again if needed.'),
    variant: 'destructive',
    duration: 6000,
  });
}

export function voucherRefusedToast(toast: ToastFn, title: string): void {
  toast({
    title,
    description: tr(
      'सर्वर ने इसका वाउचर स्वीकार नहीं किया (बंद वर्ष / अवधि-लॉक / अनुमति), इसलिए यह रिकॉर्ड भी दर्ज नहीं हुआ। कारण ऊपर की सूचना में है — ठीक करके दोबारा करें।',
      'The server did not accept its voucher (closed year / period lock / permission), so this record was not made either. The reason is in the message above — fix it and try again.',
    ),
    variant: 'destructive',
    duration: 12000,
  });
}
