/**
 * Board of Directors / Board of Administration
 *
 * Manages current board composition (BOD or BOA), links to member register,
 * tracks term dates, and configures signing authority for all PDF reports.
 */
import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users2, Plus, Edit2, Trash2, Download, FileSpreadsheet, Shield, Info, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fmtDate } from '@/lib/dateUtils';
import { downloadCSV } from '@/lib/exportUtils';
import type { BoardMember, BoardDesignation, BoardType, SignatoryConfig } from '@/types';

const DESIGNATIONS: { value: BoardDesignation; label: string; labelHi: string }[] = [
  { value: 'president', label: 'President', labelHi: 'अध्यक्ष' },
  { value: 'vice_president', label: 'Vice President', labelHi: 'उपाध्यक्ष' },
  { value: 'secretary', label: 'Secretary', labelHi: 'सचिव' },
  { value: 'joint_secretary', label: 'Joint Secretary', labelHi: 'संयुक्त सचिव' },
  { value: 'treasurer', label: 'Treasurer', labelHi: 'कोषाध्यक्ष' },
  { value: 'director', label: 'Director', labelHi: 'निदेशक' },
  { value: 'administrator', label: 'Administrator', labelHi: 'प्रशासक' },
  { value: 'other', label: 'Other', labelHi: 'अन्य' },
];

const getDesignation = (val: BoardDesignation) => DESIGNATIONS.find(d => d.value === val);

const lid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);

