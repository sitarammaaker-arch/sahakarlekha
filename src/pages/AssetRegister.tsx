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
import { Textarea } from '@/components/ui/textarea';
import { Plus, Download, Search, Edit, Trash2, Package } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { generateAssetRegisterPDF } from '@/lib/pdf';
import type { Asset, AssetCategory, AssetStatus } from '@/types';

const CATEGORIES: AssetCategory[] = ['Land', 'Building', 'Furniture', 'Equipment', 'Vehicle', 'Computer', 'Other'];

const EMPTY_FORM = {
  name: '',
  category: 'Furniture' as AssetCategory,
  purchaseDate: new Date().toISOString().split('T')[0],
  cost: '',
  depreciationRate: '',
  location: '',
  description: '',
  status: 'active' as AssetStatus,
};

const AssetRegister: React.FC = () => {
  const { language } = useLanguage();
  const { assets, addAsset, updateAsset, deleteAsset, society } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

  // Straight-line depreciation: calculate accumulated depreciation
  const calcBookValue = (asset: Asset): number => {
    if (!asset.purchaseDate || !asset.depreciationRate) return asset.cost;
    const purchaseYear = new Date(asset.purchaseDate).getFullYear();
    // Use current financial year end (March 31 of current/next year)
    const now = new Date();
    const yearEnd = now.getMonth() >= 3 ? new Date(now.getFullYear(), 2, 31) : new Date(now.getFullYear() - 1, 2, 31);
    const yearsElapsed = Math.max(0, (yearEnd.getTime() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000));
    const depreciation = asset.cost * (asset.depreciationRate / 100) * yearsElapsed;
    return Math.max(0, asset.cost - depreciation);
  };

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.assetNo.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || a.category === catFilter;
    return matchSearch && matchCat;
  });

  const totalCost = assets.reduce((s, a) => s + a.cost, 0);
  const totalBookValue = assets.reduce((s, a) => s + calcBookValue(a), 0);
  const totalDepreciation = totalCost - totalBookValue;
  const activeCount = assets.filter(a => a.status === 'active').length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.cost || !form.purchaseDate) {
      toast({ title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    addAsset({
      name: form.name,
      category: form.category,
      purchaseDate: form.purchaseDate,
      cost: Number(form.cost),
      depreciationRate: Number(form.depreciationRate) || 0,
      location: form.location,
      description: form.description,
      status: form.status,
    });
    toast({ title: hi ? 'संपत्ति जोड़ी गई' : 'Asset added' });
    setForm(EMPTY_FORM);
    setIsAddOpen(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAsset) return;
    updateAsset(editAsset.id, {
      name: form.name,
      category: form.category,
      purchaseDate: form.purchaseDate,
      cost: Number(form.cost),
      depreciationRate: Number(form.depreciationRate) || 0,
      location: form.location,
      description: form.description,
      status: form.status,
    });
    toast({ title: hi ? 'संपत्ति अपडेट की गई' : 'Asset updated' });
    setEditAsset(null);
  };

  const openEdit = (a: Asset) => {
    setEditAsset(a);
    setForm({
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate,
      cost: String(a.cost),
      depreciationRate: String(a.depreciationRate),
      location: a.location,
      description: a.description,
      status: a.status,
    });
  };

  const catLabel: Record<AssetCategory, string> = {
    Land: hi ? 'भूमि' : 'Land',
    Building: hi ? 'भवन' : 'Building',
    Furniture: hi ? 'फर्नीचर' : 'Furniture',
    Equipment: hi ? 'उपकरण' : 'Equipment',
    Vehicle: hi ? 'वाहन' : 'Vehicle',
    Computer: hi ? 'कंप्यूटर' : 'Computer',
    Other: hi ? 'अन्य' : 'Other',
  };

  const AssetForm = ({ onSubmit }: { onSubmit: (e: React.FormEvent) => void }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>{hi ? 'संपत्ति का नाम *' : 'Asset Name *'}</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={hi ? 'जैसे: अलमारी, जीप आदि' : 'e.g. Steel Almirah, Jeep'} />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'श्रेणी' : 'Category'}</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as AssetCategory }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{catLabel[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'स्थान' : 'Location'}</Label>
          <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={hi ? 'कार्यालय/गोदाम' : 'Office/Godown'} />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'क्रय तिथि *' : 'Purchase Date *'}</Label>
          <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'लागत (₹) *' : 'Cost (₹) *'}</Label>
          <Input type="number" min="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="25000" />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'ह्रास दर (% SLM)' : 'Dep. Rate (% SLM)'}</Label>
          <Input type="number" step="0.01" min="0" max="100" value={form.depreciationRate} onChange={e => setForm(f => ({ ...f, depreciationRate: e.target.value }))} placeholder="10" />
        </div>
        <div className="space-y-1">
          <Label>{hi ? 'स्थिति' : 'Status'}</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as AssetStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{hi ? 'सक्रिय' : 'Active'}</SelectItem>
              <SelectItem value="disposed">{hi ? 'निपटाया गया' : 'Disposed'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label>{hi ? 'विवरण' : 'Description'}</Label>
          <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={hi ? 'अतिरिक्त विवरण...' : 'Additional details...'} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditAsset(null); }}>{hi ? 'रद्द' : 'Cancel'}</Button>
        <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            {hi ? 'संपत्ति रजिस्टर' : 'Asset Register'}
          </h1>
          <p className="text-muted-foreground">{hi ? 'स्थायी संपत्तियां एवं ह्रास का विवरण (SLM पद्धति)' : 'Fixed assets & depreciation record (SLM method)'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateAssetRegisterPDF(assets, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setForm(EMPTY_FORM); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4" />{hi ? 'नई संपत्ति' : 'Add Asset'}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल संपत्तियां' : 'Total Assets'}</p>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल लागत' : 'Total Cost'}</p>
            <p className="text-lg font-bold text-success">{fmt(totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'कुल ह्रास' : 'Total Depreciation'}</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(totalDepreciation)}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{hi ? 'पुस्तक मूल्य' : 'Book Value'}</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(totalBookValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={hi ? 'संपत्ति खोजें...' : 'Search assets...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{hi ? 'सभी श्रेणी' : 'All Categories'}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{catLabel[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hi ? 'सं.' : 'No.'}</TableHead>
                <TableHead>{hi ? 'संपत्ति' : 'Asset'}</TableHead>
                <TableHead>{hi ? 'श्रेणी' : 'Category'}</TableHead>
                <TableHead>{hi ? 'स्थान' : 'Location'}</TableHead>
                <TableHead>{hi ? 'क्रय तिथि' : 'Purchase Date'}</TableHead>
                <TableHead className="text-right">{hi ? 'लागत' : 'Cost'}</TableHead>
                <TableHead className="text-right">{hi ? 'ह्रास%' : 'Dep%'}</TableHead>
                <TableHead className="text-right">{hi ? 'कुल ह्रास' : 'Acc. Dep.'}</TableHead>
                <TableHead className="text-right">{hi ? 'पुस्तक मूल्य' : 'Book Value'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {hi ? 'कोई संपत्ति नहीं मिली' : 'No assets found'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(a => {
                  const bookValue = calcBookValue(a);
                  const accDep = a.cost - bookValue;
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{a.assetNo}</TableCell>
                      <TableCell>
                        <div className="font-medium">{a.name}</div>
                        {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                      </TableCell>
                      <TableCell>{catLabel[a.category]}</TableCell>
                      <TableCell className="text-muted-foreground">{a.location || '—'}</TableCell>
                      <TableCell className="text-sm">{a.purchaseDate}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(a.cost)}</TableCell>
                      <TableCell className="text-right">{a.depreciationRate}%</TableCell>
                      <TableCell className="text-right text-amber-600">{fmt(accDep)}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">{fmt(bookValue)}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>
                          {a.status === 'active' ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निपटाया' : 'Disposed')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {filtered.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={5}>{hi ? 'कुल' : 'Total'}</TableCell>
                  <TableCell className="text-right">{fmt(filtered.reduce((s, a) => s + a.cost, 0))}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right text-amber-600">{fmt(filtered.reduce((s, a) => s + (a.cost - calcBookValue(a)), 0))}</TableCell>
                  <TableCell className="text-right text-blue-600">{fmt(filtered.reduce((s, a) => s + calcBookValue(a), 0))}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'नई संपत्ति जोड़ें' : 'Add New Asset'}</DialogTitle>
          </DialogHeader>
          <AssetForm onSubmit={handleAdd} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAsset} onOpenChange={open => !open && setEditAsset(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'संपत्ति संपादित करें' : 'Edit Asset'} — {editAsset?.assetNo}</DialogTitle>
          </DialogHeader>
          <AssetForm onSubmit={handleEdit} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{hi ? 'संपत्ति हटाएं?' : 'Delete asset?'}</AlertDialogTitle>
            <AlertDialogDescription>{hi ? 'यह कार्य वापस नहीं किया जा सकता।' : 'This action cannot be undone.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => { if (deleteId) { deleteAsset(deleteId); setDeleteId(null); toast({ title: hi ? 'हटाई गई' : 'Deleted' }); } }}>
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssetRegister;
