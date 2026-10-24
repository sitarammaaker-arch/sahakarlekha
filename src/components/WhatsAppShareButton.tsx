/**
 * WhatsAppShareButton — opens the staff member's own WhatsApp with the recipient's number and a
 * prefilled Hindi message (wa.me). Nothing is sent automatically; the user presses Send.
 *
 * When `getPdf` is given and the device can share files (phones, via the Web Share API), a menu also
 * offers "PDF के साथ" — the OS share sheet with the PDF attached (the contact is picked there; wa.me
 * cannot attach a file). Desktop browsers get the plain text link.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { WHATSAPP_ICON_PATHS, SocialIcon } from '@/lib/socials';
import { whatsappLink } from '@/lib/whatsappShare';
import { cn } from '@/lib/utils';

let fileShareSupport: boolean | undefined;
function canShareFiles(): boolean {
  if (fileShareSupport !== undefined) return fileShareSupport;
  try {
    fileShareSupport = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] });
  } catch {
    fileShareSupport = false;
  }
  return fileShareSupport;
}

interface Props {
  phone?: string;
  message: string;
  hi: boolean;
  /** Builds the PDF on demand (only called when the user picks "PDF के साथ"). */
  getPdf?: () => File | void;
  /** Icon-only, for table rows. */
  iconOnly?: boolean;
  className?: string;
}

export function WhatsAppShareButton({ phone, message, hi, getPdf, iconOnly, className }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const label = hi ? 'WhatsApp पर भेजें' : 'Send on WhatsApp';
  const href = whatsappLink(phone, message);
  const icon = <SocialIcon paths={WHATSAPP_ICON_PATHS} className="h-4 w-4" />;
  const btnProps = iconOnly
    ? { variant: 'ghost' as const, size: 'icon' as const, className: cn('h-9 w-9 text-[#1ebe57] hover:bg-green-50', className) }
    : { variant: 'outline' as const, size: 'sm' as const, className: cn('gap-1 print:hidden', className) };

  if (!getPdf || !canShareFiles()) {
    return (
      <Button asChild {...btnProps} title={label} aria-label={label}>
        <a href={href} target="_blank" rel="noopener noreferrer">{icon}{!iconOnly && label}</a>
      </Button>
    );
  }

  const sharePdf = async () => {
    setBusy(true);
    try {
      const file = getPdf();
      if (!file) throw new Error('no pdf');
      await navigator.share({ files: [file], text: message });
    } catch (e) {
      // The user closing the share sheet is not an error.
      if ((e as Error)?.name !== 'AbortError') {
        toast({
          title: hi ? 'PDF share नहीं हो सकी' : 'Could not share the PDF',
          description: hi ? '"सिर्फ़ संदेश" से भेजें, या PDF download करके भेजें।' : 'Send the message only, or download the PDF and send it.',
          variant: 'destructive', duration: 10000,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button {...btnProps} title={label} aria-label={label} disabled={busy}>{icon}{!iconOnly && label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">{hi ? 'सिर्फ़ संदेश (नंबर पहले से भरा)' : 'Message only (number filled in)'}</a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { void sharePdf(); }}>
          {hi ? 'PDF के साथ (contact ख़ुद चुनें)' : 'With PDF (pick the contact)'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