const BoardOfDirectors: React.FC = () => {
  const { language } = useLanguage();
  const { society, members, employees, updateSociety } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const boardMembers: BoardMember[] = society.boardMembers || [];
  const boardType: BoardType = society.boardType || 'bod';
  const signatories = society.signatories || {};

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active' && (!m.approvalStatus || m.approvalStatus === 'approved')), [members]);
  const activeEmployees = useMemo(() => (employees || []).filter(e => e.status === 'active'), [employees]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    memberId: '', designation: 'director' as BoardDesignation,
    termFrom: '', termTo: '', resolutionNo: '', isSigningAuthority: false, status: 'active' as 'active' | 'resigned' | 'expired',
  });

  // Signatory config dialog
  const [sigDialogOpen, setSigDialogOpen] = useState(false);
  const [sigForm, setSigForm] = useState({
    accountant: signatories.accountant?.name || '',
    accountantSource: signatories.accountant?.source || 'employee' as 'board' | 'employee',
    secretary: signatories.secretary?.name || '',
    secretarySource: signatories.secretary?.source || 'board' as 'board' | 'employee',
    president: signatories.president?.name || '',
    presidentSource: signatories.president?.source || 'board' as 'board' | 'employee',
  });

  const openAdd = () => {
    setEditId(null);
    setForm({ memberId: '', designation: 'director', termFrom: '', termTo: '', resolutionNo: '', isSigningAuthority: false, status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (bm: BoardMember) => {
    setEditId(bm.id);
    setForm({
      memberId: bm.memberId, designation: bm.designation,
      termFrom: bm.termFrom, termTo: bm.termTo, resolutionNo: bm.resolutionNo,
      isSigningAuthority: bm.isSigningAuthority, status: bm.status,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const member = members.find(m => m.id === form.memberId);
    if (!member) {
      toast({ title: hi ? 'सदस्य चुनें' : 'Please select a member', variant: 'destructive' });
      return;
    }
    const desig = getDesignation(form.designation);
    const entry: BoardMember = {
      id: editId || lid(),
      memberId: member.id,
      memberName: member.name,
      memberIdNo: member.memberId,
      designation: form.designation,
      designationLabel: desig?.label || form.designation,
      designationLabelHi: desig?.labelHi || form.designation,
      termFrom: form.termFrom,
      termTo: form.termTo,
      resolutionNo: form.resolutionNo,
      isSigningAuthority: form.isSigningAuthority,
      status: form.status,
    };

    const updated = editId
      ? boardMembers.map(b => b.id === editId ? entry : b)
      : [...boardMembers, entry];

    updateSociety({ boardMembers: updated });
    setDialogOpen(false);
    toast({ title: hi ? (editId ? 'सदस्य अपडेट किया' : 'सदस्य जोड़ा गया') : (editId ? 'Member updated' : 'Member added') });
  };

  const handleRemove = (id: string) => {
    updateSociety({ boardMembers: boardMembers.filter(b => b.id !== id) });
    toast({ title: hi ? 'सदस्य हटाया गया' : 'Member removed' });
  };

  const handleBoardTypeChange = (type: BoardType) => {
    updateSociety({ boardType: type });
    toast({ title: hi ? `बोर्ड प्रकार: ${type === 'bod' ? 'निदेशक मंडल' : 'प्रशासन मंडल'}` : `Board type: ${type === 'bod' ? 'Board of Directors' : 'Board of Administration'}` });
  };

  const handleSaveSignatories = () => {
    const newSig: any = {};
    if (sigForm.accountant) newSig.accountant = { name: sigForm.accountant, source: sigForm.accountantSource };
    if (sigForm.secretary) newSig.secretary = { name: sigForm.secretary, source: sigForm.secretarySource };
    if (sigForm.president) newSig.president = { name: sigForm.president, source: sigForm.presidentSource };
    updateSociety({ signatories: newSig });
    setSigDialogOpen(false);
    toast({ title: hi ? 'हस्ताक्षर प्राधिकारी सहेजा गया' : 'Signing authority saved' });
  };

  // Combined list for signatory dropdowns: board members + employees
  const signatoryOptions = useMemo(() => {
    const opts: { value: string; label: string; source: 'board' | 'employee' }[] = [];
    boardMembers.filter(b => b.status === 'active').forEach(b =>
      opts.push({ value: b.memberName, label: `${b.memberName} (${b.designationLabel})`, source: 'board' })
    );
    activeEmployees.forEach(e =>
      opts.push({ value: e.name, label: `${e.name} (${e.designation})`, source: 'employee' })
    );
    return opts;
  }, [boardMembers, activeEmployees]);

  const handleCSV = () => {
    const headers = ['S.No', 'Member ID', 'Name', 'Designation', 'Term From', 'Term To', 'Resolution', 'Signing Authority', 'Status'];
    const rows = boardMembers.map((b, i) => [
      i + 1, b.memberIdNo, b.memberName, b.designationLabel,
      b.termFrom ? fmtDate(b.termFrom) : '', b.termTo ? fmtDate(b.termTo) : '',
      b.resolutionNo, b.isSigningAuthority ? 'Yes' : 'No', b.status,
    ]);
    downloadCSV(headers, rows, `board-${boardType}-${society.financialYear}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <Users2 className="h-6 w-6 text-violet-700 dark:text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {boardType === 'bod'
                ? (hi ? 'निदेशक मंडल (BOD)' : 'Board of Directors (BOD)')
                : (hi ? 'प्रशासन मंडल (BOA)' : 'Board of Administration (BOA)')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hi ? society.nameHi : society.name} · {hi ? 'वित्तीय वर्ष' : 'FY'} {society.financialYear}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setSigDialogOpen(true)}>
            <Shield className="h-4 w-4" />
            {hi ? 'हस्ताक्षर प्राधिकारी' : 'Signing Authority'}
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleCSV}>
            <FileSpreadsheet className="h-4 w-4" />CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {hi ? 'सदस्य जोड़ें' : 'Add Member'}
          </Button>
        </div>
      </div>

      {/* Board Type Toggle */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label className="text-sm font-medium">{hi ? 'बोर्ड प्रकार' : 'Board Type'}:</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={boardType === 'bod' ? 'default' : 'outline'}
                onClick={() => handleBoardTypeChange('bod')}>
                {hi ? 'निदेशक मंडल (BOD)' : 'Board of Directors (BOD)'}
              </Button>
              <Button size="sm" variant={boardType === 'boa' ? 'default' : 'outline'}
                onClick={() => handleBoardTypeChange('boa')}>
                {hi ? 'प्रशासन मंडल (BOA)' : 'Board of Administration (BOA)'}
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {boardType === 'bod'
                ? (hi ? 'AGM द्वारा निर्वाचित' : 'Elected by AGM')
                : (hi ? 'रजिस्ट्रार द्वारा नियुक्त' : 'Appointed by Registrar')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Signing Authority Summary */}
      {(signatories.accountant || signatories.secretary || signatories.president) && (
        <Card className="border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {hi ? 'हस्ताक्षर प्राधिकारी (PDF रिपोर्ट)' : 'Signing Authority (PDF Reports)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-2 bg-muted rounded">
                <p className="font-semibold">{signatories.accountant?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{hi ? 'लेखाकार' : 'Accountant'}</p>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <p className="font-semibold">{signatories.secretary?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{hi ? 'सचिव / प्रबंधक' : 'Secretary / Manager'}</p>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <p className="font-semibold">{signatories.president?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{hi ? 'अध्यक्ष' : 'President'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Board Members Table */}
      <Card>
        <CardContent className="pt-4">
          {boardMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{hi ? 'कोई सदस्य नहीं जोड़ा गया' : 'No board members added yet'}</p>
              <p className="text-sm mt-1">{hi ? '"सदस्य जोड़ें" बटन दबाएं' : 'Click "Add Member" to get started'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{hi ? 'सदस्य ID' : 'Member ID'}</TableHead>
                    <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                    <TableHead>{hi ? 'पद' : 'Designation'}</TableHead>
                    <TableHead>{hi ? 'कार्यकाल से' : 'Term From'}</TableHead>
                    <TableHead>{hi ? 'कार्यकाल तक' : 'Term To'}</TableHead>
                    <TableHead>{hi ? 'प्रस्ताव संख्या' : 'Resolution'}</TableHead>
                    <TableHead className="text-center">{hi ? 'हस्ताक्षर' : 'Signing'}</TableHead>
                    <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कार्य' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boardMembers.map((bm, i) => (
                    <TableRow key={bm.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{bm.memberIdNo}</TableCell>
                      <TableCell className="font-medium">{bm.memberName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {hi ? bm.designationLabelHi : bm.designationLabel}
                        </span>
                      </TableCell>
                      <TableCell>{bm.termFrom ? fmtDate(bm.termFrom) : '—'}</TableCell>
                      <TableCell>{bm.termTo ? fmtDate(bm.termTo) : '—'}</TableCell>
                      <TableCell>{bm.resolutionNo || '—'}</TableCell>
                      <TableCell className="text-center">
                        {bm.isSigningAuthority && <CheckCircle2 className="h-4 w-4 text-success mx-auto" />}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${bm.status === 'active' ? 'text-success' : bm.status === 'resigned' ? 'text-amber-600' : 'text-destructive'}`}>
                          {bm.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : bm.status === 'resigned' ? (hi ? 'त्यागपत्र' : 'Resigned') : (hi ? 'समाप्त' : 'Expired')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(bm)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemove(bm.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg text-sm text-violet-800 dark:text-violet-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {hi
            ? 'हस्ताक्षर प्राधिकारी में चयनित नाम सभी PDF रिपोर्ट (Trial Balance, Balance Sheet, I&E, R&P आदि) की हस्ताक्षर पंक्ति में स्वतः दिखाई देंगे।'
            : 'Names configured in Signing Authority will automatically appear in the signature block of all PDF reports (Trial Balance, Balance Sheet, I&E, R&P, etc.).'}
        </span>
      </div>

      {/* Add/Edit Board Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? (hi ? 'सदस्य संपादित करें' : 'Edit Board Member') : (hi ? 'बोर्ड सदस्य जोड़ें' : 'Add Board Member')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'सदस्य चुनें' : 'Select Member'}</Label>
              <Select value={form.memberId} onValueChange={v => setForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger><SelectValue placeholder={hi ? 'सदस्य चुनें...' : 'Select member...'} /></SelectTrigger>
                <SelectContent>
                  {activeMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.memberId} — {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'पद / पदनाम' : 'Designation'}</Label>
              <Select value={form.designation} onValueChange={v => setForm(f => ({ ...f, designation: v as BoardDesignation }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESIGNATIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.labelHi} / {d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'कार्यकाल से' : 'Term From'}</Label>
                <Input type="date" value={form.termFrom} onChange={e => setForm(f => ({ ...f, termFrom: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'कार्यकाल तक' : 'Term To'}</Label>
                <Input type="date" value={form.termTo} onChange={e => setForm(f => ({ ...f, termTo: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'प्रस्ताव / आदेश संख्या' : 'Resolution / Order No.'}</Label>
              <Input value={form.resolutionNo} onChange={e => setForm(f => ({ ...f, resolutionNo: e.target.value }))} className="h-8 text-sm"
                placeholder={hi ? 'AGM/बोर्ड प्रस्ताव संख्या' : 'AGM/Board resolution number'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'स्थिति' : 'Status'}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
                    <SelectItem value="resigned">{hi ? 'त्यागपत्र' : 'Resigned'}</SelectItem>
                    <SelectItem value="expired">{hi ? 'समाप्त' : 'Expired'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isSigningAuthority}
                    onChange={e => setForm(f => ({ ...f, isSigningAuthority: e.target.checked }))}
                    className="rounded border-gray-300" />
                  {hi ? 'हस्ताक्षर अधिकारी' : 'Signing Authority'}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={handleSave}>{editId ? (hi ? 'अपडेट करें' : 'Update') : (hi ? 'जोड़ें' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signing Authority Config Dialog */}
      <Dialog open={sigDialogOpen} onOpenChange={setSigDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-600" />
              {hi ? 'PDF रिपोर्ट हस्ताक्षर प्राधिकारी' : 'PDF Report Signing Authority'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {hi ? 'यहाँ चयनित नाम सभी PDF रिपोर्ट में हस्ताक्षर पंक्ति में दिखाई देंगे।' : 'Names selected here will appear in the signature block of all PDF reports.'}
          </p>
          <div className="space-y-4">
            {/* Accountant Position */}
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs font-semibold">{hi ? 'पद 1: लेखाकार / Accountant' : 'Position 1: Accountant'}</Label>
              <Select value={sigForm.accountant || '__none__'} onValueChange={v => {
                const opt = signatoryOptions.find(o => o.value === v);
                setSigForm(f => ({ ...f, accountant: v === '__none__' ? '' : v, accountantSource: opt?.source || 'employee' }));
              }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={hi ? 'चुनें...' : 'Select...'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कॉन्फ़िगर नहीं —' : '— Not configured —'}</SelectItem>
                  {signatoryOptions.map(o => (
                    <SelectItem key={`acc-${o.value}`} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Secretary Position */}
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs font-semibold">{hi ? 'पद 2: सचिव / प्रबंधक / Secretary' : 'Position 2: Secretary / Manager'}</Label>
              <Select value={sigForm.secretary || '__none__'} onValueChange={v => {
                const opt = signatoryOptions.find(o => o.value === v);
                setSigForm(f => ({ ...f, secretary: v === '__none__' ? '' : v, secretarySource: opt?.source || 'board' }));
              }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={hi ? 'चुनें...' : 'Select...'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कॉन्फ़िगर नहीं —' : '— Not configured —'}</SelectItem>
                  {signatoryOptions.map(o => (
                    <SelectItem key={`sec-${o.value}`} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* President Position */}
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs font-semibold">{hi ? 'पद 3: अध्यक्ष / President' : 'Position 3: President'}</Label>
              <Select value={sigForm.president || '__none__'} onValueChange={v => {
                const opt = signatoryOptions.find(o => o.value === v);
                setSigForm(f => ({ ...f, president: v === '__none__' ? '' : v, presidentSource: opt?.source || 'board' }));
              }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={hi ? 'चुनें...' : 'Select...'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{hi ? '— कॉन्फ़िगर नहीं —' : '— Not configured —'}</SelectItem>
                  {signatoryOptions.map(o => (
                    <SelectItem key={`pres-${o.value}`} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigDialogOpen(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
            <Button onClick={handleSaveSignatories}>{hi ? 'सहेजें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoardOfDirectors;
