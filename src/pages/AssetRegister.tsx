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
import { Plus, Download, Search, Edit, Trash2, Package, RefreshCw, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { generateAssetRegisterPDF } from '@/lib/pdf';
import type { Asset, AssetCategory, AssetStatus } from '@/types';
import { calcSLMDepreciation, calcWDVDepreciation, DEP_ACCOUNTS } from '@/lib/depreciation';

const CATEGORIES: AssetCategory[] = ['Land', 'Building', 'Furniture', 'Equipment', 'Vehicle', 'Computer', 'Other'];

const EMPTY_FORM = {
  name: '',
  category: 'Furniture' as AssetCategory,
  purchaseDate: new Date().toISOString().split('T')[0],
  cost: '',
  depreciationRate: '',
  depreciationMethod: 'SLM' as 'SLM' | 'WDV',
  location: '',
  description: '',
  status: 'active' as AssetStatus,
};

interface AssetFormProps {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  hi: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const AssetForm: React.FC<AssetFormProps> = ({ form, setForm, hi, onSubmit, onCancel }) => (
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
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{hi ? { Land: 'भूमि', Building: 'भवन', Furniture: 'फर्नीचर', Equipment: 'उपकरण', Vehicle: 'वाहन', Computer: 'कंप्यूटर', Other: 'अन्य' }[c] : c}</SelectItem>)}
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
        <Label>{hi ? 'ह्रास दर (%)' : 'Dep. Rate (%)'}</Label>
        <Input type="number" step="0.01" min="0" max="100" value={form.depreciationRate} onChange={e => setForm(f => ({ ...f, depreciationRate: e.target.value }))} placeholder="10" />
      </div>
      <div className="space-y-1">
        <Label>{hi ? 'ह्रास पद्धति' : 'Dep. Method'}</Label>
        <Select value={form.depreciationMethod} onValueChange={v => setForm(f => ({ ...f, depreciationMethod: v as 'SLM' | 'WDV' }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SLM">SLM {hi ? '(सीधी रेखा)' : '(Straight Line)'}</SelectItem>
            <SelectItem value="WDV">WDV {hi ? '(घटती शेष)' : '(Written Down Value)'}</SelectItem>
          </SelectContent>
        </Select>
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
      <Button type="button" variant="outline" onClick={onCancel}>{hi ? 'रद्द' : 'Cancel'}</Button>
      <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
    </div>
  </form>
);

const AssetRegister: React.FC = () => {
  const { language } = useLanguage();
  const { assets, addAsset, updateAsset, deleteAsset, postDepreciation, society } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPosting, setIsPosting] = useState(false);

  const currentFY = society.financialYear;

  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

  // Accumulated depreciation across all FYs up to and including currentFY
  const calcAccumDep = (asset: Asset): number => {
    if (!asset.depreciationRate || !DEP_ACCOUNTS[asset.category]) return 0;
    const fyParts = currentFY.split('-');
    if (fyParts.length !== 2) return 0;
    const fyStartYear = parseInt(fyParts[0]);
    const purchaseYear = new Date(asset.purchaseDate).getFullYear();
    const purchaseMonth = new Date(asset.purchaseDate).getMonth(); // 0-indexed
    // Earliest FY is the one containing the purchase date
    const firstFYStart = purchaseMonth >= 3 ? purchaseYear : purchaseYear - 1;
    let totalDep = 0;
    for (let yr = firstFYStart; yr <= fyStartYear; yr++) {
      const fy = `${yr}-${String(yr + 1).slice(-2)}`;
      const dep = asset.depreciationMethod === 'WDV'
        ? calcWDVDepreciation(asset, fy, totalDep)
        : calcSLMDepreciation(asset, fy);
      totalDep += dep;
      if (totalDep >= asset.cost) { totalDep = asset.cost; break; }
    }
    return Math.round(totalDep * 100) / 100;
  };

  const calcBookValue = (asset: Asset): number => Math.max(0, asset.cost - calcAccumDep(asset));

  // Depreciation for the current financial year only
  const calcCurrentFYDep = (asset: Asset): number => {
    if (!asset.depreciationRate || !DEP_ACCOUNTS[asset.category]) return 0;
    const fyParts = currentFY.split('-');
    if (fyParts.length !== 2) return 0;
    const fyStartYear = parseInt(fyParts[0]);
    // Prior FYs accumulated dep (WDV needs this)
    let priorDep = 0;
    if (asset.depreciationMethod === 'WDV') {
      const purchaseYear = new Date(asset.purchaseDate).getFullYear();
      const purchaseMonth = new Date(asset.purchaseDate).getMonth();
      const firstFYStart = purchaseMonth >= 3 ? purchaseYear : purchaseYear - 1;
      for (let yr = firstFYStart; yr < fyStartYear; yr++) {
        const fy = `${yr}-${String(yr + 1).slice(-2)}`;
        priorDep += calcWDVDepreciation(asset, fy, priorDep);
        if (priorDep >= asset.cost) { priorDep = asset.cost; break; }
      }
    }
    return asset.depreciationMethod === 'WDV'
      ? calcWDVDepreciation(asset, currentFY, priorDep)
      : calcSLMDepreciation(asset, currentFY);
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

  const handlePostDepreciation = () => {
    setIsPosting(true);
    setTimeout(() => {
      const result = postDepreciation();
      setIsPosting(false);
      if (result.posted === 0) {
        toast({ title: hi ? 'कोई ह्रास नहीं जोड़ा गया' : 'No depreciation posted', description: hi ? `${result.skipped} संपत्तियां छोड़ी गईं (पहले से पोस्ट/शून्य दर/भूमि)` : `${result.skipped} assets skipped (already posted / zero rate / Land)` });
      } else {
        toast({ title: hi ? `ह्रास पोस्ट हुआ — ${result.posted} संपत्तियां` : `Depreciation posted — ${result.posted} asset(s)`, description: hi ? `वित्तीय वर्ष ${currentFY} के लिए जर्नल प्रविष्टियां बनाई गईं` : `Journal entries created for FY ${currentFY}` });
      }
    }, 100);
  };

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
      depreciationMethod: form.depreciationMethod,
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
      depreciationMethod: form.depreciationMethod,
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
      depreciationMethod: a.depreciationMethod ?? 'SLM',
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => generateAssetRegisterPDF(assets, society)}>
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-amber-700 border-amber-400 hover:bg-amber-50" onClick={handlePostDepreciation} disabled={isPosting}>
            <RefreshCw className={`h-4 w-4 ${isPosting ? 'animate-spin' : ''}`} />
            {hi ? `ह्रास पोस्ट करें (${currentFY})` : `Post Dep. (${currentFY})`}
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
                <TableHead>{hi ? 'पद्धति' : 'Method'}</TableHead>
                <TableHead>{hi ? 'क्रय तिथि' : 'Purchase Date'}</TableHead>
                <TableHead className="text-right">{hi ? 'लागत' : 'Cost'}</TableHead>
                <TableHead className="text-right">{hi ? 'ह्रास%' : 'Dep%'}</TableHead>
                <TableHead className="text-right">{hi ? `${currentFY} ह्रास` : `${currentFY} Dep.`}</TableHead>
                <TableHead className="text-right">{hi ? 'कुल ह्रास' : 'Acc. Dep.'}</TableHead>
                <TableHead className="text-right">{hi ? 'पुस्तक मूल्य' : 'Book Value'}</TableHead>
                <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {hi ? 'कोई संपत्ति नहीं मिली' : 'No assets found'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(a => {
                  const accumDep   = calcAccumDep(a);
                  const bookValue  = Math.max(0, a.cost - accumDep);
                  const curFYDep   = calcCurrentFYDep(a);
                  const isPostedFY = a.depreciationPostedFY?.includes(currentFY);
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{a.assetNo}</TableCell>
                      <TableCell>
                        <div className="font-medium">{a.name}</div>
                        {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                      </TableCell>
                      <TableCell>{catLabel[a.category]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {a.depreciationMethod ?? 'SLM'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.purchaseDate}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(a.cost)}</TableCell>
                      <TableCell className="text-right">{a.depreciationRate}%</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {curFYDep > 0 ? (
                            <>
                              <span className={isPostedFY ? 'text-green-600 font-medium' : 'text-amber-600'}>{fmt(curFYDep)}</span>
                              {isPostedFY && <CheckCircle className="h-3 w-3 text-green-600" />}
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-amber-600">{fmt(accumDep)}</TableCell>
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
                  <TableCell className="text-right text-amber-600">{fmt(filtered.reduce((s, a) => s + calcCurrentFYDep(a), 0))}</TableCell>
                  <TableCell className="text-right text-amber-600">{fmt(filtered.reduce((s, a) => s + calcAccumDep(a), 0))}</TableCell>
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
          <AssetForm form={form} setForm={setForm} hi={hi} onSubmit={handleAdd} onCancel={() => { setIsAddOpen(false); setForm(EMPTY_FORM); }} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAsset} onOpenChange={open => !open && setEditAsset(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{hi ? 'संपत्ति संपादित करें' : 'Edit Asset'} — {editAsset?.assetNo}</DialogTitle>
          </DialogHeader>
          <AssetForm form={form} setForm={setForm} hi={hi} onSubmit={handleEdit} onCancel={() => setEditAsset(null)} />
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
