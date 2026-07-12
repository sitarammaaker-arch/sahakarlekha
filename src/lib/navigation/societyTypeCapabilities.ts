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
  pacs: ['inventory_sales', 'lending', 'deposit_ledger', 'procurement_msp', 'subsidy_reconciliation', 'gst', 'tds'], // credit + deposits + input distribution + FPS/subsidy + procurement
  consumer: ['inventory_sales', 'pos_billing', 'subsidy_reconciliation', 'gst', 'tds'],     // retail store + fast POS + FPS subsidy
  dairy: ['dairy_collection', 'inventory_sales', 'gst', 'tds'],               // milk + goods commerce
  housing: ['tds', 'housing'],                                                // service — core accounting + TDS + housing (flats/maintenance)
  sugar: ['inventory_sales', 'procurement_msp', 'gst', 'tds'],                // cane procurement + sugar sales
  labour: ['tds', 'labour', 'pf_esi'],                                        // service — core accounting + TDS + labour (work orders/wages) + EPF/ESI (revocable per society)
  producer: ['inventory_sales', 'procurement_msp', 'gst', 'tds'],             // FPO — input supply + output marketing (T-13 / SC-2)
  multistate: ['inventory_sales', 'lending', 'deposit_ledger', 'procurement_msp', 'gst', 'tds'], // multi-state coop — broad, credit-capable (T-13 / SC-3)
  multipurpose: ['inventory_sales', 'lending', 'deposit_ledger', 'dairy_collection', 'procurement_msp', 'pos_billing', 'subsidy_reconciliation', 'gst', 'tds'], // does many activities at once (T-13 / SC-1)
  other: ['inventory_sales', 'lending', 'deposit_ledger', 'gst', 'tds'],      // catch-all — broad
};
