/**
 * Export Center (T-16b) — the first surface driven entirely by the Export Registry.
 *
 * Nothing here knows the name of a table or a column. The entity list, the column picker,
 * the role and capability gating, the PII warnings — all of it is read from the registry.
 * Adding an entity to `src/lib/export/entities/` makes it appear here; nothing else.
 *
 * FOUR THINGS THIS PAGE REFUSES TO DO
 *
 *  1. Show an entity the society cannot reach. Capability-gated entities are HIDDEN, not
 *     rendered empty (blueprint §3.1). A dairy society never sees housing entities.
 *
 *  2. Trust its own buttons. `exportEntity` re-checks role and capability at generate
 *     time. This page hiding a row is convenience; the generator refusing it is the rule.
 *
 *  3. Export a truncated table. `fetchEntityRows` reports `truncated` when a society has
 *     more rows than an inline browser export can hold. We stop and say so. A partial CSV
 *     that looks complete is the same class of bug as the backup that could not restore.
 *
 *  4. Deliver without a trail. The generator awaits the audit write before any bytes
 *     leave; if it throws, the user sees the failure and receives no file.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ShieldAlert, Loader2, EyeOff, Info } from 'lucide-react';

import { REGISTRY } from '@/lib/export/registry';
import type { EntityDescriptor } from '@/lib/export/registry.types';
import { authorizeExport, exportEntity, type ExportMode, type TabularFormat } from '@/lib/export/generator';
import { fetchEntityRows } from '@/lib/export/source';
import { preflightExport, formatBytes, type PreflightResult } from '@/lib/export/preflight';

const MODES: { value: ExportMode; hi: string; en: string; hint: string; hintHi: string }[] = [
  { value: 'standard', hi: 'सामान्य', en: 'Standard', hint: 'Visible columns, active rows', hintHi: 'दिखने वाले कॉलम, सक्रिय पंक्तियाँ' },
  { value: 'full', hi: 'पूर्ण', en: 'Full', hint: 'Every column, includes deleted rows', hintHi: 'हर कॉलम, हटाई गई पंक्तियाँ भी' },
  { value: 'redacted', hi: 'रिडैक्टेड', en: 'Redacted', hint: 'Personal data masked', hintHi: 'निजी डेटा छिपा हुआ' },
];

const FORMATS: TabularFormat[] = ['csv', 'xlsx', 'json'];

const ExportCenter: React.FC = () => {
  const { language } = useLanguage();
  const { society } = useData();
  const { user } = useAuth();
  const { capabilities } = useCapabilities();
  const { toast } = useToast();

  const hi = language === 'hi';
  const role = (user?.role ?? 'viewer') as 'admin' | 'accountant' | 'viewer';
  const principal = useMemo(
    () => ({ role, capabilities: [...capabilities] }),
    [role, capabilities],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<ExportMode>('standard');
  const [format, setFormat] = useState<TabularFormat>('csv');
  const [chosenColumns, setChosenColumns] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Entities this principal may actually export, grouped by domain.
   * `authorizeExport` is the single source of truth — the UI does not re-implement it.
   */
  const available = useMemo(() => {
    const groups = new Map<string, EntityDescriptor[]>();
    for (const entity of REGISTRY) {
      if (!authorizeExport(entity, principal, 'csv').ok) continue;
      const list = groups.get(entity.domain) ?? [];
      list.push(entity);
      groups.set(entity.domain, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [principal]);

  const selected = selectedKey ? REGISTRY.find(e => e.key === selectedKey) ?? null : null;

  const pickEntity = (entity: EntityDescriptor) => {
    setSelectedKey(entity.key);
    setChosenColumns(null);   // reset to the mode's default column set
    if (!entity.formats.includes(format)) setFormat(entity.formats[0] as TabularFormat);
  };

  const columnsForMode = selected
    ? (mode === 'full' ? selected.columns : selected.columns.filter(c => c.defaultVisible))
    : [];

  const activeColumns = chosenColumns ?? columnsForMode.map(c => c.key);
  const piiCount = selected
    ? selected.columns.filter(c => activeColumns.includes(c.key) && c.piiClass !== 'none').length
    : 0;

  /**
   * Preflight (T-17). Counts the rows with a HEAD request — no rows are read — as soon as
   * an entity, mode or format is chosen. The user learns the scale BEFORE waiting, and a
   * table too large for an inline browser export is refused up front rather than after a
   * frozen tab. Re-runs on format because the size estimate depends on it.
   */
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [preflighting, setPreflighting] = useState(false);

  useEffect(() => {
    if (!selected || !user?.societyId) { setPreflight(null); setPreflightError(null); return; }
    let cancelled = false;
    setPreflighting(true);
    setPreflight(null);
    setPreflightError(null);
    preflightExport(selected, user.societyId, activeColumns.length, format)
      .then(({ result, error }) => {
        if (cancelled) return;
        setPreflight(result);
        setPreflightError(error);
      })
      .finally(() => { if (!cancelled) setPreflighting(false); });
    return () => { cancelled = true; };
    // activeColumns.length (not the array) — re-counting on every checkbox click is waste.
  }, [selected, user?.societyId, format, activeColumns.length]);

  const blocked = preflightError !== null || preflight?.canExportInline === false;

  const toggleColumn = (key: string) => {
    const next = new Set(activeColumns);
    if (next.has(key)) next.delete(key); else next.add(key);
    // Preserve declared order, never the click order.
    setChosenColumns(selected!.columns.filter(c => next.has(c.key)).map(c => c.key));
  };

  async function handleExport() {
    if (!selected || !user?.societyId) return;
    setBusy(true);
    try {
      const { rows, truncated, fetched, error } = await fetchEntityRows(selected, user.societyId);

      if (error) {
        toast({ title: hi ? 'डेटा पढ़ा नहीं जा सका' : 'Could not read the data', description: error, variant: 'destructive', duration: 10000 });
        return;
      }

      // NO SILENT CAPS. A partial file that looks complete is data loss with a success toast.
      if (truncated) {
        toast({
          title: hi ? 'एक्सपोर्ट रोका गया — डेटा बहुत बड़ा है' : 'Export stopped — too much data',
          description: hi
            ? `${fetched} पंक्तियाँ पढ़ी गईं, पर टेबल में और भी हैं। अधूरी फ़ाइल देने के बजाय रोका गया।`
            : `Read ${fetched} rows, but the table holds more. Stopped rather than hand you an incomplete file.`,
          variant: 'destructive',
          duration: 15000,
        });
        return;
      }

      const count = await exportEntity(rows, {
        entityKey: selected.key,
        format,
        mode,
        columns: chosenColumns ?? undefined,
        filenameBase: `${selected.key}-${society.financialYear}`,
      }, {
        societyId: user.societyId,
        actor: { name: user.name, email: user.email, role: user.role },
        principal,
        language,
        meta: {
          societyName: society.name,
          registrationNo: society.registrationNo,
          financialYear: society.financialYear,
          generatedBy: user.name,
          mode,
        },
      });

      toast({
        title: hi ? 'एक्सपोर्ट डाउनलोड हुआ' : 'Export downloaded',
        description: hi ? `${count} पंक्तियाँ · इतिहास में दर्ज` : `${count} rows · recorded in the export history`,
      });
    } catch (e) {
      // Includes AuditWriteError: if the trail cannot be written, no file is delivered.
      toast({
        title: hi ? 'एक्सपोर्ट नहीं हुआ' : 'Export failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
        duration: 12000,
      });
    } finally {
      setBusy(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Download className="h-6 w-6 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hi ? 'एक्सपोर्ट सेंटर' : 'Export Center'}</h1>
          <p className="text-sm text-gray-500">
            {society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'हर एक्सपोर्ट ऑडिट लॉग में दर्ज होता है — कौन, कब, कितनी पंक्तियाँ। बिना दर्ज हुए कोई फ़ाइल नहीं बनती।'
            : 'Every export is recorded in the audit log — who, when, how many rows. No file is produced without that record.'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Entity picker — capability-gated entities are absent, not empty */}
        <Card className="h-fit">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{hi ? 'डेटा चुनें' : 'Choose data'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
            {available.length === 0 && (
              <p className="text-sm text-gray-500">
                {hi ? 'आपकी भूमिका के लिए कोई एक्सपोर्ट उपलब्ध नहीं।' : 'No exports available for your role.'}
              </p>
            )}
            {available.map(([domain, entities]) => (
              <div key={domain}>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{domain}</p>
                <div className="space-y-1">
                  {entities.map(entity => (
                    <button
                      key={entity.key}
                      onClick={() => pickEntity(entity)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedKey === entity.key ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {hi ? entity.labelHi : entity.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Options + column picker */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {selected ? (hi ? selected.labelHi : selected.label) : (hi ? 'कोई डेटा चुनें' : 'Select data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected && (
              <p className="text-sm text-gray-500">
                {hi ? 'बाईं ओर से कोई सूची चुनें।' : 'Pick a collection on the left.'}
              </p>
            )}

            {selected && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-500">{hi ? 'मोड' : 'Mode'}</label>
                    <Select value={mode} onValueChange={v => { setMode(v as ExportMode); setChosenColumns(null); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODES.map(m => (
                          <SelectItem key={m.value} value={m.value}>
                            {hi ? m.hi : m.en} — <span className="text-gray-500">{hi ? m.hintHi : m.hint}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{hi ? 'फ़ॉर्मैट' : 'Format'}</label>
                    <Select value={format} onValueChange={v => setFormat(v as TabularFormat)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FORMATS.filter(f => selected.formats.includes(f)).map(f => (
                          <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* PII notice — computed from the registry, not guessed from entity names */}
                {mode === 'redacted' ? (
                  <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    <EyeOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {hi
                      ? 'निजी कॉलम (फ़ोन, पैन, आधार, बैंक विवरण) *** से बदल दिए जाएँगे।'
                      : 'Personal columns (phone, PAN, Aadhaar, bank details) will be replaced with ***.'}
                  </div>
                ) : piiCount > 0 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {hi
                      ? `इस फ़ाइल में ${piiCount} निजी कॉलम होंगे। बाहर साझा करना हो तो "रिडैक्टेड" मोड चुनें।`
                      : `This file will contain ${piiCount} personal columns. Use "Redacted" mode to share it outside.`}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">
                      {hi ? 'कॉलम' : 'Columns'} ({activeColumns.length}/{selected.columns.length})
                    </label>
                    {chosenColumns && (
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => setChosenColumns(null)}>
                        {hi ? 'डिफ़ॉल्ट पर लौटें' : 'Reset to default'}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                    {selected.columns.map(col => (
                      <label key={col.key} className="flex items-center gap-2 text-sm px-1 py-0.5 cursor-pointer">
                        <Checkbox
                          checked={activeColumns.includes(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        <span className="truncate">{hi ? col.headerHi : col.header}</span>
                        {col.piiClass !== 'none' && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 shrink-0">
                            {col.piiClass}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Preflight — the scale, before the wait (T-17) */}
                {preflighting && (
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {hi ? 'पंक्तियाँ गिनी जा रही हैं…' : 'Counting rows…'}
                  </p>
                )}

                {preflightError && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {/* Never fall through to "0 rows" — that reads as an empty table. */}
                    {hi ? 'पंक्तियाँ गिनी नहीं जा सकीं: ' : 'Could not count the rows: '}{preflightError}
                  </div>
                )}

                {preflight && preflight.canExportInline && (
                  <p className="text-sm text-gray-600">
                    {hi
                      ? `लगभग ${preflight.rowCount.toLocaleString('en-IN')} पंक्तियाँ · अनुमानित आकार ~${formatBytes(preflight.estimatedBytes)}`
                      : `About ${preflight.rowCount.toLocaleString('en-IN')} rows · estimated size ~${formatBytes(preflight.estimatedBytes)}`}
                  </p>
                )}

                {preflight && !preflight.canExportInline && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {hi
                        ? `यह टेबल बहुत बड़ी है — ${preflight.rowCount.toLocaleString('en-IN')} पंक्तियाँ। ब्राउज़र में एक साथ एक्सपोर्ट करने पर टैब जम जाएगा। सर्वर-साइड एक्सपोर्ट अभी उपलब्ध नहीं है।`
                        : `This table is too large — ${preflight.rowCount.toLocaleString('en-IN')} rows. Exporting it inline would freeze the tab. Server-side export is not available yet.`}
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleExport}
                  disabled={busy || preflighting || blocked || activeColumns.length === 0}
                  className="gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {busy
                    ? (hi ? 'तैयार हो रहा है…' : 'Preparing…')
                    : (hi ? 'एक्सपोर्ट डाउनलोड करें' : 'Download export')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExportCenter;
