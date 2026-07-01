import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { generateHousingShareNominationPDF } from '@/lib/pdf';
import { ScrollText, Pencil, Download } from 'lucide-react';
import type { HousingFlat } from '@/types';

export default function ShareNominationRegister() {
  const { members, society } = useData();
  const { housingFlats, updateHousingFlat } = useHousingData();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const flats = housingFlats.filter(f => !f.isDeleted).sort((a, b) => (a.flatNo || '').localeCompare(b.flatNo || '', undefined, { numeric: true }));
  const memberLabel = (id?: string) => { const m = members.find(x => x.id === id); return m ? `${m.name} (${m.memberId})` : (hi ? '— खाली —' : '— Vacant —'); };

  const [editId, setEditId] = useState('');
  const [certNo, setCertNo] = useState('');
  const [shares, setShares] = useState('');
  const [faceVal, setFaceVal] = useState('');
  const [nomName, setNomName] = useState('');
  const [nomRel, setNomRel] = useState('');
  const [nomPhone, setNomPhone] = useState('');

  const openEdit = (f: HousingFlat) => {
    setEditId(f.id);
    setCertNo(f.shareCertNo || ''); setShares(f.shareCount != null ? String(f.shareCount) : ''); setFaceVal(f.shareFaceValue != null ? String(f.shareFaceValue) : '');
    setNomName(f.nomineeName || ''); setNomRel(f.nomineeRelation || ''); setNomPhone(f.nomineePhone || '');
  };
  const save = () => {
    updateHousingFlat(editId, {
      shareCertNo: certNo.trim() || undefined,
      shareCount: shares ? Number(shares) : undefined,
      shareFaceValue: faceVal ? Number(faceVal) : undefined,
      nomineeName: nomName.trim() || undefined,
      nomineeRelation: nomRel.trim() || undefined,
      nomineePhone: nomPhone.trim() || undefined,
    });
    toast({ title: hi ? 'सहेजा गया' : 'Saved' });
    setEditId('');
  };

  const totalShares = flats.reduce((s, f) => s + (f.shareCount || 0), 0);
  const totalCapital = flats.reduce((s, f) => s + (f.shareCount || 0) * (f.shareFaceValue || 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ScrollText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'शेयर एवं नामांकन रजिस्टर' : 'Share & Nomination Register'}</h1>
          <p className="text-sm text-muted-foreground">{hi ? 'प्रति-फ्लैट शेयर प्रमाणपत्र और नामिती — मालिक बदलने पर प्रमाणपत्र फ्लैट के साथ रहता है' : 'Per-flat share certificate and nominee — the certificate follows the flat on transfer'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{hi ? 'फ्लैट' : 'Flats'} ({flats.length}) · {hi ? 'कुल शेयर' : 'Total shares'} {totalShares} · {money(totalCapital)}</span>
            {flats.length > 0 && <Button size="sm" variant="outline" onClick={() => generateHousingShareNominationPDF(flats, members, society)} className="gap-1"><Download className="h-4 w-4" />PDF</Button>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flats.length === 0 && <p className="text-sm text-muted-foreground">{hi ? 'कोई फ्लैट नहीं — पहले Flats Register में जोड़ें।' : 'No flats — add them in the Flats Register first.'}</p>}
          {flats.map(f => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium flex flex-wrap items-center gap-1">
                  <span>{f.flatNo}{f.blockNo ? ` · ${f.blockNo}` : ''}</span>
                  {f.shareCertNo && <Badge variant="secondary">{hi ? 'प्रमाणपत्र' : 'Cert'} {f.shareCertNo}</Badge>}
                  {(f.shareCount || 0) > 0 && <Badge variant="outline">{f.shareCount} {hi ? 'शेयर' : 'shares'}</Badge>}
                </div>
                <div className="text-muted-foreground">
                  {memberLabel(f.memberId)}
                  {f.nomineeName ? ` · ${hi ? 'नामिती' : 'Nominee'}: ${f.nomineeName}${f.nomineeRelation ? ` (${f.nomineeRelation})` : ''}` : ` · ${hi ? 'नामिती नहीं' : 'no nominee'}`}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editId} onOpenChange={o => { if (!o) setEditId(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{hi ? 'शेयर एवं नामिती' : 'Share & Nominee'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">{hi ? 'शेयर प्रमाणपत्र' : 'Share Certificate'}</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'प्रमाणपत्र सं.' : 'Cert No.'}</Label><Input value={certNo} onChange={e => setCertNo(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'शेयर' : 'Shares'}</Label><Input type="number" min={0} value={shares} onChange={e => setShares(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'अंकित मूल्य' : 'Face ₹'}</Label><Input type="number" min={0} value={faceVal} onChange={e => setFaceVal(e.target.value)} /></div>
            </div>
            <div className="text-xs font-medium text-muted-foreground pt-1">{hi ? 'नामिती' : 'Nominee'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{hi ? 'नाम' : 'Name'}</Label><Input value={nomName} onChange={e => setNomName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{hi ? 'संबंध' : 'Relation'}</Label><Input value={nomRel} onChange={e => setNomRel(e.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>{hi ? 'फोन' : 'Phone'}</Label><Input value={nomPhone} onChange={e => setNomPhone(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId('')}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={save}>{hi ? 'सेव करें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
