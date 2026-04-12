import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateMemberApplicationPDF } from '@/lib/pdf';
import { FileText, ArrowLeft } from 'lucide-react';
import type { MemberType, CasteCategory } from '@/types';

const CASTE_OPTIONS: { value: CasteCategory; label: string; labelHi: string }[] = [
  { value: 'General', label: 'General', labelHi: 'सामान्य' },
  { value: 'Backward Class', label: 'Backward Class (BC)', labelHi: 'पिछड़ा वर्ग (BC)' },
  { value: 'Schedule Caste', label: 'Schedule Caste (SC)', labelHi: 'अनुसूचित जाति (SC)' },
  { value: 'Schedule Tribe', label: 'Schedule Tribe (ST)', labelHi: 'अनुसूचित जनजाति (ST)' },
];

const EMPTY_FORM = {
  name: '', fatherName: '', age: '', occupation: '', caste: '' as CasteCategory | '',
  address: '', postOffice: '', tehsil: '', district: '', state: '', pinCode: '', phone: '',
  memberType: 'member' as MemberType, shareCount: '', shareCapital: '', admissionFee: '',
  shareFaceValue: '', paymentMode: 'cash' as 'cash' | 'cheque' | 'online',
  nomineeName: '', nomineeFatherName: '', nomineeRelation: '', nomineeAge: '',
  nomineeOccupation: '', nomineeAddress: '', nomineeShares: '', nomineePhone: '',
};

