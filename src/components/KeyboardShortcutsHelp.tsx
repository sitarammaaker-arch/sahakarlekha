import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GLOBAL_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useLanguage } from '@/contexts/LanguageContext';
import { Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ open, onClose }: Props) {
  const { language } = useLanguage();
  const hi = language === 'hi';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            {hi ? 'कीबोर्ड शॉर्टकट' : 'Keyboard Shortcuts'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">
            {hi ? 'इनपुट बॉक्स से बाहर होने पर ये शॉर्टकट काम करते हैं' : 'These shortcuts work when focus is outside input fields'}
          </p>
          {GLOBAL_SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm">{hi ? s.descriptionHi : s.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">{s.key}</kbd>
            </div>
          ))}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm">{hi ? 'यह सहायता' : 'Toggle this help'}</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono border border-border">Ctrl+/</kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
