/**
 * In-page replacements for window.confirm / window.prompt / window.alert.
 *
 * The native dialogs never show in the Claude desktop app's browser pane, nor in some phone browsers — they answer
 * "no" / null at once, so a delete button silently did nothing (live check 2026-11-24, voucher bill copies). These
 * return a Promise answered by <ConfirmHost/> (mounted once in App), which draws the app's own AlertDialog.
 *
 *   if (!(await confirmAction(hi ? 'हटाएँ?' : 'Delete?'))) return;
 *   const reason = await promptAction({ title: 'Cancel this lot?', label: 'Reason' });   // null = cancelled
 *   await noticeAction('Please log in again.');                                          // resolves on OK
 *
 * Module state, no React context, so any handler can call it. Tested: scripts/test-no-native-confirm.mjs.
 */
import { tr } from './uiLang.ts';

export type ConfirmKind = 'confirm' | 'prompt' | 'notice';

export interface ConfirmRequest {
  id: number;
  kind: ConfirmKind;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  label?: string;          // prompt: the field's label
  defaultValue?: string;   // prompt
  requireValue: boolean;   // prompt: OK stays off until something is typed
  resolve: (value: boolean | string | null) => void;
}

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. Default: true for confirm (nearly every use is a delete / cancel). */
  destructive?: boolean;
};

type Listener = (queue: readonly ConfirmRequest[]) => void;

let queue: ConfirmRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => { for (const l of listeners) l(queue); };

export function subscribeConfirm(l: Listener): () => void {
  listeners.add(l);
  l(queue);
  return () => { listeners.delete(l); };
}

/** Called by the host when the user answers the request at the head of the queue. */
export function answerConfirm(id: number, value: boolean | string | null): void {
  const req = queue.find(r => r.id === id);
  if (!req) return;
  queue = queue.filter(r => r.id !== id);
  emit();
  req.resolve(value);
}

const asOptions = (o: string | ConfirmOptions): ConfirmOptions => (typeof o === 'string' ? { title: o } : o);

function push<T extends boolean | string | null>(build: (resolve: (v: T) => void) => Omit<ConfirmRequest, 'id' | 'resolve'>): Promise<T> {
  return new Promise<T>(resolve => {
    const id = nextId++;
    const req: ConfirmRequest = { ...build(resolve), id, resolve: v => resolve(v as T) };
    // No host mounted (a test, or before the app shell loads): refuse rather than act unasked.
    if (listeners.size === 0) { resolve((req.kind === 'notice' ? true : req.kind === 'prompt' ? null : false) as T); return; }
    queue = [...queue, req];
    emit();
  });
}

/** Yes / no. Resolves true only when the user presses the confirm button. */
export function confirmAction(o: string | ConfirmOptions): Promise<boolean> {
  const opt = asOptions(o);
  return push<boolean>(() => ({
    kind: 'confirm', title: opt.title, description: opt.description,
    confirmLabel: opt.confirmLabel ?? tr('हाँ', 'Yes'), cancelLabel: opt.cancelLabel ?? tr('रद्द करें', 'Cancel'),
    destructive: opt.destructive ?? true, requireValue: false,
  }));
}

/** A line of text (e.g. a reason). Resolves the trimmed text, or null when cancelled. */
export function promptAction(o: ConfirmOptions & { label?: string; defaultValue?: string; requireValue?: boolean }): Promise<string | null> {
  return push<string | null>(() => ({
    kind: 'prompt', title: o.title, description: o.description, label: o.label, defaultValue: o.defaultValue,
    confirmLabel: o.confirmLabel ?? tr('ठीक है', 'OK'), cancelLabel: o.cancelLabel ?? tr('रद्द करें', 'Cancel'),
    destructive: o.destructive ?? false, requireValue: o.requireValue ?? false,
  }));
}

/** A message the user must acknowledge. Resolves when they press OK (or close it). */
export async function noticeAction(o: string | ConfirmOptions): Promise<void> {
  const opt = asOptions(o);
  await push<boolean>(() => ({
    kind: 'notice', title: opt.title, description: opt.description,
    confirmLabel: opt.confirmLabel ?? tr('ठीक है', 'OK'), cancelLabel: '', destructive: false, requireValue: false,
  }));
}
