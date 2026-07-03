/**
 * Marketing Transport domain — entity contracts (types only, no logic).
 * Transport of procured produce / trading goods: transporters (master) and trips (T2).
 */
import type { BaseEntity } from '@/lib/procurement';

export interface Transporter extends BaseEntity {
  name: string;
  nameHi?: string;
  vehicleNo?: string;
  phone?: string;
  ratePerQtl?: number;     // default freight rate ₹/qtl (optional; overridable per trip in T2)
}
