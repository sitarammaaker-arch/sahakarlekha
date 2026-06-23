/**
 * Per-post colour accents for the blog. Keeps the index cards and the article
 * hero visually consistent. No external images — gradient covers stay fast and
 * never 404, and look good in both light and dark mode.
 */
import { BookOpen, FileText, Layers, ShieldCheck, TrendingUp, Sparkles, LucideIcon } from 'lucide-react';
import type { BlogPost } from '@/content/blog';

export interface Accent {
  /** big gradient used for the article hero + card cover */
  cover: string;
  /** category chip background + text */
  chip: string;
  /** decorative icon shown on the cover */
  icon: LucideIcon;
}

export const ACCENTS: Record<BlogPost['accent'], Accent> = {
  emerald: {
    cover: 'from-emerald-500 via-emerald-600 to-teal-700',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    icon: ShieldCheck,
  },
  sky: {
    cover: 'from-sky-500 via-sky-600 to-blue-700',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    icon: BookOpen,
  },
  violet: {
    cover: 'from-violet-500 via-violet-600 to-purple-700',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    icon: FileText,
  },
  amber: {
    cover: 'from-amber-500 via-orange-500 to-orange-700',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    icon: Layers,
  },
  rose: {
    cover: 'from-rose-500 via-rose-600 to-pink-700',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    icon: TrendingUp,
  },
  indigo: {
    cover: 'from-indigo-500 via-indigo-600 to-blue-700',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    icon: Sparkles,
  },
};

/** Format an ISO date as a readable Hindi-friendly date, e.g. "30 जून 2026". */
const HI_MONTHS = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर'];
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${HI_MONTHS[m - 1]} ${y}`;
}
