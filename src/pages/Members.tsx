import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { trackEvent } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LinkedDeleteDialog } from '@/components/LinkedDeleteDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { EntityLink } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Search, Eye, Edit, Phone, IndianRupee, Trash2, BookOpen, Download, CheckCircle, XCircle, FileText, ClipboardList, UserCog, Award, KeyRound, ContactRound, HandCoins, FileSpreadsheet } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MemberType, CasteCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useDeepLinkQuery } from '@/hooks/useDeepLinkQuery';
import { generateMemberPassbookPDF, generateMemberApplicationPDF } from '@/lib/pdf';
import { fmtDate } from '@/lib/dateUtils';
import type { Member, MemberStatus, Nominee, KycStatus, ShareCertStatus } from '@/types';
import { validateNominees, nomineeShareTotal } from '@/lib/nomineeUtils';
import { validateKyc } from '@/lib/kycUtils';
import { validateCertificate } from '@/lib/shareCertUtils';
import { memberStatusLabel, memberTypeLabel } from '@/lib/memberLifecycle';
import { useSubscription } from '@/hooks/useSubscription';
import { MemberPortalDialog } from '@/components/members/MemberPortalDialog';
import { MemberPhotoPicker } from '@/components/members/MemberPhotoPicker';
import { memberPhoneError } from '@/lib/memberValidation';
import { callMemberPortalAdmin, portalPlanAllowed, type PortalLoginRow } from '@/lib/memberPortalAdmin';
import { useOpenOnNew } from '@/hooks/useOpenOnNew';
import { admissionClock, applicationReceivedOn, validateAdmission, validateRejection, isHaryana } from '@/lib/members/admission';
import { generateMemberRefusalLetterPDF, generateShareCertificatePDF } from '@/lib/pdf';
import { nomineeCountWarning, certificateNoTakenBy } from '@/lib/members/shareRules';
import { validateStatusChange, liabilityUntil, isExit, deathSettlement } from '@/lib/members/cessation';
import { loanOutstanding, kccOutstanding } from '@/lib/memberSnapshot';
import { ageOn } from '@/lib/members/voters';
import { downloadExcel } from '@/lib/exportUtils';

// ECR-16: member lifecycle status → label + badge colour per state.
const STATUS_META: Record<MemberStatus, { hi: string; en: string; cls: string }> = {
  active:   { hi: 'सक्रिय',    en: 'Active',   cls: 'bg-success text-white' },
  inactive: { hi: 'निष्क्रिय', en: 'Inactive', cls: 'bg-gray-200 text-gray-700' },
  resigned: { hi: 'त्यागपत्र', en: 'Resigned', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  expelled: { hi: 'निष्कासित', en: 'Expelled', cls: 'bg-red-100 text-red-800 border-red-300' },
  deceased: { hi: 'मृत',       en: 'Deceased', cls: 'bg-slate-300 text-slate-800' },
};

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
  nominees: [] as Nominee[],   // ECR-16: multiple nominees
  aadhaar: '', pan: '', kycStatus: '' as KycStatus | '',   // ECR-16: KYC
  admissionResolutionNo: '', admissionResolutionDate: '',   // M2: the committee resolution that admitted the member
  gender: '' as '' | 'female' | 'male' | 'other', dateOfBirth: '',   // M5: s.28(1) reservation needs the women count
  correspondenceAddress: '',   // M6: s.40 proviso — correspondence address besides the permanent one
};

interface MemberFormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  language: string;
  t: (key: string) => string;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
  /** Edit mode locks the share fields — share changes must go through Share Register
   *  (which posts a voucher) so the member scalar never drifts from the ledger control. */
  isEdit?: boolean;
  /** The photograph (s.40) — held outside `form` so it never rides the member row; uploaded after the save. */
  photoFile: File | null;
  onPhoto: (file: File | null) => void;
  existingPhotoUrl?: string | null;
  onPhotoError: (message: string) => void;
}

