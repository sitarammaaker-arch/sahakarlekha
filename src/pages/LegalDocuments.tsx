import { useState } from 'react';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileCheck, Trash2 } from 'lucide-react';

const DOC_TYPES = [
  { id: 'noc', en: 'NOC', hi: 'एनओसी' },
  { id: 'occupancy_cert', en: 'Occupancy Certificate', hi: 'अधिभोग प्रमाणपत्र' },
  { id: 'completion_cert', en: 'Completion Certificate', hi: 'समापन प्रमाणपत्र' },
  { id: 'legal_notice', en: 'Legal Notice', hi: 'कानूनी नोटिस' },
  { id: 'agreement', en: 'Agreement / Deed', hi: 'समझौता / विलेख' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
];
const STATUSES = [
  { id: 'valid', en: 'Valid', hi: 'वैध' },
  { id: 'pending', en: 'Pending', hi: 'लंबित' },
  { id: 'expired', en: 'Expired', hi: 'समाप्त' },
] as const;

export default function LegalDocuments() {
  const { documents, addDocument, deleteDocument } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [docType, setDocType] = useState('noc');
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [authority, setAuthority] = useState('');
  const [date, setDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState<'valid' | 'pending' | 'expired'>('valid');

  const typeLabel = (id?: string) => { const d = DOC_TYPES.find(x => x.id === id); return d ? (hi ? d.hi : d.en) : id; };
  const statusMeta = (s?: string) => STATUSES.find(x => x.id === s) || STATUSES[0];

  const save = () => {
    if (!title.trim()) { toast({ title: hi ? 'शीर्षक आवश्यक' : 'Title required', variant: 'destructive' }); return; }
    const p = addDocument({
      docType, title: title.trim(), reference: reference.trim() || undefined, authority: authority.trim() || undefined,
      date: date || undefined, expiryDate: expiryDate || undefined, status,
    });
    if (p.id) { toast({ title: hi ? 'दस्तावेज़ जोड़ा गया' : 'Document added', description: p.title }); setTitle(''); setReference(''); setAuthority(''); setDate(''); setExpiryDate(''); }
  };

  const list = documents.filter(d => !d.isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'कानूनी / दस्तावेज़ रजिस्टर' : 'Legal / Document Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'NOC, अधिभोग प्रमाणपत्र, नोटिस व अन्य वैधानिक दस्तावेज़' : 'NOCs, occupancy certificates, notices and other statutory documents'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नया दस्तावेज़' : 'New Document'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'प्रकार' : 'Type'}</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(d => <SelectItem key={d.id} value={d.id}>{hi ? d.hi : d.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{hi ? 'शीर्षक' : 'Title'} *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'संदर्भ सं.' : 'Reference No.'}</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'जारीकर्ता / प्राधिकरण' : 'Authority'}</Label><Input value={authority} onChange={e => setAuthority(e.target.value)} placeholder={hi ? 'जैसे नगर निगम' : 'e.g. Municipal Corp.'} /></div>
            <div className="space-y-2"><Label>{hi ? 'तिथि' : 'Date'}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{hi ? 'समाप्ति तिथि' : 'Expiry Date'}</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>{hi ? 'स्थिति' : 'Status'}</Label>
              <Select value={status} onValueChange={v => setStatus(v as 'valid' | 'pending' | 'expired')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{hi ? s.hi : s.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'दस्तावेज़ सेव करें' : 'Save Document'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'दस्तावेज़' : 'Documents'} ({list.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई दस्तावेज़ नहीं।' : 'No documents yet.'}</p>}
          {list.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{d.title}</span>
                  <Badge variant="outline">{typeLabel(d.docType)}</Badge>
                  <Badge variant={d.status === 'expired' ? 'destructive' : d.status === 'pending' ? 'secondary' : 'default'}>{hi ? statusMeta(d.status).hi : statusMeta(d.status).en}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {d.reference ? `${d.reference} · ` : ''}{d.authority || '—'}{d.date ? ` · ${d.date}` : ''}{d.expiryDate ? ` → ${d.expiryDate}` : ''}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'दस्तावेज़ हटाएँ?' : 'Delete document?')) deleteDocument(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
