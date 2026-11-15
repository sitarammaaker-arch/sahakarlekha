/**
 * Warehouse documents (ECR-20). Turns a godown stock movement into a printable document:
 *   • INWARD  movement → Warehouse Receipt (WHR / गोदाम रसीद) — proof that goods were stored.
 *   • OUTWARD movement → Gate Pass (निकासी पर्ची) — authorisation for goods leaving the gate.
 *
 * The document is built from the data the movement already has (item, qty, godown, date, ref);
 * party / vehicle / grade / signature are printed as blank lines for manual fill, matching how
 * co-op godowns issue these by hand. Pure data model — the page turns it into printable HTML.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-warehouse-doc.mjs.
 * Language: chosen when the document is built (tr) — Hindi mode prints the bilingual labels unchanged.
 */
import { tr } from './uiLang.ts';

export type WarehouseDocKind = 'WHR' | 'GatePass';

export interface WarehouseDocInput {
  movementType: string;   // 'purchase' | 'sale' | 'adjustment' | 'opening' | …
  qty: number;
  date?: string;
  referenceNo?: string;
  docNo: string;
  societyName: string;
  godownName: string;
  itemName: string;
  itemUnit?: string;
}

export interface WarehouseDocField {
  label: string;
  value: string;          // '' → a blank line to fill by hand
}

export interface WarehouseDoc {
  kind: WarehouseDocKind;
  title: string;          // document title (Hindi-first; English in English mode)
  docNo: string;
  societyName: string;
  fields: WarehouseDocField[];
  manualFields: string[]; // labels printed with a blank line for hand-fill
}

/** Inward movements (receipts) → WHR; outward (issues) → Gate Pass. */
export function warehouseDocKind(movementType: string, qty: number): WarehouseDocKind {
  const inward = movementType === 'purchase' || movementType === 'opening' || (movementType === 'adjustment' && qty > 0);
  return inward ? 'WHR' : 'GatePass';
}

/** Build the document model for a movement. */
export function buildWarehouseDoc(input: WarehouseDocInput): WarehouseDoc {
  const kind = warehouseDocKind(input.movementType, input.qty);
  const qtyStr = `${Math.abs(input.qty)}${input.itemUnit ? ' ' + input.itemUnit : ''}`;
  const common: WarehouseDocField[] = [
    { label: tr('दिनांक (Date)', 'Date'), value: input.date || '' },
    { label: tr('वस्तु (Item)', 'Item'), value: input.itemName },
    { label: tr('मात्रा (Qty)', 'Qty'), value: qtyStr },
    { label: tr('गोदाम (Godown)', 'Godown'), value: input.godownName },
    { label: tr('संदर्भ (Ref)', 'Ref'), value: input.referenceNo || '—' },
  ];
  if (kind === 'WHR') {
    return {
      kind,
      title: tr('गोदाम रसीद (Warehouse Receipt)', 'Warehouse Receipt'),
      docNo: input.docNo,
      societyName: input.societyName,
      fields: common,
      manualFields: [tr('जमाकर्ता (Depositor)', 'Depositor'), tr('श्रेणी/किस्म (Grade)', 'Grade'), tr('बोरे/पैकेट (Bags)', 'Bags'), tr('भंडारण शुल्क (Storage charge)', 'Storage charge'), tr('प्राप्तकर्ता के हस्ताक्षर (Received by)', 'Received by')],
    };
  }
  return {
    kind,
    title: tr('निकासी पर्ची (Gate Pass)', 'Gate Pass'),
    docNo: input.docNo,
    societyName: input.societyName,
    fields: common,
    manualFields: [tr('प्राप्तकर्ता (Issued to)', 'Issued to'), tr('वाहन संख्या (Vehicle no.)', 'Vehicle no.'), tr('गंतव्य (Destination)', 'Destination'), tr('चालक (Driver)', 'Driver'), tr('अधिकृत हस्ताक्षर (Authorised by)', 'Authorised by')],
  };
}
