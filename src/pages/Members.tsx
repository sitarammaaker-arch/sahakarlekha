import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LinkedDeleteDialog } from '@/components/LinkedDeleteDialog';
import type { EntityLink } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Search, Eye, Edit, Phone, IndianRupee, Trash2, BookOpen, Download, CheckCircle, XCircle, FileText, ClipboardList } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MemberType, CasteCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { generateMemberPassbookPDF, generateMemberApplicationPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import type { Member, MemberStatus } from '@/types';

const CASTE_OPTIONS: { value: CasteCategory; label: string; labelHi: string }[] = [
  { value: 'General', label: 'General', labelHi: 'सामान्य' },
  { value: 'Backward Class', label: 'Backward Class (BC)', labelHi: 'पिछड़ा वर्ग (BC)' },
  { value: 'Schedule Caste', label: 'Schedule Caste (SC)', labelHi: 'अनुसूचित जाति (SC)' },
  { value: 'Schedule Tribe', label: 'Schedule Tribe (ST)', labelHi: 'अनुसूचित जनजाति (ST)' },
];

const EMPTY_FORM = {
  memberId: '', name: '', fatherName: '', address: '', phone: '',
  shareCapital: '', admissionFee: '', memberType: 'member' as MemberType,
  joinDate: new Date().toISOString().split('T')[0], status: 'active' as MemberStatus,
  age: '', occupation: '', caste: '' as CasteCategory | '',
  postOffice: '', tehsil: '', district: '', state: '', pinCode: '',
  paymentMode: 'cash' as 'cash' | 'cheque' | 'online',
  nomineeName: '', nomineeFatherName: '', nomineeRelation: '', nomineePhone: '',
  nomineeAge: '', nomineeOccupation: '', nomineeAddress: '', nomineeShares: '',
  shareCount: '', shareFaceValue: '',
};

interface MemberFormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  language: string;
  t: (key: string) => string;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
}

