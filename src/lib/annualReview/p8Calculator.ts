/**
 * Proforma 8 — Kachi Aarat summary (+ P9 dami-by-crop split).
 * Aggregates KachiAaratEntry rows for the chosen FY.
 */
import type { KachiAaratEntry, KachiAaratCrop } from '@/types';

export interface P8CropSplit {
  mustardSeed: number;
  gram: number;
  barley: number;
  wheat: number;
  paddy: number;
  other: number;
}

export interface P8Result {
  society: string;
  totalBusinessValue: number;
  totalDamiEarned: number;
  entryCount: number;
  damiByCrop: P8CropSplit;            // needed for P9
  businessByCrop: P8CropSplit;
}

export interface P8Inputs {
  entries: KachiAaratEntry[];
  fyStartDate: string;
  societyName: string;
}

const emptyCrop = (): P8CropSplit => ({
  mustardSeed: 0, gram: 0, barley: 0, wheat: 0, paddy: 0, other: 0,
});

export function calculateP8(input: P8Inputs): P8Result {
  const rows = input.entries.filter(e => !e.isDeleted && e.fyStartDate === input.fyStartDate);

  const damiByCrop = emptyCrop();
  const businessByCrop = emptyCrop();

  let totalBusinessValue = 0;
  let totalDamiEarned = 0;

  for (const r of rows) {
    const crop = r.crop as KachiAaratCrop;
    damiByCrop[crop]     += r.damiEarned || 0;
    businessByCrop[crop] += r.businessValue || 0;
    totalBusinessValue   += r.businessValue || 0;
    totalDamiEarned      += r.damiEarned || 0;
  }

  return {
    society: input.societyName,
    totalBusinessValue,
    totalDamiEarned,
    entryCount: rows.length,
    damiByCrop,
    businessByCrop,
  };
}

export const KACHI_CROP_LABELS: Record<KachiAaratCrop, string> = {
  mustardSeed: 'Mustard Seed (सरसों)',
  gram:        'Gram (चना)',
  barley:      'Barley (जौ)',
  wheat:       'Wheat (गेहूं)',
  paddy:       'Paddy (धान)',
  other:       'Other (अन्य)',
};
