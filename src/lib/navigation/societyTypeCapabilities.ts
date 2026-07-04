/**
 * Society-type capability templates (C1) — the ONLY place a SocietyType maps to
 * capabilities. In C1 every template is empty, so nothing is gated (sidebar
 * identical to today). Capabilities are granted here from C4 (e.g. dairy →
 * ['dairy_collection']). Modules NEVER reference society types — only capabilities.
 */
import type { SocietyType } from '@/types';
import type { Capability } from './capabilities';

export const SOCIETY_TYPE_CAPABILITIES: Record<SocietyType, Capability[]> = {
  marketing_processing: ['inventory_sales', 'procurement_msp', 'transport', 'gst', 'tds'], // trades goods + MSP procurement + transport
  pacs: ['inventory_sales', 'lending', 'procurement_msp', 'gst', 'tds'],      // credit + input distribution + procurement
  consumer: ['inventory_sales', 'pos_billing', 'gst', 'tds'],                 // retail store + fast POS counter
  dairy: ['dairy_collection', 'inventory_sales', 'gst', 'tds'],               // milk + goods commerce
  housing: ['tds', 'housing'],                                                // service — core accounting + TDS + housing (flats/maintenance)
  sugar: ['inventory_sales', 'procurement_msp', 'gst', 'tds'],                // cane procurement + sugar sales
  labour: ['tds', 'labour', 'pf_esi'],                                        // service — core accounting + TDS + labour (work orders/wages) + EPF/ESI (revocable per society)
  other: ['inventory_sales', 'lending', 'gst', 'tds'],                        // catch-all — broad
};
