import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Edit2, ShieldCheck, ShieldOff, Users, Lock, FileSpreadsheet, Download,
  RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { fmtDateTime } from '@/lib/dateUtils';
import { UserRole } from '@/types';

const USERS_KEY = 'sahayata_app_users';

interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  society_id?: string;
  createdAt: string;
  mfaEnabled?: boolean;
  branchId?: string;   // ECR-17 Phase 4b: home branch — set → user is restricted to this branch
}

function getCachedUsers(): AppUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function cacheUsers(u: AppUser[]) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

const roleColor: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  accountant: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-700',
  auditor: 'bg-purple-100 text-purple-800',
};

const roleLabel: Record<string, { hi: string; en: string }> = {
  admin: { hi: 'व्यवस्थापक', en: 'Admin' },
  accountant: { hi: 'लेखाकार', en: 'Accountant' },
  viewer: { hi: 'दर्शक', en: 'Viewer' },
  auditor: { hi: 'CA / लेखा परीक्षक', en: 'CA / Auditor' },
};

const empty: Omit<AppUser, 'id' | 'createdAt' | 'society_id'> = {
  name: '', email: '', password: '', role: 'viewer', isActive: true, branchId: '',
};

export default function UserManagement() {
  const { user: currentUser, adminResetMfa } = useAuth();
  const { language } = useLanguage();
  const { branches } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [users, setUsers] = useState<AppUser[]>(getCachedUsers);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<Omit<AppUser, 'id' | 'createdAt' | 'society_id'>>(empty);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  // Load users from Supabase (primary) with localStorage fallback
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const societyId = currentUser?.societyId;
      const { data, error } = await supabase
        .from('society_users')
        // P1-SEC-5: never fetch society_users.password (plain-text). Auth is via
        // Supabase Auth; the list does not need/display the stored password.
        .select('id, name, email, role, is_active, society_id, created_at, mfa_enabled, branch_id')
        .eq('society_id', societyId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: AppUser[] = data.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          password: '', // P1-SEC-5: password is no longer read from society_users
          role: u.role as UserRole,
          isActive: u.is_active,
          society_id: u.society_id,
          createdAt: u.created_at,
          mfaEnabled: !!u.mfa_enabled,
          branchId: (u as { branch_id?: string }).branch_id || '',
        }));
        setUsers(mapped);
        cacheUsers(mapped);
      }
      // If Supabase returns empty or errors, keep localStorage cache
    } catch {
      // Offline — use cached data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>{hi ? 'केवल व्यवस्थापक के लिए' : 'Admin access required'}</p>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = hi ? 'नाम आवश्यक है' : 'Name required';
    if (!form.email.trim() || !form.email.includes('@')) e.email = hi ? 'मान्य ईमेल दर्ज करें' : 'Valid email required';
    if (!editing && !form.password.trim()) e.password = hi ? 'पासवर्ड आवश्यक है' : 'Password required';
    if (form.password && form.password.length < 6) e.password = hi ? 'कम से कम 6 अक्षर' : 'Min 6 characters';
    const dup = users.find(u => u.email === form.email && u.id !== editing?.id);
    if (dup) e.email = hi ? 'यह ईमेल पहले से है' : 'Email already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveError('');

    const societyId = currentUser?.societyId || 'SOC001';

    try {
      if (editing) {
        // Update existing user
        const updateData: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          role: form.role,
          is_active: form.isActive,
          branch_id: form.branchId || null,   // ECR-17 Phase 4b: '' = society-wide (unrestricted)
        };
        if (form.password) updateData.password = form.password;

        const { error } = await supabase
          .from('society_users')
          .update(updateData)
          .eq('id', editing.id);

        if (error) throw error;

        const updated = users.map(u =>
          u.id === editing.id
            ? { ...u, name: form.name, email: form.email, role: form.role, isActive: form.isActive, branchId: form.branchId || '', ...(form.password ? { password: form.password } : {}) }
            : u
        );
        setUsers(updated);
        cacheUsers(updated);
      } else {
        // Create new user — atomically creates a CONFIRMED Supabase Auth login
        // (with identity) AND the society_users row, server-side via RPC. This
        // never disrupts the admin's session and never leaves a user without a
        // working JWT login (required for society-scoped RLS). Errors surface to
        // the admin instead of being swallowed.
        const { data: newSuId, error } = await supabase.rpc('app_add_society_user', {
          p_email: form.email,
          p_password: form.password,
          p_name: form.name,
          p_role: form.role,
          p_society_id: societyId,
          p_is_active: form.isActive,
        });

        if (error) throw error;

        // ECR-17 Phase 4b: the add RPC has no branch param — patch branch_id on the
        // new row afterwards (best-effort; the user is still created without it).
        if (form.branchId && newSuId) {
          const { error: brErr } = await supabase.from('society_users').update({ branch_id: form.branchId }).eq('id', newSuId as string);
          if (brErr) console.warn('User branch assign:', brErr.message);
        }

        const newUser: AppUser = {
          id: (newSuId as string) || form.email,
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          isActive: form.isActive,
          society_id: societyId,
          createdAt: new Date().toISOString(),
          branchId: form.branchId || '',
        };
        const updated = [...users, newUser];
        setUsers(updated);
        cacheUsers(updated);
      }

      setShowDialog(false);
      toast({
        title: editing
          ? (hi ? 'उपयोगकर्ता अपडेट हुआ' : 'User updated')
          : (hi ? 'उपयोगकर्ता जोड़ा गया' : 'User added'),
      });
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      const msg = e?.message || e?.details || e?.hint || JSON.stringify(err);
      setSaveError(hi ? `त्रुटि: ${msg}` : `Error: ${msg}`);
    }
  };

  const toggleActive = async (id: string) => {
    const u = users.find(x => x.id === id);
    if (!u) return;
    const newVal = !u.isActive;
    try {
      await supabase.from('society_users').update({ is_active: newVal }).eq('id', id);
    } catch { /* offline — update locally anyway */ }
    const updated = users.map(x => x.id === id ? { ...x, isActive: newVal } : x);
    setUsers(updated);
    cacheUsers(updated);
  };

  // ECR-12 — admin resets a locked-out user's 2FA (lost device).
  const handleResetMfa = async (u: AppUser) => {
    if (!window.confirm(hi
      ? `${u.name} का 2FA reset करें? वे बिना 2FA login करके दोबारा सेट कर पाएंगे.`
      : `Reset 2FA for ${u.name}? They will be able to log in without 2FA and set it up again.`)) return;
    const ok = await adminResetMfa(u.email);
    if (ok) {
      const updated = users.map(x => x.id === u.id ? { ...x, mfaEnabled: false } : x);
      setUsers(updated);
      cacheUsers(updated);
      toast({ title: hi ? '2FA reset हो गया' : '2FA reset', description: u.email });
    } else {
      toast({ title: hi ? 'Reset नहीं हो पाया' : 'Reset failed', description: hi ? 'अनुमति नहीं या cloud तक नहीं पहुँच पाया.' : 'Not authorised or cloud unreachable.', variant: 'destructive' });
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setSaveError('');
    setShowPassword(false);
    setShowDialog(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive, branchId: u.branchId || '' });
    setErrors({});
    setSaveError('');
    setShowPassword(false);
    setShowDialog(true);
  };

  const handleCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Created At'];
    const rows = users.map(u => [u.name, u.email, u.role, u.isActive ? 'Active' : 'Inactive', u.createdAt ? fmtDateTime(u.createdAt) : '']);
    downloadCSV(headers, rows, 'users.csv');
  };
  const handleExcel = () => {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Created At'];
    const rows = users.map(u => [u.name, u.email, u.role, u.isActive ? 'Active' : 'Inactive', u.createdAt ? fmtDateTime(u.createdAt) : '']);
    downloadExcelSingle(headers, rows, 'users.xlsx', 'Users');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'उपयोगकर्ता प्रबंधन' : 'User Management'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'उपयोगकर्ता बनाएं और भूमिकाएं निर्धारित करें' : 'Create users and assign roles'}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {hi ? 'रीफ्रेश' : 'Refresh'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />{hi ? 'नया उपयोगकर्ता' : 'New User'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'कुल' : 'Total'}</p>
          <p className="font-bold text-lg">{users.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'सक्रिय' : 'Active'}</p>
          <p className="font-bold text-lg text-green-700">{users.filter(u => u.isActive).length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{hi ? 'निष्क्रिय' : 'Inactive'}</p>
          <p className="font-bold text-lg text-muted-foreground">{users.filter(u => !u.isActive).length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'नाम' : 'Name'}</TableHead>
                  <TableHead>{hi ? 'ईमेल' : 'Email'}</TableHead>
                  <TableHead>{hi ? 'भूमिका' : 'Role'}</TableHead>
                  <TableHead className="text-center">{hi ? 'स्थिति' : 'Status'}</TableHead>
                  <TableHead>{hi ? 'बनाया' : 'Created'}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      {hi ? 'कोई उपयोगकर्ता नहीं। नया बनाएं।' : 'No users yet. Create one to get started.'}
                    </TableCell>
                  </TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[u.role] || 'bg-gray-100'}`}>
                        {hi ? (roleLabel[u.role]?.hi || u.role) : (roleLabel[u.role]?.en || u.role)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={u.isActive}
                        onCheckedChange={() => toggleActive(u.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.createdAt ? fmtDateTime(u.createdAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {u.mfaEnabled && (
                          <>
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <ShieldCheck className="h-3 w-3 text-green-600" /> 2FA
                            </Badge>
                            <Button size="sm" variant="ghost" title={hi ? '2FA reset करें' : 'Reset 2FA'} onClick={() => handleResetMfa(u)}>
                              <ShieldOff className="h-4 w-4 text-amber-600" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? (hi ? 'उपयोगकर्ता संपादित करें' : 'Edit User') : (hi ? 'नया उपयोगकर्ता' : 'New User')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label>{hi ? 'पूरा नाम' : 'Full Name'} *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>{hi ? 'ईमेल' : 'Email'} *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label>
                {editing
                  ? (hi ? 'नया पासवर्ड (खाली = बदलाव नहीं)' : 'New Password (blank = no change)')
                  : (hi ? 'पासवर्ड' : 'Password')}{!editing && ' *'}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>
            <div>
              <Label>{hi ? 'भूमिका' : 'Role'}</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{hi ? 'व्यवस्थापक' : 'Admin'}</SelectItem>
                  <SelectItem value="accountant">{hi ? 'लेखाकार' : 'Accountant'}</SelectItem>
                  <SelectItem value="viewer">{hi ? 'दर्शक' : 'Viewer'}</SelectItem>
                  <SelectItem value="auditor">{hi ? 'CA / लेखा परीक्षक' : 'CA / Auditor'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* ECR-17 Phase 4b: branch restriction — pick a branch to lock this user to it,
                or "All branches" for society-wide (admin / consolidated) access. */}
            {branches.length > 0 && (
              <div>
                <Label>{hi ? 'शाखा तक सीमित' : 'Branch restriction'}</Label>
                <Select value={form.branchId || '__all__'} onValueChange={v => setForm(p => ({ ...p, branchId: v === '__all__' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{hi ? 'सभी शाखाएँ (कोई पाबंदी नहीं)' : 'All branches (no restriction)'}</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}{b.isHeadOffice ? (hi ? ' (हेड ऑफ़िस)' : ' (HO)') : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{hi ? 'किसी शाखा को चुनने पर यह उपयोगकर्ता केवल उसी शाखा का डेटा देख/दर्ज कर पाएगा।' : 'If a branch is set, this user only sees and enters that branch’s data.'}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
              <Label>{hi ? 'सक्रिय' : 'Active'}</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
              <Button onClick={handleSave}>{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
