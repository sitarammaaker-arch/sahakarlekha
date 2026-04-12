import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Download, Vote, Trophy, Users, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { addHeader, addPageNumbers, addSignatureBlock, getSignatoryNames, pdfFileName } from '@/lib/pdf';
import { electionSelect, electionInsert, electionUpdate } from '@/lib/supabaseService';

type ElectionStatus = 'upcoming' | 'ongoing' | 'completed';
type PostType = 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'director' | 'other';

interface Candidate {
  id: string;
  name: string;
  memberId?: string;
  votes: number;
}

interface Election {
  id: string;
  electionNo: string;
  title: string;
  post: PostType;
  electionDate: string;
  nominationDeadline: string;
  status: ElectionStatus;
  candidates: Candidate[];
  totalVoters: number;
  votesCast: number;
  winnerId?: string;
  remarks?: string;
  createdAt: string;
  createdBy: string;
}

const postLabel: Record<PostType, { hi: string; en: string }> = {
  president:       { hi: 'अध्यक्ष',          en: 'President' },
  vice_president:  { hi: 'उपाध्यक्ष',         en: 'Vice President' },
  secretary:       { hi: 'सचिव',              en: 'Secretary' },
  treasurer:       { hi: 'कोषाध्यक्ष',        en: 'Treasurer' },
  director:        { hi: 'संचालक',            en: 'Director' },
  other:           { hi: 'अन्य',              en: 'Other' },
};

const statusColor: Record<ElectionStatus, string> = {
  upcoming: 'bg-blue-100 text-blue-800',
  ongoing:  'bg-yellow-100 text-yellow-800',
  completed:'bg-green-100 text-green-800',
};

