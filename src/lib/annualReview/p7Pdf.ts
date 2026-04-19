/**
 * Proforma 7 PDF — Godown Rent + Transport + Consumer Products.
 * 3 small tables, one per section, matching HAFED format.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SocietySettings, P7Entry } from '@/types';
import { addPageNumbers, pdfFileName } from '@/lib/pdf';

const fmt  = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtL = (n: number) => (n / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateP7PDF(entry: P7Entry, society: SocietySettings, fyStartDate: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  const pw = doc.internal.pageSize.getWidth();
  const fyEnd = (() => {
    const d = new Date(fyStartDate);
    d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const dd = (d: string) => d.split('-').reverse().join('-');

  doc.setFont(font, 'bold'); doc.setFontSize(13);
  doc.text('PERFORMA 7', pw / 2, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.text(
    `HAFED DISTRICT OFFICE${society.hafedDistrictOffice ? ' — ' + society.hafedDistrictOffice.toUpperCase() : ''}`,
    pw / 2, 20, { align: 'center' }
  );

  // ── Section 1 — Godown Rent ──
  let y = 28;
  doc.setFont(font, 'bold'); doc.setFontSize(10);
  doc.text(`1. Details of Godown rent paid during ${dd(fyStartDate)} to ${dd(fyEnd)}`, 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['S.No.', 'Name of Society', 'No. of Godowns on rent', 'Capacity hired (MT)', 'Rent Paid (Rs.)']],
    body: [['1', society.name, String(entry.rentedGodownCount || 0), fmt(entry.rentedCapacityMT || 0), fmt(entry.godownRentPaid || 0)]],
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 40, halign: 'right' },
    },
  });

  // ── Section 2 — Transport ──
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFont(font, 'bold'); doc.setFontSize(10);
  doc.text(`2. Transportation Charges paid during ${dd(fyStartDate)} to ${dd(fyEnd)}`, 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['S.No.', 'Name of Society', 'No. of Trucks with Society', 'Transport Charges Paid (Rs. in Lacs)']],
    body: [['1', society.name, String(entry.truckCount || 0), fmtL(entry.transportChargesPaid || 0)]],
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 75 },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 55, halign: 'right' },
    },
  });

  // ── Section 3 — Consumer Products ──
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFont(font, 'bold'); doc.setFontSize(10);
  doc.text(`3. Details of value of Consumer Products / Cattle Feed sold during ${dd(fyStartDate)} to ${dd(fyEnd)}`, 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['S.No.', 'Name of Society', 'Sugar / Cattle Feed / Mustard Cake (Rs.)', 'Consumer Products — Rice, Mustard Oil, Refined Oil etc. (Rs.)']],
    body: [['1', society.name, fmt(entry.sugarCattleFeedSales || 0), fmt(entry.consumerProductSales || 0)]],
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 55, halign: 'right' },
      3: { cellWidth: 65, halign: 'right' },
    },
  });

  // Signatories
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.text('Manager / Secretary', 30, finalY);
  doc.text('Chairman', 110, finalY);
  doc.text('Inspector / Auditor', 170, finalY);
  doc.line(15, finalY - 2, 70, finalY - 2);
  doc.line(95, finalY - 2, 140, finalY - 2);
  doc.line(155, finalY - 2, 195, finalY - 2);

  addPageNumbers(doc, font, society.name);
  doc.save(pdfFileName('Proforma-7-RentTransportConsumer', society, fyStartDate, fyEnd));
}
