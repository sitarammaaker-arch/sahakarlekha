/**
 * Dairy registers (pure, tested) — read-only aggregations over milk entries & settlements.
 * No React / Supabase / storage. Feed the statutory/audit registers and CSV exports (D5).
 */
import type { MilkEntry, DairySettlement } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CollectionRegister {
  rows: MilkEntry[];
  totalQty: number;
  totalAmount: number;
  count: number;
  avgFat: number;   // qty-weighted
  avgSnf: number;   // qty-weighted
}

/** Milk collection register for [from,to], sorted date → shift → member. Qty-weighted avg fat/snf. */
export function buildCollectionRegister(entries: ReadonlyArray<MilkEntry>, from: string, to: string): CollectionRegister {
  const rows = entries
    .filter(e => e.date >= from && e.date <= to)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift) || a.memberName.localeCompare(b.memberName));
  let totalQty = 0, totalAmount = 0, fatWt = 0, snfWt = 0;
  for (const e of rows) {
    totalQty += e.qty || 0;
    totalAmount += e.amount || 0;
    fatWt += (e.fat || 0) * (e.qty || 0);
    snfWt += (e.snf || 0) * (e.qty || 0);
  }
  return {
    rows,
    totalQty: round2(totalQty),
    totalAmount: round2(totalAmount),
    count: rows.length,
    avgFat: totalQty > 0 ? round2(fatWt / totalQty) : 0,
    avgSnf: totalQty > 0 ? round2(snfWt / totalQty) : 0,
  };
}

export interface SettlementRow {
  id: string;
  settlementNo?: string;
  memberName: string;
  from: string;
  to: string;
  gross: number;
  deductions: number;
  netPayable: number;
  amountPaid: number;
  outstanding: number;
  status: 'draft' | 'approved';
}
export interface SettlementRegister {
  rows: SettlementRow[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalPaid: number;
  totalOutstanding: number;
}

export function buildSettlementRegister(settlements: ReadonlyArray<DairySettlement>): SettlementRegister {
  const rows: SettlementRow[] = settlements
    .filter(s => !s.isDeleted)
    .slice()
    .sort((a, b) => a.to.localeCompare(b.to) || a.memberName.localeCompare(b.memberName))
    .map(s => {
      const deductions = round2(s.gross - s.netPayable);
      const outstanding = round2(Math.max(0, s.netPayable - s.amountPaid));
      return { id: s.id, settlementNo: s.settlementNo, memberName: s.memberName, from: s.from, to: s.to, gross: round2(s.gross), deductions, netPayable: round2(s.netPayable), amountPaid: round2(s.amountPaid), outstanding, status: s.status };
    });
  const sum = (f: (r: SettlementRow) => number) => round2(rows.reduce((a, r) => a + f(r), 0));
  return {
    rows,
    totalGross: sum(r => r.gross),
    totalDeductions: sum(r => r.deductions),
    totalNet: sum(r => r.netPayable),
    totalPaid: sum(r => r.amountPaid),
    totalOutstanding: sum(r => r.outstanding),
  };
}

export interface RecoveryRow { type: string; count: number; amount: number; }
/** Recovery summary: deduction lines across non-deleted settlements grouped by type. */
export function buildRecoverySummary(settlements: ReadonlyArray<DairySettlement>): { rows: RecoveryRow[]; total: number } {
  const m = new Map<string, { count: number; amount: number }>();
  for (const s of settlements) {
    if (s.isDeleted) continue;
    for (const l of s.deductionLines) {
      const cur = m.get(l.type) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount = round2(cur.amount + (l.amount || 0));
      m.set(l.type, cur);
    }
  }
  const rows = [...m.entries()].map(([type, v]) => ({ type, count: v.count, amount: v.amount })).sort((a, b) => b.amount - a.amount);
  return { rows, total: round2(rows.reduce((a, r) => a + r.amount, 0)) };
}

export interface MemberPassbook {
  collections: MilkEntry[];
  settlements: DairySettlement[];
  totalQty: number;
  totalGross: number;       // Σ collection amount
  totalNet: number;         // Σ settlement net
  totalPaid: number;
  totalOutstanding: number;
}
/** Per-member milk passbook: collections + settlements + outstanding (full history). */
export function buildMemberPassbook(entries: ReadonlyArray<MilkEntry>, settlements: ReadonlyArray<DairySettlement>, memberId: string): MemberPassbook {
  const collections = entries.filter(e => e.memberId === memberId).slice().sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
  const setts = settlements.filter(s => !s.isDeleted && s.memberId === memberId).slice().sort((a, b) => a.to.localeCompare(b.to));
  const totalQty = round2(collections.reduce((a, e) => a + (e.qty || 0), 0));
  const totalGross = round2(collections.reduce((a, e) => a + (e.amount || 0), 0));
  const totalNet = round2(setts.reduce((a, s) => a + s.netPayable, 0));
  const totalPaid = round2(setts.reduce((a, s) => a + s.amountPaid, 0));
  const totalOutstanding = round2(setts.reduce((a, s) => a + Math.max(0, s.netPayable - s.amountPaid), 0));
  return { collections, settlements: setts, totalQty, totalGross, totalNet, totalPaid, totalOutstanding };
}
