/**
 * Auto-tag ledger accounts for HAFED Proforma 1 classification.
 *
 * Uses keyword matching on account name (English + Hindi) to suggest:
 *   - p1IncomeCategory  (Commission / Patronage / Margin / Consumer / …)
 *   - cropCategory      (Wheat / Paddy / Mustard / …)  — only when commission
 *   - p1ExpenseBucket   (Admn / Office / Marketing / Fert-Pest / Processing / Other)
 *   - turnoverBucket    (Procurement / Consumer / Fertilizer / Pesticide / CattleFeed / NonHafed)
 *
 * Returns null for any field it cannot confidently classify.
 * Caller can show preview + confirm before applying.
 */
import type {
  LedgerAccount, CropCategory, P1IncomeCategory,
  P1ExpenseBucket, TurnoverBucket,
} from '@/types';

export interface P1Tags {
  p1IncomeCategory?: P1IncomeCategory;
  cropCategory?: CropCategory;
  p1ExpenseBucket?: P1ExpenseBucket;
  turnoverBucket?: TurnoverBucket;
}

// ── Crop matchers (Hindi + English) ──
const CROP_PATTERNS: Array<[CropCategory, RegExp]> = [
  ['wheat',     /\b(wheat|गेहूं|gehun|gehoon)\b/i],
  ['paddy',     /\b(paddy|rice|धान|dhan|chawal|चावल)\b/i],
  ['sunflower', /\b(sunflower|सूरजमुखी|surajmukhi)\b/i],
  ['mustard',   /\b(mustard|सरसों|sarso|sarson)\b/i],
  ['gram',      /\b(gram|channa|chana|चना)\b/i],
  ['bajra',     /\b(bajra|बाजरा|pearl millet)\b/i],
  ['maize',     /\b(maize|makka|मक्का|corn)\b/i],
  ['moong',     /\b(moong|मूंग|green gram)\b/i],
];

function detectCrop(name: string): CropCategory | undefined {
  for (const [crop, re] of CROP_PATTERNS) if (re.test(name)) return crop;
  return undefined;
}

// ── Income category matchers ──
function detectIncomeCategory(name: string): P1IncomeCategory | undefined {
  const n = name.toLowerCase();

  if (/patronage\s*rebate|संरक्षण\s*छूट/i.test(name)) return 'patronageRebate';
  if (/commission|कमीशन|दलाली|आढ़त/.test(n)) return 'commission';
  if (/margin.*input|input.*margin|मार्जिन/.test(n)) return 'inputMargin';
  if (/consumer\s*(product|sale)|उपभोक्ता/.test(n)) return 'consumerSale';
  if (/processing|dal\s*mill|oil\s*mill|atta\s*chakki|प्रसंस्करण/.test(n)) return 'processingIncome';
  if (/truck|vehicle\s*rent|transport.*income|ट्रक/.test(n)) return 'truckIncome';
  if (/rental|rent\s*received|किराया\s*प्राप्त|rent\s*income/.test(n)) return 'rentalIncome';
  if (/hafed/.test(n)) return 'hafedOther';
  return undefined;
}

// ── Expense bucket matchers ──
function detectExpenseBucket(name: string): P1ExpenseBucket | undefined {
  const n = name.toLowerCase();

  // Fertilizer / Pesticide related expenses → bucket d
  if (/(fertili[sz]er|pesticide|dap|urea|cartage.*fert|फर्टिलाइजर|कीटनाशक|खाद)/.test(n)) {
    return 'fertPesticide';
  }
  // Processing unit operating expenses → bucket e
  if (/(processing|mill.*exp|cleaning|drying|hulling|polishing|प्रसंस्करण)/.test(n)) {
    return 'processing';
  }
  // Marketing / trading / godown / handling → bucket c
  if (/(marketing|trading|godown|warehouse|handling|freight|loading|transport\s*exp|कार्टेज|ढुलाई|मंडी)/.test(n)) {
    return 'marketing';
  }
  // Admn / establishment / salary / audit / directors → bucket a
  if (/(admn|admin|salary|wages|audit|director|board|establishment|स्थापना|वेतन|ऑडिट|निदेशक)/.test(n)) {
    return 'admn';
  }
  // Office overheads → bucket b
  if (/(office|stationery|printing|postage|telephone|phone|electricity|water|bank.*charge|internet|computer.*exp|बिजली|फोन|स्टेशनरी)/.test(n)) {
    return 'office';
  }
  // Generic expenses → "other"
  return 'other';
}

