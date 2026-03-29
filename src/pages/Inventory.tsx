import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Boxes, Plus, Pencil, Trash2, Search, PackageMinus, PackagePlus, ScanLine, X, FileSpreadsheet, Download } from 'lucide-react';
import { downloadCSV, downloadExcelSingle } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { StockItem, StockMovement } from '@/types';

// ─── Unit definitions ──────────────────────────────────────────────────────────

type UnitKey = 'kg' | 'quintal' | 'liter' | 'piece' | 'bag' | 'other';

const UNITS: { value: UnitKey; label: string; labelHi: string }[] = [
  { value: 'kg', label: 'Kilogram (kg)', labelHi: 'किलोग्राम (kg)' },
  { value: 'quintal', label: 'Quintal', labelHi: 'क्विंटल' },
  { value: 'liter', label: 'Liter', labelHi: 'लीटर' },
  { value: 'piece', label: 'Piece', labelHi: 'नग' },
  { value: 'bag', label: 'Bag', labelHi: 'बोरी' },
  { value: 'other', label: 'Other', labelHi: 'अन्य' },
];

// ─── Movement type badge class ──────────────────────────────────────────────────

const MOVEMENT_BADGE: Record<StockMovement['type'], string> = {
  purchase: 'bg-green-100 text-green-700 border-green-200',
  sale: 'bg-orange-100 text-orange-700 border-orange-200',
  adjustment: 'bg-blue-100 text-blue-700 border-blue-200',
};

// ─── Empty forms ────────────────────────────────────────────────────────────────

const EMPTY_ITEM_FORM = {
  name: '',
  nameHi: '',
  unit: 'kg' as UnitKey,
  openingStock: '',
  purchaseRate: '',
  saleRate: '',
  isActive: true,
  barcodeValue: '',
};

const EMPTY_ADJUSTMENT_FORM = {
  itemId: '',
  qty: '',
  narration: '',
  date: new Date().toISOString().split('T')[0],
};

// ─── ItemForm component (outside Inventory to prevent remount on re-render) ────

interface ItemFormProps {
  itemForm: typeof EMPTY_ITEM_FORM;
  setItemForm: React.Dispatch<React.SetStateAction<typeof EMPTY_ITEM_FORM>>;
  hi: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
}

