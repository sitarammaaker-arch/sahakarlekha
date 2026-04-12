import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookMarked, Download, Search, Edit, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateShareRegisterPDF } from '@/lib/pdf';
import type { Member } from '@/types';

const ShareRegister: React.FC = () => {
  const { language } = useLanguage();
  const { members, updateMember, society } = useData();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState({ shareCertNo: '', shareCount: '', shareFaceValue: '', nomineeName: '', nomineeRelation: '', nomineePhone: '' });

  const hi = language === 'hi';
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

  const approvedMembers = members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved');
  const filtered = approvedMembers.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.memberId.toLowerCase().includes(search.toLowerCase())
  );

  const totalShares = approvedMembers.reduce((s, m) => s + (m.shareCount || 0), 0);
  const totalCapital = approvedMembers.reduce((s, m) => s + m.shareCapital, 0);
  const withNominee = approvedMembers.filter(m => m.nomineeName).length;

  const openEdit = (m: Member) => {
    setEditMember(m);
    setForm({
      shareCertNo: m.shareCertNo || '',
      shareCount: String(m.shareCount || ''),
      shareFaceValue: String(m.shareFaceValue || ''),
      nomineeName: m.nomineeName || '',
      nomineeRelation: m.nomineeRelation || '',
      nomineePhone: m.nomineePhone || '',
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    updateMember(editMember.id, {
      shareCertNo: form.shareCertNo,
      shareCount: Number(form.shareCount) || undefined,
      shareFaceValue: Number(form.shareFaceValue) || undefined,
      nomineeName: form.nomineeName,
      nomineeRelation: form.nomineeRelation,
      nomineePhone: form.nomineePhone,
    });
    toast({ title: hi ? 'अपडेट किया गया' : 'Updated successfully' });
    setEditMember(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookMarked className="h-7 w-7 text-primary" />
            {hi ? 'अंश रजिस्टर' : 'Share Register'}
          </h1>
          <p className="text-muted-foreground">
            {hi ? 'सदस्यों का अंश पूंजी एवं नामांकन विवरण' : 'Member share capital & nominee details'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateShareRegisterPDF(members, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल सदस्य' : 'Total Members'}</p>
            <p className="text-2xl font-bold text-primary">{approvedMembers.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल अंश पूंजी' : 'Total Share Capital'}</p>
            <p className="text-xl font-bold text-success">{fmt(totalCapital)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल अंश' : 'Total Shares'}</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalShares}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'नामांकित' : 'With Nominee'}</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{withNominee}/{approvedMembers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={hi ? 'सदस्य खोजें...' : 'Search members...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Register Table */}
      <Card className="shadow-card">
        <CardHeader className="border-b text-center py-4">
          <CardTitle className="text-lg">{hi ? 'अंश रजिस्टर' : 'Share Register'}</CardTitle>
          <p className="text-sm text-muted-foreground">{hi ? society.nameHi : society.name}</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{hi ? 'सदस्य ID' : 'Member ID'}</TableHead>
                <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                <TableHead>{hi ? 'पिता/पति' : 'Father/Husband'}</TableHead>
                <TableHead className="whitespace-nowrap">{hi ? 'प्रमाणपत्र सं.' : 'Cert. No.'}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{hi ? 'अंश संख्या' : 'Shares'}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{hi ? 'मूल्य/अंश' : 'Face Value'}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{hi ? 'कुल पूंजी' : 'Total Capital'}</TableHead>
                <TableHead>{hi ? 'नामांकित' : 'Nominee'}</TableHead>
                <TableHead>{hi ? 'संबंध' : 'Relation'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {hi ? 'कोई सदस्य नहीं मिला' : 'No members found'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m, i) => (
                  <TableRow key={m.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">{m.memberId}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.fatherName || '-'}</TableCell>
                    <TableCell className="font-mono">{m.shareCertNo || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right">{m.shareCount ?? <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right">{m.shareFaceValue ? fmt(m.shareFaceValue) : <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(m.shareCapital)}</TableCell>
                    <TableCell>{m.nomineeName || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{m.nomineeRelation || <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                        {m.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={open => !open && setEditMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'अंश विवरण संपादित करें' : 'Edit Share Details'} — {editMember?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'प्रमाणपत्र सं.' : 'Share Cert. No.'}</Label>
                <Input value={form.shareCertNo} onChange={e => setForm(f => ({ ...f, shareCertNo: e.target.value }))} placeholder="SC-001" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'अंश संख्या' : 'No. of Shares'}</Label>
                <Input type="number" min="0" value={form.shareCount} onChange={e => setForm(f => ({ ...f, shareCount: e.target.value }))} placeholder="10" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'मूल्य/अंश (₹)' : 'Face Value (₹)'}</Label>
                <Input type="number" min="0" value={form.shareFaceValue} onChange={e => setForm(f => ({ ...f, shareFaceValue: e.target.value }))} placeholder="100" />
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-3">{hi ? 'नामांकन विवरण' : 'Nominee Details'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{hi ? 'नामांकित का नाम' : 'Nominee Name'}</Label>
                  <Input value={form.nomineeName} onChange={e => setForm(f => ({ ...f, nomineeName: e.target.value }))} placeholder={hi ? 'पूरा नाम' : 'Full name'} />
                </div>
                <div className="space-y-1">
                  <Label>{hi ? 'संबंध' : 'Relation'}</Label>
                  <Select value={form.nomineeRelation} onValueChange={v => setForm(f => ({ ...f, nomineeRelation: v }))}>
                    <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      {['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label>{hi ? 'नामांकित फोन' : 'Nominee Phone'}</Label>
                <Input value={form.nomineePhone} onChange={e => setForm(f => ({ ...f, nomineePhone: e.target.value }))} placeholder="9876543210" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditMember(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
              <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShareRegister;
