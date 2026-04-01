/**
 * supabaseService.ts
 *
 * Centralised service layer for all raw Supabase mutations used by page
 * components that manage their own tables (budgets, elections, eway_bills,
 * hsn_master, kcc_loans, meeting_register).
 *
 * Rule 12: No page component may import supabase directly for business-data
 * mutations.  All such calls must go through this file.
 */

import { supabase } from '@/lib/supabase';

// ── Generic helpers ───────────────────────────────────────────────────────────

export async function dbInsert<T extends object>(
  table: string,
  record: T,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(table).insert(record);
  return { error: error?.message ?? null };
}

export async function dbUpdate<T extends object>(
  table: string,
  id: string,
  updates: T,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(table).update(updates).eq('id', id);
  return { error: error?.message ?? null };
}

export async function dbDelete(
  table: string,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── Table-specific wrappers ───────────────────────────────────────────────────

// budgets
export const budgetInsert = (record: object) => dbInsert('budgets', record);
export const budgetUpdate = (id: string, updates: object) => dbUpdate('budgets', id, updates);

// elections
export const electionInsert = (record: object) => dbInsert('elections', record);
export const electionUpdate = (id: string, updates: object) => dbUpdate('elections', id, updates);

// eway_bills
export const ewayBillInsert = (record: object) => dbInsert('eway_bills', record);
export const ewayBillUpdate = (id: string, updates: object) => dbUpdate('eway_bills', id, updates);

// hsn_master
export const hsnInsert = (record: object) => dbInsert('hsn_master', record);
export const hsnUpdate = (id: string, updates: object) => dbUpdate('hsn_master', id, updates);
export const hsnDelete = (id: string) => dbDelete('hsn_master', id);

// kcc_loans
export const kccLoanInsert = (record: object) => dbInsert('kcc_loans', record);
export const kccLoanUpdate = (id: string, updates: object) => dbUpdate('kcc_loans', id, updates);

// meeting_register
export const meetingInsert = (record: object) => dbInsert('meeting_register', record);
export const meetingUpdate = (id: string, updates: object) => dbUpdate('meeting_register', id, updates);
export const meetingDelete = (id: string) => dbDelete('meeting_register', id);