const ItemForm: React.FC<ItemFormProps> = ({ itemForm, setItemForm, hi, onSubmit, submitLabel, onCancel }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>
          {hi ? 'नाम (अंग्रेजी)' : 'Name (English)'} <span className="text-destructive">*</span>
        </Label>
        <Input
          value={itemForm.name}
          onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Wheat"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'नाम (हिंदी)' : 'Name (Hindi)'}</Label>
        <Input
          value={itemForm.nameHi}
          onChange={e => setItemForm(f => ({ ...f, nameHi: e.target.value }))}
          placeholder="जैसे गेहूं"
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label>
        {hi ? 'इकाई' : 'Unit'} <span className="text-destructive">*</span>
      </Label>
      <Select
        value={itemForm.unit}
        onValueChange={val => setItemForm(f => ({ ...f, unit: val as UnitKey }))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map(u => (
            <SelectItem key={u.value} value={u.value}>
              {hi ? u.labelHi : u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-2">
        <Label>{hi ? 'प्रारंभिक स्टॉक' : 'Opening Stock'}</Label>
        <Input
          type="number"
          min="0"
          value={itemForm.openingStock}
          onChange={e => setItemForm(f => ({ ...f, openingStock: e.target.value }))}
          placeholder="0"
        />
      </div>
      <div className="space-y-2">
        <Label>
          {hi ? 'खरीद दर (₹)' : 'Purchase Rate (₹)'} <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          min="0"
          value={itemForm.purchaseRate}
          onChange={e => setItemForm(f => ({ ...f, purchaseRate: e.target.value }))}
          placeholder="0"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>{hi ? 'बिक्री दर (₹)' : 'Sale Rate (₹)'}</Label>
        <Input
          type="number"
          min="0"
          value={itemForm.saleRate}
          onChange={e => setItemForm(f => ({ ...f, saleRate: e.target.value }))}
          placeholder="0"
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label>{hi ? 'बारकोड / EAN' : 'Barcode / EAN'}</Label>
      <Input
        value={itemForm.barcodeValue}
        onChange={e => setItemForm(f => ({ ...f, barcodeValue: e.target.value }))}
        placeholder="e.g. 8901234567890"
      />
    </div>
    <div className="flex items-center gap-3">
      <Switch
        id="item-active"
        checked={itemForm.isActive}
        onCheckedChange={val => setItemForm(f => ({ ...f, isActive: val }))}
      />
      <Label htmlFor="item-active">{hi ? 'सक्रिय' : 'Active'}</Label>
    </div>
    <div className="flex gap-2 justify-end pt-2">
      <Button variant="outline" type="button" onClick={onCancel}>
        {hi ? 'रद्द करें' : 'Cancel'}
      </Button>
      <Button type="submit">{submitLabel}</Button>
    </div>
  </form>
);

// ─── Barcode scan modal ────────────────────────────────────────────────────────
interface BarcodeScanModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  hi: boolean;
}
const BarcodeScanModal: React.FC<BarcodeScanModalProps> = ({ open, onClose, onDetected, hi }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number>(0);
  const [supported] = React.useState(() => 'BarcodeDetector' in window);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open || !supported) return;
    let detector: any;
    (async () => {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e', 'code_39'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const scan = async () => {
          if (!videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) { onDetected(results[0].rawValue); return; }
          } catch { /* ignore frame errors */ }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (e: any) { setError(e.message || 'Camera error'); }
    })();
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [open, supported, onDetected]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            {hi ? 'बारकोड स्कैन करें' : 'Scan Barcode'}
          </span>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">
          {!supported ? (
            <p className="text-sm text-red-600">{hi ? 'यह ब्राउज़र बारकोड स्कैनिंग का समर्थन नहीं करता। Chrome 83+ उपयोग करें।' : 'BarcodeDetector not supported. Use Chrome 83+ or Edge.'}</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <video ref={videoRef} className="w-full rounded aspect-video bg-black object-cover" muted playsInline />
              <p className="text-xs text-muted-foreground mt-2 text-center">{hi ? 'कैमरे को बारकोड पर रखें' : 'Point camera at barcode to scan'}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

const Inventory: React.FC = () => {
  const { language } = useLanguage();
  const {
    stockItems,
    stockMovements,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    addStockMovement,
  } = useData();
  const { toast } = useToast();
  const hi = language === 'hi';

  // Item tab state
  const [itemSearch, setItemSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | UnitKey>('all');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isItemAddOpen, setIsItemAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);

  // Movement tab state
  const [movDateFrom, setMovDateFrom] = useState('');
  const [movDateTo, setMovDateTo] = useState('');
  const [movItemFilter, setMovItemFilter] = useState('all');
  const [movTypeFilter, setMovTypeFilter] = useState<'all' | StockMovement['type']>('all');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjForm, setAdjForm] = useState(EMPTY_ADJUSTMENT_FORM);

  // Formatters
  const fmt = (amount: number) =>
    new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const fmtDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN');

  // Derived data
  const totalStockValue = stockItems.reduce(
    (sum, item) => sum + (item.currentStock ?? 0) * (item.purchaseRate ?? 0),
    0,
  );
  const lowStockCount = stockItems.filter(item => (item.currentStock ?? 0) < 5).length;

  const filteredItems = stockItems.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.nameHi && item.nameHi.includes(itemSearch)) ||
      item.itemCode.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.barcodeValue && item.barcodeValue.includes(itemSearch));
    const matchUnit = unitFilter === 'all' || item.unit === unitFilter;
    const matchActive = !showActiveOnly || item.isActive;
    return matchSearch && matchUnit && matchActive;
  });

  const filteredMovements = stockMovements.filter(mov => {
    const matchItem = movItemFilter === 'all' || mov.itemId === movItemFilter;
    const matchType = movTypeFilter === 'all' || mov.type === movTypeFilter;
    const matchFrom = !movDateFrom || mov.date >= movDateFrom;
    const matchTo = !movDateTo || mov.date <= movDateTo;
    return matchItem && matchType && matchFrom && matchTo;
  });

  // Helpers
  const getUnitLabel = (unit: string) => {
    const u = UNITS.find(x => x.value === unit);
    return u ? (hi ? u.labelHi : u.label) : unit;
  };

  const getMovTypeLabel = (type: StockMovement['type']) => {
    if (type === 'purchase') return hi ? 'खरीद' : 'Purchase';
    if (type === 'sale') return hi ? 'बिक्री' : 'Sale';
    return hi ? 'समायोजन' : 'Adjustment';
  };

  const getItemName = (itemId: string) => {
    const item = stockItems.find(i => i.id === itemId);
    return item ? (hi && item.nameHi ? item.nameHi : item.name) : '—';
  };

  // Item CRUD handlers
  const resetItemForm = () => setItemForm(EMPTY_ITEM_FORM);

  const openAddItem = () => {
    resetItemForm();
    setIsItemAddOpen(true);
  };

  const openEditItem = (item: StockItem) => {
    setEditItem(item);
    setItemForm({
      name: item.name,
      nameHi: item.nameHi || '',
      unit: (item.unit as UnitKey) || 'kg',
      openingStock: String(item.openingStock ?? ''),
      purchaseRate: String(item.purchaseRate ?? ''),
      saleRate: String(item.saleRate ?? ''),
      isActive: item.isActive ?? true,
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.unit || !itemForm.purchaseRate) {
      toast({
        title: hi ? 'कृपया आवश्यक फ़ील्ड भरें' : 'Please fill required fields',
        variant: 'destructive',
      });
      return;
    }
    addStockItem({
      name: itemForm.name.trim(),
      nameHi: itemForm.nameHi.trim(),
      unit: itemForm.unit,
      openingStock: Number(itemForm.openingStock) || 0,
      currentStock: Number(itemForm.openingStock) || 0,
      purchaseRate: Number(itemForm.purchaseRate) || 0,
      saleRate: Number(itemForm.saleRate) || 0,
      isActive: itemForm.isActive,
      ...(itemForm.barcodeValue.trim() ? { barcodeValue: itemForm.barcodeValue.trim() } : {}),
    });
    toast({ title: hi ? 'वस्तु जोड़ी गई' : 'Item added successfully' });
    resetItemForm();
    setIsItemAddOpen(false);
  };

  const handleEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    if (!itemForm.name.trim()) {
      toast({
        title: hi ? 'नाम आवश्यक है' : 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    updateStockItem(editItem.id, {
      name: itemForm.name.trim(),
      nameHi: itemForm.nameHi.trim(),
      unit: itemForm.unit,
      openingStock: Number(itemForm.openingStock) || 0,
      purchaseRate: Number(itemForm.purchaseRate) || 0,
      saleRate: Number(itemForm.saleRate) || 0,
      isActive: itemForm.isActive,
      barcodeValue: itemForm.barcodeValue.trim() || undefined,
    });
    toast({ title: hi ? 'वस्तु अपडेट की गई' : 'Item updated successfully' });
    setEditItem(null);
    resetItemForm();
  };

  const handleDeleteItem = () => {
    if (!deleteId) return;
    deleteStockItem(deleteId);
    toast({ title: hi ? 'वस्तु हटाई गई' : 'Item deleted' });
    setDeleteId(null);
  };

  // Adjustment handler
  const handleAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.itemId || !adjForm.qty) {
      toast({
        title: hi ? 'वस्तु और मात्रा आवश्यक है' : 'Item and quantity are required',
        variant: 'destructive',
      });
      return;
    }
    const qty = Number(adjForm.qty);
    const item = stockItems.find(i => i.id === adjForm.itemId);
    if (!item) return;
    addStockMovement({
      date: adjForm.date,
      itemId: adjForm.itemId,
      type: 'adjustment',
      qty: Math.abs(qty),
      rate: item.purchaseRate ?? 0,
      amount: Math.abs(qty) * (item.purchaseRate ?? 0),
      referenceNo: '',
      narration: adjForm.narration || (qty >= 0 ? (hi ? 'स्टॉक में वृद्धि' : 'Stock increase') : (hi ? 'स्टॉक में कमी' : 'Stock decrease')),
    });
    // Update current stock
    const newStock = (item.currentStock ?? 0) + qty;
    updateStockItem(item.id, { currentStock: Math.max(0, newStock) });
    toast({ title: hi ? 'समायोजन किया गया' : 'Adjustment recorded' });
    setAdjForm(EMPTY_ADJUSTMENT_FORM);
    setIsAdjustOpen(false);
  };

  const handleCSV = () => {
    const headers = ['Item Code', 'Name', 'Name (Hindi)', 'Unit', 'Opening Stock', 'Current Stock', 'Purchase Rate', 'Sale Rate', 'Stock Value', 'Status', 'Barcode'];
    const rows = filteredItems.map(i => [i.itemCode || '', i.name, i.nameHi || '', i.unit || '', i.openingStock || 0, i.currentStock || 0, i.purchaseRate || 0, i.saleRate || 0, (i.currentStock || 0) * (i.purchaseRate || 0), i.isActive ? 'Active' : 'Inactive', i.barcodeValue || '']);
    downloadCSV(headers, rows, 'inventory.csv');
  };
  const handleExcel = () => {
    const headers = ['Item Code', 'Name', 'Name (Hindi)', 'Unit', 'Opening Stock', 'Current Stock', 'Purchase Rate', 'Sale Rate', 'Stock Value', 'Status', 'Barcode'];
    const rows = filteredItems.map(i => [i.itemCode || '', i.name, i.nameHi || '', i.unit || '', i.openingStock || 0, i.currentStock || 0, i.purchaseRate || 0, i.saleRate || 0, (i.currentStock || 0) * (i.purchaseRate || 0), i.isActive ? 'Active' : 'Inactive', i.barcodeValue || '']);
    downloadExcelSingle(headers, rows, 'inventory.xlsx', 'Inventory');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Boxes className="h-7 w-7 text-accent" />
          {hi ? 'माल भंडार' : 'Inventory'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {hi ? 'स्टॉक वस्तुओं और आवाजाही का प्रबंधन' : 'Manage stock items and movements / माल भंडार'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{hi ? 'कुल वस्तुएं' : 'Total Items'}</p>
                <p className="text-2xl font-bold">{stockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <PackagePlus className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {hi ? 'कुल स्टॉक मूल्य' : 'Total Stock Value'}
                </p>
                <p className="text-xl font-bold text-green-700">{fmt(totalStockValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border', lowStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/30')}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', lowStockCount > 0 ? 'bg-red-100' : 'bg-muted')}>
                <PackageMinus className={cn('h-5 w-5', lowStockCount > 0 ? 'text-red-600' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {hi ? 'कम स्टॉक (<5)' : 'Low Stock (<5)'}
                </p>
                <p className={cn('text-2xl font-bold', lowStockCount > 0 ? 'text-red-700' : '')}>
                  {lowStockCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="mb-4">
          <TabsTrigger value="items">
            {hi ? 'स्टॉक वस्तुएं' : 'Stock Items'}
          </TabsTrigger>
          <TabsTrigger value="movements">
            {hi ? 'स्टॉक आवाजाही' : 'Stock Movements'}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Stock Items ── */}
        <TabsContent value="items" className="space-y-4">
          {/* Filter bar */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 flex gap-2">
                  <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={hi ? 'नाम, कोड या बारकोड से खोजें...' : 'Search by name, code or barcode...'}
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="pl-10"
                  />
                  </div>
                  <Button variant="outline" size="icon" title={hi ? 'बारकोड स्कैन करें' : 'Scan Barcode'} onClick={() => setShowBarcodeScanner(true)}>
                    <ScanLine className="h-4 w-4" />
                  </Button>
                </div>
                <Select
                  value={unitFilter}
                  onValueChange={val => setUnitFilter(val as 'all' | UnitKey)}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder={hi ? 'इकाई फ़िल्टर' : 'Filter by unit'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{hi ? 'सभी इकाइयां' : 'All Units'}</SelectItem>
                    {UNITS.map(u => (
                      <SelectItem key={u.value} value={u.value}>
                        {hi ? u.labelHi : u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    id="active-toggle"
                    checked={showActiveOnly}
                    onCheckedChange={setShowActiveOnly}
                  />
                  <Label htmlFor="active-toggle" className="text-sm cursor-pointer">
                    {hi ? 'केवल सक्रिय' : 'Active only'}
                  </Label>
                </div>
                <Button className="gap-2 shrink-0" onClick={openAddItem}>
                  <Plus className="h-4 w-4" />
                  {hi ? 'नई वस्तु' : 'Add Item'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">
                  {hi ? 'वस्तु सूची' : 'Item List'}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredItems.length} {hi ? 'वस्तुएं' : 'items'})
                  </span>
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={handleExcel}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={handleCSV}>
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {hi ? 'कोई डेटा नहीं' : 'No data available'}
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">{hi ? 'कोड' : 'Item Code'}</TableHead>
                        <TableHead className="font-semibold">{hi ? 'नाम' : 'Name'}</TableHead>
                        <TableHead className="font-semibold">{hi ? 'इकाई' : 'Unit'}</TableHead>
                        <TableHead className="font-semibold text-right">
                          {hi ? 'प्रारंभिक स्टॉक' : 'Opening Stock'}
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          {hi ? 'वर्तमान स्टॉक' : 'Current Stock'}
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          {hi ? 'खरीद दर' : 'Purchase Rate'}
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          {hi ? 'बिक्री दर' : 'Sale Rate'}
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          {hi ? 'स्टॉक मूल्य' : 'Stock Value'}
                        </TableHead>
                        <TableHead className="font-semibold text-center">
                          {hi ? 'स्थिति' : 'Status'}
                        </TableHead>
                        <TableHead className="font-semibold text-center">
                          {hi ? 'क्रियाएं' : 'Actions'}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map(item => {
                        const stockValue = (item.currentStock ?? 0) * (item.purchaseRate ?? 0);
                        const isLow = (item.currentStock ?? 0) < 5;
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {item.itemCode}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.nameHi && (
                                  <p className="text-xs text-muted-foreground">{item.nameHi}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {getUnitLabel(item.unit)}
                            </TableCell>
                            <TableCell className="text-right">{item.openingStock ?? 0}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  'font-semibold',
                                  isLow ? 'text-red-600' : 'text-foreground',
                                )}
                              >
                                {item.currentStock ?? 0}
                                {isLow && (
                                  <span className="ml-1 text-xs text-red-500">
                                    {hi ? '(कम)' : '(Low)'}
                                  </span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{fmt(item.purchaseRate ?? 0)}</TableCell>
                            <TableCell className="text-right">{fmt(item.saleRate ?? 0)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {fmt(stockValue)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={item.isActive ? 'default' : 'secondary'}
                                className={item.isActive ? 'bg-green-500 text-white text-xs' : 'text-xs'}
                              >
                                {item.isActive
                                  ? (hi ? 'सक्रिय' : 'Active')
                                  : (hi ? 'निष्क्रिय' : 'Inactive')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditItem(item)}
                                  title={hi ? 'संपादित करें' : 'Edit'}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteId(item.id)}
                                  title={hi ? 'हटाएं' : 'Delete'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Stock Movements ── */}
        <TabsContent value="movements" className="space-y-4">
          {/* Movement filters */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
                <div className="flex gap-2 items-center">
                  <Label className="shrink-0 text-sm">{hi ? 'तिथि से' : 'From'}</Label>
                  <Input
                    type="date"
                    value={movDateFrom}
                    onChange={e => setMovDateFrom(e.target.value)}
                    className="w-36"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Label className="shrink-0 text-sm">{hi ? 'तिथि तक' : 'To'}</Label>
                  <Input
                    type="date"
                    value={movDateTo}
                    onChange={e => setMovDateTo(e.target.value)}
                    className="w-36"
                  />
                </div>
                <Select value={movItemFilter} onValueChange={setMovItemFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder={hi ? 'वस्तु चुनें' : 'Select item'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{hi ? 'सभी वस्तुएं' : 'All Items'}</SelectItem>
                    {stockItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {hi && item.nameHi ? item.nameHi : item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={movTypeFilter}
                  onValueChange={val => setMovTypeFilter(val as 'all' | StockMovement['type'])}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder={hi ? 'प्रकार चुनें' : 'Type'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{hi ? 'सभी प्रकार' : 'All Types'}</SelectItem>
                    <SelectItem value="purchase">{hi ? 'खरीद' : 'Purchase'}</SelectItem>
                    <SelectItem value="sale">{hi ? 'बिक्री' : 'Sale'}</SelectItem>
                    <SelectItem value="adjustment">{hi ? 'समायोजन' : 'Adjustment'}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  className="gap-2 shrink-0 ml-auto"
                  onClick={() => {
                    setAdjForm(EMPTY_ADJUSTMENT_FORM);
                    setIsAdjustOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {hi ? 'मैनुअल समायोजन' : 'Manual Adjustment'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Movements Table */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">
                {hi ? 'स्टॉक आवाजाही' : 'Stock Movements'}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredMovements.length} {hi ? 'प्रविष्टियां' : 'entries'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredMovements.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {hi ? 'कोई डेटा नहीं' : 'No data available'}
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">{hi ? 'तिथि' : 'Date'}</TableHead>
                        <TableHead className="font-semibold">{hi ? 'संदर्भ नं.' : 'Reference'}</TableHead>
                        <TableHead className="font-semibold">{hi ? 'वस्तु' : 'Item Name'}</TableHead>
                        <TableHead className="font-semibold text-center">{hi ? 'प्रकार' : 'Type'}</TableHead>
                        <TableHead className="font-semibold text-right">{hi ? 'मात्रा' : 'Qty'}</TableHead>
                        <TableHead className="font-semibold text-right">{hi ? 'दर' : 'Rate'}</TableHead>
                        <TableHead className="font-semibold text-right">{hi ? 'राशि' : 'Amount'}</TableHead>
                        <TableHead className="font-semibold">{hi ? 'विवरण' : 'Narration'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map(mov => (
                        <TableRow key={mov.id} className="hover:bg-muted/30">
                          <TableCell className="whitespace-nowrap text-sm">
                            {fmtDate(mov.date)}
                          </TableCell>
                          <TableCell>
                            {mov.referenceNo ? (
                              <Badge variant="outline" className="font-mono text-xs">
                                {mov.referenceNo}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{getItemName(mov.itemId)}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', MOVEMENT_BADGE[mov.type])}
                            >
                              {getMovTypeLabel(mov.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{mov.qty}</TableCell>
                          <TableCell className="text-right">{fmt(mov.rate ?? 0)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(mov.amount ?? 0)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                            {mov.narration || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog
        open={isItemAddOpen}
        onOpenChange={o => {
          setIsItemAddOpen(o);
          if (!o) resetItemForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'नई स्टॉक वस्तु जोड़ें' : 'Add New Stock Item'}</DialogTitle>
            <DialogDescription>
              {hi ? 'वस्तु का विवरण भरें' : 'Fill in the item details'}
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            itemForm={itemForm}
            setItemForm={setItemForm}
            hi={hi}
            onSubmit={handleAddItem}
            submitLabel={hi ? 'सहेजें' : 'Save'}
            onCancel={() => {
              setIsItemAddOpen(false);
              resetItemForm();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={!!editItem}
        onOpenChange={o => {
          if (!o) {
            setEditItem(null);
            resetItemForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hi ? 'वस्तु संपादित करें' : 'Edit Stock Item'}</DialogTitle>
            <DialogDescription>
              {hi ? 'वस्तु का विवरण अपडेट करें' : 'Update item details'}
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            itemForm={itemForm}
            setItemForm={setItemForm}
            hi={hi}
            onSubmit={handleEditItem}
            submitLabel={hi ? 'अपडेट करें' : 'Update'}
            onCancel={() => {
              setEditItem(null);
              resetItemForm();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Manual Adjustment Dialog */}
      <Dialog
        open={isAdjustOpen}
        onOpenChange={o => {
          setIsAdjustOpen(o);
          if (!o) setAdjForm(EMPTY_ADJUSTMENT_FORM);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hi ? 'मैनुअल स्टॉक समायोजन' : 'Manual Stock Adjustment'}</DialogTitle>
            <DialogDescription>
              {hi
                ? 'सकारात्मक मात्रा = स्टॉक बढ़ाएं, नकारात्मक = घटाएं'
                : 'Positive qty = increase stock, Negative = decrease'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustment} className="space-y-4">
            <div className="space-y-2">
              <Label>
                {hi ? 'वस्तु चुनें' : 'Select Item'} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={adjForm.itemId}
                onValueChange={val => setAdjForm(f => ({ ...f, itemId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={hi ? 'वस्तु चुनें' : 'Choose item'} />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {hi && item.nameHi ? item.nameHi : item.name} ({item.itemCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{hi ? 'तिथि' : 'Date'}</Label>
                <Input
                  type="date"
                  value={adjForm.date}
                  onChange={e => setAdjForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {hi ? 'मात्रा (+/-)' : 'Quantity (+/-)'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={adjForm.qty}
                  onChange={e => setAdjForm(f => ({ ...f, qty: e.target.value }))}
                  placeholder={hi ? 'जैसे 10 या -5' : 'e.g. 10 or -5'}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{hi ? 'विवरण' : 'Narration'}</Label>
              <Input
                value={adjForm.narration}
                onChange={e => setAdjForm(f => ({ ...f, narration: e.target.value }))}
                placeholder={hi ? 'समायोजन का कारण...' : 'Reason for adjustment...'}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsAdjustOpen(false);
                  setAdjForm(EMPTY_ADJUSTMENT_FORM);
                }}
              >
                {hi ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button type="submit">{hi ? 'सहेजें' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hi ? 'क्या आप वाकई हटाना चाहते हैं?' : 'Are you sure you want to delete?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hi
                ? 'यह वस्तु स्थायी रूप से हटा दी जाएगी। यह क्रिया पूर्ववत नहीं की जा सकती।'
                : 'This item will be permanently deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hi ? 'रद्द करें' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteItem}
            >
              {hi ? 'हटाएं' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Barcode scanner modal */}
      <BarcodeScanModal
        open={showBarcodeScanner}
        hi={hi}
        onClose={() => setShowBarcodeScanner(false)}
        onDetected={code => {
          setShowBarcodeScanner(false);
          setItemSearch(code);
          toast({ title: hi ? `बारकोड मिला: ${code}` : `Barcode detected: ${code}` });
        }}
      />
    </div>
  );
};

export default Inventory;
