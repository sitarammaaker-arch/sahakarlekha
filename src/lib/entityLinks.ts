/**
 * Delete pre-check — which live records still point at an entity (Phase K5: lifted verbatim out of
 * DataContext.getEntityLinks). PURE. Pages call this before a delete to show the user what to clear
 * first; the delete mutations in DataContext keep their own guards (this is a heads-up, not the gate).
 *
 * RULE 5: orphan references (parent already deleted) and soft-deleted vouchers never block — the
 * caller passes LIVE vouchers, and stock movements only count while their purchase/sale still exists.
 */
import type { Asset, Customer, EntityLink, Loan, Purchase, SalaryRecord, Sale, StockMovement, Supplier, Voucher } from '@/types';

export type EntityLinkType = 'member' | 'customer' | 'supplier' | 'stockItem' | 'employee' | 'account' | 'loan' | 'asset';

export interface EntityLinkSources {
  /** Live vouchers only (soft-deleted ones excluded by the caller). */
  vouchers: Voucher[];
  loans: Loan[];
  sales: Sale[];
  purchases: Purchase[];
  stockMovements: StockMovement[];
  salaryRecords: SalaryRecord[];
  suppliers: Supplier[];
  customers: Customer[];
  assets: Asset[];
}

export function computeEntityLinks(
  entityType: EntityLinkType,
  id: string,
  { vouchers, loans, sales, purchases, stockMovements, salaryRecords, suppliers, customers, assets }: EntityLinkSources,
): EntityLink[] {
  const links: EntityLink[] = [];

  if (entityType === 'member') {
    const vCount = vouchers.filter(v => v.memberId === id).length;
    if (vCount > 0) links.push({
      module: 'Vouchers', count: vCount,
      labelHi: `${vCount} वाउचर`, labelEn: `${vCount} Voucher(s)`,
      instructionHi: 'Vouchers page pe jao → in vouchers ko pehle cancel karo',
      instructionEn: 'Go to Vouchers page → cancel these vouchers first',
      blocking: true,
    });
    const lCount = loans.filter(l => l.memberId === id).length;
    if (lCount > 0) links.push({
      module: 'Loans', count: lCount,
      labelHi: `${lCount} ऋण`, labelEn: `${lCount} Loan(s)`,
      instructionHi: 'Loan Register pe jao → pehle ye loans delete karo',
      instructionEn: 'Go to Loan Register → delete these loans first',
      blocking: true,
    });
  }

  if (entityType === 'customer') {
    const sCount = sales.filter(s => s.customerId === id).length;
    if (sCount > 0) links.push({
      module: 'Sales', count: sCount,
      labelHi: `${sCount} बिक्री`, labelEn: `${sCount} Sale(s)`,
      instructionHi: 'Sale Management pe jao → pehle ye sales delete karo',
      instructionEn: 'Go to Sale Management → delete these sales first',
      blocking: true,
    });
  }

  if (entityType === 'supplier') {
    const pCount = purchases.filter(p => p.supplierId === id).length;
    if (pCount > 0) links.push({
      module: 'Purchases', count: pCount,
      labelHi: `${pCount} खरीद`, labelEn: `${pCount} Purchase(s)`,
      instructionHi: 'Purchase Management pe jao → pehle ye purchases delete karo',
      instructionEn: 'Go to Purchase Management → delete these purchases first',
      blocking: true,
    });
  }

  if (entityType === 'stockItem') {
    // Only count movements whose parent purchase/sale still exists.
    // Orphan movements (parent already deleted) are auto-cleaned by deleteStockItem,
    // so they should NOT block deletion.
    const livePurchaseNos = new Set(purchases.map(p => p.purchaseNo));
    const liveSaleNos = new Set(sales.map(s => s.saleNo));
    const mvCount = stockMovements.filter(m =>
      m.itemId === id && (livePurchaseNos.has(m.referenceNo || '') || liveSaleNos.has(m.referenceNo || ''))
    ).length;
    if (mvCount > 0) links.push({
      module: 'Stock Movements', count: mvCount,
      labelHi: `${mvCount} स्टॉक मूवमेंट`, labelEn: `${mvCount} Stock Movement(s)`,
      instructionHi: 'Is item ki stock movements hain (purchases/sales). Pehle linked purchases aur sales delete karo.',
      instructionEn: 'This item has stock movements (purchases/sales). Delete linked purchases and sales first.',
      blocking: true,
    });
    const pCount = purchases.filter(p => p.items.some(i => i.itemId === id)).length;
    if (pCount > 0) links.push({
      module: 'Purchases', count: pCount,
      labelHi: `${pCount} खरीद में शामिल`, labelEn: `${pCount} Purchase(s) contain this item`,
      instructionHi: 'Purchase Management pe jao → ye purchases delete karo',
      instructionEn: 'Go to Purchase Management → delete these purchases',
      blocking: true,
    });
    const sCount = sales.filter(s => s.items.some(i => i.itemId === id)).length;
    if (sCount > 0) links.push({
      module: 'Sales', count: sCount,
      labelHi: `${sCount} बिक्री में शामिल`, labelEn: `${sCount} Sale(s) contain this item`,
      instructionHi: 'Sale Management pe jao → ye sales delete karo',
      instructionEn: 'Go to Sale Management → delete these sales',
      blocking: true,
    });
  }

  if (entityType === 'employee') {
    const srCount = salaryRecords.filter(r => r.employeeId === id).length;
    if (srCount > 0) links.push({
      module: 'Salary Records', count: srCount,
      labelHi: `${srCount} वेतन रिकॉर्ड`, labelEn: `${srCount} Salary Record(s)`,
      instructionHi: 'Salary Management pe jao → is employee ke salary records pehle delete karo',
      instructionEn: 'Go to Salary Management → delete this employee\'s salary records first',
      blocking: true,
    });
  }

  if (entityType === 'account') {
    // Same rule as deleteAccount's guard: a multi-line voucher uses the account through `lines`, not
    // the legacy debit/credit fields. Counting only those told the user "no links" and then the delete
    // was refused anyway.
    const vCount = vouchers.filter(v =>
      v.debitAccountId === id || v.creditAccountId === id || (v.lines?.some(l => l.accountId === id) ?? false),
    ).length;
    if (vCount > 0) links.push({
      module: 'Vouchers', count: vCount,
      labelHi: `${vCount} वाउचर में use ho raha hai`, labelEn: `Used in ${vCount} Voucher(s)`,
      instructionHi: 'Vouchers page pe jao → pehle in vouchers ko cancel karo',
      instructionEn: 'Go to Vouchers page → cancel these vouchers first',
      blocking: true,
    });
    const supLinked = suppliers.find(s => s.accountId === id);
    if (supLinked) links.push({
      module: 'Supplier', count: 1,
      labelHi: `Supplier "${supLinked.name}" ka account hai`, labelEn: `This is Supplier "${supLinked.name}"'s account`,
      instructionHi: 'Suppliers page pe jao → pehle supplier delete karo',
      instructionEn: 'Go to Suppliers page → delete the supplier first',
      blocking: true,
    });
    const cusLinked = customers.find(c => c.accountId === id);
    if (cusLinked) links.push({
      module: 'Customer', count: 1,
      labelHi: `Customer "${cusLinked.name}" ka account hai`, labelEn: `This is Customer "${cusLinked.name}"'s account`,
      instructionHi: 'Customers page pe jao → pehle customer delete karo',
      instructionEn: 'Go to Customers page → delete the customer first',
      blocking: true,
    });
  }

  if (entityType === 'loan') {
    const vCount = vouchers.filter(v => v.narration?.includes(loans.find(l => l.id === id)?.loanNo || '____NOMATCH____')).length;
    if (vCount > 0) links.push({
      module: 'Vouchers', count: vCount,
      labelHi: `${vCount} वाउचर linked`, labelEn: `${vCount} linked Voucher(s)`,
      instructionHi: 'Vouchers page pe jao → pehle in vouchers ko cancel karo',
      instructionEn: 'Go to Vouchers → cancel linked vouchers first',
      blocking: false,
    });
  }

  if (entityType === 'asset') {
    const asset = assets.find(a => a.id === id);
    if (asset) {
      // M14: Tighter match — require a word-boundary around assetNo (prevents AST/0010
      // matching AST/00100) AND restrict to depreciation/disposal vouchers, so a casual
      // narration mention of the assetNo doesn't falsely block deletion.
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const assetNoRe = new RegExp(`(^|[^\\w/-])${escapeRegex(asset.assetNo)}([^\\w/-]|$)`);
      const vCount = vouchers.filter(v => {
        if (!v.narration || !assetNoRe.test(v.narration)) return false;
        return /depreciation|disposal|sold|written off|impair/i.test(v.narration);
      }).length;
      if (vCount > 0) links.push({
        module: 'Vouchers', count: vCount,
        labelHi: `${vCount} वाउचर (ह्रास आदि)`, labelEn: `${vCount} Voucher(s) (depreciation etc.)`,
        instructionHi: 'Vouchers page pe jao → pehle in vouchers ko cancel karo',
        instructionEn: 'Go to Vouchers → cancel depreciation vouchers first',
        blocking: true,
      });
    }
  }

  return links;
}
