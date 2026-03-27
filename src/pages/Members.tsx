import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Search, Eye, Edit, Phone, IndianRupee, Trash2, BookOpen, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MemberType } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { generateMemberPassbookPDF } from '@/lib/pdf';
import type { Member, MemberStatus } from '@/types';

const EMPTY_FORM = { memberId: '', name: '', fatherName: '', address: '', phone: '', shareCapital: '', admissionFee: '', memberType: 'member' as MemberType, joinDate: new Date().toISOString().split('T')[0], status: 'active' as MemberStatus };

interface MemberFormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  language: string;
  t: (key: string) => string;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
}

const MemberForm: React.FC<MemberFormProps> = ({ form, setForm, language, t, onSubmit, submitLabel, onCancel }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>{t('memberId')} *</Label>
        <Input value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} placeholder="M001" required />
      </div>
      <div className="space-y-2">
        <Label>{language === 'hi' ? 'शामिल होने की तिथि' : 'Join Date'}</Label>
        <Input type="date" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))} />
      </div>
    </div>
    <div className="space-y-2">
      <Label>{t('memberName')} *</Label>
      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={language === 'hi' ? 'पूरा नाम' : 'Full name'} required />
    </div>
    <div className="space-y-2">
      <Label>{language === 'hi' ? 'पिता/पति का नाम' : "Father's/Husband's Name"}</Label>
      <Input value={form.fatherName} onChange={e => setForm(f => ({ ...f, fatherName: e.target.value }))} placeholder={language === 'hi' ? 'श्री...' : 'Mr...'} />
    </div>
    <div className="space-y-2">
      <Label>{t('address')}</Label>
      <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={language === 'hi' ? 'पूरा पता' : 'Full address'} />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>{t('phone')} *</Label>
        <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" required />
      </div>
      <div className="space-y-2">
        <Label>{language === 'hi' ? 'सदस्यता प्रकार' : 'Member Type'}</Label>
        <Select value={form.memberType} onValueChange={v => setForm(f => ({ ...f, memberType: v as MemberType }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{language === 'hi' ? 'सदस्य' : 'Member'}</SelectItem>
            <SelectItem value="nominal">{language === 'hi' ? 'नॉमिनल सदस्य' : 'Nominal Member'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>{t('shareCapital')} (₹)</Label>
        <Input type="number" value={form.shareCapital} onChange={e => setForm(f => ({ ...f, shareCapital: e.target.value }))} placeholder="10000" min="0" />
      </div>
      <div className="space-y-2">
        <Label>{language === 'hi' ? 'प्रवेश शुल्क (₹)' : 'Admission Fee (₹)'}</Label>
        <Input type="number" value={form.admissionFee} onChange={e => setForm(f => ({ ...f, admissionFee: e.target.value }))} placeholder="0" min="0" />
      </div>
    </div>
    <div className="flex gap-2 justify-end">
      <Button variant="outline" type="button" onClick={onCancel}>{t('cancel')}</Button>
      <Button type="submit">{submitLabel}</Button>
    </div>
  </form>
);

const Members: React.FC = () => {
  const { t, language } = useLanguage();
  const { members, addMember, updateMember, deleteMember, getMemberLedger, society } = useData();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [ledgerMember, setLedgerMember] = useState<Member | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery)
  );

  const totalShareCapital = members.reduce((s, m) => s + m.shareCapital, 0);
  const activeMembers = members.filter(m => m.status === 'active').length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.name || !form.phone) {
      toast({ title: language === 'hi' ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    if (members.some(m => m.memberId === form.memberId)) {
      toast({ title: language === 'hi' ? 'यह सदस्य ID पहले से मौजूद है' : 'Member ID already exists', variant: 'destructive' });
      return;
    }
    addMember({ ...form, shareCapital: Number(form.shareCapital) || 0, admissionFee: Number(form.admissionFee) || 0 });
    toast({ title: language === 'hi' ? 'सदस्य जोड़ा गया' : 'Member added' });
    setForm(EMPTY_FORM);
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    updateMember(editMember.id, { ...form, shareCapital: Number(form.shareCapital) || 0, admissionFee: Number(form.admissionFee) || 0 });
    toast({ title: language === 'hi' ? 'सदस्य अपडेट किया गया' : 'Member updated' });
    setEditMember(null);
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setForm({ memberId: m.memberId, name: m.name, fatherName: m.fatherName, address: m.address, phone: m.phone, shareCapital: String(m.shareCapital), admissionFee: String(m.admissionFee || 0), memberType: m.memberType || 'member', joinDate: m.joinDate, status: m.status });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-accent" />
            {t('members')}
          </h1>
          <p className="text-muted-foreground">{language === 'hi' ? 'समिति सदस्यों का प्रबंधन' : 'Manage society members'}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setForm(EMPTY_FORM); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{language === 'hi' ? 'नया सदस्य' : 'New Member'}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{language === 'hi' ? 'नया सदस्य जोड़ें' : 'Add New Member'}</DialogTitle>
              <DialogDescription>{language === 'hi' ? 'सदस्य का विवरण भरें' : 'Fill in member details'}</DialogDescription>
            </DialogHeader>
            <MemberForm form={form} setForm={setForm} language={language} t={t} onSubmit={handleAdd} submitLabel={t('save')} onCancel={() => { setIsAddOpen(false); setForm(EMPTY_FORM); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center"><Users className="h-6 w-6 text-accent" /></div>
              <div><p className="text-sm text-muted-foreground">{t('totalMembers')}</p><p className="text-2xl font-bold">{members.length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-success/20 flex items-center justify-center"><Users className="h-6 w-6 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">{language === 'hi' ? 'सक्रिय सदस्य' : 'Active Members'}</p><p className="text-2xl font-bold text-success">{activeMembers}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center"><IndianRupee className="h-6 w-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">{t('shareCapital')}</p><p className="text-2xl font-bold text-primary">{fmt(totalShareCapital)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'hi' ? 'नाम, ID या फोन से खोजें...' : 'Search by name, ID or phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">{language === 'hi' ? 'सदस्य सूची' : 'Member List'}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{t('noData')}</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t('memberId')}</TableHead>
                    <TableHead className="font-semibold">{t('memberName')}</TableHead>
                    <TableHead className="font-semibold">{t('phone')}</TableHead>
                    <TableHead className="font-semibold text-center">{language === 'hi' ? 'प्रकार' : 'Type'}</TableHead>
                    <TableHead className="font-semibold text-right">{t('shareCapital')}</TableHead>
                    <TableHead className="font-semibold text-right">{language === 'hi' ? 'प्रवेश शुल्क' : 'Admission Fee'}</TableHead>
                    <TableHead className="font-semibold text-center">{language === 'hi' ? 'स्थिति' : 'Status'}</TableHead>
                    <TableHead className="font-semibold text-center">{language === 'hi' ? 'क्रियाएं' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map(member => (
                    <TableRow key={member.id} className="hover:bg-muted/30">
                      <TableCell><Badge variant="outline" className="font-mono">{member.memberId}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            {member.fatherName && <p className="text-xs text-muted-foreground">{member.fatherName}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3 text-muted-foreground" />{member.phone}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={member.memberType === 'nominal' ? 'border-amber-500 text-amber-600' : 'border-primary text-primary'}>
                          {member.memberType === 'nominal' ? (language === 'hi' ? 'नॉमिनल' : 'Nominal') : (language === 'hi' ? 'सदस्य' : 'Member')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{fmt(member.shareCapital)}</TableCell>
                      <TableCell className="text-right">{fmt(member.admissionFee || 0)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className={member.status === 'active' ? 'bg-success' : ''}>
                          {member.status === 'active' ? (language === 'hi' ? 'सक्रिय' : 'Active') : (language === 'hi' ? 'निष्क्रिय' : 'Inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMember(member)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => setLedgerMember(member)}>
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(member)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(member.id)}>
                            <Trash2 className="h-4 w-4" />
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

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => { if (!o) setEditMember(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'hi' ? 'सदस्य संपादित करें' : 'Edit Member'}</DialogTitle>
          </DialogHeader>
          <MemberForm form={form} setForm={setForm} language={language} t={t} onSubmit={handleEdit} submitLabel={language === 'hi' ? 'अपडेट करें' : 'Update'} onCancel={() => setEditMember(null)} />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewMember} onOpenChange={(o) => { if (!o) setViewMember(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'hi' ? 'सदस्य विवरण' : 'Member Details'}</DialogTitle>
          </DialogHeader>
          {viewMember && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-center mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">{getInitials(viewMember.name)}</AvatarFallback>
                </Avatar>
              </div>
              {[
                [t('memberId'), viewMember.memberId],
                [t('memberName'), viewMember.name],
                [language === 'hi' ? 'पिता/पति' : 'Father/Husband', viewMember.fatherName],
                [t('phone'), viewMember.phone],
                [t('address'), viewMember.address],
                [language === 'hi' ? 'सदस्यता प्रकार' : 'Member Type', viewMember.memberType === 'nominal' ? (language === 'hi' ? 'नॉमिनल सदस्य' : 'Nominal Member') : (language === 'hi' ? 'सदस्य' : 'Member')],
                [t('shareCapital'), fmt(viewMember.shareCapital)],
                [language === 'hi' ? 'प्रवेश शुल्क' : 'Admission Fee', fmt(viewMember.admissionFee || 0)],
                [language === 'hi' ? 'शामिल तिथि' : 'Join Date', new Date(viewMember.joinDate).toLocaleDateString('hi-IN')],
                [language === 'hi' ? 'स्थिति' : 'Status', viewMember.status === 'active' ? (language === 'hi' ? 'सक्रिय' : 'Active') : (language === 'hi' ? 'निष्क्रिय' : 'Inactive')],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-medium">{value || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Member Share Ledger Sheet */}
      <Sheet open={!!ledgerMember} onOpenChange={(o) => { if (!o) setLedgerMember(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {ledgerMember && (() => {
            const entries = getMemberLedger(ledgerMember.id);
            const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
            const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
            const closing = entries[entries.length - 1];
            const fmtAmt = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(n);
            return (
              <>
                <SheetHeader className="pb-4 border-b">
                  <SheetTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {language === 'hi' ? 'सदस्य खाता बही' : 'Member Share Ledger'}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => generateMemberPassbookPDF(ledgerMember, entries, society)}
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  </SheetTitle>
                </SheetHeader>

                {/* Member Info */}
                <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('memberId')}:</span>
                    <span className="font-semibold">{ledgerMember.memberId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('memberName')}:</span>
                    <span className="font-semibold">{ledgerMember.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === 'hi' ? 'शामिल तिथि' : 'Join Date'}:</span>
                    <span>{new Date(ledgerMember.joinDate).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === 'hi' ? 'शेष' : 'Balance'}:</span>
                    <span className="font-bold text-primary text-base">
                      {closing ? fmtAmt(closing.balance) : fmtAmt(0)}
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                    <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल जमा' : 'Total Deposits'}</p>
                    <p className="font-bold text-green-700">{fmtAmt(totalCredit)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                    <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल निकासी' : 'Total Withdrawals'}</p>
                    <p className="font-bold text-red-700">{fmtAmt(totalDebit)}</p>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="mt-4 rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">{t('date')}</TableHead>
                        <TableHead className="text-xs">{t('voucherNo')}</TableHead>
                        <TableHead className="text-xs">{t('particulars')}</TableHead>
                        <TableHead className="text-xs text-right">{language === 'hi' ? 'जमा' : 'Credit'}</TableHead>
                        <TableHead className="text-xs text-right">{language === 'hi' ? 'निकासी' : 'Debit'}</TableHead>
                        <TableHead className="text-xs text-right">{language === 'hi' ? 'शेष' : 'Balance'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, idx) => (
                        <TableRow key={entry.id} className={idx === 0 ? 'bg-blue-50/60 font-medium' : 'hover:bg-muted/30'}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">{entry.voucherNo}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{entry.particulars}</TableCell>
                          <TableCell className="text-right text-xs">
                            {entry.credit > 0 && <span className="font-semibold text-green-600">{fmtAmt(entry.credit)}</span>}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {entry.debit > 0 && <span className="font-semibold text-red-600">{fmtAmt(entry.debit)}</span>}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold">{fmtAmt(entry.balance)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-primary text-primary-foreground font-bold text-xs">
                        <TableCell colSpan={3} className="text-right">{t('total')}</TableCell>
                        <TableCell className="text-right">{fmtAmt(totalCredit)}</TableCell>
                        <TableCell className="text-right">{fmtAmt(totalDebit)}</TableCell>
                        <TableCell className="text-right">{closing ? fmtAmt(closing.balance) : fmtAmt(0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{language === 'hi' ? 'यह सदस्य स्थायी रूप से हटा दिया जाएगा।' : 'This member will be permanently deleted.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => { if (deleteId) { deleteMember(deleteId); setDeleteId(null); toast({ title: language === 'hi' ? 'सदस्य हटाया गया' : 'Member deleted' }); } }}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Members;
