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
  type Capability, type CapabilityMeta,
} from '@/lib/navigation';
import { SOCIETY_TYPES } from '@/lib/constants';
import { Blocks, Lock, Search, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateUtils';

export default function Features() {
  const { society, societyCapabilities, setCapabilityHidden } = useData();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const hi = language === 'hi';
  const societyType = society.societyType ?? 'other';
  const typeLabel = SOCIETY_TYPES.find(s => s.value === societyType)?.[hi ? 'labelHi' : 'label'] ?? societyType;

  const entitled = useMemo(() => resolveEntitlements(societyType, societyCapabilities), [societyType, societyCapabilities]);
  const visible = useMemo(() => resolveCapabilities(societyType, societyCapabilities), [societyType, societyCapabilities]);

  const [showOthers, setShowOthers] = useState(false);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ cap: Capability; toHidden: boolean } | null>(null);
  const [reason, setReason] = useState('');

  // Defense in depth (C6.2): this screen governs module visibility, so it must enforce
  // admin-only at the COMPONENT level — never rely on the sidebar hiding the link. A
  // non-admin reaching /features directly (URL/bookmark) gets no access and no toggles.
  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>{hi ? 'केवल व्यवस्थापक के लिए' : 'Admin access required'}</p>
      </div>
    );
  }

  const adminRevokeRow = (cap: Capability) =>
    societyCapabilities.find(r => r.capability === cap && r.source === 'admin' && r.mode === 'revoke');
  const isMandatory = (cap: Capability) =>
    societyCapabilities.some(r => r.capability === cap && (r.source === 'state' || r.source === 'system') && r.mode === 'grant' && (!r.expiresAt || new Date(r.expiresAt).getTime() > Date.now()));

  // Relevant = entitled (applies to this society). Others = the rest (read-only).
  const relevant = CAPABILITY_META.filter(m => entitled.has(m.id));
  const others = CAPABILITY_META.filter(m => !entitled.has(m.id));
  const othersFiltered = others.filter(m => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const mods = modulesForCapability(m.id).map(x => x.titleKey).join(' ');
    return `${m.nameHi} ${m.nameEn} ${mods}`.toLowerCase().includes(q);
  });

  const confirmToggle = () => {
    if (!pending) return;
    setCapabilityHidden(pending.cap, pending.toHidden, { reason: reason.trim() || undefined, by: user?.name });
    setPending(null);
    setReason('');
  };

  const pendingMods = pending ? modulesForCapability(pending.cap) : [];
  const pendingScreens = pendingMods.filter(m => m.domain !== 'reports');
  const pendingReports = pendingMods.filter(m => m.domain === 'reports');
  const pendingMeta = pending ? CAPABILITY_META.find(m => m.id === pending.cap) ?? null : null;

  const FeatureCard = ({ meta, readOnly }: { meta: CapabilityMeta; readOnly: boolean }) => {
    const cap = meta.id;
    const en = visible.has(cap);
    const mandatory = isMandatory(cap);
    const row = adminRevokeRow(cap);
    const mods = modulesForCapability(cap);
    const statusText = readOnly ? (hi ? 'आपकी समिति के लिए नहीं' : 'Not for your society')
      : mandatory ? (hi ? 'ज़रूरी — हटा नहीं सकते' : 'Required — can’t remove')
      : en ? (hi ? 'चालू' : 'On') : (hi ? 'बंद' : 'Off');
    const statusVariant: 'default' | 'secondary' | 'outline' = readOnly ? 'outline' : mandatory ? 'secondary' : en ? 'default' : 'secondary';
    const toggleable = !readOnly && !mandatory;
    return (
      <Card className={readOnly ? 'opacity-70' : ''}>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{hi ? meta.nameHi : meta.nameEn}</span>
              <Badge variant={statusVariant}>{statusText}</Badge>
              {mandatory && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">{hi ? meta.descHi : meta.descEn}</p>
            {mods.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {hi ? 'इसमें ये आते हैं' : 'Includes'}: {mods.map(m => t(m.titleKey)).join(', ')}
              </p>
            )}
            {row?.createdAt && (
              <p className="text-xs text-muted-foreground">
                {hi ? 'पिछली बार बदला' : 'Last changed'}: {fmtDateTime(row.createdAt)}{row.grantedBy ? ` · ${row.grantedBy}` : ''}
              </p>
            )}
          </div>
          {toggleable ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setReason(''); setPending({ cap, toHidden: en }); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReason(''); setPending({ cap, toHidden: en }); } }}
              className="p-3 -m-1 rounded-xl hover:bg-muted/60 active:bg-muted transition-colors shrink-0 cursor-pointer flex items-center"
              aria-label={hi ? (en ? 'बंद करें' : 'चालू करें') : (en ? 'Turn off' : 'Turn on')}
            >
              <Switch checked={en} className="pointer-events-none" tabIndex={-1} />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground shrink-0 px-2">{mandatory ? <Lock className="h-4 w-4" /> : '—'}</span>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Blocks className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'सुविधाएँ' : 'Features'}</h1>
          <p className="text-sm text-muted-foreground">{typeLabel}</p>
        </div>
      </div>

      {/* Reassurance banner (positive) */}
      <div className="flex items-start gap-3 rounded-xl border border-green-600/20 bg-green-600/5 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/80">
          {hi
            ? 'आपकी समिति के लिए आवश्यक सुविधाएँ पहले से चालू हैं। सामान्यतः यहाँ कोई बदलाव करने की आवश्यकता नहीं होती।'
            : 'Your society’s essential modules are already on. You usually don’t need to change anything here.'}
        </p>
      </div>

      {/* Relevant features OR empty state */}
      {relevant.length > 0 ? (
        <div className="space-y-3">
          {relevant.map(meta => <FeatureCard key={meta.id} meta={meta} readOnly={false} />)}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-5">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-foreground/80">
            {hi ? 'आपकी समिति की सभी उपलब्ध सुविधाएँ पहले से चालू हैं।' : 'All available modules for your society are already on.'}
          </p>
        </div>
      )}

      {/* Secondary action: reveal the rest (kept, not removed) */}
      {others.length > 0 && (
        <div className="space-y-3">
          <Button variant="ghost" className="w-full justify-between text-muted-foreground" onClick={() => setShowOthers(v => !v)}>
            <span>{hi ? 'अन्य उपलब्ध सुविधाएँ देखें' : 'See other available features'} ({others.length})</span>
            {showOthers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showOthers && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={hi ? 'सुविधा खोजें…' : 'Search features…'} className="pl-9" />
              </div>
              {CAPABILITY_CATEGORIES.map(cat => {
                const inCat = othersFiltered.filter(m => m.category === cat.key);
                if (inCat.length === 0) return null;
                return (
                  <div key={cat.key} className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">{hi ? cat.nameHi : cat.nameEn}</h2>
                    {inCat.map(meta => <FeatureCard key={meta.id} meta={meta} readOnly />)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Always-on core note */}
      <p className="text-xs text-muted-foreground border-t pt-4">
        {hi
          ? 'लेखांकन, सदस्य, रिपोर्ट और प्रशासन जैसे मुख्य मॉड्यूल हमेशा चालू रहते हैं।'
          : 'Core modules — Accounting, Members, Reports and Administration — are always on.'}
      </p>

      {/* Impact-preview confirm dialog */}
      <Dialog open={!!pending} onOpenChange={o => { if (!o) { setPending(null); setReason(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {pending?.toHidden
                ? (hi ? `"${pendingMeta?.nameHi}" बंद करें?` : `Turn off "${pendingMeta?.nameEn}"?`)
                : (hi ? `"${pendingMeta?.nameHi}" चालू करें?` : `Turn on "${pendingMeta?.nameEn}"?`)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{pending?.toHidden ? (hi ? 'ये स्क्रीन छिप जाएँगी' : 'These screens will hide') : (hi ? 'ये स्क्रीन दिखेंगी' : 'These screens will show')}:</p>
              <p className="text-muted-foreground">{pendingScreens.length ? pendingScreens.map(m => t(m.titleKey)).join(', ') : (hi ? '(कोई नहीं)' : '(none)')}</p>
            </div>
            <div>
              <p className="font-medium">{pending?.toHidden ? (hi ? 'ये रिपोर्ट छिप जाएँगी' : 'These reports will hide') : (hi ? 'ये रिपोर्ट दिखेंगी' : 'These reports will show')}:</p>
              <p className="text-muted-foreground">{pendingReports.length ? pendingReports.map(m => t(m.titleKey)).join(', ') : (hi ? '(कोई नहीं)' : '(none)')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">{hi ? 'क्या पुराना डेटा बदलेगा?' : 'Will old data change?'}</span><span className="font-medium text-green-600">{hi ? 'नहीं' : 'No'}</span>
              <span className="text-muted-foreground">{hi ? 'हिसाब-किताब पर असर?' : 'Affects accounts?'}</span><span className="font-medium text-green-600">{hi ? 'नहीं' : 'No'}</span>
              <span className="text-muted-foreground">{hi ? 'क्या कुछ डेटा हटेगा?' : 'Will any data be deleted?'}</span><span className="font-medium">{hi ? 'नहीं, कुछ नहीं' : 'No, nothing'}</span>
              <span className="text-muted-foreground">{hi ? 'वापस ला सकते हैं?' : 'Can undo?'}</span><span className="font-medium text-green-600">{hi ? 'हाँ, कभी भी' : 'Yes, anytime'}</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{hi ? 'कारण (ज़रूरी नहीं)' : 'Reason (optional)'}</label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={hi ? 'क्यों बदल रहे हैं…' : 'Why are you changing this…'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setReason(''); }}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button variant={pending?.toHidden ? 'destructive' : 'default'} onClick={confirmToggle}>
              {pending?.toHidden ? (hi ? 'हाँ, बंद करें' : 'Yes, turn off') : (hi ? 'हाँ, चालू करें' : 'Yes, turn on')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
