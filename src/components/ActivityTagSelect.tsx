/**
 * Optional "which business activity is this voucher for?" picker (CM-PACS activity-wise accounts).
 * Writes nothing itself: the caller stores activityTag(value) in Voucher.costCentreId. '' = not tagged.
 */
import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { declaredActivities, type Activity } from '@/lib/navigation/activities';
import { activityChoices } from '@/lib/reports/activityPL';

const NONE = '__none__';

export function ActivityTagSelect({ value, onChange, id }: { value: Activity | ''; onChange: (v: Activity | '') => void; id?: string }) {
  const { society, societyActivities } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { primary, others } = useMemo(
    () => activityChoices(declaredActivities(societyActivities), society.societyType),
    [societyActivities, society.societyType],
  );
  const label = (a: { label: string; labelHi: string }) => (hi ? a.labelHi : a.label);
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm">{hi ? 'गतिविधि (वैकल्पिक)' : 'Activity (optional)'}</Label>
      <Select value={value || NONE} onValueChange={v => onChange(v === NONE ? '' : (v as Activity))}>
        <SelectTrigger id={id} className="h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{hi ? '— कोई नहीं (साझा खर्च/आय) —' : '— None (common) —'}</SelectItem>
          {primary.length > 0 && (
            <SelectGroup>
              <SelectLabel>{hi ? 'समिति की गतिविधियाँ' : "Society's activities"}</SelectLabel>
              {primary.map(a => <SelectItem key={a.code} value={a.code}>{label(a)}</SelectItem>)}
            </SelectGroup>
          )}
          {others.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{hi ? 'अन्य गतिविधियाँ' : 'Other activities'}</SelectLabel>
                {others.map(a => <SelectItem key={a.code} value={a.code}>{label(a)}</SelectItem>)}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {hi ? 'गतिविधि-वार आय-व्यय रिपोर्ट के लिए। डेबिट/क्रेडिट पर कोई असर नहीं।' : 'For the activity-wise income & expenditure report. Does not change Dr/Cr.'}
      </p>
    </div>
  );
}
