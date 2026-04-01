import { useState, useMemo, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Hash, Plus, Pencil, Trash2, Search, Download, FileSpreadsheet } from 'lucide-react';
import { hsnInsert, hsnUpdate, hsnDelete } from '@/lib/supabaseService';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';

interface HsnCode {
  id: string;
  code: string;
  description: string;
  type: 'HSN' | 'SAC';
  gstRate: number;
  cess: number;
}

const EMPTY_FORM = (): Omit<HsnCode, 'id'> => ({
  code: '',
  description: '',
  type: 'HSN',
  gstRate: 0,
  cess: 0,
});

const GST_RATES = [0, 5, 12, 18, 28];

export default function HsnMaster() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';
  const societyId = user?.societyId || 'SOC001';

  const [codes, setCodes] = useState<HsnCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load from Supabase
  useEffect(() => {
    setIsLoading(true);
    supabase
      .from('hsn_master')
      .select('*')
      .eq('society_id', societyId)
      .order('code', { ascending: true })
      .then(({ data, error }) => {
        setIsLoading(false);
        if (error) {
          // Table may not exist yet — just show empty
          console.warn('HSN Master load:', error.message);
          return;
        }
        const mapped: HsnCode[] = (data || []).map((r: any) => ({
          id: r.id,
          code: r.code,
          description: r.description || '',
          type: r.type === 'SAC' ? 'SAC' : 'HSN',
          gstRate: Number(r.gstRate ?? 0),
          cess: Number(r.cess ?? 0),
        }));
        setCodes(mapped);
      });
  }, [societyId]);

  const filtered = useMemo(() =>
    codes.filter(c =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
    ), [codes, search]);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM());
    setShowForm(true);
  };

  const openEdit = (c: HsnCode) => {
    setEditId(c.id);
    setForm({ code: c.code, description: c.description, type: c.type, gstRate: c.gstRate, cess: c.cess });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: hi ? 'कोड आवश्यक है' : 'Code is required', variant: 'destructive' });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: hi ? 'विवरण आवश्यक है' : 'Description is required', variant: 'destructive' });
      return;
    }

    if (editId) {
      const { error } = await hsnUpdate(editId, { code: form.code.trim(), description: form.description.trim(), type: form.type, gstRate: form.gstRate, cess: form.cess });
      if (error) {
        toast({ title: hi ? 'त्रुटि हुई' : 'Error saving', variant: 'destructive' });
        return;
      }
      setCodes(prev => prev.map(c => c.id === editId ? { ...c, ...form, id: editId } : c));
      toast({ title: hi ? 'HSN कोड अपडेट हुआ' : 'HSN code updated' });
    } else {
      const newId = `hsn_${Date.now()}`;
      const record = { id: newId, society_id: societyId, code: form.code.trim(), description: form.description.trim(), type: form.type, gstRate: form.gstRate, cess: form.cess, createdAt: new Date().toISOString() };
      const { error } = await hsnInsert(record);
      if (error) {
        toast({ title: hi ? 'त्रुटि हुई' : 'Error saving', variant: 'destructive' });
        return;
      }
      setCodes(prev => [...prev, { id: newId, code: form.code.trim(), description: form.description.trim(), type: form.type, gstRate: form.gstRate, cess: form.cess }]);
      toast({ title: hi ? 'HSN कोड जोड़ा गया' : 'HSN code added' });
    }
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await hsnDelete(id);
    if (error) {
      toast({ title: hi ? 'हटाने में त्रुटि' : 'Error deleting', variant: 'destructive' });
      return;
    }
    setCodes(prev => prev.filter(c => c.id !== id));
    toast({ title: hi ? 'HSN कोड हटाया गया' : 'HSN code deleted' });
    setDeleteId(null);
  };

  const handleCSV = () => {
    const headers = ['Code', 'Description', 'Type', 'GST Rate %', 'Cess %'];
    const rows = filtered.map(c => [c.code, c.description, c.type, c.gstRate, c.cess]);
    downloadCSV(headers, rows, 'hsn-master.csv');
  };

  const handleExcel = () => {
    const headers = ['Code', 'Description', 'Type', 'GST Rate %', 'Cess %'];
    const rows = filtered.map(c => [c.code, c.description, c.type, c.gstRate, c.cess]);
    downloadExcelSingle(headers, rows, 'hsn-master.xlsx', 'HSN Master');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Hash className="h-7 w-7 text-primary" />
            {hi ? 'HSN/SAC मास्टर' : 'HSN/SAC Master'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hi ? 'GST के लिए HSN/SAC कोड प्रबंधन' : 'Manage HSN/SAC codes for GST compliance'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {hi ? 'नया कोड' : 'Add Code'}
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{hi ? 'कुल कोड' : 'Total Codes'}</p>
            <p className="text-2xl font-bold text-primary">{codes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{hi ? 'HSN कोड' : 'HSN Codes'}</p>
            <p className="text-2xl font-bold text-blue-600">{codes.filter(c => c.type === 'HSN').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">{hi ? 'SAC कोड' : 'SAC Codes'}</p>
            <p className="text-2xl font-bold text-orange-600">{codes.filter(c => c.type === 'SAC').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="shadow-card">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={hi ? 'कोड या विवरण से खोजें…' : 'Search by code or description…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Badge variant="secondary" className="ml-auto">
              {filtered.length} {hi ? 'कोड' : 'codes'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">{hi ? 'लोड हो रहा है...' : 'Loading...'}</div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>{hi ? 'कोड' : 'Code'}</TableHead>
                    <TableHead>{hi ? 'विवरण' : 'Description'}</TableHead>
                    <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
                    <TableHead className="text-right">{hi ? 'GST दर %' : 'GST Rate %'}</TableHead>
                    <TableHead className="text-right">{hi ? 'Cess %' : 'Cess %'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कार्य' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        {search ? (hi ? 'कोई परिणाम नहीं' : 'No results found') : (hi ? 'कोई HSN/SAC कोड नहीं जोड़ा गया' : 'No HSN/SAC codes added yet')}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(c => (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                      <TableCell>{c.description}</TableCell>
                      <TableCell>
                        <Badge variant={c.type === 'HSN' ? 'default' : 'secondary'} className="text-xs">
                          {c.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">{c.gstRate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.cess}%</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(c.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId
                ? (hi ? 'HSN/SAC कोड संपादित करें' : 'Edit HSN/SAC Code')
                : (hi ? 'नया HSN/SAC कोड जोड़ें' : 'Add New HSN/SAC Code')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'कोड *' : 'Code *'}</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. 1001 or 9963"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'प्रकार' : 'Type'}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as 'HSN' | 'SAC' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HSN">HSN (Goods)</SelectItem>
                    <SelectItem value="SAC">SAC (Services)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{hi ? 'विवरण *' : 'Description *'}</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={hi ? 'वस्तु/सेवा का विवरण' : 'Goods/Service description'}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{hi ? 'GST दर %' : 'GST Rate %'}</Label>
                <Select value={String(form.gstRate)} onValueChange={v => setForm(f => ({ ...f, gstRate: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map(r => (
                      <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'Cess %' : 'Cess %'}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.cess}
                  onChange={e => setForm(f => ({ ...f, cess: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                {hi ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="flex-1">
                {hi ? 'सहेजें' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{hi ? 'हटाने की पुष्टि करें' : 'Confirm Delete'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {hi ? 'क्या आप इस HSN/SAC कोड को हटाना चाहते हैं? यह क्रिया वापस नहीं हो सकती।'
              : 'Are you sure you want to delete this HSN/SAC code? This action cannot be undone.'}
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">
              {hi ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="flex-1">
              {hi ? 'हटाएं' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
