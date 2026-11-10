import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDate } from '@/lib/dateUtils';
import { addDays } from '@/lib/lateFee';

const QUICK_DAYS = [7, 15, 30];

/** Credit days on a bill, with the due date they give. Blank = no term set on this bill. */
export default function CreditTermsField({ value, onChange, billDate, hi }: {
  value: string;
  onChange: (value: string) => void;
  billDate: string;
  hi: boolean;
}) {
  const days = Math.floor(Number(value) || 0);
  return (
    <div className="space-y-1">
      <Label>{hi ? 'उधार के दिन' : 'Credit days'}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0}
          step={1}
          className="h-9 w-24"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={hi ? 'उधार के दिन' : 'Credit days'}
        />
        {QUICK_DAYS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(String(d))}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${days === d ? 'border-primary text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            {d} {hi ? 'दिन' : 'days'}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {days > 0 && billDate
          ? `${hi ? 'देय तिथि' : 'Due date'}: ${fmtDate(addDays(billDate, days))}`
          : (hi ? 'खाली छोड़ें तो इस बिल पर देय तिथि नहीं होगी।' : 'Leave blank for no due date on this bill.')}
      </p>
    </div>
  );
}
