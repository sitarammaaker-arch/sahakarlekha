/**
 * Show / hide button for a password field (audit 2026-11-16, M-3).
 *
 * The three auth pages each had their own copy: a bare 16×16px icon with no name. On a phone it was
 * nearly impossible to hit, and a screen reader announced only "button". This one fills the right end of
 * the input (44×40px), says what it will do, and reports its state.
 *
 * Usage: inside the `relative` wrapper of an <Input className="pr-12" />.
 */
import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Props {
  shown: boolean;
  onToggle: () => void;
  /** true = Hindi labels. */
  hi: boolean;
}

export const PasswordToggle: React.FC<Props> = ({ shown, onToggle, hi }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={shown}
    aria-label={shown ? (hi ? 'पासवर्ड छिपाएँ' : 'Hide password') : (hi ? 'पासवर्ड दिखाएँ' : 'Show password')}
    className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
  </button>
);

export default PasswordToggle;