const MemberForm: React.FC<MemberFormProps> = ({ form, setForm, language, t, onSubmit, submitLabel, onCancel }) => {
  const hi = language === 'hi';
  const f = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  return (
  <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
    {/* Basic */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{t('memberId')} <span className="text-muted-foreground">({hi ? 'स्वचालित' : 'auto'})</span></Label>
        <Input value={form.memberId} onChange={e => f('memberId', e.target.value)} placeholder="M001" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'शामिल होने की तिथि' : 'Join Date'}</Label>
        <Input type="date" value={form.joinDate} onChange={e => f('joinDate', e.target.value)} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{t('memberName')} *</Label>
        <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder={hi ? 'पूरा नाम' : 'Full name'} required />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'पिता/पति का नाम' : "Father's/Husband's Name"}</Label>
        <Input value={form.fatherName} onChange={e => f('fatherName', e.target.value)} placeholder={hi ? 'श्री...' : 'Mr...'} />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'आयु' : 'Age'}</Label>
        <Input type="number" value={form.age} onChange={e => f('age', e.target.value)} placeholder="25" min="1" max="120" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'व्यवसाय' : 'Occupation'}</Label>
        <Input value={form.occupation} onChange={e => f('occupation', e.target.value)} placeholder={hi ? 'किसान' : 'Farmer'} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'जाति वर्ग' : 'Caste'}</Label>
        <Select value={form.caste} onValueChange={v => f('caste', v)}>
          <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
          <SelectContent>
            {CASTE_OPTIONS.map(c => (
              <SelectItem key={c.value} value={c.value}>{hi ? c.labelHi : c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    {/* Address */}
    <div className="space-y-1">
      <Label className="text-xs">{t('address')}</Label>
      <Textarea value={form.address} onChange={e => f('address', e.target.value)} placeholder={hi ? 'पूरा पता' : 'Full address'} className="h-16" />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'डाकघर' : 'Post Office'}</Label>
        <Input value={form.postOffice} onChange={e => f('postOffice', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'तहसील' : 'Tehsil'}</Label>
        <Input value={form.tehsil} onChange={e => f('tehsil', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'जिला' : 'District'}</Label>
        <Input value={form.district} onChange={e => f('district', e.target.value)} />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'राज्य' : 'State'}</Label>
        <Input value={form.state} onChange={e => f('state', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'पिन कोड' : 'Pin Code'}</Label>
        <Input value={form.pinCode} onChange={e => f('pinCode', e.target.value)} maxLength={6} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('phone')} *</Label>
        <Input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" required />
      </div>
    </div>
    {/* Member type & Finance */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'सदस्यता प्रकार' : 'Member Type'}</Label>
        <Select value={form.memberType} onValueChange={v => f('memberType', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{hi ? 'सदस्य' : 'Member'}</SelectItem>
            <SelectItem value="nominal">{hi ? 'नॉमिनल' : 'Nominal'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'भुगतान माध्यम' : 'Payment Mode'}</Label>
        <Select value={form.paymentMode} onValueChange={v => f('paymentMode', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">{hi ? 'नकद' : 'Cash'}</SelectItem>
            <SelectItem value="cheque">{hi ? 'चेक' : 'Cheque'}</SelectItem>
            <SelectItem value="online">{hi ? 'ऑनलाइन' : 'Online'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'अंश संख्या' : 'Shares'}</Label>
        <Input type="number" value={form.shareCount} onChange={e => f('shareCount', e.target.value)} min="0" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'प्रति अंश' : 'Face Value'}</Label>
        <Input type="number" value={form.shareFaceValue} onChange={e => f('shareFaceValue', e.target.value)} min="0" step="0.01" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('shareCapital')} (₹)</Label>
        <Input type="number" value={form.shareCapital} onChange={e => f('shareCapital', e.target.value)} min="0" step="0.01" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'प्रवेश शुल्क' : 'Adm. Fee'} (₹)</Label>
        <Input type="number" value={form.admissionFee} onChange={e => f('admissionFee', e.target.value)} min="0" step="0.01" />
      </div>
    </div>
    {/* Nominee */}
    <p className="text-xs font-semibold text-muted-foreground pt-1">{hi ? 'नामांकित (Nominee)' : 'Nominee Details'}</p>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'नामांकित का नाम' : 'Nominee Name'}</Label>
        <Input value={form.nomineeName} onChange={e => f('nomineeName', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'नामांकित के पिता' : "Nominee's Father"}</Label>
        <Input value={form.nomineeFatherName} onChange={e => f('nomineeFatherName', e.target.value)} />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'सम्बन्ध' : 'Relation'}</Label>
        <Input value={form.nomineeRelation} onChange={e => f('nomineeRelation', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'नामांकित आयु' : 'Nominee Age'}</Label>
        <Input type="number" value={form.nomineeAge} onChange={e => f('nomineeAge', e.target.value)} min="1" max="120" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'नामांकित फ़ोन' : 'Nominee Phone'}</Label>
        <Input type="tel" value={form.nomineePhone} onChange={e => f('nomineePhone', e.target.value)} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'नामांकित व्यवसाय' : 'Nominee Occupation'}</Label>
        <Input value={form.nomineeOccupation} onChange={e => f('nomineeOccupation', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'नामांकित अंश' : 'Nominee Shares'}</Label>
        <Input type="number" value={form.nomineeShares} onChange={e => f('nomineeShares', e.target.value)} min="0" />
      </div>
    </div>
    <div className="space-y-1">
      <Label className="text-xs">{hi ? 'नामांकित का पता' : 'Nominee Address'}</Label>
      <Input value={form.nomineeAddress} onChange={e => f('nomineeAddress', e.target.value)} />
    </div>
    <div className="flex gap-2 justify-end pt-2">
      <Button variant="outline" type="button" onClick={onCancel}>{t('cancel')}</Button>
      <Button type="submit">{submitLabel}</Button>
    </div>
  </form>
  );
};

const Members: React.FC = () => {
  const { t, language } = useLanguage();
  const { hasPermission } = useAuth();
  const { members, addMember, updateMember, deleteMember, approveMember, rejectMember, getMemberLedger, society, getEntityLinks } = useData();
  const canEdit = hasPermission(['admin', 'accountant']);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const hi = language === 'hi';
  const activeTab = searchParams.get('tab') || 'approved';

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [deleteGuard, setDeleteGuard] = useState<{ open: boolean; id: string; name: string; links: EntityLink[] }>({ open: false, id: '', name: '', links: [] });
  const [ledgerMember, setLedgerMember] = useState<Member | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

  // Split members by approval status
  const approvedMembers = members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved');
  const pendingMembers = members.filter(m => m.approvalStatus === 'pending');
  const rejectedMembers = members.filter(m => m.approvalStatus === 'rejected');

  const filterBySearch = (list: Member[]) => list.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery)
  );

  const totalShareCapital = approvedMembers.reduce((s, m) => s + m.shareCapital, 0);
  const activeApproved = approvedMembers.filter(m => m.status === 'active').length;

  const getNextMemberId = () => {
    const nums = members
      .map(m => parseInt(m.memberId.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n) && n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `M${String(next).padStart(3, '0')}`;
  };

  const handleDeleteClick = (member: Member) => {
    const links = getEntityLinks('member', member.id);
    setDeleteGuard({ open: true, id: member.id, name: `${member.name} (${member.memberId})`, links });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    const memberId = form.memberId.trim() || getNextMemberId();
    if (members.some(m => m.memberId === memberId)) {
      toast({ title: hi ? 'यह सदस्य ID पहले से मौजूद है' : 'Member ID already exists', variant: 'destructive' });
      return;
    }
    Object.assign(form, { memberId });
    addMember({
      ...form, memberId,
      shareCapital: Number(form.shareCapital) || 0, admissionFee: Number(form.admissionFee) || 0,
      age: form.age ? Number(form.age) : undefined, caste: form.caste || undefined,
      occupation: form.occupation || undefined, postOffice: form.postOffice || undefined,
      tehsil: form.tehsil || undefined, district: form.district || undefined,
      state: form.state || undefined, pinCode: form.pinCode || undefined,
      paymentMode: form.paymentMode || undefined,
      nomineeName: form.nomineeName || undefined, nomineeFatherName: form.nomineeFatherName || undefined,
      nomineeRelation: form.nomineeRelation || undefined, nomineePhone: form.nomineePhone || undefined,
      nomineeAge: form.nomineeAge ? Number(form.nomineeAge) : undefined,
      nomineeOccupation: form.nomineeOccupation || undefined, nomineeAddress: form.nomineeAddress || undefined,
      nomineeShares: form.nomineeShares ? Number(form.nomineeShares) : undefined,
      shareCount: form.shareCount ? Number(form.shareCount) : undefined,
      shareFaceValue: form.shareFaceValue ? Number(form.shareFaceValue) : undefined,
    });
    toast({ title: hi ? 'सदस्य जोड़ा गया' : 'Member added' });
    setForm(EMPTY_FORM);
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    updateMember(editMember.id, {
      ...form,
      shareCapital: Number(form.shareCapital) || 0, admissionFee: Number(form.admissionFee) || 0,
      age: form.age ? Number(form.age) : undefined, caste: form.caste || undefined,
      occupation: form.occupation || undefined, postOffice: form.postOffice || undefined,
      tehsil: form.tehsil || undefined, district: form.district || undefined,
      state: form.state || undefined, pinCode: form.pinCode || undefined,
      paymentMode: form.paymentMode || undefined,
      nomineeName: form.nomineeName || undefined, nomineeFatherName: form.nomineeFatherName || undefined,
      nomineeRelation: form.nomineeRelation || undefined, nomineePhone: form.nomineePhone || undefined,
      nomineeAge: form.nomineeAge ? Number(form.nomineeAge) : undefined,
      nomineeOccupation: form.nomineeOccupation || undefined, nomineeAddress: form.nomineeAddress || undefined,
      nomineeShares: form.nomineeShares ? Number(form.nomineeShares) : undefined,
      shareCount: form.shareCount ? Number(form.shareCount) : undefined,
      shareFaceValue: form.shareFaceValue ? Number(form.shareFaceValue) : undefined,
    });
    toast({ title: hi ? 'सदस्य अपडेट किया गया' : 'Member updated' });
    setEditMember(null);
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setForm({
      memberId: m.memberId, name: m.name, fatherName: m.fatherName, address: m.address, phone: m.phone,
      shareCapital: String(m.shareCapital), admissionFee: String(m.admissionFee || 0),
      memberType: m.memberType || 'member', joinDate: m.joinDate, status: m.status,
      age: m.age ? String(m.age) : '', occupation: m.occupation || '', caste: (m.caste || '') as CasteCategory | '',
      postOffice: m.postOffice || '', tehsil: m.tehsil || '', district: m.district || '',
      state: m.state || '', pinCode: m.pinCode || '', paymentMode: m.paymentMode || 'cash',
      nomineeName: m.nomineeName || '', nomineeFatherName: m.nomineeFatherName || '',
      nomineeRelation: m.nomineeRelation || '', nomineePhone: m.nomineePhone || '',
      nomineeAge: m.nomineeAge ? String(m.nomineeAge) : '', nomineeOccupation: m.nomineeOccupation || '',
      nomineeAddress: m.nomineeAddress || '', nomineeShares: m.nomineeShares ? String(m.nomineeShares) : '',
      shareCount: m.shareCount ? String(m.shareCount) : '', shareFaceValue: m.shareFaceValue ? String(m.shareFaceValue) : '',
    });
  };

  const handleApprove = (member: Member) => {
    approveMember(member.id);
    toast({ title: hi ? 'सदस्य स्वीकृत' : 'Member Approved', description: hi ? `${member.name} अब सत्यापित सदस्य है` : `${member.name} is now a verified member` });
  };

  const handleReject = (member: Member) => {
    rejectMember(member.id);
    toast({ title: hi ? 'आवेदन अस्वीकृत' : 'Application Rejected', description: member.name });
  };

  const handleDownloadPDF = (member: Member) => {
    generateMemberApplicationPDF(member, society);
  };

  const renderMemberTable = (memberList: Member[], showApprovalActions: boolean) => {
    const filtered = filterBySearch(memberList);
    if (filtered.length === 0) {
      return <p className="text-center text-muted-foreground py-12">{t('noData')}</p>;
    }
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">{t('memberId')}</TableHead>
              <TableHead className="font-semibold">{t('memberName')}</TableHead>
              <TableHead className="font-semibold">{t('phone')}</TableHead>
              <TableHead className="font-semibold text-center">{hi ? 'प्रकार' : 'Type'}</TableHead>
              <TableHead className="font-semibold text-right">{t('shareCapital')}</TableHead>
              <TableHead className="font-semibold text-right">{hi ? 'प्रवेश शुल्क' : 'Admission Fee'}</TableHead>
              {!showApprovalActions && <TableHead className="font-semibold text-center">{hi ? 'स्थिति' : 'Status'}</TableHead>}
              <TableHead className="font-semibold text-center">{hi ? 'क्रियाएं' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(member => (
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
                    {member.memberType === 'nominal' ? (hi ? 'नॉमिनल' : 'Nominal') : (hi ? 'सदस्य' : 'Member')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(member.shareCapital)}</TableCell>
                <TableCell className="text-right">{fmt(member.admissionFee || 0)}</TableCell>
                {!showApprovalActions && (
                  <TableCell className="text-center">
                    <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className={member.status === 'active' ? 'bg-success' : ''}>
                      {member.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {showApprovalActions && canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApprove(member)} title={hi ? 'स्वीकृत' : 'Approve'}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(member)} title={hi ? 'अस्वीकृत' : 'Reject'}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleDownloadPDF(member)} title="PDF">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMember(member)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!showApprovalActions && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => setLedgerMember(member)}>
                        <BookOpen className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(member)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(member)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-accent" />
            {t('members')}
          </h1>
          <p className="text-muted-foreground">{hi ? 'समिति सदस्यों का प्रबंधन' : 'Manage society members'}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" className="gap-2" onClick={() => navigate('/member-application')}>
              <ClipboardList className="h-4 w-4" />
              {hi ? 'आवेदन पत्र' : 'Application Form'}
            </Button>
          )}
          <Dialog open={isAddOpen} onOpenChange={(o) => { if (o) setForm({ ...EMPTY_FORM, memberId: getNextMemberId() }); else { setIsAddOpen(false); setForm(EMPTY_FORM); } setIsAddOpen(o); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />{hi ? 'नया सदस्य' : 'New Member'}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{hi ? 'नया सदस्य जोड़ें (सीधा)' : 'Add New Member (Direct)'}</DialogTitle>
                <DialogDescription>{hi ? 'सदस्य सीधे सत्यापित सूची में जोड़ें' : 'Add member directly to verified list'}</DialogDescription>
              </DialogHeader>
              <MemberForm form={form} setForm={setForm} language={language} t={t} onSubmit={handleAdd} submitLabel={t('save')} onCancel={() => { setIsAddOpen(false); setForm(EMPTY_FORM); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center"><Users className="h-6 w-6 text-accent" /></div>
              <div><p className="text-sm text-muted-foreground">{t('totalMembers')}</p><p className="text-2xl font-bold">{approvedMembers.length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-success/20 flex items-center justify-center"><Users className="h-6 w-6 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">{hi ? 'सक्रिय सदस्य' : 'Active Members'}</p><p className="text-2xl font-bold text-success">{activeApproved}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-amber-600" /></div>
              <div><p className="text-sm text-muted-foreground">{hi ? 'पेंडिंग आवेदन' : 'Pending Applications'}</p><p className="text-2xl font-bold text-amber-600">{pendingMembers.length}</p></div>
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
              placeholder={hi ? 'नाम, ID या फोन से खोजें...' : 'Search by name, ID or phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {hi ? 'सत्यापित सदस्य' : 'Verified Members'}
            <Badge variant="secondary" className="ml-1">{approvedMembers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            {hi ? 'पेंडिंग आवेदन' : 'Pending Applications'}
            {pendingMembers.length > 0 && <Badge variant="destructive" className="ml-1">{pendingMembers.length}</Badge>}
          </TabsTrigger>
          {rejectedMembers.length > 0 && (
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              {hi ? 'अस्वीकृत' : 'Rejected'}
              <Badge variant="secondary" className="ml-1">{rejectedMembers.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="approved">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">{hi ? 'सत्यापित सदस्य सूची' : 'Verified Member List'}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderMemberTable(approvedMembers, false)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {hi ? 'पेंडिंग आवेदन' : 'Pending Applications'}
                {pendingMembers.length > 0 && <Badge variant="destructive">{pendingMembers.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderMemberTable(pendingMembers, true)}
            </CardContent>
          </Card>
        </TabsContent>

        {rejectedMembers.length > 0 && (
          <TabsContent value="rejected">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{hi ? 'अस्वीकृत आवेदन' : 'Rejected Applications'}</CardTitle>
              </CardHeader>
              <CardContent>
                {renderMemberTable(rejectedMembers, true)}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => { if (!o) setEditMember(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{hi ? 'सदस्य संपादित करें' : 'Edit Member'}</DialogTitle>
          </DialogHeader>
          <MemberForm form={form} setForm={setForm} language={language} t={t} onSubmit={handleEdit} submitLabel={hi ? 'अपडेट करें' : 'Update'} onCancel={() => setEditMember(null)} />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewMember} onOpenChange={(o) => { if (!o) setViewMember(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'सदस्य विवरण' : 'Member Details'}</DialogTitle>
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
                [hi ? 'पिता/पति' : 'Father/Husband', viewMember.fatherName],
                [t('phone'), viewMember.phone],
                [t('address'), viewMember.address],
                [hi ? 'सदस्यता प्रकार' : 'Member Type', viewMember.memberType === 'nominal' ? (hi ? 'नॉमिनल सदस्य' : 'Nominal Member') : (hi ? 'सदस्य' : 'Member')],
                [t('shareCapital'), fmt(viewMember.shareCapital)],
                [hi ? 'प्रवेश शुल्क' : 'Admission Fee', fmt(viewMember.admissionFee || 0)],
                [hi ? 'शामिल तिथि' : 'Join Date', fmtDate(viewMember.joinDate)],
                [hi ? 'स्थिति' : 'Status', viewMember.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')],
                ...(viewMember.approvalStatus ? [[hi ? 'अनुमोदन' : 'Approval', viewMember.approvalStatus === 'pending' ? (hi ? 'पेंडिंग' : 'Pending') : viewMember.approvalStatus === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') : (hi ? 'अस्वीकृत' : 'Rejected')]] : []),
                ...(viewMember.age ? [[hi ? 'आयु' : 'Age', `${viewMember.age} ${hi ? 'वर्ष' : 'years'}`]] : []),
                ...(viewMember.occupation ? [[hi ? 'व्यवसाय' : 'Occupation', viewMember.occupation]] : []),
                ...(viewMember.caste ? [[hi ? 'जाति वर्ग' : 'Caste', viewMember.caste]] : []),
                ...(viewMember.district ? [[hi ? 'जिला' : 'District', viewMember.district]] : []),
                ...(viewMember.state ? [[hi ? 'राज्य' : 'State', viewMember.state]] : []),
                ...(viewMember.pinCode ? [[hi ? 'पिन कोड' : 'Pin Code', viewMember.pinCode]] : []),
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
            const fmtAmt = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n);
            return (
              <>
                <SheetHeader className="pb-4 border-b">
                  <SheetTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {hi ? 'सदस्य खाता बही' : 'Member Share Ledger'}
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
                    <span className="text-muted-foreground">{hi ? 'शामिल तिथि' : 'Join Date'}:</span>
                    <span>{fmtDate(ledgerMember.joinDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{hi ? 'शेष' : 'Balance'}:</span>
                    <span className="font-bold text-primary text-base">
                      {closing ? fmtAmt(closing.balance) : fmtAmt(0)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                    <p className="text-xs text-muted-foreground">{hi ? 'कुल जमा' : 'Total Deposits'}</p>
                    <p className="font-bold text-green-700">{fmtAmt(totalCredit)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                    <p className="text-xs text-muted-foreground">{hi ? 'कुल निकासी' : 'Total Withdrawals'}</p>
                    <p className="font-bold text-red-700">{fmtAmt(totalDebit)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">{t('date')}</TableHead>
                        <TableHead className="text-xs">{t('voucherNo')}</TableHead>
                        <TableHead className="text-xs">{t('particulars')}</TableHead>
                        <TableHead className="text-xs text-right">{hi ? 'जमा' : 'Credit'}</TableHead>
                        <TableHead className="text-xs text-right">{hi ? 'निकासी' : 'Debit'}</TableHead>
                        <TableHead className="text-xs text-right">{hi ? 'शेष' : 'Balance'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, idx) => (
                        <TableRow key={entry.id} className={idx === 0 ? 'bg-blue-50/60 font-medium' : 'hover:bg-muted/30'}>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(entry.date)}</TableCell>
                          <TableCell><Badge variant="outline" className="font-mono text-xs">{entry.voucherNo}</Badge></TableCell>
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

      {/* Delete Guard */}
      <LinkedDeleteDialog
        open={deleteGuard.open}
        onOpenChange={o => setDeleteGuard(g => ({ ...g, open: o }))}
        entityName={deleteGuard.name}
        links={deleteGuard.links}
        language={language as 'hi' | 'en'}
        onConfirmDelete={() => {
          if (deleteGuard.id) {
            deleteMember(deleteGuard.id);
            toast({ title: hi ? 'सदस्य हटाया गया' : 'Member deleted' });
          }
        }}
      />
    </div>
  );
};

export default Members;
