import React, { useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, ChevronRight, Trash2 } from 'lucide-react';
import type { EntityLink } from '@/types';

interface LinkedDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;           // "Ram Kumar (MEM/001)"
  links: EntityLink[];
  onConfirmDelete: () => void;
  language?: 'hi' | 'en';
}

export const LinkedDeleteDialog: React.FC<LinkedDeleteDialogProps> = ({
  open, onOpenChange, entityName, links, onConfirmDelete, language = 'en',
}) => {
  const [step, setStep] = useState<'links' | 'confirm'>('links');
  const hi = language === 'hi';
  const blockingLinks = links.filter(l => l.blocking);
  const hasBlocking = blockingLinks.length > 0;

  const handleOpenChange = (o: boolean) => {
    if (!o) setStep('links');
    onOpenChange(o);
  };

  if (links.length === 0) {
    // No links — show simple confirm
    return (
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'क्या आप sure हैं?' : 'Are you sure?'}</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="px-1 text-sm text-muted-foreground">
            <strong>{entityName}</strong>{' '}
            {hi ? 'को permanently delete किया जाएगा।' : 'will be permanently deleted.'}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { onConfirmDelete(); handleOpenChange(false); }}>
              <Trash2 className="h-4 w-4 mr-1" />{hi ? 'Delete करें' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            {step === 'links'
              ? (hi ? 'Delete से पहले ये देखें' : 'Check before deleting')
              : (hi ? 'क्या आप sure हैं?' : 'Are you sure?')}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {step === 'links' && (
          <div className="space-y-3 py-1">
            <p className="text-sm">
              <strong>{entityName}</strong>{' '}
              {hi
                ? 'को delete करने से पहले नीचे दिए linked records का ध्यान रखें:'
                : 'is linked to the following records. Please handle them first:'}
            </p>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className={`p-3 rounded-lg border text-sm ${link.blocking ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <ChevronRight className={`h-4 w-4 ${link.blocking ? 'text-red-600' : 'text-yellow-600'}`} />
                    <span className={link.blocking ? 'text-red-700' : 'text-yellow-700'}>
                      [{link.module}] {hi ? link.labelHi : link.labelEn}
                    </span>
                  </div>
                  <p className={`ml-6 text-xs ${link.blocking ? 'text-red-600' : 'text-yellow-600'}`}>
                    👉 {hi ? link.instructionHi : link.instructionEn}
                  </p>
                </div>
              ))}
            </div>
            {hasBlocking && (
              <p className="text-xs text-red-600 font-medium">
                {hi
                  ? '⛔ ऊपर दिए red records को पहले handle करना जरूरी है।'
                  : '⛔ Red items above must be handled before deletion.'}
              </p>
            )}
            {!hasBlocking && (
              <p className="text-xs text-yellow-700">
                {hi
                  ? '⚠️ Ye sirf warnings hain — aage badh sakte hain.'
                  : '⚠️ These are warnings only — you may proceed.'}
              </p>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="py-1 space-y-2">
            <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-800">
              ⚠️ {hi
                ? `"${entityName}" aur uske saare linked data permanently delete ho jayenge. Ye action UNDO nahi ho sakta.`
                : `"${entityName}" and all its data will be permanently deleted. This action CANNOT be undone.`}
            </div>
            <p className="text-sm text-muted-foreground">
              {hi ? 'Kya aap sure hain ki aap delete karna chahte hain?' : 'Are you absolutely sure you want to delete this?'}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setStep('links'); handleOpenChange(false); }}>
            {hi ? 'वापस जाएं' : 'Go Back'}
          </AlertDialogCancel>
          {step === 'links' && (
            <AlertDialogAction
              className={hasBlocking ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'}
              onClick={() => setStep('confirm')}
            >
              {hasBlocking
                ? (hi ? 'फिर भी आगे बढ़ें →' : 'Proceed Anyway →')
                : (hi ? 'Delete करें →' : 'Delete →')}
            </AlertDialogAction>
          )}
          {step === 'confirm' && (
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { onConfirmDelete(); setStep('links'); handleOpenChange(false); }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {hi ? 'हाँ, Delete करें' : 'Yes, Delete'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
