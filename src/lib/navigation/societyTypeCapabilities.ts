/**
 * Society-type capability templates (C1) — the ONLY place a SocietyType maps to
 * capabilities. In C1 every template is empty, so nothing is gated (sidebar
 * identical to today). Capabilities are granted here from C4 (e.g. dairy →
 * ['dairy_collection']). Modules NEVER reference society types — only capabilities.
 */
import type { SocietyType } from '@/types';
import type { Capability } from './capabilities';

export const SOCIETY_TYPE_CAPABILITIES: Record<SocietyType, Capability[]> = {
  marketing_processing: [],
  pacs: [],
  consumer: [],
  dairy: [],
  housing: [],
  sugar: [],
  labour: [],
  other: [],
};
