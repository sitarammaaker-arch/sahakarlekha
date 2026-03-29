import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant: 'cash' | 'bank' | 'members' | 'profit' | 'loss';
  className?: string;
}

const variantStyles = {
  cash: 'bg-card-cash',
  bank: 'bg-card-bank',
  members: 'bg-card-members',
  profit: 'bg-card-profit',
  loss: 'bg-destructive',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant,
  className,
}) => {
  const { language } = useLanguage();

  return (
    <div
      className={cn(
        'stat-card',
        variantStyles[variant],
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && (
              <p className="text-sm text-white/70 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon className="h-6 w-6" />
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                trend.isPositive ? 'text-green-200' : 'text-red-200'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-white/60">
              {language === 'hi' ? 'पिछले माह से' : 'from last month'}
            </span>
          </div>
        )}
      </div>

      {/* Decorative element */}
      <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-white/10" />
    </div>
  );
};
