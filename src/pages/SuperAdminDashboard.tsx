/**
 * Super Admin Dashboard — Platform Owner View
 * Accessible only to emails listed in platform_admins table.
 * Shows all registered societies + subscription management.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Shield, Users, CreditCard, RefreshCw, Lock, Unlock,
  AlertTriangle, CheckCircle2, Clock, Search, Edit2, BarChart3,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Society {
  society_id: string;
  name: string;
  nameHi: string;
  registrationNo: string;
  district: string;
  state: string;
  societyType: string;
  financialYear: string;
  plan: string;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  is_locked: boolean;
  subscription_notes: string | null;
  created_at: string | null;
  user_count?: number;
}

interface SubEditState {
  plan: string;
  plan_expires_at: string;
  is_locked: boolean;
  subscription_notes: string;
}

const PLAN_OPTIONS = [
  { value: 'trial',   label: 'Trial',   color: 'bg-yellow-100 text-yellow-800' },
  { value: 'active',  label: 'Active',  color: 'bg-green-100  text-green-800'  },
  { value: 'expired', label: 'Expired', color: 'bg-red-100    text-red-800'    },
  { value: 'free',    label: 'Free',    color: 'bg-blue-100   text-blue-800'   },
];

const SOCIETY_TYPE_LABEL: Record<string, string> = {
  marketing_processing: 'CMS',
  pacs: 'PACS',
  consumer: 'Consumer',
  labour: 'Labour',
  other: 'Other',
};

function planBadge(plan: string) {
  const p = PLAN_OPTIONS.find(o => o.value === plan) ?? PLAN_OPTIONS[0];
  return <Badge className={`text-xs ${p.color}`}>{p.label}</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');

  // Subscription edit dialog
  const [editSociety, setEditSociety] = useState<Society | null>(null);
  const [editForm, setEditForm] = useState<SubEditState>({
    plan: 'trial', plan_expires_at: '', is_locked: false, subscription_notes: '',
  });
  const [saving, setSaving] = useState(false);

  // ── Load all societies ─────────────────────────────────────────────────────
  const loadSocieties = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: societyData }, { data: userCounts }] = await Promise.all([
        supabase.rpc('get_all_societies'),
        supabase.rpc('get_society_user_counts'),
      ]);

      const countMap: Record<string, number> = {};
      (userCounts ?? []).forEach((r: { society_id: string; user_count: number }) => {
        countMap[r.society_id] = Number(r.user_count);
      });

      const rows: Society[] = (societyData ?? []).map((s: Society) => ({
        ...s,
        user_count: countMap[s.society_id] ?? 0,
      }));
      setSocieties(rows);
    } catch (err) {
      console.error('Failed to load societies:', err);
      toast({ title: 'Error loading societies', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadSocieties(); }, [loadSocieties]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:   societies.length,
    active:  societies.filter(s => s.plan === 'active').length,
    trial:   societies.filter(s => s.plan === 'trial').length,
    locked:  societies.filter(s => s.is_locked).length,
    expired: societies.filter(s => s.plan === 'expired').length,
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = societies.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.registrationNo?.toLowerCase().includes(search.toLowerCase()) ||
      s.district?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === 'all' || s.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  // ── Open edit dialog ───────────────────────────────────────────────────────
  const openEdit = (s: Society) => {
    setEditSociety(s);
    setEditForm({
      plan: s.plan ?? 'trial',
      plan_expires_at: s.plan_expires_at ? s.plan_expires_at.slice(0, 10) : '',
      is_locked: s.is_locked ?? false,
      subscription_notes: s.subscription_notes ?? '',
    });
  };

  // ── Save subscription ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editSociety) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_society_subscription', {
        p_society_id:      editSociety.society_id,
        p_plan:            editForm.plan,
        p_plan_expires_at: editForm.plan_expires_at ? new Date(editForm.plan_expires_at).toISOString() : null,
        p_is_locked:       editForm.is_locked,
        p_notes:           editForm.subscription_notes,
      });
      if (error) throw error;
      toast({ title: 'Subscription updated', description: editSociety.name });
      setEditSociety(null);
      loadSocieties();
    } catch (err: unknown) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Quick lock toggle ──────────────────────────────────────────────────────
  const toggleLock = async (s: Society) => {
    try {
      await supabase.rpc('update_society_subscription', {
        p_society_id:      s.society_id,
        p_plan:            s.plan,
        p_plan_expires_at: s.plan_expires_at ?? null,
        p_is_locked:       !s.is_locked,
        p_notes:           s.subscription_notes ?? '',
      });
      toast({ title: !s.is_locked ? 'Society locked' : 'Society unlocked', description: s.name });
      loadSocieties();
    } catch {
      toast({ title: 'Failed to toggle lock', variant: 'destructive' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Shield className="h-6 w-6 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Super Admin Dashboard
            <Badge className="bg-purple-100 text-purple-800 text-xs">Platform Owner</Badge>
          </h1>
          <p className="text-sm text-gray-500">Logged in as {user?.email}</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={loadSocieties} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',   value: stats.total,   icon: Building2,     color: 'text-gray-700'   },
          { label: 'Active',  value: stats.active,  icon: CheckCircle2,  color: 'text-green-700'  },
          { label: 'Trial',   value: stats.trial,   icon: Clock,         color: 'text-yellow-700' },
          { label: 'Expired', value: stats.expired, icon: AlertTriangle, color: 'text-red-700'    },
          { label: 'Locked',  value: stats.locked,  icon: Lock,          color: 'text-slate-700'  },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="societies">
        <TabsList>
          <TabsTrigger value="societies" className="gap-2">
            <Building2 className="h-4 w-4" /> All Societies
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" /> Subscription Overview
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Stats
          </TabsTrigger>
        </TabsList>

        {/* ── Societies Tab ─────────────────────────────────────────────── */}
        <TabsContent value="societies" className="mt-4 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, reg. no, district…"
                className="pl-8 h-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {PLAN_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Society</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>District / State</TableHead>
                      <TableHead>FY</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Locked</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-400">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-400">
                          No societies found
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(s => (
                      <TableRow key={s.society_id} className={s.is_locked ? 'bg-red-50' : undefined}>
                        <TableCell>
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs text-gray-400">{s.registrationNo}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {SOCIETY_TYPE_LABEL[s.societyType] ?? s.societyType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.district}{s.district && s.state ? ', ' : ''}{s.state?.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-sm">{s.financialYear}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            {s.user_count ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>{planBadge(s.plan)}</TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {s.plan === 'trial'
                            ? <span className="text-yellow-700">Trial ends {fmtDate(s.trial_ends_at)}</span>
                            : fmtDate(s.plan_expires_at)}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={s.is_locked}
                            onCheckedChange={() => toggleLock(s)}
                            className={s.is_locked ? 'data-[state=checked]:bg-red-600' : ''}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">{fmtDate(s.created_at)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(s)} className="h-7 px-2">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Subscription Overview Tab ──────────────────────────────────── */}
        <TabsContent value="subscription" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {societies.map(s => (
              <Card key={s.society_id} className={s.is_locked ? 'border-red-300' : s.plan === 'expired' ? 'border-orange-300' : ''}>
                <CardHeader className="py-3 pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="truncate">{s.name}</span>
                    {planBadge(s.plan)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span>{SOCIETY_TYPE_LABEL[s.societyType] ?? s.societyType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Users</span>
                    <span>{s.user_count ?? 0}</span>
                  </div>
                  {s.plan === 'trial' && (
                    <div className="flex justify-between text-yellow-700">
                      <span>Trial ends</span>
                      <span>{fmtDate(s.trial_ends_at)}</span>
                    </div>
                  )}
                  {s.plan_expires_at && s.plan !== 'trial' && (
                    <div className="flex justify-between">
                      <span>Expires</span>
                      <span>{fmtDate(s.plan_expires_at)}</span>
                    </div>
                  )}
                  {s.is_locked && (
                    <div className="flex items-center gap-1 text-red-600 font-medium">
                      <Lock className="h-3 w-3" /> Locked
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={() => openEdit(s)}>
                    Manage Subscription
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Stats Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Plan distribution */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PLAN_OPTIONS.map(p => {
                  const count = societies.filter(s => s.plan === p.value).length;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={p.value} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{p.label}</span>
                        <span className="font-medium">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Society type distribution */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Society Type Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(SOCIETY_TYPE_LABEL).map(([key, label]) => {
                  const count = societies.filter(s => s.societyType === key).length;
                  if (count === 0) return null;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{label}</span>
                        <span className="font-medium">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit Subscription Dialog ─────────────────────────────────────── */}
      <Dialog open={!!editSociety} onOpenChange={() => setEditSociety(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              Manage Subscription
            </DialogTitle>
          </DialogHeader>
          {editSociety && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium">{editSociety.name}</p>
                <p className="text-gray-500 text-xs">{editSociety.registrationNo} · {editSociety.district}</p>
              </div>

              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={editForm.plan} onValueChange={v => setEditForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Plan Expiry Date</Label>
                <Input
                  type="date"
                  value={editForm.plan_expires_at}
                  onChange={e => setEditForm(f => ({ ...f, plan_expires_at: e.target.value }))}
                />
                <p className="text-xs text-gray-400">Leave blank for no expiry (free/lifetime)</p>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={editForm.is_locked}
                  onCheckedChange={v => setEditForm(f => ({ ...f, is_locked: v }))}
                  className={editForm.is_locked ? 'data-[state=checked]:bg-red-600' : ''}
                />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {editForm.is_locked
                      ? <><Lock className="h-3.5 w-3.5 text-red-600" /> Society Locked</>
                      : <><Unlock className="h-3.5 w-3.5 text-green-600" /> Society Active</>}
                  </p>
                  <p className="text-xs text-gray-400">Locked society cannot log in</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  value={editForm.subscription_notes}
                  onChange={e => setEditForm(f => ({ ...f, subscription_notes: e.target.value }))}
                  placeholder="Payment reference, contact, remarks…"
                  className="min-h-16 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSociety(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-purple-700 hover:bg-purple-800">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
