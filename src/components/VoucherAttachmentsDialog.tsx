/**
 * Bill copies kept with one voucher (migration 207): list, open (10-minute link), add, remove (soft — the file stays
 * for the audit trail). The parent passes guardPageWrite so the same refusals as any edit apply (role, FY lock,
 * period lock, offline); a cancelled voucher's bills can be opened but not changed.
 */
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Paperclip, ExternalLink, Trash2, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Voucher, VoucherAttachment } from '@/types';
import { ATTACHMENT_ACCEPT, formatBytes } from '@/lib/voucherAttachments';
import { uploadVoucherAttachment, openVoucherAttachment, removeVoucherAttachment } from '@/lib/voucherAttachmentsClient';
import { fmtDate } from '@/lib/dateUtils';

export function VoucherAttachmentsDialog(props: {
  voucher: Pick<Voucher, 'id' | 'voucherNo' | 'date' | 'isDeleted'> | null;
  attachments: VoucherAttachment[];
  societyId: string;
  userName?: string;
  hi: boolean;
  guardWrite: (date: string) => boolean;   // true = refused (it has already said why)
  onAdded: (row: VoucherAttachment) => void;
  onRemoved: (id: string) => void;
  onClose: () => void;
}) {
  const { voucher, attachments, societyId, userName, hi, guardWrite, onAdded, onRemoved, onClose } = props;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readOnly = !!voucher?.isDeleted;

  const add = async (files: FileList | null) => {
    if (!voucher || !files?.length) return;
    if (guardWrite(voucher.date)) return;
    setBusy(true);
    let added = 0;
    for (const file of Array.from(files)) {
      const r = await uploadVoucherAttachment({ societyId, voucherId: voucher.id, file, by: userName });
      if (r.ok) { onAdded(r.row); added++; }
      else toast({ title: `${file.name}: ${hi ? 'नहीं जुड़ा' : 'not added'}`, description: r.error, variant: 'destructive', duration: 10000 });
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (added) toast({ title: hi ? `${added} बिल जुड़ा` : `${added} bill(s) added`, description: voucher.voucherNo });
  };

  const open = async (a: VoucherAttachment) => {
    // Open the tab first (inside the click), then point it at the link — a pop-up blocker allows that.
    const w = window.open('', '_blank');
    const url = await openVoucherAttachment(a.path);
    if (url && w) { w.location.href = url; return; }
    w?.close();
    toast({ title: hi ? 'बिल नहीं खुला' : 'Could not open the bill', variant: 'destructive' });
  };

  const remove = async (a: VoucherAttachment) => {
    if (!voucher || guardWrite(voucher.date)) return;
    if (!window.confirm(hi ? `"${a.fileName || 'बिल'}" हटाएँ? (ऑडिट रिकॉर्ड में फ़ाइल बनी रहेगी)` : `Remove "${a.fileName || 'bill'}"? (the file stays in the audit record)`)) return;
    setBusy(true);
    const err = await removeVoucherAttachment(a.id, userName);
    setBusy(false);
    if (err) { toast({ title: hi ? 'नहीं हटा' : 'Not removed', description: err, variant: 'destructive', duration: 10000 }); return; }
    onRemoved(a.id);
  };

  return (
    <Dialog open={!!voucher} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Paperclip className="h-5 w-5" />{hi ? 'बिल की कॉपी' : 'Bill copies'} — {voucher?.voucherNo}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? (hi ? 'यह वाउचर रद्द है — बिल देखे जा सकते हैं, बदले नहीं।' : 'This voucher is cancelled — its bills can be opened, not changed.')
              : (hi ? 'बिल की फ़ोटो (फ़ोन से सीधे) या PDF जोड़ें। फ़ोटो अपने-आप छोटी हो जाती है; PDF 5 MB तक।' : 'Add a photo of the bill (straight from the phone) or a PDF. Photos are shrunk automatically; PDFs up to 5 MB.')}
          </DialogDescription>
        </DialogHeader>

        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{hi ? 'अभी कोई बिल नहीं जुड़ा।' : 'No bill added yet.'}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {attachments.map(a => (
              <li key={a.id} className="flex items-center gap-2 p-2 text-sm">
                {a.mimeType === 'application/pdf' ? <FileText className="h-4 w-4 shrink-0 text-red-600" /> : <ImageIcon className="h-4 w-4 shrink-0 text-blue-600" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.fileName || (hi ? 'बिल' : 'Bill')}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(a.sizeBytes)} · {fmtDate(a.uploadedAt.slice(0, 10))}{a.uploadedBy ? ` · ${a.uploadedBy}` : ''}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => open(a)} disabled={busy}><ExternalLink className="h-3.5 w-3.5" />{hi ? 'देखें' : 'Open'}</Button>
                {!readOnly && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a)} disabled={busy} aria-label={hi ? 'हटाएँ' : 'Remove'}><Trash2 className="h-4 w-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={e => add(e.target.files)} />
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1">
              <Upload className="h-4 w-4" />{busy ? (hi ? 'जुड़ रहा है…' : 'Adding…') : (hi ? 'बिल जोड़ें' : 'Add bill')}
            </Button>
            <Button variant="outline" onClick={onClose}>{hi ? 'बंद करें' : 'Close'}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
