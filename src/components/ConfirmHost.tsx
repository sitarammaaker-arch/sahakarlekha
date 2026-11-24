/**
 * Draws the request at the head of lib/confirmAction's queue as the app's own AlertDialog — the in-page answer to
 * window.confirm / prompt / alert (which never show in the desktop app's browser pane). Mounted once, in App.
 */
import { useEffect, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { answerConfirm, subscribeConfirm, type ConfirmRequest } from '@/lib/confirmAction';

export function ConfirmHost() {
  const [queue, setQueue] = useState<readonly ConfirmRequest[]>([]);
  const [text, setText] = useState('');
  useEffect(() => subscribeConfirm(setQueue), []);
  const req = queue[0];
  useEffect(() => { setText(req?.defaultValue ?? ''); }, [req?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!req) return null;
  const cancelValue = req.kind === 'prompt' ? null : req.kind === 'notice' ? true : false;
  const ok = () => answerConfirm(req.id, req.kind === 'prompt' ? text.trim() : true);
  const okDisabled = req.kind === 'prompt' && req.requireValue && !text.trim();

  return (
    <AlertDialog open onOpenChange={o => { if (!o) answerConfirm(req.id, cancelValue); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="whitespace-pre-line">{req.title}</AlertDialogTitle>
          {req.description && <AlertDialogDescription className="whitespace-pre-line">{req.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {req.kind === 'prompt' && (
          <div className="space-y-1.5">
            {req.label && <Label htmlFor="confirm-host-input">{req.label}</Label>}
            <Input id="confirm-host-input" autoFocus value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !okDisabled) { e.preventDefault(); ok(); } }} />
          </div>
        )}
        <AlertDialogFooter>
          {req.kind !== 'notice' && <AlertDialogCancel onClick={() => answerConfirm(req.id, cancelValue)}>{req.cancelLabel}</AlertDialogCancel>}
          <AlertDialogAction
            disabled={okDisabled}
            className={cn(req.destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            onClick={e => { e.preventDefault(); ok(); }}
          >
            {req.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