const MemberForm: React.FC<MemberFormProps> = ({ form, setForm, language, t, onSubmit, submitLabel, onCancel, isEdit, photoFile, onPhoto, existingPhotoUrl, onPhotoError }) => {
  const hi = language === 'hi';
  const f = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  // ECR-16: multiple-nominee editor helpers (functional updates → no stale-closure lost writes)
  const nominees = form.nominees || [];
  const addNominee = () => setForm(prev => ({ ...prev, nominees: [...(prev.nominees || []), { id: crypto.randomUUID(), name: '', relation: '', phone: '', sharePercent: 0 }] }));
  const updateNominee = (i: number, patch: Partial<Nominee>) => setForm(prev => ({ ...prev, nominees: (prev.nominees || []).map((n, idx) => idx === i ? { ...n, ...patch } : n) }));
  const removeNominee = (i: number) => setForm(prev => ({ ...prev, nominees: (prev.nominees || []).filter((_, idx) => idx !== i) }));
  const nomTotal = nomineeShareTotal(nominees);
  // a-3: derive Share Capital from shares x face value so the three fields can't drift.
  // When both are set, Share Capital is auto-computed and locked; otherwise it stays a
  // free field (a society may enter a lump-sum capital without a per-share breakdown).
  const shareCountNum = parseFloat(form.shareCount) || 0;
  const shareFaceNum = parseFloat(form.shareFaceValue) || 0;
  const capitalAuto = shareCountNum > 0 && shareFaceNum > 0;
  return (
  <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
    {/* Basic */}
    <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{hi ? 'मूल जानकारी' : 'Basic details'}</p>
    <MemberPhotoPicker file={photoFile} onChange={onPhoto} existingUrl={existingPhotoUrl} hi={hi} onError={onPhotoError} />
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{t('memberId')} <span className="text-muted-foreground">({hi ? 'स्वचालित' : 'auto'})</span></Label>
        <Input value={form.memberId} onChange={e => f('memberId', e.target.value)} placeholder="M001" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'दाख़िला तिथि (सदस्य बनने की तिथि)' : 'Admission date'}</Label>
        <Input type="date" value={form.joinDate} onChange={e => f('joinDate', e.target.value)} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'समिति प्रस्ताव संख्या' : 'Committee resolution no.'}</Label>
        <Input value={form.admissionResolutionNo} onChange={e => f('admissionResolutionNo', e.target.value)} placeholder={hi ? 'जैसे 12/2025' : 'e.g. 12/2025'} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'प्रस्ताव तिथि' : 'Resolution date'}</Label>
        <Input type="date" value={form.admissionResolutionDate} onChange={e => f('admissionResolutionDate', e.target.value)} />
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'लिंग' : 'Gender'}{!isEdit && ' *'}</Label>
        <Select value={form.gender || undefined} onValueChange={v => { if (v) f('gender', v); }}>
          <SelectTrigger><SelectValue placeholder={hi ? 'चुनें' : 'Select'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="female">{hi ? 'महिला' : 'Female'}</SelectItem>
            <SelectItem value="male">{hi ? 'पुरुष' : 'Male'}</SelectItem>
            <SelectItem value="other">{hi ? 'अन्य' : 'Other'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'जन्म तिथि (वैकल्पिक)' : 'Date of birth (optional)'}</Label>
        <Input type="date" value={form.dateOfBirth} max={new Date().toISOString().split('T')[0]} onChange={e => f('dateOfBirth', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'आयु' : 'Age'}{form.dateOfBirth ? (hi ? ' (जन्म तिथि से)' : ' (from DOB)') : ''}</Label>
        <Input type="number" value={form.dateOfBirth ? String(ageOn(form.dateOfBirth, new Date().toISOString().split('T')[0]) ?? '') : form.age} readOnly={!!form.dateOfBirth} onChange={e => f('age', e.target.value)} placeholder="25" min="1" max="120" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide border-t border-border pt-3">{hi ? 'पता' : 'Address'}</p>
    <div className="space-y-1">
      <Label className="text-xs">{hi ? 'स्थायी पता' : 'Permanent address'}</Label>
      <Textarea value={form.address} onChange={e => f('address', e.target.value)} placeholder={hi ? 'पूरा पता' : 'Full address'} className="h-16" />
    </div>
    <div className="space-y-1">
      <Label className="text-xs">{hi ? 'पत्राचार का पता (अलग हो तो)' : 'Correspondence address (if different)'}</Label>
      <Textarea value={form.correspondenceAddress} onChange={e => f('correspondenceAddress', e.target.value)} placeholder={hi ? 'खाली छोड़ें तो स्थायी पता ही माना जाएगा' : 'Leave blank if the same'} className="h-12" />
      <p className="text-[11px] text-muted-foreground">{hi ? 'धारा 40: पता बदले तो 15 दिन में समिति को बताना होता है — यहीं बदलें, बदलाव audit में दर्ज होता है।' : 's.40: report an address change within 15 days — change it here; the change is audited.'}</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'राज्य' : 'State'}</Label>
        <Input value={form.state} onChange={e => f('state', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'पिन कोड' : 'Pin Code'}</Label>
        <Input value={form.pinCode} onChange={e => f('pinCode', e.target.value)} maxLength={6} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('phone')} {hi ? '(वैकल्पिक)' : '(optional)'}</Label>
        <Input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" />
      </div>
    </div>
    {/* Member type & Finance */}
    <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide border-t border-border pt-3">{hi ? 'सदस्यता व शेयर' : 'Membership & shares'}</p>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'सदस्यता प्रकार' : 'Member Type'}</Label>
        <Select value={form.memberType} onValueChange={v => f('memberType', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{hi ? 'सदस्य' : 'Member'}</SelectItem>
            <SelectItem value="nominal">{hi ? 'नाममात्र सदस्य' : 'Nominal'}</SelectItem>
            <SelectItem value="associate">{hi ? 'सहयोगी सदस्य (मत/लाभांश नहीं)' : 'Associate (no vote / dividend)'}</SelectItem>
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'शेयर संख्या' : 'Shares'}</Label>
        <Input type="number" value={form.shareCount} onChange={e => setForm(prev => { const c = parseFloat(e.target.value) || 0; const fv = parseFloat(prev.shareFaceValue) || 0; return { ...prev, shareCount: e.target.value, ...(c > 0 && fv > 0 ? { shareCapital: String(c * fv) } : {}) }; })} min="0" disabled={isEdit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'प्रति शेयर' : 'Face Value'}</Label>
        <Input type="number" value={form.shareFaceValue} onChange={e => setForm(prev => { const fv = parseFloat(e.target.value) || 0; const c = parseFloat(prev.shareCount) || 0; return { ...prev, shareFaceValue: e.target.value, ...(c > 0 && fv > 0 ? { shareCapital: String(c * fv) } : {}) }; })} min="0" step="0.01" disabled={isEdit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('shareCapital')} (₹)</Label>
        <Input type="number" value={form.shareCapital} onChange={e => f('shareCapital', e.target.value)} min="0" step="0.01" disabled={isEdit || capitalAuto} />
        {!isEdit && capitalAuto && (
          <p className="text-[10px] text-muted-foreground">{shareCountNum} × ₹{shareFaceNum} = ₹{(shareCountNum * shareFaceNum).toLocaleString('en-IN')}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{hi ? 'प्रवेश शुल्क' : 'Adm. Fee'} (₹)</Label>
        <Input type="number" value={form.admissionFee} onChange={e => f('admissionFee', e.target.value)} min="0" step="0.01" />
      </div>
    </div>
    {isEdit && (
      <p className="text-[11px] text-muted-foreground -mt-2">
        {hi
          ? 'शेयर संख्या/मूल्य यहाँ से नहीं बदलते — "शेयर रजिस्टर" पेज पर जाएँ, ताकि बदलाव बही में सही दर्ज हो और शेष मेल खाता रहे।'
          : 'Share count/value can\'t be changed here — use the Share Register page so the change posts to the ledger and the balance stays reconciled.'}
      </p>
    )}
    {/* Nominee — primary (drives the statutory nomination form / Form-1) */}
    <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide border-t border-border pt-3">{hi ? 'मुख्य नामांकित' : 'Primary Nominee'}</p>
    <p className="text-[11px] text-muted-foreground -mt-1">{hi ? 'यही विवरण नामांकन फॉर्म व Form-1 पर छपता है — पूरा भरें।' : 'These details print on the nomination form & Form-1 — fill them in full.'}</p>
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <Label className="text-xs">{hi ? 'नामांकित शेयर' : 'Nominee Shares'}</Label>
        <Input type="number" value={form.nomineeShares} onChange={e => f('nomineeShares', e.target.value)} min="0" />
      </div>
    </div>
    <div className="space-y-1">
      <Label className="text-xs">{hi ? 'नामांकित का पता' : 'Nominee Address'}</Label>
      <Input value={form.nomineeAddress} onChange={e => f('nomineeAddress', e.target.value)} />
    </div>

    {/* ECR-16: KYC (Aadhaar / PAN) */}
    <div className="pt-3 border-t border-border">
      <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{hi ? 'KYC (आधार / पैन)' : 'KYC (Aadhaar / PAN)'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
        <div className="space-y-1">
          <Label className="text-xs">{hi ? 'आधार नंबर' : 'Aadhaar No.'}</Label>
          <Input value={form.aadhaar} onChange={e => f('aadhaar', e.target.value)} placeholder={hi ? '12 अंक' : '12 digits'} maxLength={14} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">PAN</Label>
          <Input value={form.pan} onChange={e => f('pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{hi ? 'KYC स्थिति' : 'KYC Status'}</Label>
          <Select value={form.kycStatus || 'none'} onValueChange={v => setForm(prev => ({ ...prev, kycStatus: (v === 'none' ? '' : v) as KycStatus | '' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{hi ? '— शुरू नहीं —' : '— Not started —'}</SelectItem>
              <SelectItem value="pending">{hi ? 'लंबित' : 'Pending'}</SelectItem>
              <SelectItem value="verified">{hi ? 'सत्यापित' : 'Verified'}</SelectItem>
              <SelectItem value="rejected">{hi ? 'अस्वीकृत' : 'Rejected'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    {/* ECR-16: Multiple nominees with benefit share % */}
    <div className="pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{hi ? 'अतिरिक्त नामांकित — लाभ-हिस्सा % (वैकल्पिक)' : 'Additional Nominees — benefit share % (optional)'}</p>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1" onClick={addNominee}>
          <Plus className="h-3.5 w-3.5" />{hi ? 'नामांकित जोड़ें' : 'Add nominee'}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{hi ? 'सिर्फ़ तब भरें जब एक से ज़्यादा नामांकित हों और लाभ %-वार बाँटना हो (कुल 100% तक)। एक ही नामांकित हो तो ऊपर "मुख्य नामांकित" काफ़ी है।' : 'Only if there is more than one nominee and benefits are split by % (up to 100% total). For a single nominee, the Primary Nominee above is enough.'}</p>
      {nominees.map((n, i) => (
        <div key={n.id} className="grid grid-cols-12 gap-2 mt-2 items-end">
          <div className="col-span-4 space-y-1">
            <Label className="text-[10px]">{hi ? 'नाम' : 'Name'}</Label>
            <Input className="h-8" value={n.name} onChange={e => updateNominee(i, { name: e.target.value })} />
          </div>
          <div className="col-span-3 space-y-1">
            <Label className="text-[10px]">{hi ? 'सम्बन्ध' : 'Relation'}</Label>
            <Input className="h-8" value={n.relation} onChange={e => updateNominee(i, { relation: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px]">{hi ? 'फ़ोन' : 'Phone'}</Label>
            <Input className="h-8" value={n.phone || ''} onChange={e => updateNominee(i, { phone: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px]">{hi ? 'हिस्सा %' : 'Share %'}</Label>
            <Input className="h-8" type="number" min="0" max="100" value={n.sharePercent || ''} onChange={e => updateNominee(i, { sharePercent: Number(e.target.value) || 0 })} />
          </div>
          <div className="col-span-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeNominee(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {nominees.length > 0 && (
        <p className={`text-xs mt-1 ${nomTotal > 100 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {hi ? 'कुल हिस्सा' : 'Total share'}: {nomTotal}%{nomTotal > 100 ? (hi ? ' — 100% से ज़्यादा!' : ' — exceeds 100%!') : ''}
        </p>
      )}
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
  const { can, user } = useAuth();
  const { members: allMembers, addMember, updateMember, changeMemberStatus, deleteMember, approveMember, rejectMember, getMemberLedger, society, getEntityLinks, matchesActiveBranch, loans, kccLoans, approveShareRefund, uploadMemberPhoto, removeMemberPhoto, memberPhotoUrl } = useData();
  // ECR-17 Phase 4: scope the member list to the active branch ('all' → every member).
  const members = allMembers.filter(m => matchesActiveBranch(m.branchId));
  // ECR-06 17-role: RBAC permission gate, not a hardcoded legacy list. `update` (not `create`)
  // keeps the auditor family — whose `create` is audit-objection-scoped — read-only here;
  // byte-identical for the 4 legacy roles, opens edit to operational roles (delete fail-closes
  // at the data layer).
  const canEdit = can('update');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const hi = language === 'hi';
  const activeTab = searchParams.get('tab') || 'approved';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | MemberType>('all');
  useDeepLinkQuery(setSearchQuery);   // ECR-25 P2: focus a member deep-linked from global search (?q=)
  const [isAddOpen, setIsAddOpen] = useState(false);
  useOpenOnNew(() => setAddChooserOpen(true));   // ＋ नई entry → सदस्य (U1: the same chooser as the button)
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [deleteGuard, setDeleteGuard] = useState<{ open: boolean; id: string; name: string; links: EntityLink[] }>({ open: false, id: '', name: '', links: [] });
  const [decision, setDecision] = useState<{ member: Member; action: 'approve' | 'reject' } | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const [decisionForm, setDecisionForm] = useState({ admissionDate: today, resolutionNo: '', resolutionDate: '', reason: '' });
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  // M6: the viewed member's photo (private bucket → short-lived signed URL)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Photo chosen in the add / edit form — uploaded once the member row is saved (it never rides `form`).
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const photoError = (message: string) => toast({ title: hi ? 'फ़ोटो' : 'Photo', description: message, variant: 'destructive' });
  const photoInput = useRef<HTMLInputElement>(null);
  // M6: Rules r.14 / r.15 eligibility, declared at approval (recorded in the audit; unticked → warning, never a block)
  const [declared, setDeclared] = useState({ notInsolvent: false, notConvicted: false, noOtherCreditSociety: false });
  const viewPhotoPath = viewMember ? allMembers.find(m => m.id === viewMember.id)?.photoPath : undefined;
  useEffect(() => {
    let live = true;
    setPhotoUrl(null);
    if (viewPhotoPath) memberPhotoUrl(viewPhotoPath).then(u => { if (live) setPhotoUrl(u); });
    return () => { live = false; };
  }, [viewPhotoPath, memberPhotoUrl]);
  const onPhotoPicked = async (file: File | undefined) => {
    if (!file || !viewMember) return;
    setPhotoBusy(true);
    await uploadMemberPhoto(viewMember.id, file);
    setPhotoBusy(false);
    if (photoInput.current) photoInput.current.value = '';
  };
  const [ledgerMember, setLedgerMember] = useState<Member | null>(null);
  // Member Portal S2b: admin-only portal-login management (the Edge Function re-checks admin + plan).
  const isAdmin = user?.role === 'admin';
  const { plan, status: subStatus } = useSubscription();
  const portalAllowed = portalPlanAllowed(plan, subStatus);
  const [portalMember, setPortalMember] = useState<Member | null>(null);
  const [portalLogins, setPortalLogins] = useState<Record<string, PortalLoginRow>>({});
  const loadPortalLogins = useCallback(async () => {
    if (!isAdmin) return;
    const res = await callMemberPortalAdmin<{ logins: PortalLoginRow[] }>('list');
    if (res.ok) setPortalLogins(Object.fromEntries(res.data.logins.map(l => [l.member_id, l])));
  }, [isAdmin]);
  useEffect(() => { void loadPortalLogins(); }, [loadPortalLogins]);
  // ECR-16: lifecycle status-change dialog
  const [statusMember, setStatusMember] = useState<Member | null>(null);
  const [statusNew, setStatusNew] = useState<MemberStatus>('inactive');
  const [statusReason, setStatusReason] = useState('');
  // M4: the effective date (r.22(c)) + the resolution behind the change (r.19 / Board)
  const [statusDate, setStatusDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusResNo, setStatusResNo] = useState('');
  const [statusResDate, setStatusResDate] = useState('');
  const [settleMember, setSettleMember] = useState<Member | null>(null);
  const [settleForm, setSettleForm] = useState({ date: new Date().toISOString().split('T')[0], resolution: '', amount: '' });
  // ECR-16: share-certificate dialog
  const [certMember, setCertMember] = useState<Member | null>(null);
  const [certForm, setCertForm] = useState({ certNo: '', count: '', faceValue: '', status: 'issued' as ShareCertStatus, reason: '' });
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2);

  // Split members by approval status
  const approvedMembers = members.filter(m => !m.approvalStatus || m.approvalStatus === 'approved');
  const pendingMembers = members.filter(m => m.approvalStatus === 'pending');
  const rejectedMembers = members.filter(m => m.approvalStatus === 'rejected');

  const filterBySearch = (list: Member[]) => list.filter(m =>
    (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.memberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.phone || '').includes(searchQuery))
    && (statusFilter === 'all' || m.status === statusFilter)
    && (typeFilter === 'all' || (m.memberType || 'member') === typeFilter)
  );
  // U6 (M5): the verified list as it is filtered on screen, to Excel.
  const exportMembersExcel = () => {
    const rows = filterBySearch(approvedMembers).map((m, i) => [
      i + 1, m.memberId, m.name, m.fatherName || '', m.gender === 'female' ? 'Female' : m.gender === 'male' ? 'Male' : m.gender === 'other' ? 'Other' : '',
      m.dateOfBirth || '', m.occupation || '', m.caste || '', m.address || '', m.phone || '', memberTypeLabel(m.memberType),
      m.admissionDate || m.joinDate || '', memberStatusLabel(m.status), isExit(m.status) ? (m.statusChangedAt || '') : '',
      m.shareCount ?? '', m.shareCapital || 0, m.nomineeName || '',
    ]);
    downloadExcel([{ name: 'Members', headers: ['S.No', 'Member No.', 'Name', 'Father/Husband', 'Gender', 'Date of Birth', 'Occupation', 'Category', 'Address', 'Phone', 'Type', 'Admission Date', 'Status', 'Ceased On', 'Shares', 'Share Capital', 'Nominee'], rows }], 'members');
  };

  const totalShareCapital = approvedMembers.reduce((s, m) => s + m.shareCapital, 0);
  const activeApproved = approvedMembers.filter(m => m.status === 'active').length;

  const getNextMemberId = () => {
    const nums = allMembers   // scan ALL members (not branch-scoped) so IDs stay unique society-wide
      .map(m => parseInt(m.memberId.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n) && n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `M${String(next).padStart(3, '0')}`;
  };

  const handleDeleteClick = (member: Member) => {
    const links = getEntityLinks('member', member.id);
    setDeleteGuard({ open: true, id: member.id, name: `${member.name} (${member.memberId})`, links });
  };

  // Compose the canonical nominees[] = [primary, ...additional]. The primary is built
  // from the "Primary Nominee" block (role-marked + enriched with father/age/etc.); the
  // additional list comes from the editor. Legacy flat fields are still written
  // separately (below) so the statutory PDFs keep reading them unchanged (no pdf.ts
  // change needed). `role` makes the split deterministic — existing data (no role) is
  // treated as additional and never dropped.
  const buildCanonicalNominees = (): Nominee[] => {
    const additional = form.nominees.filter(n => n.name?.trim() && n.role !== 'primary');
    const name = form.nomineeName.trim();
    if (!name) return additional;
    const primary: Nominee = {
      id: crypto.randomUUID(),
      role: 'primary',
      name,
      relation: form.nomineeRelation || '',
      phone: form.nomineePhone || undefined,
      sharePercent: 0,
      fatherName: form.nomineeFatherName || undefined,
      age: form.nomineeAge ? Number(form.nomineeAge) : undefined,
      occupation: form.nomineeOccupation || undefined,
      address: form.nomineeAddress || undefined,
      shares: form.nomineeShares ? Number(form.nomineeShares) : undefined,
    };
    return [primary, ...additional];
  };

  // Phone is optional (founder 2026-10-09); if given it must be a real mobile — the shared rule (lib/memberValidation).
  const phoneError = (phone: string | undefined): string | null => memberPhoneError(phone, hi);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    if (phoneError(form.phone)) { toast({ title: phoneError(form.phone)!, variant: 'destructive' }); return; }
    // M5: a NEW member records the gender (s.28(1) committee reservation); older members may stay blank.
    if (!form.gender) { toast({ title: hi ? 'लिंग चुनें' : 'Select gender', description: hi ? 'समिति में महिला आरक्षण (धारा 28) के हिसाब के लिए ज़रूरी।' : 'Needed for the committee reservation (s.28).', variant: 'destructive' }); return; }
    const memberId = form.memberId.trim() || getNextMemberId();
    if (allMembers.some(m => m.memberId.trim().toLowerCase() === memberId.toLowerCase())) {   // D6: every branch, not just the one on screen
      toast({ title: hi ? 'यह सदस्य ID पहले से मौजूद है' : 'Member ID already exists', variant: 'destructive' });
      return;
    }
    // ECR-16: nomination is mandatory — at least one nominee (legacy single OR the list).
    const cleanNominees = form.nominees.filter(n => n.name?.trim());
    if (cleanNominees.length === 0 && !form.nomineeName.trim()) {
      toast({ title: hi ? 'नामांकित ज़रूरी है' : 'Nominee required', description: hi ? 'कम से कम एक नामांकित जोड़ें।' : 'Add at least one nominee.', variant: 'destructive' });
      return;
    }
    const nv = validateNominees(cleanNominees);
    if (!nv.ok) { toast({ title: hi ? 'नामांकित त्रुटि' : 'Nominee error', description: nv.error, variant: 'destructive' }); return; }
    const kv = validateKyc(form.aadhaar, form.pan);
    if (!kv.ok) { toast({ title: 'KYC', description: kv.error, variant: 'destructive' }); return; }
    // M3: r.21 — nominees may not outnumber the shares (warning only).
    const nomWarn = nomineeCountWarning((form.nomineeName.trim() ? 1 : 0) + cleanNominees.length, Number(form.shareCount) || undefined);
    if (nomWarn) toast({ title: hi ? 'नामांकन जाँचें' : 'Check nomination', description: nomWarn, duration: 10000 });
    Object.assign(form, { memberId });
    const photoToUpload = formPhoto;   // captured now — the form resets right after
    const created = addMember({
      ...form, memberId,
      shareCapital: Number(form.shareCapital) || 0, admissionFee: Number(form.admissionFee) || 0,
      caste: form.caste || undefined,
      occupation: form.occupation || undefined, postOffice: form.postOffice || undefined,
      tehsil: form.tehsil || undefined, district: form.district || undefined,
      state: form.state || undefined, pinCode: form.pinCode || undefined,
      paymentMode: form.paymentMode || undefined,
      nomineeName: form.nomineeName || undefined, nomineeFatherName: form.nomineeFatherName || undefined,
      nomineeRelation: form.nomineeRelation || undefined, nomineePhone: form.nomineePhone || undefined,
      nomineeAge: form.nomineeAge ? Number(form.nomineeAge) : undefined,
      nomineeOccupation: form.nomineeOccupation || undefined, nomineeAddress: form.nomineeAddress || undefined,
      nomineeShares: form.nomineeShares ? Number(form.nomineeShares) : undefined,
      nominees: buildCanonicalNominees(),
      aadhaar: form.aadhaar.replace(/\s/g, '') || undefined, pan: form.pan.toUpperCase().trim() || undefined,
      kycStatus: form.kycStatus || undefined,
      shareCount: form.shareCount ? Number(form.shareCount) : undefined,
      shareFaceValue: form.shareFaceValue ? Number(form.shareFaceValue) : undefined,
      // M2: recorded as an already-admitted member — the admission date and the committee resolution.
      admissionDate: form.joinDate || undefined,
      gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined,
      age: form.dateOfBirth ? ageOn(form.dateOfBirth, new Date().toISOString().split('T')[0]) : (form.age ? Number(form.age) : undefined),
      correspondenceAddress: form.correspondenceAddress.trim() || undefined,
      admissionResolutionNo: form.admissionResolutionNo.trim() || undefined,
      admissionResolutionDate: form.admissionResolutionDate || undefined,
    }, {
      // D5: "added" only once the cloud has the row (a failure rolls back and says so itself).
      onSaved: m => {
        toast({
          title: hi ? 'सदस्य जोड़ा गया' : 'Member added',
          description: `${m.name} (${m.memberId})${m.admissionResolutionNo ? '' : (hi ? ' — समिति प्रस्ताव संख्या नहीं भरी; edit करके भर सकते हैं।' : ' — no committee resolution number; you can add it by editing.')}`,
        });
        if (photoToUpload) void uploadMemberPhoto(m.id, photoToUpload);
      },
    });
    if (!created.id) return;   // refused (FY lock) — keep the form so nothing typed is lost
    trackEvent('member_added');
    setForm(EMPTY_FORM);
    setFormPhoto(null);
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    const cleanNominees = form.nominees.filter(n => n.name?.trim());
    const nv = validateNominees(cleanNominees);
    if (!nv.ok) { toast({ title: hi ? 'नामांकित त्रुटि' : 'Nominee error', description: nv.error, variant: 'destructive' }); return; }
    const kv = validateKyc(form.aadhaar, form.pan);
    if (!kv.ok) { toast({ title: 'KYC', description: kv.error, variant: 'destructive' }); return; }
    // M3: r.21 — every member nominates, and nominees may not outnumber the shares (warnings, never blocking).
    const nomCount = (form.nomineeName.trim() ? 1 : 0) + cleanNominees.length;
    const nomWarn = nomCount === 0
      ? (hi ? 'इस सदस्य का कोई नामांकित नहीं है — नियम 21: हर सदस्य नामांकन करेगा।' : 'This member has no nominee — Rule 21: every member shall nominate.')
      : nomineeCountWarning(nomCount, editMember.shareCount);
    if (nomWarn) toast({ title: hi ? 'नामांकन जाँचें' : 'Check nomination', description: nomWarn, duration: 10000 });
    // Only a CHANGED phone is checked — an old member's legacy number must not block an unrelated edit.
    if ((form.phone || '').trim() !== (editMember.phone || '').trim() && phoneError(form.phone)) { toast({ title: phoneError(form.phone)!, variant: 'destructive' }); return; }
    const applied = updateMember(editMember.id, {
      ...form,
      shareCapital: Number(form.shareCapital) || 0, admissionFee: Number(form.admissionFee) || 0,
      caste: form.caste || undefined,
      occupation: form.occupation || undefined, postOffice: form.postOffice || undefined,
      tehsil: form.tehsil || undefined, district: form.district || undefined,
      state: form.state || undefined, pinCode: form.pinCode || undefined,
      paymentMode: form.paymentMode || undefined,
      nomineeName: form.nomineeName || undefined, nomineeFatherName: form.nomineeFatherName || undefined,
      nomineeRelation: form.nomineeRelation || undefined, nomineePhone: form.nomineePhone || undefined,
      nomineeAge: form.nomineeAge ? Number(form.nomineeAge) : undefined,
      nomineeOccupation: form.nomineeOccupation || undefined, nomineeAddress: form.nomineeAddress || undefined,
      nomineeShares: form.nomineeShares ? Number(form.nomineeShares) : undefined,
      nominees: buildCanonicalNominees(),
      aadhaar: form.aadhaar.replace(/\s/g, '') || undefined, pan: form.pan.toUpperCase().trim() || undefined,
      kycStatus: form.kycStatus || undefined,
      shareCount: form.shareCount ? Number(form.shareCount) : undefined,
      shareFaceValue: form.shareFaceValue ? Number(form.shareFaceValue) : undefined,
      admissionDate: editMember.approvalStatus === 'pending' ? editMember.admissionDate : (form.joinDate || undefined),
      gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined,
      age: form.dateOfBirth ? ageOn(form.dateOfBirth, new Date().toISOString().split('T')[0]) : (form.age ? Number(form.age) : undefined),
      correspondenceAddress: form.correspondenceAddress.trim() || undefined,
      admissionResolutionNo: form.admissionResolutionNo.trim() || undefined,
      admissionResolutionDate: form.admissionResolutionDate || undefined,
    }, { onSaved: () => toast({ title: hi ? 'सदस्य अपडेट किया गया' : 'Member updated' }) });
    if (!applied) return;
    if (formPhoto) void uploadMemberPhoto(editMember.id, formPhoto);
    setFormPhoto(null);
    setEditMember(null);
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setFormPhoto(null);
    setEditPhotoUrl(null);
    if (m.photoPath) memberPhotoUrl(m.photoPath).then(setEditPhotoUrl);
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
      nominees: (m.nominees || []).filter(n => n.role !== 'primary'),   // additional-only in the editor; primary lives in the block above
      aadhaar: m.aadhaar || '', pan: m.pan || '', kycStatus: m.kycStatus || '',
      admissionResolutionNo: m.admissionResolutionNo || '', admissionResolutionDate: m.admissionResolutionDate || '',
      gender: m.gender || '', dateOfBirth: m.dateOfBirth || '',
      correspondenceAddress: m.correspondenceAddress || '',
    });
  };

  // ECR-16: open / save share-certificate dialog
  const openCert = (m: Member) => {
    setCertMember(m);
    setCertForm({
      certNo: m.shareCertNo || '',
      count: m.shareCount ? String(m.shareCount) : '',
      faceValue: m.shareFaceValue ? String(m.shareFaceValue) : '',
      status: m.shareCertStatus || 'issued',
      reason: '',
    });
  };
  const handleSaveCertificate = () => {
    if (!certMember) return;
    const v = validateCertificate({ status: certForm.status, certNo: certForm.certNo, count: Number(certForm.count), reason: certForm.reason });
    if (!v.ok) { toast({ title: hi ? 'प्रमाणपत्र त्रुटि' : 'Certificate error', description: v.error, variant: 'destructive' }); return; }
    // M3: a certificate number belongs to one member only.
    const taken = certificateNoTakenBy(allMembers, certForm.certNo, certMember.id);
    if (taken) { toast({ title: hi ? 'प्रमाणपत्र संख्या पहले से है' : 'Certificate number in use', description: hi ? `यह संख्या ${taken.name} (${taken.memberId}) को दी जा चुकी है।` : `Already issued to ${taken.name} (${taken.memberId}).`, variant: 'destructive' }); return; }
    const name = certMember.name;
    const applied = updateMember(certMember.id, {
      shareCertNo: certForm.certNo.trim() || undefined,
      shareCount: certForm.count ? Number(certForm.count) : undefined,
      shareFaceValue: certForm.faceValue ? Number(certForm.faceValue) : undefined,
      shareCertStatus: certForm.status,
      shareCertIssuedAt: new Date().toISOString().split('T')[0],
      shareCertReason: certForm.reason.trim() || undefined,
    }, { onSaved: () => toast({ title: hi ? 'शेयर प्रमाणपत्र अपडेट' : 'Share certificate updated', description: name }) });
    if (!applied) return;
    setCertMember(null);
  };

  // U9: approve / reject go through a confirmation; the success message comes from DataContext once saved (D5).
  const openDecision = (member: Member, action: 'approve' | 'reject') => {
    setDecisionForm({ admissionDate: today, resolutionNo: '', resolutionDate: '', reason: '' });
    setDeclared({ notInsolvent: false, notConvicted: false, noOtherCreditSociety: false });
    setDecision({ member, action });
  };
  const handleApprove = (member: Member) => openDecision(member, 'approve');
  const handleReject = (member: Member) => openDecision(member, 'reject');
  // M2: approve records the admission date + committee resolution (r.22(b)); reject needs the reason (r.17).
  const confirmDecision = () => {
    if (!decision) return;
    if (decision.action === 'approve') {
      const v = validateAdmission({ admissionDate: decisionForm.admissionDate, resolutionNo: decisionForm.resolutionNo, resolutionDate: decisionForm.resolutionDate || undefined },
        { receivedOn: applicationReceivedOn(decision.member), today });
      if (!v.ok) { toast({ title: hi ? 'जाँचें' : 'Check', description: v.error, variant: 'destructive' }); return; }
      approveMember(decision.member.id, { admissionDate: decisionForm.admissionDate, resolutionNo: decisionForm.resolutionNo, resolutionDate: decisionForm.resolutionDate || undefined, eligibility: declared });
    } else {
      const v = validateRejection(decisionForm.reason);
      if (!v.ok) { toast({ title: hi ? 'कारण ज़रूरी है' : 'Reason required', description: v.error, variant: 'destructive' }); return; }
      rejectMember(decision.member.id, decisionForm.reason);
    }
    setDecision(null);
  };
  const missingResolution = decision?.action === 'approve' && !decisionForm.resolutionNo.trim();
  // M4: lifecycle change — a real date, warnings for a missing resolution (never blocking)
  const statusChangeCheck = statusMember
    ? validateStatusChange({ to: statusNew, effectiveDate: statusDate, resolutionNo: statusResNo, resolutionDate: statusResDate || undefined },
      { today, joinedOn: statusMember.admissionDate || statusMember.joinDate })
    : { ok: true, warnings: [] as string[] };
  // M4: s.23 / s.55 — a deceased member's share money, after their loan + KCC dues, goes to the nominee
  const memberDues = (m: Member) => loans.filter(l => l.memberId === m.id && !l.isDeleted).reduce((s, l) => s + loanOutstanding(l), 0)
    + kccLoans.filter(k => k.memberId === m.id).reduce((s, k) => s + kccOutstanding(k), 0);
  const settlement = settleMember ? deathSettlement({ shareCapital: settleMember.shareCapital || 0, dues: memberDues(settleMember), dateOfDeath: settleMember.statusChangedAt }) : null;
  const nomineeNames = (m: Member) => {
    const list = (m.nominees || []).filter(n => n.name?.trim()).map(n => `${n.name}${n.relation ? ` (${n.relation})` : ''}${n.sharePercent ? ` ${n.sharePercent}%` : ''}`);
    if (!list.length && m.nomineeName) list.push(`${m.nomineeName}${m.nomineeRelation ? ` (${m.nomineeRelation})` : ''}`);
    return list;
  };
  const openSettle = (m: Member) => { setSettleForm({ date: today, resolution: '', amount: String(deathSettlement({ shareCapital: m.shareCapital || 0, dues: memberDues(m) }).shareCapital) }); setSettleMember(m); };
  const confirmSettle = () => {
    if (!settleMember) return;
    const amount = Number(settleForm.amount) || 0;
    const who = nomineeNames(settleMember).join(', ') || (hi ? 'वारिस' : 'heir');
    if (approveShareRefund(settleMember.id, amount, settleForm.date, `${settleForm.resolution.trim()} — मृत्यु निपटारा, नामांकित: ${who}`)) setSettleMember(null);
  };

  const handleDownloadPDF = (member: Member) => {
    generateMemberApplicationPDF(member, society);
  };

  // M2: the r.17 (one month) / s.16 (PACS, 60 days) clock on a pending application — law references only for Haryana.
  const haryana = isHaryana(society.state);
  const clockBadge = (m: Member) => {
    const c = admissionClock(applicationReceivedOn(m), today, { societyType: society.societyType });
    if (!c) return null;
    if (c.deemed) return <Badge variant="destructive" className="text-[10px]">{hi ? `${c.days} दिन — ${haryana ? 'धारा 16: स्वतः सदस्य माना जाएगा' : '60 दिन पूरे'}` : `${c.days} days — ${haryana ? 's.16: deemed admitted' : '60 days passed'}`}</Badge>;
    if (c.overdue) return <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px]" variant="outline">{hi ? `${c.days} दिन — 1 माह पार${haryana ? ' (नियम 17)' : ''}` : `${c.days} days — over one month${haryana ? ' (r.17)' : ''}`}</Badge>;
    return <span className="text-[11px] text-muted-foreground">{hi ? `${c.days} दिन · फ़ैसला ${fmtDate(c.decideBy)} तक` : `${c.days} days · decide by ${fmtDate(c.decideBy)}`}</span>;
  };

  const renderMemberTable = (memberList: Member[], showApprovalActions: boolean, rejectedList = false) => {
    const filtered = filterBySearch(memberList);
    if (filtered.length === 0) {
      if (allMembers.length === 0) {
        return (
          <EmptyState
            icon={Users}
            title={language === 'hi' ? 'अभी कोई सदस्य नहीं' : 'No members yet'}
            description={language === 'hi' ? 'समिति के सदस्य यहाँ दिखेंगे। पहला सदस्य जोड़कर शुरू करें।' : 'Your society members appear here. Add the first one to begin.'}
            actionLabel={language === 'hi' ? 'नया सदस्य जोड़ें' : 'Add first member'}
            onAction={() => { setForm({ ...EMPTY_FORM, memberId: getNextMemberId() }); setIsAddOpen(true); }}
          />
        );
      }
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
              {showApprovalActions && <TableHead className="font-semibold">{rejectedList ? (hi ? 'अस्वीकृति का कारण' : 'Reason') : (hi ? 'आवेदन तिथि' : 'Applied on')}</TableHead>}
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
                      {portalLogins[member.id]?.is_active && (
                        <Badge variant="outline" className="mt-0.5 h-5 px-1.5 text-[10px] border-green-600 text-green-700">{hi ? 'Portal ✓' : 'Portal ✓'}</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3 text-muted-foreground" />{member.phone}</div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={member.memberType && member.memberType !== 'member' ? 'border-amber-500 text-amber-600' : 'border-primary text-primary'}>
                    {memberTypeLabel(member.memberType, hi)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(member.shareCapital)}</TableCell>
                <TableCell className="text-right">{fmt(member.admissionFee || 0)}</TableCell>
                {showApprovalActions && (
                  <TableCell>
                    {rejectedList ? (
                      <div className="max-w-[16rem]">
                        <p className="text-xs">{member.rejectionReason || <span className="text-muted-foreground">{hi ? '— (पुराना रिकॉर्ड)' : '— (older record)'}</span>}</p>
                        {member.decidedAt && <p className="text-[11px] text-muted-foreground">{fmtDate(member.decidedAt)}</p>}
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs">{applicationReceivedOn(member) ? fmtDate(applicationReceivedOn(member)) : '—'}</p>
                        {clockBadge(member)}
                      </div>
                    )}
                  </TableCell>
                )}
                {!showApprovalActions && (
                  <TableCell className="text-center">
                    <Badge variant="outline" className={STATUS_META[member.status]?.cls}>
                      {hi ? STATUS_META[member.status]?.hi : STATUS_META[member.status]?.en}
                    </Badge>
                    {isExit(member.status) && member.statusChangedAt && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground" title={hi ? 'धारा 24: पूर्व/मृत सदस्य की देनदारी 2 साल' : 's.24: two-year liability of a past member'}>
                        {fmtDate(member.statusChangedAt)}{liabilityUntil(member.statusChangedAt) && today <= liabilityUntil(member.statusChangedAt)! ? (hi ? ` · देनदारी ${fmtDate(liabilityUntil(member.statusChangedAt))} तक` : ` · liable till ${fmtDate(liabilityUntil(member.statusChangedAt))}`) : ''}
                      </p>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {showApprovalActions && canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApprove(member)} title={hi ? 'स्वीकृत' : 'Approve'}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        {!rejectedList && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(member)} title={hi ? 'अस्वीकृत' : 'Reject'}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {rejectedList && member.rejectionReason && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-700 hover:bg-red-50" onClick={() => generateMemberRefusalLetterPDF(member, society)} title={hi ? 'अस्वीकृति पत्र (PDF)' : 'Refusal letter (PDF)'}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleDownloadPDF(member)} title="PDF">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMember(member)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!showApprovalActions && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                        title={hi ? 'सदस्य 360° — पूरा हिसाब एक जगह' : 'Member 360° — whole account'}
                        onClick={() => navigate(`/members/${member.id}`)}>
                        <ContactRound className="h-4 w-4" />
                      </Button>
                    )}
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
                    {canEdit && !showApprovalActions && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        title={hi ? 'स्थिति बदलें (त्यागपत्र/निष्कासन/मृत्यु)' : 'Change status (resign/expel/death)'}
                        onClick={() => { setStatusMember(member); setStatusNew(member.status === 'active' ? 'resigned' : 'active'); setStatusReason(''); setStatusDate(new Date().toISOString().split('T')[0]); setStatusResNo(''); setStatusResDate(''); }}>
                        <UserCog className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && !showApprovalActions && member.status === 'deceased' && (member.shareCapital || 0) > 0 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-700 hover:bg-slate-100"
                        title={hi ? 'मृत्यु निपटारा — शेयर राशि नामांकित को' : 'Death settlement — share money to the nominee'}
                        onClick={() => openSettle(member)}>
                        <HandCoins className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && !showApprovalActions && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        title={hi ? 'शेयर प्रमाणपत्र (जारी/पुनः/रद्द)' : 'Share certificate (issue/reissue/cancel)'}
                        onClick={() => openCert(member)}>
                        <Award className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && !showApprovalActions && !['resigned', 'expelled', 'deceased'].includes(member.status) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        title={hi ? 'सदस्य portal login' : 'Member portal login'}
                        onClick={() => setPortalMember(member)}>
                        <KeyRound className="h-4 w-4" />
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
          {/* U1 (M2): ONE entry — a new person applies (committee decides); an already-admitted member is recorded. */}
          {canEdit && (
            <Button className="gap-2" onClick={() => setAddChooserOpen(true)}><Plus className="h-4 w-4" />{hi ? 'नया सदस्य' : 'New Member'}</Button>
          )}
          <Dialog open={addChooserOpen} onOpenChange={setAddChooserOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{hi ? 'नया सदस्य — क्या करना है?' : 'New member — what would you like to do?'}</DialogTitle>
                <DialogDescription>{hi ? 'नए व्यक्ति का आवेदन समिति की मंज़ूरी के लिए जाता है। जिसे समिति पहले ही स्वीकृत कर चुकी है, उसे सीधे दर्ज करें।' : 'A new person applies and the committee decides. A member the committee already admitted is recorded directly.'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left whitespace-normal" onClick={() => { setAddChooserOpen(false); navigate('/member-application'); }}>
                  <ClipboardList className="h-5 w-5 shrink-0 text-amber-600" />
                  <span><span className="block font-semibold">{hi ? 'नया आवेदन' : 'New application'}</span><span className="block text-xs text-muted-foreground">{hi ? 'आवेदन "पेंडिंग" में जाएगा; समिति के फ़ैसले के बाद स्वीकृत/अस्वीकृत करें।' : 'Goes to Pending; approve or reject after the committee decides.'}</span></span>
                </Button>
                <Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left whitespace-normal" onClick={() => { setAddChooserOpen(false); setForm({ ...EMPTY_FORM, memberId: getNextMemberId() }); setFormPhoto(null); setIsAddOpen(true); }}>
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                  <span><span className="block font-semibold">{hi ? 'स्वीकृत / पुराना सदस्य दर्ज करें' : 'Record an admitted / existing member'}</span><span className="block text-xs text-muted-foreground">{hi ? 'जिसे समिति स्वीकृत कर चुकी है — दाख़िला तिथि और प्रस्ताव संख्या भरें।' : 'Already admitted by the committee — enter the admission date and resolution.'}</span></span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddOpen} onOpenChange={(o) => { if (!o) { setIsAddOpen(false); setForm(EMPTY_FORM); } else setIsAddOpen(true); }}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{hi ? 'स्वीकृत / पुराना सदस्य दर्ज करें' : 'Record an admitted member'}</DialogTitle>
                <DialogDescription>{hi ? 'जिस सदस्य को समिति स्वीकृत कर चुकी है। नए व्यक्ति के लिए "नया आवेदन" चुनें।' : 'A member the committee has already admitted. For a new person, choose "New application".'}</DialogDescription>
              </DialogHeader>
              <MemberForm form={form} setForm={setForm} language={language} t={t} onSubmit={handleAdd} submitLabel={t('save')} onCancel={() => { setIsAddOpen(false); setForm(EMPTY_FORM); setFormPhoto(null); }}
                photoFile={formPhoto} onPhoto={setFormPhoto} onPhotoError={photoError} />
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-md sm:w-auto sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={hi ? 'नाम, ID या फोन से खोजें...' : 'Search by name, ID or phone...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { if (v) setStatusFilter(v as 'all' | MemberStatus); }}>
              <SelectTrigger className="h-9 w-36" aria-label={hi ? 'स्थिति' : 'Status'}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{hi ? 'सभी स्थिति' : 'All statuses'}</SelectItem>
                {(Object.keys(STATUS_META) as MemberStatus[]).map(st => <SelectItem key={st} value={st}>{hi ? STATUS_META[st].hi : STATUS_META[st].en}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={v => { if (v) setTypeFilter(v as 'all' | MemberType); }}>
              <SelectTrigger className="h-9 w-36" aria-label={hi ? 'प्रकार' : 'Type'}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{hi ? 'सभी प्रकार' : 'All types'}</SelectItem>
                <SelectItem value="member">{hi ? 'सदस्य' : 'Member'}</SelectItem>
                <SelectItem value="nominal">{hi ? 'नाममात्र सदस्य' : 'Nominal'}</SelectItem>
                <SelectItem value="associate">{hi ? 'सहयोगी सदस्य' : 'Associate'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1" onClick={exportMembersExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
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
                {renderMemberTable(rejectedMembers, true, true)}
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
          <MemberForm form={form} setForm={setForm} language={language} t={t} onSubmit={handleEdit} submitLabel={hi ? 'अपडेट करें' : 'Update'} onCancel={() => { setEditMember(null); setFormPhoto(null); }} isEdit
            photoFile={formPhoto} onPhoto={setFormPhoto} existingPhotoUrl={editPhotoUrl} onPhotoError={photoError} />
        </DialogContent>
      </Dialog>

      {/* ECR-16: Lifecycle status-change Dialog */}
      <Dialog open={!!statusMember} onOpenChange={(o) => { if (!o) setStatusMember(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'सदस्य स्थिति बदलें' : 'Change Member Status'}</DialogTitle>
          </DialogHeader>
          {statusMember && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {statusMember.name} — {hi ? 'वर्तमान' : 'current'}:{' '}
                <strong>{hi ? STATUS_META[statusMember.status]?.hi : STATUS_META[statusMember.status]?.en}</strong>
              </p>
              <div>
                <Label className="text-sm">{hi ? 'नई स्थिति' : 'New status'}</Label>
                <Select value={statusNew} onValueChange={(v) => setStatusNew(v as MemberStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as MemberStatus[]).map(s => (
                      <SelectItem key={s} value={s} disabled={s === statusMember.status}>
                        {hi ? STATUS_META[s].hi : STATUS_META[s].en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">{hi ? 'कारण *' : 'Reason *'}</Label>
                <Textarea className="mt-1" rows={2} value={statusReason} onChange={e => setStatusReason(e.target.value)}
                  placeholder={hi ? 'कारण लिखें (त्यागपत्र/निष्कासन/मृत्यु आदि)...' : 'Enter reason...'} />
              </div>
              <div>
                <Label className="text-sm">{statusNew === 'deceased' ? (hi ? 'मृत्यु की तिथि *' : 'Date of death *') : (hi ? 'किस तिथि से *' : 'Effective date *')}</Label>
                <Input className="mt-1" type="date" value={statusDate} max={new Date().toISOString().split('T')[0]} onChange={e => setStatusDate(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-0.5">{hi ? 'जिस दिन सच में हुआ — रजिस्टर में यही "सदस्यता समाप्ति तिथि" छपेगी (नियम 22)।' : 'The day it actually happened — the register prints this (Rule 22).'}</p>
              </div>
              {(statusNew === 'resigned' || statusNew === 'expelled') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{statusNew === 'expelled' ? (hi ? 'आम सभा प्रस्ताव सं.' : 'GM resolution no.') : (hi ? 'संचालक मंडल प्रस्ताव सं.' : 'Board resolution no.')}</Label>
                    <Input className="mt-1" value={statusResNo} onChange={e => setStatusResNo(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{hi ? 'प्रस्ताव तिथि' : 'Resolution date'}</Label>
                    <Input className="mt-1" type="date" value={statusResDate} max={new Date().toISOString().split('T')[0]} onChange={e => setStatusResDate(e.target.value)} />
                  </div>
                </div>
              )}
              {statusChangeCheck.warnings.map(w => <p key={w} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">⚠ {w}</p>)}
              {isExit(statusNew) && (
                <p className="text-[11px] text-muted-foreground">{hi ? `धारा 24: पूर्व/मृत सदस्य की देनदारी ${liabilityUntil(statusDate) ? fmtDate(liabilityUntil(statusDate)) : '2 साल'} तक बनी रहती है।` : `s.24: a past / deceased member stays liable until ${liabilityUntil(statusDate) ? fmtDate(liabilityUntil(statusDate)) : 'two years'}.`}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusMember(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button
              disabled={!statusReason.trim() || !statusMember || statusNew === statusMember.status}
              onClick={() => {
                if (!statusMember) return;
                if (!statusChangeCheck.ok) { toast({ title: hi ? 'जाँचें' : 'Check', description: statusChangeCheck.error, variant: 'destructive' }); return; }
                if (changeMemberStatus(statusMember.id, statusNew, statusReason.trim(), { effectiveDate: statusDate, resolutionNo: statusResNo, resolutionDate: statusResDate || undefined })) setStatusMember(null);
              }}>
              {hi ? 'बदलें' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* M4: death settlement (s.23 nominee, s.55 set-off) */}
      <Dialog open={!!settleMember} onOpenChange={(o) => { if (!o) setSettleMember(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'मृत्यु निपटारा — शेयर राशि' : 'Death settlement — share money'}</DialogTitle>
            <DialogDescription>{settleMember?.name} ({settleMember?.memberId}){settleMember?.statusChangedAt ? ` · ${hi ? 'मृत्यु' : 'died'} ${fmtDate(settleMember.statusChangedAt)}` : ''}</DialogDescription>
          </DialogHeader>
          {settleMember && settlement && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">{hi ? 'नामांकित' : 'Nominee(s)'}</p>
                <p className="font-medium">{nomineeNames(settleMember).join(', ') || (hi ? 'कोई नामांकित नहीं — वारिस/कानूनी प्रतिनिधि (धारा 23)' : 'No nominee — heir / legal representative (s.23)')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted p-2"><p className="text-[11px] text-muted-foreground">{hi ? 'शेयर राशि' : 'Share money'}</p><p className="font-semibold">{fmt(settlement.shareCapital)}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-[11px] text-muted-foreground">{hi ? 'ऋण/KCC बक़ाया' : 'Loan/KCC dues'}</p><p className="font-semibold">{fmt(settlement.dues)}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-[11px] text-muted-foreground">{hi ? 'नामांकित को' : 'To nominee'}</p><p className="font-semibold">{fmt(settlement.payableToNominee)}</p></div>
              </div>
              {settlement.setOff > 0 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">⚠ {hi ? `धारा 55: बक़ाया ${fmt(settlement.setOff)} शेयर राशि से काटा जा सकता है। स्वीकृति के बाद "देय" राशि में से पहले ऋण/KCC में ${fmt(settlement.setOff)} की वसूली दर्ज करें, फिर शेष ${fmt(settlement.payableToNominee)} नामांकित को दें।` : `s.55: dues of ${fmt(settlement.setOff)} may be set off. After approval, record that recovery from the payable first, then pay the balance ${fmt(settlement.payableToNominee)} to the nominee.`}</p>
              )}
              {settlement.courtOrderWindowUntil && (
                <p className="text-[11px] text-muted-foreground">{hi ? `धारा 23: अन्य राशियाँ ${fmtDate(settlement.courtOrderWindowUntil)} तक अदालती आदेश न आने पर दी जाती हैं।` : `s.23: other moneys are paid unless a court order arrives by ${fmtDate(settlement.courtOrderWindowUntil)}.`}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{hi ? 'राशि (शेयर पूँजी से देय में)' : 'Amount (to the payable)'}</Label>
                  <Input type="number" className="mt-1" value={settleForm.amount} max={settlement.shareCapital} onChange={e => setSettleForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'तिथि' : 'Date'}</Label>
                  <Input type="date" className="mt-1" value={settleForm.date} max={today} onChange={e => setSettleForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{hi ? 'समिति प्रस्ताव संख्या / संदर्भ *' : 'Committee resolution / reference *'}</Label>
                <Input className="mt-1" value={settleForm.resolution} onChange={e => setSettleForm(f => ({ ...f, resolution: e.target.value }))} />
              </div>
              <p className="text-[11px] text-muted-foreground">{hi ? 'Dr शेयर पूँजी / Cr शेयर वापसी देय। भुगतान बाद में शेयर रजिस्टर के "देय भुगतान" से।' : 'Posts Dr Share Capital / Cr Share Refund Payable; pay later from the Share Register ("Pay refund").'}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleMember(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button disabled={!settlement || !(Number(settleForm.amount) > 0) || Number(settleForm.amount) > (settlement?.shareCapital || 0) || settleForm.resolution.trim().length < 2} onClick={confirmSettle}>
              {hi ? 'स्वीकृत करें' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ECR-16: Share Certificate Dialog */}
      <Dialog open={!!certMember} onOpenChange={(o) => { if (!o) setCertMember(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'शेयर प्रमाणपत्र' : 'Share Certificate'}</DialogTitle>
          </DialogHeader>
          {certMember && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{certMember.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{hi ? 'प्रमाणपत्र सं.' : 'Certificate No.'}</Label>
                  <Input className="mt-1" value={certForm.certNo} onChange={e => setCertForm(p => ({ ...p, certNo: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'स्थिति' : 'Status'}</Label>
                  <Select value={certForm.status} onValueChange={v => setCertForm(p => ({ ...p, status: v as ShareCertStatus }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="issued">{hi ? 'जारी' : 'Issued'}</SelectItem>
                      <SelectItem value="reissued">{hi ? 'पुनः जारी' : 'Reissued'}</SelectItem>
                      <SelectItem value="cancelled">{hi ? 'रद्द' : 'Cancelled'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'शेयर संख्या' : 'Share count'}</Label>
                  <Input className="mt-1" type="number" min="0" value={certForm.count} onChange={e => setCertForm(p => ({ ...p, count: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{hi ? 'अंकित मूल्य (₹)' : 'Face value (₹)'}</Label>
                  <Input className="mt-1" type="number" min="0" value={certForm.faceValue} onChange={e => setCertForm(p => ({ ...p, faceValue: e.target.value }))} />
                </div>
              </div>
              {(certForm.status === 'reissued' || certForm.status === 'cancelled') && (
                <div>
                  <Label className="text-xs">{hi ? 'कारण *' : 'Reason *'}</Label>
                  <Textarea className="mt-1" rows={2} value={certForm.reason} onChange={e => setCertForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder={hi ? 'पुनः जारी / रद्द का कारण...' : 'Reason for reissue / cancel...'} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {certMember?.shareCertNo && certMember.shareCertStatus !== 'cancelled' && (
              <Button variant="outline" className="gap-1 sm:mr-auto" onClick={() => generateShareCertificatePDF(certMember, society)} title={hi ? 'सेव हुआ प्रमाणपत्र छापें' : 'Print the saved certificate'}>
                <Download className="h-4 w-4" />{hi ? 'प्रमाणपत्र PDF' : 'Certificate PDF'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setCertMember(null)}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={handleSaveCertificate}>{hi ? 'सहेजें' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewMember} onOpenChange={(o) => { if (!o) setViewMember(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{hi ? 'सदस्य विवरण' : 'Member Details'}</DialogTitle>
          </DialogHeader>
          {viewMember && (
            <div className="space-y-3 text-sm overflow-y-auto flex-1 pr-2">
              <div className="mb-4 flex flex-col items-center gap-2">
                {photoUrl
                  ? <img src={photoUrl} alt={viewMember.name} className="h-24 w-24 rounded-md border object-cover" />
                  : <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/10 text-primary text-xl">{getInitials(viewMember.name)}</AvatarFallback></Avatar>}
                {canEdit && (
                  <div className="flex gap-2">
                    <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onPhotoPicked(e.target.files?.[0])} />
                    <Button size="sm" variant="outline" disabled={photoBusy} onClick={() => photoInput.current?.click()}>
                      {photoBusy ? (hi ? 'सेव हो रही है…' : 'Saving…') : viewPhotoPath ? (hi ? 'फ़ोटो बदलें' : 'Change photo') : (hi ? 'फ़ोटो जोड़ें' : 'Add photo')}
                    </Button>
                    {viewPhotoPath && <Button size="sm" variant="ghost" disabled={photoBusy} onClick={() => removeMemberPhoto(viewMember.id)}>{hi ? 'हटाएँ' : 'Remove'}</Button>}
                  </div>
                )}
                {!viewPhotoPath && <p className="text-[11px] text-muted-foreground">{hi ? 'धारा 40: प्राथमिक समिति के हर सदस्य की फ़ोटो रखनी होती है।' : 's.40: a photograph of every member of a primary society.'}</p>}
              </div>
              {[
                [t('memberId'), viewMember.memberId],
                [t('memberName'), viewMember.name],
                [hi ? 'पिता/पति' : 'Father/Husband', viewMember.fatherName],
                [t('phone'), viewMember.phone],
                [hi ? 'स्थायी पता' : 'Permanent Address', viewMember.address],
                ...(viewMember.correspondenceAddress ? [[hi ? 'पत्राचार का पता' : 'Correspondence Address', viewMember.correspondenceAddress]] : []),
                [hi ? 'सदस्यता प्रकार' : 'Member Type', memberTypeLabel(viewMember.memberType, hi)],
                [t('shareCapital'), fmt(viewMember.shareCapital)],
                [hi ? 'प्रवेश शुल्क' : 'Admission Fee', fmt(viewMember.admissionFee || 0)],
                [hi ? 'दाख़िला तिथि' : 'Admission Date', fmtDate(viewMember.admissionDate || viewMember.joinDate)],
                ...(viewMember.applicationDate ? [[hi ? 'आवेदन तिथि' : 'Applied On', fmtDate(viewMember.applicationDate)]] : []),
                ...(viewMember.admissionResolutionNo ? [[hi ? 'समिति प्रस्ताव' : 'Committee Resolution', `${viewMember.admissionResolutionNo}${viewMember.admissionResolutionDate ? ` · ${fmtDate(viewMember.admissionResolutionDate)}` : ''}`]] : []),
                ...(viewMember.rejectionReason ? [[hi ? 'अस्वीकृति का कारण' : 'Reason for Refusal', viewMember.rejectionReason]] : []),
                [hi ? 'स्थिति' : 'Status', memberStatusLabel(viewMember.status, hi)],
                ...(viewMember.approvalStatus ? [[hi ? 'अनुमोदन' : 'Approval', viewMember.approvalStatus === 'pending' ? (hi ? 'पेंडिंग' : 'Pending') : viewMember.approvalStatus === 'approved' ? (hi ? 'स्वीकृत' : 'Approved') : (hi ? 'अस्वीकृत' : 'Rejected')]] : []),
                ...(viewMember.age ? [[hi ? 'आयु' : 'Age', `${viewMember.age} ${hi ? 'वर्ष' : 'years'}`]] : []),
                ...(viewMember.occupation ? [[hi ? 'व्यवसाय' : 'Occupation', viewMember.occupation]] : []),
                ...(viewMember.caste ? [[hi ? 'जाति वर्ग' : 'Caste', viewMember.caste]] : []),
                ...(viewMember.postOffice ? [[hi ? 'डाकघर' : 'Post Office', viewMember.postOffice]] : []),
                ...(viewMember.tehsil ? [[hi ? 'तहसील' : 'Tehsil', viewMember.tehsil]] : []),
                ...(viewMember.district ? [[hi ? 'जिला' : 'District', viewMember.district]] : []),
                ...(viewMember.state ? [[hi ? 'राज्य' : 'State', viewMember.state]] : []),
                ...(viewMember.pinCode ? [[hi ? 'पिन कोड' : 'Pin Code', viewMember.pinCode]] : []),
                ...(viewMember.paymentMode ? [[hi ? 'भुगतान माध्यम' : 'Payment Mode', viewMember.paymentMode]] : []),
                ...(viewMember.shareCount ? [[hi ? 'शेयर संख्या' : 'Shares', String(viewMember.shareCount)]] : []),
                ...(viewMember.nomineeName ? [[hi ? 'नामांकित' : 'Nominee', viewMember.nomineeName]] : []),
                ...(viewMember.nomineeRelation ? [[hi ? 'सम्बन्ध' : 'Relation', viewMember.nomineeRelation]] : []),
                ...(viewMember.nomineePhone ? [[hi ? 'नामांकित फ़ोन' : 'Nominee Phone', viewMember.nomineePhone]] : []),
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
                      {hi ? 'सदस्य लेजर' : 'Member Share Ledger'}
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

      {/* Member Portal S2b */}
      <MemberPortalDialog
        member={portalMember}
        login={portalMember ? portalLogins[portalMember.id] : undefined}
        societyName={(hi ? (society.nameHi || society.name) : society.name) || society.name || ''}
        planAllowed={portalAllowed}
        hi={hi}
        onClose={() => setPortalMember(null)}
        onChanged={loadPortalLogins}
      />

      {/* U9: approve / reject confirmation */}
      <AlertDialog open={!!decision} onOpenChange={o => { if (!o) setDecision(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision?.action === 'approve'
                ? (hi ? 'आवेदन स्वीकृत करें?' : 'Approve this application?')
                : (hi ? 'आवेदन अस्वीकृत करें?' : 'Reject this application?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision && (decision.action === 'approve'
                ? (hi
                  ? `${decision.member.name} (${decision.member.memberId}) सत्यापित सदस्य बनेंगे। शेयर पूँजी ₹${(decision.member.shareCapital || 0).toLocaleString('en-IN')} व प्रवेश शुल्क ₹${(decision.member.admissionFee || 0).toLocaleString('en-IN')} की रसीद वाउचर अपने-आप बनेगा।`
                  : `${decision.member.name} (${decision.member.memberId}) becomes a verified member. A receipt voucher for share capital ₹${(decision.member.shareCapital || 0).toLocaleString('en-IN')} and admission fee ₹${(decision.member.admissionFee || 0).toLocaleString('en-IN')} is posted.`)
                : (hi
                  ? `${decision.member.name} (${decision.member.memberId}) का आवेदन अस्वीकृत होगा। कोई वाउचर नहीं बनेगा।`
                  : `${decision.member.name} (${decision.member.memberId})'s application is rejected. No voucher is posted.`))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decision?.action === 'approve' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'दाख़िला तिथि *' : 'Admission date *'}</Label>
                <Input type="date" value={decisionForm.admissionDate} max={today} onChange={e => setDecisionForm(d => ({ ...d, admissionDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'समिति प्रस्ताव संख्या' : 'Resolution no.'}</Label>
                <Input value={decisionForm.resolutionNo} onChange={e => setDecisionForm(d => ({ ...d, resolutionNo: e.target.value }))} placeholder={hi ? 'जैसे 12/2025' : 'e.g. 12/2025'} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{hi ? 'प्रस्ताव तिथि' : 'Resolution date'}</Label>
                <Input type="date" value={decisionForm.resolutionDate} max={today} onChange={e => setDecisionForm(d => ({ ...d, resolutionDate: e.target.value }))} />
              </div>
              <div className="sm:col-span-3 space-y-1 rounded-md border p-2">
                <p className="text-xs font-medium">{hi ? 'पात्रता की पुष्टि (नियम 14 / 15)' : 'Eligibility (Rules 14 / 15)'}</p>
                {([
                  ['notInsolvent', hi ? 'आवेदक दिवालिया नहीं है, न दिवालिया घोषित होने का आवेदन किया है' : 'Not an insolvent, no insolvency application'],
                  ['notConvicted', hi ? 'पिछले 5 साल में नैतिक अधमता के अपराध में सज़ा नहीं हुई' : 'No conviction (moral turpitude) in the last 5 years'],
                  ['noOtherCreditSociety', hi ? 'किसी दूसरी प्राथमिक credit समिति का सदस्य नहीं (या रजिस्ट्रार की अनुमति है)' : 'Not a member of another primary credit society (or Registrar permitted)'],
                ] as const).map(([k, label]) => (
                  <label key={k} className="flex items-start gap-2 text-xs">
                    <input type="checkbox" className="mt-0.5" checked={declared[k]} onChange={e => setDeclared(d => ({ ...d, [k]: e.target.checked }))} />
                    <span>{label}</span>
                  </label>
                ))}
                {!(declared.notInsolvent && declared.notConvicted && declared.noOtherCreditSociety) && (
                  <p className="text-[11px] text-amber-700">{hi ? 'सब पुष्ट न हों तो भी स्वीकृत कर सकते हैं — जो पुष्ट हुआ वह audit में दर्ज होगा।' : 'You can approve anyway — what was confirmed is recorded in the audit.'}</p>
                )}
              </div>
              {missingResolution && (
                <p className="sm:col-span-3 text-xs text-amber-700">{hi ? 'प्रस्ताव संख्या खाली है — फिर भी स्वीकृत कर सकते हैं, पर रजिस्टर व ऑडिट के लिए भरना अच्छा रहेगा।' : 'No resolution number — you can still approve, but the register and the audit need it.'}</p>
              )}
            </div>
          )}
          {decision?.action === 'reject' && (
            <div className="space-y-1">
              <Label className="text-xs">{hi ? 'अस्वीकृति का कारण * (आवेदक को पत्र में जाएगा)' : 'Reason for refusal * (goes to the applicant)'}</Label>
              <Textarea rows={3} value={decisionForm.reason} onChange={e => setDecisionForm(d => ({ ...d, reason: e.target.value }))}
                placeholder={hi ? 'जैसे: समिति के कार्य-क्षेत्र से बाहर निवास' : 'e.g. resides outside the area of operation'} />
              <p className="text-[11px] text-muted-foreground">{hi ? 'नियम 17: अस्वीकृति कारण सहित आवेदक को बतानी होती है। "अस्वीकृत" टैब से पत्र (PDF) निकालें।' : 'Rule 17: the refusal goes to the applicant with reasons. Print the letter from the Rejected tab.'}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'वापस' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDecision} className={decision?.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : undefined}>
              {decision?.action === 'approve' ? (hi ? 'हाँ, स्वीकृत करें' : 'Yes, approve') : (hi ? 'हाँ, अस्वीकृत करें' : 'Yes, reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Guard */}
      <LinkedDeleteDialog
        open={deleteGuard.open}
        onOpenChange={o => setDeleteGuard(g => ({ ...g, open: o }))}
        entityName={deleteGuard.name}
        links={deleteGuard.links}
        language={language as 'hi' | 'en'}
        blockOnLinks
        softDelete
        onConfirmDelete={() => {
          // The success toast comes from DataContext once the cloud delete has landed (D5).
          if (deleteGuard.id) deleteMember(deleteGuard.id);
        }}
      />
    </div>
  );
};

export default Members;