// ── Turnover bucket matchers ──
function detectTurnoverBucket(name: string): TurnoverBucket | undefined {
  const n = name.toLowerCase();

  // Ignore internal accounts — turnover only applies to sale/procurement accounts
  if (!/\b(sale|sales|turnover|procurement|procure|supply)\b/.test(n)
      && !detectCrop(name)) return undefined;

  if (/cattle\s*feed|पशु\s*आहार/.test(n)) return 'cattleFeed';
  if (/pesticide|कीटनाशक/.test(n)) return 'pesticide';
  if (/fertili[sz]er|dap|urea|खाद|फर्टिलाइजर/.test(n)) return 'fertilizer';
  if (/consumer|रिटेल|upbhogta/.test(n)) return 'consumer';
  if (detectCrop(name) || /procurement|procure|खरीद|wheat|paddy|mustard|gram/.test(n)) {
    return 'procurement';
  }
  if (/non.*hafed|other.*than.*hafed/.test(n)) return 'nonHafed';
  return undefined;
}

/** Main entry — returns the suggested tags for one account, or an empty object. */
export function suggestP1Tags(acc: LedgerAccount): P1Tags {
  if (acc.isGroup) return {};  // group accounts don't need tags

  const fullName = `${acc.name} ${acc.nameHi || ''}`.trim();
  const tags: P1Tags = {};

  // Income-type accounts → income category + possibly crop + possibly turnover bucket
  if (acc.type === 'income') {
    const income = detectIncomeCategory(fullName);
    if (income) {
      tags.p1IncomeCategory = income;
      if (income === 'commission') {
        const crop = detectCrop(fullName);
        if (crop) tags.cropCategory = crop;
      }
    }
    // Turnover bucket is separate from income category — can apply to both income + asset
    const turnover = detectTurnoverBucket(fullName);
    if (turnover) tags.turnoverBucket = turnover;
  }

  // Expense-type accounts → expense bucket
  if (acc.type === 'expense') {
    const bucket = detectExpenseBucket(fullName);
    if (bucket) tags.p1ExpenseBucket = bucket;
  }

  // Asset accounts can also carry a turnover bucket (e.g. sales clearing account)
  if (acc.type === 'asset') {
    const turnover = detectTurnoverBucket(fullName);
    if (turnover) tags.turnoverBucket = turnover;
  }

  return tags;
}

export interface TagSuggestion {
  account: LedgerAccount;
  suggested: P1Tags;
  changed: boolean;   // true if any tag differs from current account
}

/** Bulk analyze — returns per-account suggestions with "changed" flag. */
export function analyzeAccounts(accounts: LedgerAccount[]): TagSuggestion[] {
  return accounts
    .filter(a => !a.isGroup && (a.type === 'income' || a.type === 'expense' || a.type === 'asset'))
    .map(account => {
      const suggested = suggestP1Tags(account);
      const changed =
        (suggested.p1IncomeCategory && suggested.p1IncomeCategory !== account.p1IncomeCategory) ||
        (suggested.cropCategory     && suggested.cropCategory     !== account.cropCategory) ||
        (suggested.p1ExpenseBucket  && suggested.p1ExpenseBucket  !== account.p1ExpenseBucket) ||
        (suggested.turnoverBucket   && suggested.turnoverBucket   !== account.turnoverBucket);
      return { account, suggested, changed: !!changed };
    });
}
