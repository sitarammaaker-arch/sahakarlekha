import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LateFeeRule, LateFeeType } from '@/types';

/** The fields of one late-charge rule. A party's form adds the "society rule" choice through inheritLabel. */
export default function LateFeeRuleFields({ value, onChange, hi, inheritLabel, noneLabel }: {
  value: LateFeeRule | null | undefined;
  onChange: (rule: LateFeeRule | null) => void;
  hi: boolean;
  inheritLabel?: string;
  noneLabel: string;
}) {
  const INHERIT = '__inherit__';
  const type: string = value?.type ?? (inheritLabel ? INHERIT : 'none');
  const charging = !!value && value.type !== 'none';
  const update = (patch: Partial<LateFeeRule>) => onChange({ type: 'percent', rate: 0, ...value, ...patch });
  const pickType = (next: string) => {
    if (next === INHERIT) onChange(null);
    else if (next === 'none') onChange(inheritLabel ? { type: 'none', rate: 0 } : null);
    else update({ type: next as LateFeeType });
  };
  const rateLabel = value?.type === 'percent' ? (hi ? 'दर (% सालाना)' : 'Rate (% a year)') : (hi ? 'रकम (₹)' : 'Amount (₹)');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label>{hi ? 'विलंब शुल्क' : 'Late charge'}</Label>
        <Select value={type} onValueChange={pickType}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {inheritLabel && <SelectItem value={INHERIT}>{inheritLabel}</SelectItem>}
            <SelectItem value="none">{noneLabel}</SelectItem>
            <SelectItem value="percent">{hi ? 'विलंब ब्याज (% सालाना)' : 'Late interest (% a year)'}</SelectItem>
            <SelectItem value="flat">{hi ? 'पेनल्टी (एकमुश्त)' : 'Penalty (once)'}</SelectItem>
            <SelectItem value="perDay">{hi ? 'पेनल्टी (प्रति दिन)' : 'Penalty (a day)'}</SelectItem>
            <SelectItem value="perMonth">{hi ? 'पेनल्टी (प्रति माह)' : 'Penalty (a month)'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {charging && (
        <>
          <div className="space-y-1">
            <Label>{rateLabel}</Label>
            <Input type="number" min={0} step="any" className="h-9" value={value?.rate || ''} onChange={e => update({ rate: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'छूट के दिन' : 'Grace days'}</Label>
            <Input type="number" min={0} step={1} className="h-9" value={value?.graceDays || ''} onChange={e => update({ graceDays: Math.floor(Number(e.target.value) || 0) })} />
          </div>
        </>
      )}
    </div>
  );
}
