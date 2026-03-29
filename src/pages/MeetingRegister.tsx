/**
 * AGM / Meeting Register
 *
 * Track Annual General Meetings, Special General Meetings, and Board Meetings.
 * Stored in localStorage (same pattern as other registers).
 * Fields: meetingNo, type, date, venue, agenda, attendees count, resolutions, minutes, status.
 */
import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users2, Plus, Download, Search, Pencil, Trash2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

// ── Types ────────────────────────────────────────────────────────────────────
type MeetingType   = 'AGM' | 'SGM' | 'Board' | 'Committee' | 'Other';
type MeetingStatus = 'scheduled' | 'held' | 'adjourned' | 'cancelled';

interface Meeting {
  id: string;
  meetingNo: string;
  type: MeetingType;
  date: string;
  time: string;
  venue: string;
  agenda: string;
  attendees: string;   // number as string
  resolutions: string;
  minutes: string;
  status: MeetingStatus;
  createdAt: string;
}

const STORAGE_KEY = 'sahayata_meetings';

const loadMeetings = (): Meeting[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const saveMeetings = (data: Meeting[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const nextMeetingNo = (meetings: Meeting[], type: MeetingType): string => {
  const year = new Date().getFullYear();
  const prefix = type === 'AGM' ? 'AGM' : type === 'SGM' ? 'SGM' : type === 'Board' ? 'BM' : 'MT';
  const sameType = meetings.filter(m => m.type === type && m.meetingNo.includes(String(year)));
  const num = sameType.length + 1;
  return `${prefix}/${year}/${String(num).padStart(2, '0')}`;
};

const EMPTY_FORM = {
  type: 'AGM' as MeetingType,
  date: new Date().toISOString().split('T')[0],
  time: '10:00',
  venue: '',
  agenda: '',
  attendees: '',
  resolutions: '',
  minutes: '',
  status: 'scheduled' as MeetingStatus,
};

const TYPE_LABELS: Record<MeetingType, { hi: string; en: string }> = {
  AGM:       { hi: 'वार्षिक आम सभा (AGM)', en: 'Annual General Meeting' },
  SGM:       { hi: 'विशेष आम सभा (SGM)',   en: 'Special General Meeting' },
  Board:     { hi: 'बोर्ड बैठक',             en: 'Board Meeting'           },
  Committee: { hi: 'समिति बैठक',             en: 'Committee Meeting'       },
  Other:     { hi: 'अन्य',                  en: 'Other'                   },
};

const STATUS_COLORS: Record<MeetingStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  held:      'bg-green-100 text-green-800',
  adjourned: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ────────────────────────────────────────────────────────────────────────────
const MeetingRegister: React.FC = () => {
  const { language } = useLanguage();
  const { society } = useData();
  const { toast } = useToast();

  const hi = language === 'hi';

  const [meetings, setMeetings] = useState<Meeting[]>(loadMeetings);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(m =>
      m.meetingNo.toLowerCase().includes(q) ||
      m.venue.toLowerCase().includes(q) ||
      m.agenda.toLowerCase().includes(q)
    );
  }, [meetings, search]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setForm({
      type: m.type,
      date: m.date,
      time: m.time,
      venue: m.venue,
      agenda: m.agenda,
      attendees: m.attendees,
      resolutions: m.resolutions,
      minutes: m.minutes,
      status: m.status,
    });
    setEditId(m.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.date || !form.venue.trim()) {
      toast({ title: hi ? 'तिथि और स्थान आवश्यक हैं' : 'Date and venue are required', variant: 'destructive' });
      return;
    }

    if (editId) {
      const updated = meetings.map(m => m.id === editId ? { ...m, ...form } : m);
      setMeetings(updated); saveMeetings(updated);
      toast({ title: hi ? 'बैठक अपडेट की गई' : 'Meeting updated' });
    } else {
      const newMeeting: Meeting = {
        id: crypto.randomUUID(),
        meetingNo: nextMeetingNo(meetings, form.type),
        ...form,
        createdAt: new Date().toISOString(),
      };
      const updated = [newMeeting, ...meetings];
      setMeetings(updated); saveMeetings(updated);
      toast({ title: hi ? 'बैठक जोड़ी गई' : 'Meeting added', description: newMeeting.meetingNo });
    }

    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const updated = meetings.filter(m => m.id !== deleteId);
    setMeetings(updated); saveMeetings(updated);
    setDeleteId(null);
    toast({ title: hi ? 'बैठक हटाई गई' : 'Meeting deleted' });
  };

  const csvHeaders = ['Meeting No.', 'Type', 'Date', 'Time', 'Venue', 'Attendees', 'Status', 'Agenda', 'Resolutions'];
  const getCsvRows = () =>
    filtered.map(m => [
      m.meetingNo,
      TYPE_LABELS[m.type].en,
      new Date(m.date).toLocaleDateString('en-IN'),
      m.time || '—',
      m.venue,
      m.attendees || '—',
      m.status,
      m.agenda || '—',
      m.resolutions || '—',
    ]);

  const handleCSV = () =>
    downloadCSV(csvHeaders, getCsvRows(), 'meeting-register');

  const handleExcel = () =>
    downloadExcelSingle(csvHeaders, getCsvRows(), 'meeting-register', 'Meetings');

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let y = 14;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Meeting / AGM Register', 14, y); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`${society.name}  |  FY ${society.financialYear}`, 14, y); y += 8;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Meeting No.', 'Type', 'Date', 'Venue', 'Attendees', 'Status', 'Resolutions']],
      body: filtered.map((m, i) => [
        i + 1,
        m.meetingNo,
        TYPE_LABELS[m.type].en,
        new Date(m.date).toLocaleDateString('en-IN'),
        m.venue,
        m.attendees || '—',
        m.status,
        m.resolutions.substring(0, 60) + (m.resolutions.length > 60 ? '…' : ''),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save(`meeting-register-${society.financialYear}.pdf`);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const heldCount = meetings.filter(m => m.status === 'held').length;
  const pendingCount = meetings.filter(m => m.status === 'scheduled').length;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Users2 className="h-6 w-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hi ? 'AGM / बैठक रजिस्टर' : 'AGM / Meeting Register'}
          </h1>
          <p className="text-sm text-gray-500">{society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
          <Button size="sm" className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {hi ? 'बैठक जोड़ें' : 'Add Meeting'}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          [hi ? 'कुल बैठकें' : 'Total', meetings.length],
          [hi ? 'संपन्न' : 'Held',      heldCount],
          [hi ? 'निर्धारित' : 'Scheduled', pendingCount],
          [hi ? 'रद्द / स्थगित' : 'Other', meetings.length - heldCount - pendingCount],
        ].map(([label, val]) => (
          <Card key={String(label)}>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={hi ? 'खोजें…' : 'Search…'}
              className="h-8 w-52"
            />
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} {hi ? 'रिकॉर्ड' : 'records'}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">
              {hi ? 'कोई बैठक दर्ज नहीं। ऊपर "बैठक जोड़ें" बटन दबाएं।' : 'No meetings yet. Click "Add Meeting" above.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'बैठक नं.' : 'Meeting No.'}</TableHead>
                  <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                  <TableHead>{hi ? 'तिथि' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'समय' : 'Time'}</TableHead>
                  <TableHead>{hi ? 'स्थान' : 'Venue'}</TableHead>
                  <TableHead className="text-right">{hi ? 'उपस्थित' : 'Attendees'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead>{hi ? 'प्रस्ताव' : 'Resolutions'}</TableHead>
                  <TableHead>{hi ? 'कार्रवाई' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm font-medium">{m.meetingNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {TYPE_LABELS[m.type][hi ? 'hi' : 'en']}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(m.date).toLocaleDateString('hi-IN')}</TableCell>
                    <TableCell className="text-sm">{m.time || '—'}</TableCell>
                    <TableCell className="text-sm max-w-36 truncate">{m.venue}</TableCell>
                    <TableCell className="text-right text-sm">{m.attendees || '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[m.status]}`}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-48 truncate">{m.resolutions || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteId(m.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? (hi ? 'बैठक संपादित करें' : 'Edit Meeting') : (hi ? 'नई बैठक जोड़ें' : 'Add New Meeting')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'बैठक प्रकार *' : 'Meeting Type *'}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as MeetingType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as MeetingType[]).map(k => (
                      <SelectItem key={k} value={k}>{TYPE_LABELS[k][hi ? 'hi' : 'en']}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'स्थिति' : 'Status'}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as MeetingStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">{hi ? 'निर्धारित' : 'Scheduled'}</SelectItem>
                    <SelectItem value="held">{hi ? 'संपन्न' : 'Held'}</SelectItem>
                    <SelectItem value="adjourned">{hi ? 'स्थगित' : 'Adjourned'}</SelectItem>
                    <SelectItem value="cancelled">{hi ? 'रद्द' : 'Cancelled'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'तिथि *' : 'Date *'}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">{hi ? 'समय' : 'Time'}</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'स्थान / स्थल *' : 'Venue *'}</Label>
              <Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                     placeholder={hi ? 'जैसे: समिति कार्यालय' : 'e.g. Society Office'} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'उपस्थित सदस्य संख्या' : 'Number of Attendees'}</Label>
              <Input type="number" min="0" value={form.attendees}
                     onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="0" className="w-32" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'एजेंडा' : 'Agenda'}</Label>
              <Textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
                        rows={3} placeholder={hi ? 'बैठक के विषय…' : 'Meeting agenda…'} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'प्रस्ताव / निर्णय' : 'Resolutions / Decisions'}</Label>
              <Textarea value={form.resolutions} onChange={e => setForm(f => ({ ...f, resolutions: e.target.value }))}
                        rows={3} placeholder={hi ? 'पारित प्रस्ताव…' : 'Resolutions passed…'} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{hi ? 'कार्यवाही विवरण (Minutes)' : 'Minutes'}</Label>
              <Textarea value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))}
                        rows={3} placeholder={hi ? 'बैठक का संक्षिप्त विवरण…' : 'Brief minutes of meeting…'} className="text-sm" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1">
                {editId ? (hi ? 'अपडेट करें' : 'Update') : (hi ? 'सहेजें' : 'Save')}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {hi ? 'रद्द करें' : 'Cancel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'बैठक हटाएं?' : 'Delete Meeting?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {hi ? 'यह क्रिया वापस नहीं होगी।' : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MeetingRegister;
