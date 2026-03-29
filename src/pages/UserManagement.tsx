import { useState, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, ShieldCheck, Users, Lock } from 'lucide-react';
import { UserRole } from '@/types';

const USERS_KEY = 'sahayata_app_users';

interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

function getUsers(): AppUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function saveUsers(u: AppUser[]) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

const roleColor: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  accountant: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-700',
};

const roleLabel: Record<UserRole, { hi: string; en: string }> = {
  admin: { hi: 'व्यवस्थापक', en: 'Admin' },
  accountant: { hi: 'लेखाकार', en: 'Accountant' },
  viewer: { hi: 'दर्शक', en: 'Viewer' },
};

const empty: Omit<AppUser, 'id' | 'createdAt'> = {
  name: '', email: '', password: '', role: 'viewer', isActive: true,
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [users, setUsers] = useState<AppUser[]>(getUsers);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<Omit<AppUser, 'id' | 'createdAt'>>(empty);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!editing && form.password && form.password.length < 6) e.password = hi ? 'कम से कम 6 अक्षर' : 'Min 6 characters';
    // Check duplicate email (excluding current editing)
    const dup = users.find(u => u.email === form.email && u.id !== editing?.id);
    if (dup) e.email = hi ? 'यह ईमेल पहले से है' : 'Email already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    let updated: AppUser[];
    if (editing) {
      updated = users.map(u =>
        u.id === editing.id
          ? { ...u, name: form.name, email: form.email, role: form.role, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) }
          : u
      );
    } else {
      const newUser: AppUser = {
        id: `usr_${Date.now()}`,
        ...form,
        createdAt: new Date().toISOString(),
      };
      updated = [...users, newUser];
    }
    saveUsers(updated);
    setUsers(updated);
    setShowDialog(false);
    toast({ title: editing ? (hi ? 'उपयोगकर्ता अपडेट हुआ' : 'User updated') : (hi ? 'उपयोगकर्ता जोड़ा गया' : 'User added') });
  };

  const toggleActive = (id: string) => {
    const updated = users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u);
    saveUsers(updated);
    setUsers(updated);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setShowPassword(false);
    setShowDialog(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive });
    setErrors({});
    setShowPassword(false);
    setShowDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hi ? 'उपयोगकर्ता प्रबंधन' : 'User Management'}</h1>
          <p className="text-muted-foreground text-sm">{hi ? 'उपयोगकर्ता बनाएं और भूमिकाएं निर्धारित करें' : 'Create users and assign roles'}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />{hi ? 'नया उपयोगकर्ता' : 'New User'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[u.role]}`}>
                      {hi ? roleLabel[u.role].hi : roleLabel[u.role].en}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={u.isActive}
                      onCheckedChange={() => toggleActive(u.id)}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString('hi-IN')}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {hi
              ? 'नोट: यहाँ बनाए गए उपयोगकर्ता localStorage में संग्रहीत हैं। Supabase से लॉगिन के लिए society_users तालिका में जोड़ें।'
              : 'Note: Users created here are stored in localStorage. For Supabase-based login, add them to the society_users table.'}
          </p>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? (hi ? 'उपयोगकर्ता संपादित करें' : 'Edit User') : (hi ? 'नया उपयोगकर्ता' : 'New User')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label>{editing ? (hi ? 'नया पासवर्ड (खाली = बदलाव नहीं)' : 'New Password (blank = no change)') : (hi ? 'पासवर्ड' : 'Password')} {!editing && '*'}</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              />
              <button type="button" className="text-xs text-muted-foreground mt-1" onClick={() => setShowPassword(p => !p)}>
                {showPassword ? (hi ? 'छुपाएं' : 'Hide') : (hi ? 'दिखाएं' : 'Show')}
              </button>
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
