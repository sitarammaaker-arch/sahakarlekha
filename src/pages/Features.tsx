import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  resolveEntitlements, resolveCapabilities,
  CAPABILITY_META, CAPABILITY_CATEGORIES, modulesForCapability,
  type Capability,
} from '@/lib/navigation';
import { SOCIETY_TYPES } from '@/lib/constants';
import { Blocks, Lock, FileText, Search, Layers } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateUtils';

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'available';

export default function Features() {
  const { society, societyCapabilities, setCapabilityHidden } = useData();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const hi = language === 'hi';
  const societyType = society.societyType ?? 'other';
  const typeLabel = SOCIETY_TYPES.find(s => s.value === societyType)?.[hi ? 'labelHi' : 'label'] ?? societyType;

  const entitled = useMemo(() => resolveEntitlements(societyType, societyCapabilities), [societyType, societyCapabilities]);
  const visible = useMemo(() => resolveCapabilities(societyType, societyCapabilities), [societyType, societyCapabilities]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<{ cap: Capability; toHidden: boolean } | null>(null);
  const [reason, setReason] = useState('');

  const adminRevokeRow = (cap: Capability) =>
    societyCapabilities.find(r => r.capability === cap && r.source === 'admin' && r.mode === 'revoke');
  const isMandatory = (cap: Capability) =>
    societyCapabilities.some(r => r.capability === cap && (r.source === 'state' || r.source === 'system') && r.mode === 'grant' && (!r.expiresAt || new Date(r.expiresAt).getTime() > Date.now()));

  // Build filtered feature rows per category
  const matchesSearch = (cap: Capability) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const meta = CAPABILITY_META.find(m => m.id === cap)!;
    const mods = modulesForCapability(cap).map(m => t(m.titleKey)).join(' ');
    return `${meta.nameHi} ${meta.nameEn} ${mods}`.toLowerCase().includes(q);
  };

  const passesStatus = (cap: Capability) => {
    const ent = entitled.has(cap), en = visible.has(cap);
    if (statusFilter === 'enabled') return en;
    if (statusFilter === 'disabled') return ent && !en;
    if (statusFilter === 'available') return !ent;
    return true;
  };

  const confirmToggle = () => {
    if (!pending) return;
    setCapabilityHidden(pending.cap, pending.toHidden, { reason: reason.trim() || undefined, by: user?.name });
    setPending(null);
    setReason('');
  };

  const pendingMods = pending ? modulesForCapability(pending.cap) : [];
  const pendingScreens = pendingMods.filter(m => m.domain !== 'reports');
  const pendingReports = pendingMods.filter(m => m.domain === 'reports');
  const pendingMeta = pending ? CAPABILITY_META.find(m => m.id === pending.cap) : null;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Blocks className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'सुविधाएँ' : 'Features'}</h1>
          <p className="text-sm text-muted-foreground">
            {hi ? 'अपनी समिति के लिए मॉड्यूल चालू/बंद करें' : 'Enable or disable modules for your society'}
            {' · '}{typeLabel}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={hi ? 'सुविधा या मॉड्यूल खोजें…' : 'Search features or modules…'} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'enabled', 'disabled', 'available'] as StatusFilter[]).map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
              {hi
                ? ({ all: 'सभी', enabled: 'चालू', disabled: 'बंद', available: 'उपलब्ध' } as const)[s]
                : ({ all: 'All', enabled: 'Enabled', disabled: 'Disabled', available: 'Available' } as const)[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Category groups */}
      {CAPABILITY_CATEGORIES.map(cat => {
        const caps = CAPABILITY_META.filter(m => m.category === cat.key && m.id && passesStatus(m.id) && matchesSearch(m.id));
        if (caps.length === 0) return null;
        const enabledCount = caps.filter(m => visible.has(m.id)).length;
        return (
          <div key={cat.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{hi ? cat.nameHi : cat.nameEn}</h2>
              <span className="text-xs text-muted-foreground">{enabledCount} {hi ? 'चालू' : 'enabled'}</span>
            </div>
            {caps.map(meta => {
              const cap = meta.id;
              const ent = entitled.has(cap);
              const en = visible.has(cap);
              const mandatory = isMandatory(cap);
              const row = adminRevokeRow(cap);
              const mods = modulesForCapability(cap);
              const statusText = !ent ? (hi ? 'इस समिति प्रकार के लिए उपलब्ध नहीं' : 'Not available for your society type')
                : mandatory ? (hi ? 'अनिवार्य' : 'Mandatory')
                : en ? (hi ? 'चालू' : 'Enabled') : (hi ? 'बंद' : 'Disabled');
              const statusVariant = !ent ? 'outline' : mandatory ? 'secondary' : en ? 'default' : 'secondary';
              return (
                <Card key={cap} className={!ent ? 'opacity-60' : ''}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{hi ? meta.nameHi : meta.nameEn}</span>
                        <Badge variant={statusVariant as 'default' | 'secondary' | 'outline'}>{statusText}</Badge>
                        {mandatory && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{hi ? meta.descHi : meta.descEn}</p>
                      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Layers className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{hi ? 'शामिल मॉड्यूल' : 'Includes'}: {mods.length ? mods.map(m => t(m.titleKey)).join(', ') : '—'}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                        <span>{hi ? 'स्रोत' : 'Source'}: {ent ? (hi ? `समिति प्रकार (${typeLabel})` : `Society type (${typeLabel})`) : '—'}</span>
                        <span>{hi ? 'अंतिम बदलाव' : 'Last updated'}: {row?.createdAt ? fmtDateTime(row.createdAt) + (row.grantedBy ? ` · ${row.grantedBy}` : '') : '—'}</span>
                        <a href={meta.docsUrl || '#'} className="inline-flex items-center gap-1 text-primary hover:underline" onClick={e => { if (!meta.docsUrl || meta.docsUrl === '#') e.preventDefault(); }}>
                          <FileText className="h-3.5 w-3.5" />{hi ? 'दस्तावेज़' : 'Documentation'}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:pt-1">
                      <Switch
                        checked={en}
                        disabled={!ent || mandatory}
                        onCheckedChange={() => { setReason(''); setPending({ cap, toHidden: en }); }}
                        aria-label={hi ? 'चालू/बंद' : 'toggle'}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}

      {/* Always-on core note */}
      <p className="text-xs text-muted-foreground border-t pt-4">
        {hi
          ? 'लेखांकन, सदस्य, रिपोर्ट और प्रशासन जैसे मुख्य मॉड्यूल हमेशा चालू रहते हैं और यहाँ नहीं दिखते।'
          : 'Core modules — Accounting, Members, Reports and Administration — are always on and not listed here.'}
      </p>

      {/* Impact-preview confirm dialog */}
      <Dialog open={!!pending} onOpenChange={o => { if (!o) { setPending(null); setReason(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {pending?.toHidden
                ? (hi ? `"${hi ? pendingMeta?.nameHi : pendingMeta?.nameEn}" बंद करें?` : `Disable "${pendingMeta?.nameEn}"?`)
                : (hi ? `"${hi ? pendingMeta?.nameHi : pendingMeta?.nameEn}" चालू करें?` : `Enable "${pendingMeta?.nameEn}"?`)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{pending?.toHidden ? (hi ? 'छिपने वाली स्क्रीन' : 'Hidden screens') : (hi ? 'दिखने वाली स्क्रीन' : 'Shown screens')}:</p>
              <p className="text-muted-foreground">{pendingScreens.length ? pendingScreens.map(m => t(m.titleKey)).join(', ') : (hi ? '(कोई नहीं)' : '(none)')}</p>
            </div>
            <div>
              <p className="font-medium">{pending?.toHidden ? (hi ? 'छिपने वाली रिपोर्ट' : 'Hidden reports') : (hi ? 'दिखने वाली रिपोर्ट' : 'Shown reports')}:</p>
              <p className="text-muted-foreground">{pendingReports.length ? pendingReports.map(m => t(m.titleKey)).join(', ') : (hi ? '(कोई नहीं)' : '(none)')}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">{hi ? 'मौजूदा डेटा प्रभावित?' : 'Existing data affected?'}</span><span className="font-medium text-green-600">{hi ? 'नहीं' : 'No'}</span>
              <span className="text-muted-foreground">{hi ? 'मौजूदा लेखांकन प्रभावित?' : 'Existing accounting affected?'}</span><span className="font-medium text-green-600">{hi ? 'नहीं' : 'No'}</span>
              <span className="text-muted-foreground">{hi ? 'डेटाबेस बदलाव?' : 'Database changes?'}</span><span className="font-medium">{hi ? 'कोई नहीं' : 'None'}</span>
              <span className="text-muted-foreground">{hi ? 'वापस लाया जा सकता है?' : 'Rollback possible?'}</span><span className="font-medium text-green-600">{hi ? 'हाँ — कभी भी दोबारा चालू करें' : 'Yes — re-enable anytime'}</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{hi ? 'कारण (वैकल्पिक)' : 'Reason (optional)'}</label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={hi ? 'क्यों बदल रहे हैं…' : 'Why are you changing this…'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setReason(''); }}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button variant={pending?.toHidden ? 'destructive' : 'default'} onClick={confirmToggle}>
              {pending?.toHidden ? (hi ? 'सुविधा बंद करें' : 'Disable feature') : (hi ? 'सुविधा चालू करें' : 'Enable feature')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
