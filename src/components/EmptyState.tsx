/**
 * EmptyState — a teaching empty state for list/table screens.
 *
 * Replaces the dead "कोई डेटा नहीं / No data" placeholder: shows an icon, a short
 * message, and (optionally) a primary call-to-action that starts the very task the
 * empty list is waiting for. Model: the Payroll page's "अभी कोई कर्मचारी नहीं —
 * 'कर्मचारी जोड़ें' से शुरू करें" pattern.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, actionLabel, onAction, className }) => (
  <div className={`flex flex-col items-center justify-center text-center gap-3 px-6 py-12 ${className ?? ''}`}>
    {Icon && (
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
    )}
    <div className="space-y-1">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
    </div>
    {actionLabel && onAction && (
      <Button onClick={onAction} className="mt-1">{actionLabel}</Button>
    )}
  </div>
);

export default EmptyState;
