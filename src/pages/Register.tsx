import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const STATES = [
  { value: 'ap', label: 'Andhra Pradesh' },
  { value: 'ar', label: 'Arunachal Pradesh' },
  { value: 'as', label: 'Assam' },
  { value: 'br', label: 'Bihar' },
  { value: 'ct', label: 'Chhattisgarh' },
  { value: 'ga', label: 'Goa' },
  { value: 'gj', label: 'Gujarat' },
  { value: 'hr', label: 'Haryana' },
  { value: 'hp', label: 'Himachal Pradesh' },
  { value: 'jh', label: 'Jharkhand' },
  { value: 'ka', label: 'Karnataka' },
  { value: 'kl', label: 'Kerala' },
  { value: 'mp', label: 'Madhya Pradesh' },
  { value: 'mh', label: 'Maharashtra' },
  { value: 'mn', label: 'Manipur' },
  { value: 'ml', label: 'Meghalaya' },
  { value: 'mz', label: 'Mizoram' },
  { value: 'nl', label: 'Nagaland' },
  { value: 'or', label: 'Odisha' },
  { value: 'pb', label: 'Punjab' },
  { value: 'rj', label: 'Rajasthan' },
  { value: 'sk', label: 'Sikkim' },
  { value: 'tn', label: 'Tamil Nadu' },
  { value: 'tg', label: 'Telangana' },
  { value: 'tr', label: 'Tripura' },
  { value: 'up', label: 'Uttar Pradesh' },
  { value: 'ut', label: 'Uttarakhand' },
  { value: 'wb', label: 'West Bengal' },
];

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Society fields
  const [societyName, setSocietyName] = useState('');
  const [societyNameHi, setSocietyNameHi] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [financialYear, setFinancialYear] = useState('2024-25');

  // Admin fields
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!societyName || !registrationNo || !district || !state) {
      setError('Please fill all required fields');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName || !adminEmail || !adminPassword) {
      setError('Please fill all required fields');
      return;
    }
    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (adminPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Insert society
      const { data: society, error: societyError } = await supabase
        .from('societies')
        .insert({
          name: societyName,
          name_hi: societyNameHi || null,
          registration_no: registrationNo,
          address: address || null,
          district,
          state,
          phone: phone || null,
          financial_year: financialYear,
        })
        .select()
        .single();

      if (societyError) {
        if (societyError.code === '23505') {
          setError('Registration number already exists. Please use a different registration number.');
        } else {
          setError(societyError.message);
        }
        setLoading(false);
        return;
      }

      // 2. Insert admin user
      const { error: userError } = await supabase
        .from('society_users')
        .insert({
          society_id: society.id,
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
        });

      if (userError) {
        // Rollback society on user insert failure
        await supabase.from('societies').delete().eq('id', society.id);
        if (userError.code === '23505') {
          setError('This email is already registered. Please use a different email.');
        } else {
          setError(userError.message);
        }
        setLoading(false);
        return;
      }

      // 3. Insert society_settings so the correct name shows after login
      await supabase.from('society_settings').insert({
        id: society.id,
        society_id: society.id,
        name: societyName,
        nameHi: societyNameHi || societyName,
        registrationNo: registrationNo,
        financialYear: financialYear,
        financialYearStart: financialYear.split('-')[0] + '-04-01',
        address: address || '',
        district: district,
        state: state,
        phone: phone || '',
        email: adminEmail,
        pinCode: '',
      });

      // 4. Insert default accounts so balances work from day one
      const sid = society.id;
      await supabase.from('accounts').insert([
        { id: 'CASH',       society_id: sid, name: 'Cash in Hand',            nameHi: 'हाथ में नकद',       type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: true  },
        { id: 'BANK',       society_id: sid, name: 'Bank - SBI',              nameHi: 'बैंक - एसबीआई',     type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: true  },
        { id: 'SHARE_CAP',  society_id: sid, name: 'Share Capital',           nameHi: 'अंश पूंजी',          type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: true  },
        { id: 'MEM_DEP',    society_id: sid, name: 'Member Deposits',         nameHi: 'सदस्य जमा',          type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
        { id: 'RES_FUND',   society_id: sid, name: 'Reserve Fund',            nameHi: 'आरक्षित निधि',        type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
        { id: 'DEBTORS',    society_id: sid, name: 'Sundry Debtors',          nameHi: 'देनदार',             type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false },
        { id: 'CREDITORS',  society_id: sid, name: 'Sundry Creditors',        nameHi: 'लेनदार',             type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
        { id: 'COMM_INC',   society_id: sid, name: 'Commission Income',       nameHi: 'कमीशन आय',           type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
        { id: 'INT_INC',    society_id: sid, name: 'Interest Income',         nameHi: 'ब्याज आय',           type: 'income',    openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
        { id: 'SAL_EXP',    society_id: sid, name: 'Salary Expense',          nameHi: 'वेतन व्यय',           type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false },
        { id: 'RENT_EXP',   society_id: sid, name: 'Rent Expense',            nameHi: 'किराया व्यय',         type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false },
        { id: 'OFF_EXP',    society_id: sid, name: 'Office Expenses',         nameHi: 'कार्यालय व्यय',        type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false },
        { id: 'ELEC_EXP',   society_id: sid, name: 'Electricity Expense',     nameHi: 'बिजली व्यय',          type: 'expense',   openingBalance: 0, openingBalanceType: 'debit',  isSystem: false },
        { id: 'STOCK',      society_id: sid, name: 'Stock in Trade',          nameHi: 'व्यापारिक स्टॉक',     type: 'asset',     openingBalance: 0, openingBalanceType: 'debit',  isSystem: false },
        { id: 'SURPLUS_BF', society_id: sid, name: 'Surplus Brought Forward', nameHi: 'अग्रनीत अधिशेष',     type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false },
      ]);

      setSuccess(true);
    } catch {
      setError('Registration failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardContent className="pt-10 pb-10">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Registration Successful!
            </h2>
            <p className="text-muted-foreground mb-1">
              <strong>{societyName}</strong> has been registered successfully.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Login with: <strong className="text-primary">{adminEmail}</strong>
            </p>
            <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
              Go to Login →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent/20" />

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-primary-foreground">
          <div className="h-24 w-24 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-8">
            <Building2 className="h-12 w-12" />
          </div>
          <h1 className="text-4xl font-bold text-center mb-4">
            नई समिति पंजीकरण
          </h1>
          <p className="text-xl text-center text-primary-foreground/80 mb-2">
            New Society Registration
          </p>
          <p className="text-center text-primary-foreground/60 max-w-md">
            अपनी सहकारी समिति का पंजीकरण करें और लेखा प्रणाली का उपयोग शुरू करें
          </p>

          {/* Step indicators */}
          <div className="mt-12 flex items-center gap-4">
            <div className={`flex items-center gap-2 transition-all ${step === 1 ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 1 ? 'bg-white text-primary' : 'bg-white/20 text-white'}`}>1</div>
              <span className="text-sm">Society Info</span>
            </div>
            <div className="h-px w-8 bg-white/30" />
            <div className={`flex items-center gap-2 transition-all ${step === 2 ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 2 ? 'bg-white text-primary' : 'bg-white/20 text-white'}`}>2</div>
              <span className="text-sm">Admin Account</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-background overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-6 text-center">
          <div className="h-14 w-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">नई समिति पंजीकरण</h1>
        </div>

        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              {step === 1 ? '🏢 Society Information' : '👤 Admin Account'}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? 'Step 1 of 2 — Enter your cooperative society details'
                : 'Step 2 of 2 — Create the administrator account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 1 ? (
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="space-y-2">
                  <Label>Society Name (English) <span className="text-destructive">*</span></Label>
                  <Input
                    value={societyName}
                    onChange={e => setSocietyName(e.target.value)}
                    placeholder="Gram Seva Cooperative Marketing Society"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Society Name (Hindi)</Label>
                  <Input
                    value={societyNameHi}
                    onChange={e => setSocietyNameHi(e.target.value)}
                    placeholder="ग्राम सेवा सहकारी विपणन समिति"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Registration Number <span className="text-destructive">*</span></Label>
                  <Input
                    value={registrationNo}
                    onChange={e => setRegistrationNo(e.target.value)}
                    placeholder="COOP/2024/12345"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>District <span className="text-destructive">*</span></Label>
                    <Input
                      value={district}
                      onChange={e => setDistrict(e.target.value)}
                      placeholder="District name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State <span className="text-destructive">*</span></Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0755-1234567"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Full address"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Financial Year</Label>
                  <Select value={financialYear} onValueChange={setFinancialYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2023-24">2023-24</SelectItem>
                      <SelectItem value="2024-25">2024-25</SelectItem>
                      <SelectItem value="2025-26">2025-26</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Next: Admin Account →
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Admin Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@yoursociety.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setStep(1); setError(''); }}
                  >
                    ← Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Registering...
                      </span>
                    ) : (
                      'Register Society'
                    )}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-5 text-center text-sm text-muted-foreground">
              Already registered?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Login here
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          © 2024 समिति लेखा प्रणाली | All rights reserved
        </p>
      </div>
    </div>
  );
};

export default Register;
