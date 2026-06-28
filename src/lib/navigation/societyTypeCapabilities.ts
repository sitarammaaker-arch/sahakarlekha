/**
 * Society-type capability templates (C1) — the ONLY place a SocietyType maps to
 * capabilities. In C1 every template is empty, so nothing is gated (sidebar
 * identical to today). Capabilities are granted here from C4 (e.g. dairy →
 * ['dairy_collection']). Modules NEVER reference society types — only capabilities.
 */
import type { SocietyType } from '@/types';
import type { Capability } from './capabilities';

export const SOCIETY_TYPE_CAPABILITIES: Record<SocietyType, Capability[]> = {
  marketing_processing: ['inventory_sales'],
  pacs: ['inventory_sales'],                          // input/goods distribution
  consumer: ['inventory_sales'],
  dairy: ['dairy_collection', 'inventory_sales'],     // C4 milk + goods commerce
  housing: [],                                        // service — no goods
  sugar: ['inventory_sales'],
  labour: [],                                         // service — no goods
  other: ['inventory_sales'],                         // catch-all/store — conservative
};
