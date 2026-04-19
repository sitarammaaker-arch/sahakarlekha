/**
 * Proforma 9 — District Review of Cooperative Marketing Societies.
 * One row per society with P1 + P5 + P8 rollup.
 *
 * Columns per row:
 *   S.No | Name of Society | Turnover (Lacs) | Profit/Loss
 *        | No. of Employees | Turnover per Employee
 *        | Business of Kachi Aarat
 *        | Dami on: M/Seed | Gram | Barley
 */
import type { SocietySettings } from '@/types';
import type { P1Result } from './p1Calculator';
import type { P5Result } from './p5Calculator';
import type { P8Result } from './p8Calculator';

export interface P9Row {
  sNo: number;
  societyName: string;
  turnoverLacs: number;
  netProfitLoss: number;
  totalEmployees: number;
  turnoverPerEmployee: number;   // ₹ lacs per employee
  kachiAaratBusiness: number;    // ₹ absolute
  damiMustardSeed: number;
  damiGram: number;
  damiBarley: number;
}

export interface P9Inputs {
  society: SocietySettings;
  p1: P1Result;
  p5: P5Result;
  p8: P8Result;
}

export function calculateP9Row(input: P9Inputs): P9Row {
  const { society, p1, p5, p8 } = input;
  const turnoverLacs = p1.turnoverTotal / 100000;
  const totalEmployees = p5.summary.totalActive;
  const turnoverPerEmployee = totalEmployees > 0 ? turnoverLacs / totalEmployees : 0;

  return {
    sNo: 1,
    societyName:        society.name,
    turnoverLacs,
    netProfitLoss:      p1.netProfitLoss,
    totalEmployees,
    turnoverPerEmployee,
    kachiAaratBusiness: p8.totalBusinessValue,
    damiMustardSeed:    p8.damiByCrop.mustardSeed,
    damiGram:           p8.damiByCrop.gram,
    damiBarley:         p8.damiByCrop.barley,
  };
}