export default function ElectionModule() {
  const { members, society } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const societyId = user?.societyId || 'SOC001';

  const [elections, setElections] = useState<Election[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState<Election | null>(null);
  const [form, setForm] = useState({ title: '', post: 'director' as PostType, electionDate: '', nominationDeadline: '', totalVoters: '', remarks: '' });
  const [candidates, setCandidates] = useState<{ name: string; memberId: string }[]>([{ name: '', memberId: '' }]);

  // Load from Supabase
  useEffect(() => {
    if (!societyId) return;
    electionSelect(societyId).then(({ data, error }) => {
      if (error) { console.error('Elections load error:', error); return; }
      const parsed = data.map((e: any) => ({
        ...e,
        candidates: Array.isArray(e.candidates) ? e.candidates : [],
      })) as Election[];
      setElections(parsed);
    });
  }, [societyId]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active' && (!m.approvalStatus || m.approvalStatus === 'approved')), [members]);
  const nextNo = () => `ELECT-${new Date().getFullYear()}-${String(elections.length + 1).padStart(3, '0')}`;

  const handleCreate = async () => {
    if (!form.title || !form.electionDate) return;
    const now = new Date().toISOString().split('T')[0];
    const status: ElectionStatus = form.electionDate > now ? 'upcoming' : form.electionDate === now ? 'ongoing' : 'completed';
    const election: Election & { society_id: string } = {
      id: `elec_${Date.now()}`,
      electionNo: nextNo(),
      title: form.title,
      post: form.post,
      electionDate: form.electionDate,
      nominationDeadline: form.nominationDeadline,
      status,
      candidates: candidates.filter(c => c.name.trim()).map((c, i) => ({ id: `c_${i}`, name: c.name, memberId: c.memberId, votes: 0 })),
      totalVoters: parseInt(form.totalVoters) || activeMembers.length,
      votesCast: 0,
      remarks: form.remarks,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || '',
      society_id: societyId,
    };

    const { error } = await electionInsert(election);
    if (error) {
      toast({ title: 'Save failed', description: error, variant: 'destructive' }); return;
    }
    setElections(prev => [election, ...prev]);
    setShowDialog(false);
    setForm({ title: '', post: 'director', electionDate: '', nominationDeadline: '', totalVoters: '', remarks: '' });
    setCandidates([{ name: '', memberId: '' }]);
    toast({ title: hi ? 'चुनाव दर्ज किया गया' : 'Election created' });
  };

  const handleSaveVotes = async (electionId: string, updatedCandidates: Candidate[], votesCast: number) => {
    const winner = [...updatedCandidates].sort((a, b) => b.votes - a.votes)[0];
    const updates = { candidates: updatedCandidates, votesCast, status: 'completed' as ElectionStatus, winnerId: winner?.id };

    const { error } = await electionUpdate(electionId, updates);
    if (error) {
      toast({ title: 'Save failed', description: error, variant: 'destructive' }); return;
    }
    setElections(prev => prev.map(e => e.id !== electionId ? e : { ...e, ...updates }));
    setShowVoteDialog(null);
    toast({ title: hi ? 'परिणाम दर्ज किया गया' : 'Results recorded' });
  };

  const csvHeaders = ['No.', 'Title', 'Post', 'Date', 'Candidates', 'Winner', 'Status'];
  const getCsvRows = () =>
    elections.map(e => {
      const winner = e.winnerId ? e.candidates.find(c => c.id === e.winnerId) : null;
      return [e.electionNo, e.title, postLabel[e.post].en, e.electionDate, e.candidates.length, winner?.name || '—', e.status];
    });

  const handleCSV = () => downloadCSV(csvHeaders, getCsvRows(), 'election-module');
  const handleExcel = () => downloadExcelSingle(csvHeaders, getCsvRows(), 'election-module', 'Elections');

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { startY, font } = addHeader(doc, 'Election Report', society, `Financial Year: ${society.financialYear}`, { reportCode: 'ELC' });
    autoTable(doc, {
      startY,
      head: [['No.', 'Title', 'Post', 'Date', 'Candidates', 'Winner', 'Status']],
      body: elections.map(e => {
        const winner = e.winnerId ? e.candidates.find(c => c.id === e.winnerId) : null;
        return [e.electionNo, e.title, postLabel[e.post].en, e.electionDate, e.candidates.length, winner?.name || '—', e.status];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 73, 94] },
    });
    const sigY = (doc as any).lastAutoTable.finalY + 10;
    const sig = getSignatoryNames(society);
    addSignatureBlock(doc, font, ['Secretary', 'Election Officer', 'President'], sigY, undefined,
      [sig.secretary, '', sig.president]);

    addPageNumbers(doc, font, society?.name);
    doc.save(pdfFileName('ElectionReport', society));
  };

  const upcoming = elections.filter(e => e.status === 'upcoming');
  const ongoing = elections.filter(e => e.status === 'ongoing');
  const completed = elections.filter(e => e.status === 'completed');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'सहकारी चुनाव मॉड्यूल' : 'Cooperative Election Module'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'बोर्ड चुनाव, मतदान और परिणाम प्रबंधन' : 'Board elections, voting and result management'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handlePDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
          <Button variant="outline" onClick={handleCSV}><FileSpreadsheet className="h-4 w-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={handleExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          {user?.role === 'admin' && (
            <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />{hi ? 'नया चुनाव' : 'New Election'}</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{hi ? 'आगामी' : 'Upcoming'}</p><p className="font-bold text-lg text-blue-700">{upcoming.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{hi ? 'जारी' : 'Ongoing'}</p><p className="font-bold text-lg text-yellow-700">{ongoing.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{hi ? 'पूर्ण' : 'Completed'}</p><p className="font-bold text-lg text-green-700">{completed.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="upcoming">{hi ? 'आगामी' : 'Upcoming'}</TabsTrigger>
          <TabsTrigger value="ongoing">{hi ? 'जारी' : 'Ongoing'}</TabsTrigger>
          <TabsTrigger value="completed">{hi ? 'पूर्ण' : 'Completed'}</TabsTrigger>
          <TabsTrigger value="all">{hi ? 'सभी' : 'All'}</TabsTrigger>
        </TabsList>
        {(['upcoming', 'ongoing', 'completed', 'all'] as const).map(tab => {
          const data = tab === 'all' ? elections : elections.filter(e => e.status === tab);
          return (
            <TabsContent key={tab} value={tab}>
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{hi ? 'सं.' : 'No.'}</TableHead>
                      <TableHead>{hi ? 'चुनाव' : 'Election'}</TableHead>
                      <TableHead>{hi ? 'पद' : 'Post'}</TableHead>
                      <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                      <TableHead className="text-center">{hi ? 'उम्मीदवार' : 'Candidates'}</TableHead>
                      <TableHead>{hi ? 'विजेता' : 'Winner'}</TableHead>
                      <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        <Vote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {hi ? 'कोई चुनाव नहीं' : 'No elections'}
                      </TableCell></TableRow>
                    ) : data.map(e => {
                      const winner = e.winnerId ? e.candidates.find(c => c.id === e.winnerId) : null;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-xs">{e.electionNo}</TableCell>
                          <TableCell className="font-medium">{e.title}</TableCell>
                          <TableCell>{hi ? postLabel[e.post].hi : postLabel[e.post].en}</TableCell>
                          <TableCell>{e.electionDate}</TableCell>
                          <TableCell className="text-center">{e.candidates.length}</TableCell>
                          <TableCell>
                            {winner ? <span className="flex items-center gap-1 text-green-700"><Trophy className="h-3 w-3" />{winner.name}</span> : '—'}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[e.status]}`}>
                              {e.status === 'upcoming' ? (hi ? 'आगामी' : 'Upcoming') : e.status === 'ongoing' ? (hi ? 'जारी' : 'Ongoing') : (hi ? 'पूर्ण' : 'Completed')}
                            </span>
                          </TableCell>
                          <TableCell>
                            {e.status !== 'completed' && user?.role === 'admin' && (
                              <Button size="sm" variant="outline" onClick={() => setShowVoteDialog(e)}>
                                {hi ? 'परिणाम' : 'Results'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Create Election Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{hi ? 'नया चुनाव' : 'New Election'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{hi ? 'शीर्षक' : 'Election Title'} *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={hi ? 'जैसे: बोर्ड चुनाव 2025' : 'e.g. Board Election 2025'} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{hi ? 'पद' : 'Post'}</Label>
                <Select value={form.post} onValueChange={v => setForm(p => ({ ...p, post: v as PostType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(postLabel).map(([k, v]) => <SelectItem key={k} value={k}>{hi ? v.hi : v.en}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div><Label>{hi ? 'चुनाव तिथि' : 'Election Date'} *</Label>
                <Input type="date" value={form.electionDate} onChange={e => setForm(p => ({ ...p, electionDate: e.target.value }))} /></div>
              <div><Label>{hi ? 'नामांकन अंतिम तिथि' : 'Nomination Deadline'}</Label>
                <Input type="date" value={form.nominationDeadline} onChange={e => setForm(p => ({ ...p, nominationDeadline: e.target.value }))} /></div>
              <div><Label>{hi ? 'कुल मतदाता' : 'Total Voters'}</Label>
                <Input type="number" value={form.totalVoters} onChange={e => setForm(p => ({ ...p, totalVoters: e.target.value }))} placeholder={String(activeMembers.length)} /></div>
            </div>
            <div>
              <Label className="mb-2 block">{hi ? 'उम्मीदवार' : 'Candidates'}</Label>
              {candidates.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input placeholder={hi ? 'नाम' : 'Name'} value={c.name} onChange={e => { const u = [...candidates]; u[i].name = e.target.value; setCandidates(u); }} />
                  <Select value={c.memberId} onValueChange={v => { const u = [...candidates]; u[i].memberId = v; if (v !== '__none__') { const m = activeMembers.find(m => m.id === v); if (m) u[i].name = m.name; } setCandidates(u); }}>
                    <SelectTrigger className="w-40"><SelectValue placeholder={hi ? 'सदस्य' : 'Member'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{hi ? 'बाहरी' : 'External'}</SelectItem>
                      {activeMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {candidates.length > 1 && <Button size="sm" variant="ghost" onClick={() => setCandidates(candidates.filter((_, j) => j !== i))}>✕</Button>}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setCandidates([...candidates, { name: '', memberId: '' }])}>
                <Plus className="h-3 w-3 mr-1" />{hi ? 'उम्मीदवार जोड़ें' : 'Add Candidate'}
              </Button>
            </div>
            <div><Label>{hi ? 'टिप्पणी' : 'Remarks'}</Label>
              <Input value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button onClick={handleCreate}>{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vote Entry Dialog */}
      {showVoteDialog && (
        <VoteEntryDialog election={showVoteDialog} hi={hi} onSave={handleSaveVotes} onClose={() => setShowVoteDialog(null)} />
      )}
    </div>
  );
}

function VoteEntryDialog({ election, hi, onSave, onClose }: {
  election: Election; hi: boolean;
  onSave: (id: string, candidates: Candidate[], votesCast: number) => void;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(election.candidates.map(c => ({ ...c })));
  const [votesCast, setVotesCast] = useState(String(election.votesCast || ''));
  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{hi ? 'परिणाम दर्ज करें' : 'Enter Results'} — {election.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{hi ? 'कुल मत डाले गए' : 'Total Votes Cast'}</Label>
            <Input type="number" value={votesCast} onChange={e => setVotesCast(e.target.value)} /></div>
          <p className="text-sm font-medium">{hi ? 'उम्मीदवार-वार मत' : 'Candidate-wise Votes'}</p>
          {candidates.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{c.name}</span>
              <Input type="number" min="0" className="w-24 text-right" value={c.votes}
                onChange={e => { const u = [...candidates]; u[i].votes = parseInt(e.target.value) || 0; setCandidates(u); }} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{hi ? 'कुल:' : 'Total:'} {totalVotes}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={() => onSave(election.id, candidates, parseInt(votesCast) || totalVotes)}>
              {hi ? 'परिणाम सहेजें' : 'Save Results'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