const MemberApplication: React.FC = () => {
  const { language } = useLanguage();
  const { members, addMember, society } = useData();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canEdit = hasPermission(['admin', 'accountant']);

  const [form, setForm] = useState(EMPTY_FORM);

  const getNextMemberId = () => {
    const nums = members
      .map(m => parseInt(m.memberId.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n) && n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `M${String(next).padStart(3, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: language === 'hi' ? 'नाम आवश्यक है' : 'Name is required', variant: 'destructive' });
      return;
    }

    const newMember = addMember({
      memberId: getNextMemberId(),
      name: form.name.trim(),
      fatherName: form.fatherName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      shareCapital: parseFloat(form.shareCapital) || 0,
      admissionFee: parseFloat(form.admissionFee) || 0,
      memberType: form.memberType,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
      approvalStatus: 'pending',
      age: form.age ? parseInt(form.age) : undefined,
      occupation: form.occupation.trim() || undefined,
      caste: (form.caste as CasteCategory) || undefined,
      tehsil: form.tehsil.trim() || undefined,
      district: form.district.trim() || undefined,
      state: form.state.trim() || undefined,
      pinCode: form.pinCode.trim() || undefined,
      postOffice: form.postOffice.trim() || undefined,
      paymentMode: form.paymentMode,
      shareCount: form.shareCount ? parseInt(form.shareCount) : undefined,
      shareFaceValue: form.shareFaceValue ? parseFloat(form.shareFaceValue) : undefined,
      nomineeName: form.nomineeName.trim() || undefined,
      nomineeFatherName: form.nomineeFatherName.trim() || undefined,
      nomineeRelation: form.nomineeRelation.trim() || undefined,
      nomineeAge: form.nomineeAge ? parseInt(form.nomineeAge) : undefined,
      nomineeOccupation: form.nomineeOccupation.trim() || undefined,
      nomineeAddress: form.nomineeAddress.trim() || undefined,
      nomineeShares: form.nomineeShares ? parseInt(form.nomineeShares) : undefined,
      nomineePhone: form.nomineePhone.trim() || undefined,
    });

    // Generate PDF
    generateMemberApplicationPDF(newMember, society);

    toast({
      title: language === 'hi' ? 'आवेदन जमा हुआ' : 'Application Submitted',
      description: language === 'hi'
        ? `${newMember.name} का आवेदन पेंडिंग है। PDF डाउनलोड हो रही है।`
        : `${newMember.name}'s application is pending approval. PDF downloading.`,
    });

    setForm(EMPTY_FORM);
    navigate('/members?tab=pending');
  };

  const f = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const hi = language === 'hi';

  if (!canEdit) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {hi ? 'आपको इस पेज तक पहुँच नहीं है' : 'You do not have access to this page'}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/members')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {hi ? 'सदस्यता आवेदन पत्र' : 'Membership Application Form'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hi ? 'नए सदस्य का आवेदन भरें — सबमिट करने पर PDF डाउनलोड होगी' : 'Fill new member application — PDF will download on submit'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal Details */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hi ? 'व्यक्तिगत विवरण' : 'Personal Details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'पूरा नाम' : 'Full Name'} *</Label>
                <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder={hi ? 'पूरा नाम' : 'Full Name'} required />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'पिता/पति का नाम' : "Father's / Husband's Name"}</Label>
                <Input value={form.fatherName} onChange={e => f('fatherName', e.target.value)} placeholder={hi ? 'श्री...' : 'Mr...'} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'आयु (वर्ष)' : 'Age (Years)'}</Label>
                <Input type="number" value={form.age} onChange={e => f('age', e.target.value)} placeholder="25" min="1" max="120" />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'व्यवसाय' : 'Occupation'}</Label>
                <Input value={form.occupation} onChange={e => f('occupation', e.target.value)} placeholder={hi ? 'किसान / व्यापारी / नौकरी' : 'Farmer / Business / Service'} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'जाति वर्ग' : 'Caste Category'}</Label>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'फ़ोन नम्बर' : 'Phone'} *</Label>
                <Input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="9876543210" required />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'सदस्यता प्रकार' : 'Member Type'}</Label>
                <Select value={form.memberType} onValueChange={v => f('memberType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{hi ? 'सदस्य' : 'Member'}</SelectItem>
                    <SelectItem value="nominal">{hi ? 'नॉमिनल सदस्य' : 'Nominal Member'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Details */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hi ? 'पता विवरण' : 'Address Details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{hi ? 'पूरा पता' : 'Full Address'}</Label>
              <Textarea value={form.address} onChange={e => f('address', e.target.value)} placeholder={hi ? 'मकान नं., गली, गाँव/शहर' : 'House No., Street, Village/City'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'डाकघर' : 'Post Office'}</Label>
                <Input value={form.postOffice} onChange={e => f('postOffice', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'तहसील' : 'Tehsil'}</Label>
                <Input value={form.tehsil} onChange={e => f('tehsil', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'जिला' : 'District'}</Label>
                <Input value={form.district} onChange={e => f('district', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'राज्य' : 'State'}</Label>
                <Input value={form.state} onChange={e => f('state', e.target.value)} placeholder={hi ? 'हरियाणा' : 'Haryana'} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'पिन कोड' : 'Pin Code'}</Label>
                <Input value={form.pinCode} onChange={e => f('pinCode', e.target.value)} placeholder="125001" maxLength={6} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share & Fee Details */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hi ? 'अंश एवं शुल्क विवरण' : 'Share & Fee Details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'अंशों की संख्या' : 'Number of Shares'}</Label>
                <Input type="number" value={form.shareCount} onChange={e => f('shareCount', e.target.value)} placeholder="10" min="1" />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'प्रति अंश मूल्य (₹)' : 'Face Value per Share (₹)'}</Label>
                <Input type="number" value={form.shareFaceValue} onChange={e => f('shareFaceValue', e.target.value)} placeholder="100" min="1" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'अंश पूँजी (₹)' : 'Share Capital (₹)'}</Label>
                <Input type="number" value={form.shareCapital} onChange={e => f('shareCapital', e.target.value)} placeholder="1000" min="0" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'प्रवेश शुल्क (₹)' : 'Admission Fee (₹)'}</Label>
                <Input type="number" value={form.admissionFee} onChange={e => f('admissionFee', e.target.value)} placeholder="5" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'भुगतान का माध्यम' : 'Payment Mode'}</Label>
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
          </CardContent>
        </Card>

        {/* Nominee Details */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hi ? 'नामांकित व्यक्ति (Nominee) विवरण' : 'Nominee Details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'नामांकित का नाम' : 'Nominee Name'}</Label>
                <Input value={form.nomineeName} onChange={e => f('nomineeName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'नामांकित के पिता का नाम' : "Nominee's Father's Name"}</Label>
                <Input value={form.nomineeFatherName} onChange={e => f('nomineeFatherName', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'सम्बन्ध' : 'Relationship'}</Label>
                <Input value={form.nomineeRelation} onChange={e => f('nomineeRelation', e.target.value)} placeholder={hi ? 'पुत्र / पत्नी / भाई' : 'Son / Wife / Brother'} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'नामांकित की आयु' : 'Nominee Age'}</Label>
                <Input type="number" value={form.nomineeAge} onChange={e => f('nomineeAge', e.target.value)} min="1" max="120" />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'नामांकित का व्यवसाय' : 'Nominee Occupation'}</Label>
                <Input value={form.nomineeOccupation} onChange={e => f('nomineeOccupation', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'नामांकित का पता' : 'Nominee Address'}</Label>
                <Textarea value={form.nomineeAddress} onChange={e => f('nomineeAddress', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{hi ? 'नामांकित के अंश' : 'Nominee Shares'}</Label>
                <Input type="number" value={form.nomineeShares} onChange={e => f('nomineeShares', e.target.value)} min="0" />
                <div className="space-y-2 mt-2">
                  <Label>{hi ? 'नामांकित का फ़ोन' : 'Nominee Phone'}</Label>
                  <Input type="tel" value={form.nomineePhone} onChange={e => f('nomineePhone', e.target.value)} placeholder="9876543210" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" type="button" onClick={() => navigate('/members')}>
            {hi ? 'रद्द करें' : 'Cancel'}
          </Button>
          <Button type="submit" className="gap-2">
            <FileText className="h-4 w-4" />
            {hi ? 'आवेदन जमा करें और PDF डाउनलोड करें' : 'Submit Application & Download PDF'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MemberApplication;
