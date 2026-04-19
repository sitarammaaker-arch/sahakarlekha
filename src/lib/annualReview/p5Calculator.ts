/**
 * Proforma 5 — Information regarding Staff & Salary
 * One row per active employee with HAFED deputation + salary-split details.
 */
import type { Employee, SocietySettings } from '@/types';

export interface P5Row {
  sNo: number;
  societyName: string;
  employeeName: string;
  designation: string;
  category: string;              // A/B/C/D or '-'
  payScale: string;
  basicPay: number;
  isHafedDeputed: boolean;
  isOutsourced: boolean;
  isSocietyEmployee: boolean;    // derived: !outsourced && !hafedDeputed
  hafedSalaryPaid: number;
  hafedSalaryPercent: number;
}

export interface P5Summary {
  sanctionedStrength: number;
  totalActive: number;
  societyEmployees: number;
  hafedDeputed: number;
  outsourced: number;
  totalBasicPay: number;
  totalHafedSalaryPaid: number;
}

export interface P5Result {
  rows: P5Row[];
  summary: P5Summary;
}

export function calculateP5(employees: Employee[], society: SocietySettings): P5Result {
  const active = employees.filter(e => e.status === 'active');

  const rows: P5Row[] = active.map((e, i) => {
    const isHafed = !!e.isHafedDeputed;
    const isOut = !!e.isOutsourced;
    return {
      sNo: i + 1,
      societyName: society.name,
      employeeName: e.name,
      designation: e.designation,
      category: e.category || '-',
      payScale: e.payScale || '-',
      basicPay: e.basicSalary || 0,
      isHafedDeputed: isHafed,
      isOutsourced: isOut,
      isSocietyEmployee: !isHafed && !isOut,
      hafedSalaryPaid: e.hafedSalaryPaid || 0,
      hafedSalaryPercent: e.hafedSalaryPercent || 0,
    };
  });

  const summary: P5Summary = {
    sanctionedStrength: society.sanctionedStrength || 0,
    totalActive: rows.length,
    societyEmployees: rows.filter(r => r.isSocietyEmployee).length,
    hafedDeputed: rows.filter(r => r.isHafedDeputed).length,
    outsourced: rows.filter(r => r.isOutsourced).length,
    totalBasicPay: rows.reduce((s, r) => s + r.basicPay, 0),
    totalHafedSalaryPaid: rows.reduce((s, r) => s + r.hafedSalaryPaid, 0),
  };

  return { rows, summary };
}
