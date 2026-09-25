import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { hsnSelect } from '@/lib/supabaseService';
import { checkHsnDigits } from '@/lib/hsn/validity';
import { Search, Info, AlertTriangle } from 'lucide-react';

// ── HSN / SAC picker for the item form (Slice 1) ─────────────────────────────
// OPTIONAL at item creation by design — HSN/SAC is only legally required when the
// item is used on a GST invoice / GSTR-1 (that guard lands in a later slice). Here
// we just make it easy: search the society's HSN/SAC master by code OR description,
// filter Goods (HSN) vs Services (SAC), and on pick fill the code + SUGGEST the GST
// rate (editable, never locked). Free-typing a code not in the master also works.

type HsnType = 'HSN' | 'SAC';
interface HsnRow { code: string; description: string; type: HsnType; gstRate: number; }

const GST_RATES = [0, 5, 12, 18, 28];

// Small per-society cache so opening the form repeatedly doesn't refetch the master.
const cache = new Map<string, HsnRow[]>();

export interface HsnPickerValue { hsnCode: string; sacCode: string; gstRate: string; }

interface HsnPickerProps {
  value: HsnPickerValue;
  onChange: (patch: Partial<HsnPickerValue>) => void;
  hi: boolean;
}

export function HsnPicker({ value, onChange, hi }: HsnPickerProps) {
  const { user } = useAuth();
  const { society } = useData();
  const societyId = user?.societyId || 'SOC001';

  const [rows, setRows] = useState<HsnRow[]>(() => cache.get(societyId) || []);
  const [type, setType] = useState<HsnType>(value.sacCode ? 'SAC' : 'HSN');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Current code = whichever field matches the active type.
  const currentCode = type === 'HSN' ? value.hsnCode : value.sacCode;

  useEffect(() => {
    if (cache.has(societyId)) { setRows(cache.get(societyId)!); return; }
    let alive = true;
    hsnSelect(societyId).then(({ data, error }) => {
      if (!alive || error || !data) return;
      const mapped: HsnRow[] = (data as Array<Record<string, unknown>>).map(r => ({
        code: String(r.code ?? ''),
        description: String(r.description ?? ''),
        type: r.type === 'SAC' ? 'SAC' : 'HSN',
        gstRate: Number(r.gstRate ?? 0),
      }));
      cache.set(societyId, mapped);
      if (alive) setRows(mapped);
    });
    return () => { alive = false; };
  }, [societyId]);

  // Close the suggestion dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = rows.filter(r => r.type === type);
    if (!q) return pool.slice(0, 30);
    return pool
      .filter(r => r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
      .slice(0, 30);
  }, [rows, query, type]);

  const setType_ = (t: HsnType) => {
    setType(t);
    setQuery('');
    setOpen(false);
    // Move the existing code into the field for the newly-selected type, clearing the other.
    if (t === 'HSN') onChange({ hsnCode: value.hsnCode || value.sacCode || '', sacCode: '' });
    else onChange({ sacCode: value.sacCode || value.hsnCode || '', hsnCode: '' });
  };

  const pick = (r: HsnRow) => {
    if (r.type === 'HSN') onChange({ hsnCode: r.code, sacCode: '', gstRate: String(r.gstRate) });
    else onChange({ sacCode: r.code, hsnCode: '', gstRate: String(r.gstRate) });
    setType(r.type);
    setQuery('');
    setOpen(false);
  };

  // Free-typed code (not picked from the list) still saves, under the active type.
  const onType = (v: string) => {
    setQuery(v);
    setOpen(true);
    if (type === 'HSN') onChange({ hsnCode: v, sacCode: '' });
    else onChange({ sacCode: v, hsnCode: '' });
  };

  const notSet = !value.hsnCode && !value.sacCode;
  // Slice 4: warn (not block) when the chosen code has too few digits for the
  // society's turnover — e.g. a > ₹5 cr society needs a 6-digit HSN.
  const digitCheck = checkHsnDigits(currentCode, society?.aato);

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-amber-50/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold uppercase text-amber-900 dark:text-amber-200">
          {hi ? 'HSN / SAC कोड' : 'HSN / SAC Code'}
        </Label>
        <span className="text-[10px] font-normal text-muted-foreground">{hi ? '(वैकल्पिक)' : '(optional)'}</span>
        {notSet && (
          <Badge variant="outline" className="ml-auto text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
            {hi ? 'सेट नहीं' : 'Not set'}
          </Badge>
        )}
      </div>

      {/* Goods / Services toggle */}
      <div className="flex gap-1">
        {(['HSN', 'SAC'] as HsnType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType_(t)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              type === t
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-background text-muted-foreground border-input hover:bg-muted'
            }`}
          >
            {t === 'HSN' ? (hi ? 'HSN — वस्तु' : 'HSN — Goods') : (hi ? 'SAC — सेवा' : 'SAC — Service')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Searchable code combobox */}
        <div className="sm:col-span-2 relative" ref={boxRef}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={open ? query : currentCode}
              onChange={e => onType(e.target.value)}
              onFocus={() => { setQuery(currentCode); setOpen(true); }}
              placeholder={hi ? 'कोड या नाम से खोजें…' : 'Search by code or name…'}
              className="pl-8 font-mono"
            />
          </div>
          {open && matches.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-popover shadow-md">
              {matches.map(r => (
                <button
                  key={`${r.type}-${r.code}`}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); pick(r); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="font-mono font-semibold">{r.code}</span>
                  <span className="truncate text-muted-foreground">{r.description}</span>
                  <Badge variant="outline" className="ml-auto shrink-0 font-mono text-[10px]">{r.gstRate}%</Badge>
                </button>
              ))}
            </div>
          )}
          {open && query.trim() && matches.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-xs text-muted-foreground">
              {hi ? 'मास्टर में नहीं मिला — टाइप किया कोड ऐसे ही सेव होगा।' : 'Not in master — the typed code will be saved as-is.'}
            </div>
          )}
        </div>

        {/* GST rate — suggested on pick, always editable (never locked) */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">{hi ? 'GST दर % (सुझाव)' : 'GST Rate % (suggested)'}</Label>
          <Select value={value.gstRate === '' ? undefined : value.gstRate} onValueChange={v => onChange({ gstRate: v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder={hi ? '—' : '—'} /></SelectTrigger>
            <SelectContent>
              {GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {digitCheck.insufficient && (
        <p className="flex items-start gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {hi
              ? `आपके टर्नओवर (₹5 करोड़+) पर ${digitCheck.required}-अंकी HSN चाहिए — यह कोड ${digitCheck.actual}-अंकी है।`
              : `Your turnover (₹5 cr+) needs a ${digitCheck.required}-digit HSN — this code has ${digitCheck.actual} digits.`}
          </span>
        </p>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-amber-800/80 dark:text-amber-200/80">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          {hi
            ? 'वस्तु बनाते समय HSN/SAC ज़रूरी नहीं — GST बिल / GSTR-1 के समय ज़रूरी होगा। '
            : 'HSN/SAC is optional while creating the item — it will be required on GST invoices / GSTR-1. '}
          <Link to="/hsn-master" className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
            {hi ? 'HSN/SAC मास्टर में नया कोड जोड़ें' : 'Add codes in HSN/SAC master'}
          </Link>
        </span>
      </p>
    </div>
  );
}
