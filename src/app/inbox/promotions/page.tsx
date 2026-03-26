'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Upload, FileJson, Search, Package, X, Send, Check, RefreshCw,
  ShoppingBag, Zap, Tag, Sparkles, TrendingUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/product-selector/ProductCard';
import { useCsvProducts } from '@/components/product-selector/hooks/useCsvProducts';
import { SendCatalogDialog } from '@/components/inbox/SendCatalogDialog';
import { csvProductToPreviewProduct } from '@/lib/flex-builder';
import {
  selectedProductToPreviewProduct,
  type Product,
} from '@/types/product-catalog';
import type { ExportPreviewProduct } from '@/lib/flex-builder';
import type { CsvProduct } from '@/lib/csv-product';

// ─── Types ───────────────────────────────────────────────────────────────────
type SourceTab = 'csv' | 'json';
type FilterType = 'all' | 'flashsale' | 'promotion' | 'new' | 'bestseller';

const CATALOG_FILTERS: { key: FilterType; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { key: 'all', label: 'ทั้งหมด', icon: Package, color: 'text-gray-700', bg: 'bg-gray-100' },
  { key: 'flashsale', label: 'Flash Sale', icon: Zap, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'promotion', label: 'โปรโมชั่น', icon: Tag, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'new', label: 'สินค้าใหม่', icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'bestseller', label: 'ขายดี', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
];

// ─── CSV Product Grid ─────────────────────────────────────────────────────────
function CsvProductGrid({
  onSelectionChange,
}: {
  onSelectionChange: (products: ExportPreviewProduct[]) => void;
}) {
  const { products, loading, error } = useCsvProducts();
  const [search, setSearch] = useState('');
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.toLowerCase();
    return products.filter(
      (p) => p.productName.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  }, [products, search]);

  const toggle = useCallback(
    (sku: string, product: CsvProduct) => {
      setSelectedSkus((prev) => {
        const next = new Set(prev);
        if (next.has(sku)) next.delete(sku);
        else next.add(sku);

        const newSelected = products
          .filter((p) => next.has(p.sku))
          .map(csvProductToPreviewProduct);
        onSelectionChange(newSelected);
        return next;
      });
    },
    [products, onSelectionChange]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-500">กำลังโหลดสินค้า...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="ค้นหาสินค้าหรือรหัส SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      <p className="text-sm text-gray-500">
        พบ <strong>{filtered.length}</strong> รายการ
        {selectedSkus.size > 0 && (
          <span className="ml-2 text-green-600">
            | เลือกแล้ว <strong>{selectedSkus.size}</strong> รายการ
          </span>
        )}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((product) => (
          <ProductCard
            key={product.sku}
            product={product}
            selected={selectedSkus.has(product.sku)}
            onToggle={() => toggle(product.sku, product)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── JSON Catalog Grid ────────────────────────────────────────────────────────
function JsonCatalogGrid({
  onSelectionChange,
}: {
  onSelectionChange: (products: ExportPreviewProduct[]) => void;
}) {
  const [jsonInput, setJsonInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const handleJsonInput = (value: string) => {
    setJsonInput(value);
    setParseError(null);
    if (!value.trim()) { setProducts([]); return; }
    try {
      const parsed = JSON.parse(value);
      const list: Product[] = parsed.product && Array.isArray(parsed.product)
        ? parsed.product
        : Array.isArray(parsed) ? parsed : null;
      if (!list) { setParseError('ต้องการ property "product" ที่เป็น array'); setProducts([]); return; }
      setProducts(list);
      setSelectedIds(new Set());
      onSelectionChange([]);
    } catch (err) {
      setParseError('JSON ไม่ถูกต้อง: ' + (err as Error).message);
      setProducts([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      handleJsonInput(text);
    } catch (err) {
      setParseError('ไม่สามารถอ่านไฟล์: ' + (err as Error).message);
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const data = p.product_data?.[0];
      if (!data) return false;
      const q = search.toLowerCase();
      if (q && !data.name?.toLowerCase().includes(q) && !data.sku?.toLowerCase().includes(q)) return false;
      switch (activeFilter) {
        case 'flashsale': return p.product_is_flashSale === 1 || data.is_promotion === 1;
        case 'promotion': return data.is_promotion === 1;
        case 'new': return p.product_is_recommend === 1 || p.product_is_flashSale === 1;
        case 'bestseller': return data.is_bestseller === 1 || (p.customer_buyed ?? 0) > 0;
        default: return true;
      }
    });
  }, [products, search, activeFilter]);

  const toggleProduct = useCallback(
    (product: Product) => {
      const id = product.product_data?.[0]?.id;
      if (!id) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        const preview = products
          .filter((p) => next.has(p.product_data?.[0]?.id ?? -1))
          .map((p) => selectedProductToPreviewProduct(p, 1, p.product_unit?.[0]));
        onSelectionChange(preview);
        return next;
      });
    },
    [products, onSelectionChange]
  );

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <Card className="border-gray-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" accept=".json" id="json-upload-promo" className="hidden" onChange={handleFileUpload} />
            <label htmlFor="json-upload-promo">
              <Button variant="outline" size="sm" asChild className="cursor-pointer">
                <span>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  อัปโหลด JSON
                </span>
              </Button>
            </label>
            <Button variant="outline" size="sm" onClick={() => { setJsonInput(''); setProducts([]); setSelectedIds(new Set()); onSelectionChange([]); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> ล้าง
            </Button>
            <span className="text-xs text-gray-500">หรือวาง JSON ด้านล่าง</span>
          </div>
          {parseError && (
            <Alert variant="destructive" className="text-sm py-2">
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
          <Textarea
            value={jsonInput}
            onChange={(e) => handleJsonInput(e.target.value)}
            placeholder='วาง JSON ที่มี property "product": [...] หรือเป็น array โดยตรง'
            className="min-h-[100px] font-mono text-xs"
          />
          {products.length > 0 && (
            <p className="text-xs text-green-600">✓ โหลด <strong>{products.length}</strong> สินค้า</p>
          )}
        </CardContent>
      </Card>

      {products.length > 0 && (
        <>
          {/* Filters + Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหาสินค้า (ชื่อ, SKU...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {CATALOG_FILTERS.map(({ key, label, icon: Icon, color, bg }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    activeFilter === key ? cn(color, bg, 'ring-2 ring-offset-1 ring-current') : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-500">
            พบ <strong>{filtered.length}</strong> รายการ
            {selectedIds.size > 0 && (
              <span className="ml-2 text-green-600">| เลือกแล้ว <strong>{selectedIds.size}</strong></span>
            )}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((product) => {
              const data = product.product_data?.[0];
              if (!data) return null;
              const price = product.product_price?.[0]?.product_price?.[0];
              const photo = product.product_photo?.[0];
              const selected = selectedIds.has(data.id);
              const displayPrice = price?.promotion_price !== '0.00' ? parseFloat(price?.promotion_price ?? '0') : parseFloat(price?.price ?? '0');
              const originalPrice = parseFloat(price?.price ?? '0');
              const hasDiscount = displayPrice < originalPrice && originalPrice > 0;

              // Build a CsvProduct-compatible shape for ProductCard
              const csvShape: CsvProduct = {
                productUrl: `https://www.cnypharmacy.com/product/${data.sku}`,
                imageUrl: photo ? `https://www.cnypharmacy.com/${photo.photo_path}` : '',
                offerHeader: product.product_is_flashSale === 1 ? 'FLASH SALE' : data.is_promotion === 1 ? 'PROMOTION' : '',
                offerStart: '',
                offerEnd: '',
                skuLabel: 'SKU',
                sku: data.sku,
                productName: data.name,
                promoCond1: '',
                promoCond2: '',
                priceUnit: product.product_unit?.[0]?.unit ?? '',
                pricePerUnit: `฿${displayPrice.toLocaleString()}`,
                btnLabel: 'ดูรายละเอียด',
                priceAfterDiscount: hasDiscount ? `ราคาเดิม ฿${originalPrice.toLocaleString()}` : '',
                minQtyLabel: '',
                maxQtyLabel: '',
                priceNumber: String(displayPrice),
                specName: data.spec_name ?? '',
                bulkPrice: '',
                bulkUnit: '',
              };

              return (
                <ProductCard
                  key={data.id}
                  product={csvShape}
                  selected={selected}
                  onToggle={() => toggleProduct(product)}
                />
              );
            })}
          </div>
        </>
      )}

      {products.length === 0 && !parseError && (
        <div className="text-center py-16 text-gray-400">
          <FileJson className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">อัปโหลดหรือวาง JSON เพื่อแสดงสินค้า</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PromotionsPage() {
  const [sourceTab, setSourceTab] = useState<SourceTab>('csv');
  const [csvSelected, setCsvSelected] = useState<ExportPreviewProduct[]>([]);
  const [jsonSelected, setJsonSelected] = useState<ExportPreviewProduct[]>([]);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const selectedProducts = sourceTab === 'csv' ? csvSelected : jsonSelected;
  const selectedCount = selectedProducts.length;

  const clearSelection = () => {
    if (sourceTab === 'csv') setCsvSelected([]);
    else setJsonSelected([]);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center text-white shadow">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 leading-none">แคตตาล็อค & โปรโมชัน</h1>
            <p className="text-xs text-gray-500 mt-0.5">เลือกสินค้าแล้วส่ง Flex Message ไปยัง LINE</p>
          </div>
          {/* Tab selector in header */}
          <div className="flex rounded-lg border bg-gray-50 p-0.5 gap-0.5">
            {([
              { key: 'csv' as const, label: 'โปรโมชัน CSV', icon: Tag },
              { key: 'json' as const, label: 'แคตตาล็อค JSON', icon: FileJson },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSourceTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  sourceTab === key
                    ? 'bg-white shadow text-green-700 border border-green-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4 pb-24">
        {sourceTab === 'csv' && (
          <CsvProductGrid onSelectionChange={setCsvSelected} />
        )}
        {sourceTab === 'json' && (
          <JsonCatalogGrid onSelectionChange={setJsonSelected} />
        )}
      </div>

      {/* Floating action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
          <div className="bg-white rounded-full shadow-lg border px-4 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
              {selectedCount}
            </div>
            <span className="text-sm font-medium text-gray-700">รายการที่เลือก</span>
            <button
              onClick={clearSelection}
              className="w-5 h-5 rounded-full hover:bg-red-50 hover:text-red-500 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-full px-6"
            onClick={() => setShowSendDialog(true)}
          >
            <Send className="w-5 h-5 mr-2" />
            ส่งไปยัง LINE
          </Button>
        </div>
      )}

      {/* Send dialog */}
      <SendCatalogDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        products={selectedProducts}
        defaultConfig={{
          template: sourceTab === 'csv' ? 'promotion' : 'product_catalog',
        }}
      />
    </div>
  );
}
