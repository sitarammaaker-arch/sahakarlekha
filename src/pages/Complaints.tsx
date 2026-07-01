import { useState } from 'react';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquareWarning, Trash2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'plumbing', en: 'Plumbing', hi: 'नलसाजी' },
  { id: 'electrical', en: 'Electrical', hi: 'बिजली' },
  { id: 'lift', en: 'Lift', hi: 'लिफ्ट' },
  { id: 'security', en: 'Security', hi: 'सुरक्षा' },
  { id: 'common_area', en: 'Common Area', hi: 'सामान्य क्षेत्र' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
];
const STATUSES = [
  { id: 'open', en: 'Open', hi: 'खुला' },
  { id: 'in_progress', en: 'In Progress', hi: 'प्रगति पर' },
  { id: 'resolved', en: 'Resolved', hi: 'हल' },
  { id: 'closed', en: 'Closed', hi: 'बंद' },
] as const;

export default function Complaints() {
  const { complaints, addComplaint, updateComplaint, deleteComplaint } = useHousingData();
  const { housingFlats } = useHousingData();
  const { members } = useData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const today = () => new Date().toISOString().split('T')[0];

  const [flatId, setFlatId] = useState('');
  const [category, setCategory] = useState('other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [raisedDate, setRaisedDate] = useState(today());
  const [filter, setFilter] = useState<'all' | 'open'>('open');

  const flats = housingFlats.filter(f => !f.isDeleted);
  const flatLabel = (id?: string) => { const f = flats.find(x => x.id === id); return f ? `${f.flatNo}${f.blockNo ? `/${f.blockNo}` : ''}` : ''; };
  const memberOf = (flatId?: string) => flats.find(f => f.id === flatId)?.memberId;
  const catLabel = (id?: string) => { const c = CATEGORIES.find(x => x.id === id); return c ? (hi ? c.hi : c.en) : id; };
  const statusMeta = (s: string) => STATUSES.find(x => x.id === s) || STATUSES[0];

  const save = () => {
    if (!title.trim()) { toast({ title: hi ? 'शीर्षक आवश्यक' : 'Title required', variant: 'destructive' }); return; }
    const flat = flats.find(f => f.id === flatId);
    const c = addComplaint({
      flatId: flatId || undefined, flatNo: flat?.flatNo, memberId: memberOf(flatId),
      category, title: title.trim(), description: description.trim() || undefined,
      raisedDate, status: 'open',
    });
    if (c.id) { toast({ title: hi ? 'शिकायत दर्ज' : 'Complaint logged', description: c.complaintNo }); setTitle(''); setDescription(''); setFlatId(''); setCategory('other'); }
  };

  const setStatus = (id: string, status: string) => {
    updateComplaint(id, { status: status as any, resolvedDate: (status === 'resolved' || status === 'closed') ? today() : undefined });
  };

  const list = complaints.filter(c => !c.isDeleted && (filter === 'all' || c.status === 'open' || c.status === 'in_progress'))
    .sort((a, b) => (b.raisedDate || '').localeCompare(a.raisedDate || ''));
  const openCount = complaints.filter(c => !c.isDeleted && (c.status === 'open' || c.status === 'in_progress')).length;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquareWarning className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'शिकायत रजिस्टर' : 'Complaints Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'निवासी शिकायतें दर्ज करें और स्थिति ट्रैक करें' : 'Log resident complaints and track their status'}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{hi ? 'नई शिकायत' : 'New Complaint'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{hi ? 'फ्लैट' : 'Flat'}</Label>
              <Select value={flatId} onValueChange={setFlatId}>
                <SelectTrigger><SelectValue placeholder={hi ? 'फ्लैट चुनें (वैकल्पिक)' : 'Select flat (optional)'} /></SelectTrigger>
                <SelectContent>{flats.map(f => <SelectItem key={f.id} value={f.id}>{f.flatNo}{f.blockNo ? `/${f.blockNo}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'श्रेणी' : 'Category'}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{hi ? c.hi : c.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'शीर्षक' : 'Title'} *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={hi ? 'संक्षिप्त विवरण' : 'Short summary'} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{hi ? 'विवरण' : 'Description'}</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder={hi ? 'वैकल्पिक' : 'optional'} />
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'तिथि' : 'Date'}</Label>
              <Input type="date" value={raisedDate} onChange={e => setRaisedDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={save} className="w-full">{hi ? 'शिकायत दर्ज करें' : 'Log Complaint'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{hi ? 'शिकायतें' : 'Complaints'} ({openCount} {hi ? 'खुली' : 'open'})</span>
            <Select value={filter} onValueChange={v => setFilter(v as 'all' | 'open')}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{hi ? 'खुली' : 'Open'}</SelectItem>
                <SelectItem value="all">{hi ? 'सभी' : 'All'}</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई शिकायत नहीं।' : 'No complaints.'}</p>}
          {list.map(c => (
            <div key={c.id} className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium flex flex-wrap items-center gap-1">
                    <span>{c.title}</span>
                    <Badge variant="outline">{catLabel(c.category)}</Badge>
                  </div>
                  <div className="text-muted-foreground">{c.complaintNo} · {c.raisedDate}{c.flatNo ? ` · ${c.flatNo}` : ''}</div>
                  {c.description && <div className="text-muted-foreground mt-0.5">{c.description}</div>}
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { if (window.confirm(hi ? 'शिकायत हटाएँ?' : 'Delete complaint?')) deleteComplaint(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === 'resolved' || c.status === 'closed' ? 'default' : c.status === 'in_progress' ? 'secondary' : 'destructive'}>{hi ? statusMeta(c.status).hi : statusMeta(c.status).en}</Badge>
                <Select value={c.status} onValueChange={v => setStatus(c.id, v)}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{hi ? s.hi : s.en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
