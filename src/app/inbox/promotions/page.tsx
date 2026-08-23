'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Upload, FileJson, Search, Package, X, Send, Check, RefreshCw,
  ShoppingBag, Zap, Tag, Sparkles, TrendingUp, Loader2,
  LayoutGrid, List,
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
import { cnyProductsToCsvProducts } from '@/lib/cny-catalog';
import {
  selectedProductToPreviewProduct,
  type Product,
} from '@/types/product-catalog';
import type { ExportPreviewProduct } from '@/lib/flex-builder';
import type { CsvProduct } from '@/lib/csv-product';

// ─── Types ───────────────────────────────────────────────────────────────────
type SourceTab = 'csv' | 'json';
type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'flashsale' | 'promotion' | 'new' | 'bestseller';

const CNY_CATALOG_CACHE_KEY = 'inbox-promotions-cny-catalog-cache-v2';

const CATALOG_FILTERS: { key: FilterType; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { key: 'all', label: 'ทั้งหมด', icon: Package, color: 'text-gray-700', bg: 'bg-gray-100' },
  { key: 'flashsale', label: 'Flash Sale', icon: Zap, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'promotion', label: 'โปรโมชั่น', icon: Tag, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'new', label: 'สินค้าใหม่', icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'bestseller', label: 'ขายดี', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
];

// ─── View Toggle ─────────────────────────────────────────────────────────────
function ViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex rounded-lg border bg-gray-50 p-0.5 gap-0.5">
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
          viewMode === 'grid' ? 'bg-white shadow text-green-700 border border-green-200' : 'text-gray-500 hover:text-gray-700'
        )}
        title="มุมมองตาราง"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
          viewMode === 'list' ? 'bg-white shadow text-green-700 border border-green-200' : 'text-gray-500 hover:text-gray-700'
        )}
        title="มุมมองรายการ"
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}

// ─── CSV Product List Row ─────────────────────────────────────────────────────
function CsvProductListRow({
  product,
  selected,
  onToggle,
}: {
  product: CsvProduct;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      onClick={onToggle}
      className={cn(
        'cursor-pointer transition-colors hover:bg-gray-50',
        selected ? 'bg-green-50' : ''
      )}
    >
      <td className="px-3 py-2">
        <div className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          selected ? 'bg-green-500 border-green-500' : 'border-gray-300'
        )}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
      </td>
      <td className="px-2 py-1.5">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="w-10 h-10 object-contain rounded border border-gray-100 bg-gray-50"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-10 h-10 rounded border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-300">
            <Package className="w-4 h-4" />
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 font-mono whitespace-nowrap">{product.sku}</td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-blue-700 line-clamp-2 leading-snug">{product.productName}</span>
          {product.specName && <span className="text-[10px] text-gray-400">{product.specName}</span>}
          {product.offerHeader && (
            <span className="inline-flex w-fit text-[9px] bg-red-100 text-red-600 rounded px-1 font-bold">{product.offerHeader}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-400 text-center">—</td>
      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <span>{product.priceUnit || '—'}</span>
          <span className="text-red-600 font-semibold">{product.pricePerUnit}</span>
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-400 text-center">—</td>
      <td className="px-3 py-2 text-xs text-gray-400 text-center">—</td>
    </tr>
  );
}

// ─── CSV Product Grid ─────────────────────────────────────────────────────────
function CsvProductGrid({
  onSelectionChange,
  viewMode,
}: {
  onSelectionChange: (products: ExportPreviewProduct[]) => void;
  viewMode: ViewMode;
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

      {viewMode === 'grid' ? (
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
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-3 py-2 text-left">
                  <button
                    onClick={() => {
                      const allSkus = new Set(filtered.map(p => p.sku));
                      const allSelected = filtered.every(p => selectedSkus.has(p.sku));
                      setSelectedSkus(prev => {
                        const next = new Set(prev);
                        if (allSelected) filtered.forEach(p => next.delete(p.sku));
                        else filtered.forEach(p => next.add(p.sku));
                        onSelectionChange(products.filter(p => next.has(p.sku)).map(csvProductToPreviewProduct));
                        return next;
                      });
                    }}
                    className="text-gray-400 hover:text-green-600 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th className="w-14 px-2 py-2"></th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">รหัสสินค้า</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">ชื่อสินค้า</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">คงคลัง</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">หน่วย 1</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">หน่วย 2</th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">หน่วย 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((product) => (
                <CsvProductListRow
                  key={product.sku}
                  product={product}
                  selected={selectedSkus.has(product.sku)}
                  onToggle={() => toggle(product.sku, product)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── JSON Product List Row ────────────────────────────────────────────────────
function JsonProductListRow({
  product,
  selected,
  onToggle,
}: {
  product: Product;
  selected: boolean;
  onToggle: () => void;
}) {
  const data = product.product_data?.[0];
  if (!data) return null;
  const photo = product.product_photo?.[0];
  const imageUrl = photo ? `https://www.cnypharmacy.com/${photo.photo_path}` : '';
  const units = product.product_unit ?? [];
  const totalStock = (product.product_stock ?? []).reduce(
    (sum, s) => sum + (parseFloat(s.stock_num) || 0), 0
  );
  const price = product.product_price?.[0]?.product_price?.[0];
  const displayPrice = price?.promotion_price !== '0.00' ? parseFloat(price?.promotion_price ?? '0') : parseFloat(price?.price ?? '0');

  return (
    <tr
      onClick={onToggle}
      className={cn('cursor-pointer transition-colors hover:bg-gray-50', selected ? 'bg-green-50' : '')}
    >
      <td className="px-3 py-2">
        <div className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          selected ? 'bg-green-500 border-green-500' : 'border-gray-300'
        )}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
      </td>
      <td className="px-2 py-1.5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={data.name}
            className="w-10 h-10 object-contain rounded border border-gray-100 bg-gray-50"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-10 h-10 rounded border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-300">
            <Package className="w-4 h-4" />
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 font-mono whitespace-nowrap">{data.sku}</td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-blue-700 line-clamp-2 leading-snug">{data.name}</span>
          {data.spec_name && <span className="text-[10px] text-gray-400">{data.spec_name}</span>}
          <div className="flex gap-1 flex-wrap">
            {data.is_promotion === 1 && <span className="text-[9px] bg-orange-100 text-orange-600 rounded px-1 font-bold">โปรโมชัน</span>}
            {product.product_is_flashSale === 1 && <span className="text-[9px] bg-red-100 text-red-600 rounded px-1 font-bold">Flash Sale</span>}
            {data.is_bestseller === 1 && <span className="text-[9px] bg-green-100 text-green-700 rounded px-1 font-bold">ขายดี</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-center">
        <span className={cn(
          'font-semibold',
          totalStock <= 0 ? 'text-red-500' : totalStock < 10 ? 'text-orange-500' : 'text-gray-700'
        )}>
          {totalStock > 0 ? totalStock.toLocaleString() : '0'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
        {units[0] ? (
          <div className="flex flex-col">
            <span className="font-medium">{units[0].unit}</span>
            {displayPrice > 0 && <span className="text-red-600 text-[10px]">฿{displayPrice.toLocaleString()}</span>}
          </div>
        ) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 text-center whitespace-nowrap">
        {units[1] ? (
          <div className="flex flex-col items-center">
            <span className="font-medium">{units[1].unit}</span>
            {units[1].contain && <span className="text-[10px] text-gray-400">{units[1].contain}</span>}
          </div>
        ) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 text-center whitespace-nowrap">
        {units[2] ? (
          <div className="flex flex-col items-center">
            <span className="font-medium">{units[2].unit}</span>
            {units[2].contain && <span className="text-[10px] text-gray-400">{units[2].contain}</span>}
          </div>
        ) : '—'}
      </td>
    </tr>
  );
}

// ─── JSON Catalog Grid ────────────────────────────────────────────────────────
function JsonCatalogGrid({
  onSelectionChange,
  viewMode,
}: {
  onSelectionChange: (products: ExportPreviewProduct[]) => void;
  viewMode: ViewMode;
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

          {viewMode === 'grid' ? (
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

                const csvShape: CsvProduct = {
                  productUrl: `https://www.cnypharmacy.com/product/${data.sku}`,
                  imageUrl: photo ? `https://www.cnypharmacy.com/${photo.photo_path}` : '',
                  offerHeader: product.product_is_flashSale === 1 ? 'FLASH SALE' : data.is_promotion === 1 ? 'PROMOTION' : '',
                  offerStart: '', offerEnd: '', skuLabel: 'SKU',
                  sku: data.sku, productName: data.name,
                  promoCond1: '', promoCond2: '',
                  priceUnit: product.product_unit?.[0]?.unit ?? '',
                  pricePerUnit: `฿${displayPrice.toLocaleString()}`,
                  btnLabel: 'ดูรายละเอียด',
                  priceAfterDiscount: hasDiscount ? `ราคาเดิม ฿${originalPrice.toLocaleString()}` : '',
                  minQtyLabel: '', maxQtyLabel: '',
                  priceNumber: String(displayPrice),
                  specName: data.spec_name ?? '',
                  bulkPrice: '', bulkUnit: '',
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
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-10 px-3 py-2 text-left">
                      <button
                        onClick={() => {
                          const allSelected = filtered.every(p => selectedIds.has(p.product_data?.[0]?.id ?? -1));
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (allSelected) filtered.forEach(p => { const id = p.product_data?.[0]?.id; if (id) next.delete(id); });
                            else filtered.forEach(p => { const id = p.product_data?.[0]?.id; if (id) next.add(id); });
                            onSelectionChange(products.filter(p => next.has(p.product_data?.[0]?.id ?? -1)).map(p => selectedProductToPreviewProduct(p, 1, p.product_unit?.[0])));
                            return next;
                          });
                        }}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="w-14 px-2 py-2"></th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">รหัสสินค้า</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">ชื่อสินค้า</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">คงคลัง</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">หน่วย 1</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">หน่วย 2</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">หน่วย 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((product) => {
                    const data = product.product_data?.[0];
                    if (!data) return null;
                    return (
                      <JsonProductListRow
                        key={data.id}
                        product={product}
                        selected={selectedIds.has(data.id)}
                        onToggle={() => toggleProduct(product)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
function CnyCatalogGrid({
  onSelectionChange,
  viewMode,
}: {
  onSelectionChange: (products: ExportPreviewProduct[]) => void;
  viewMode: ViewMode;
}) {
  const [products, setProducts] = useState<CsvProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CNY_CATALOG_CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as { products?: CsvProduct[]; fetchedAt?: string };
      if (Array.isArray(parsed.products)) {
        setProducts(parsed.products);
        setLastFetchedAt(parsed.fetchedAt || null);
      }
    } catch {
      localStorage.removeItem(CNY_CATALOG_CACHE_KEY);
    }
  }, []);

  const fetchLatestProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inbox/catalog/cny-products?group=0&paginate_num=25', {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.product)) {
        throw new Error(payload.error || 'ไม่สามารถดึงสินค้า CNY ได้');
      }

      const nextProducts = cnyProductsToCsvProducts(payload.product as Product[]);
      const fetchedAt = payload.meta?.fetchedAt || new Date().toISOString();
      setProducts(nextProducts);
      setSelectedSkus(new Set());
      setLastFetchedAt(fetchedAt);
      onSelectionChange([]);
      localStorage.setItem(
        CNY_CATALOG_CACHE_KEY,
        JSON.stringify({ products: nextProducts, fetchedAt })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถดึงสินค้า CNY ได้');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.specName.toLowerCase().includes(q)
    );
  }, [products, search]);

  const toggleProduct = useCallback(
    (sku: string) => {
      setSelectedSkus((prev) => {
        const next = new Set(prev);
        if (next.has(sku)) next.delete(sku);
        else next.add(sku);

        const preview = products
          .filter((p) => next.has(p.sku))
          .map(csvProductToPreviewProduct);
        onSelectionChange(preview);
        return next;
      });
    },
    [products, onSelectionChange]
  );

  return (
    <div className="space-y-4">
      <Card className="border-gray-200">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">แคตตาล็อค CNY</p>
            <p className="text-xs text-gray-500">
              เก็บ cache ไว้ในเครื่องนี้จนกว่าจะกดดึงสินค้าใหม่
              {lastFetchedAt && (
                <span className="ml-1">
                  · ล่าสุด {new Date(lastFetchedAt).toLocaleString('th-TH')}
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLatestProducts} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            ดึงสินค้า
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="text-sm py-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {products.length > 0 && (
        <>
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

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((product) => (
                <ProductCard
                  key={product.sku}
                  product={product}
                  selected={selectedSkus.has(product.sku)}
                  onToggle={() => toggleProduct(product.sku)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-10 px-3 py-2 text-left">
                      <button
                        onClick={() => {
                          const allSelected = filtered.every((p) => selectedSkus.has(p.sku));
                          setSelectedSkus((prev) => {
                            const next = new Set(prev);
                            if (allSelected) filtered.forEach((p) => next.delete(p.sku));
                            else filtered.forEach((p) => next.add(p.sku));
                            onSelectionChange(products.filter((p) => next.has(p.sku)).map(csvProductToPreviewProduct));
                            return next;
                          });
                        }}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    <th className="w-14 px-2 py-2"></th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">รหัสสินค้า</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">ชื่อสินค้า</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">คงคลัง</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600">หน่วย 1</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">หน่วย 2</th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-600">หน่วย 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((product) => (
                    <CsvProductListRow
                      key={product.sku}
                      product={product}
                      selected={selectedSkus.has(product.sku)}
                      onToggle={() => toggleProduct(product.sku)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {products.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <FileJson className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">กดดึงสินค้าเพื่อโหลดแคตตาล็อคจาก CNY</p>
        </div>
      )}
    </div>
  );
}

export default function PromotionsPage() {
  const [sourceTab, setSourceTab] = useState<SourceTab>('csv');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
          {/* Tab selector + View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-gray-50 p-0.5 gap-0.5">
              {([
                { key: 'csv' as const, label: 'โปรโมชัน CSV', icon: Tag },
                { key: 'json' as const, label: 'แคตตาล็อค CNY', icon: FileJson },
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
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4 pb-24">
        {sourceTab === 'csv' && (
          <CsvProductGrid onSelectionChange={setCsvSelected} viewMode={viewMode} />
        )}
        {sourceTab === 'json' && (
          <CnyCatalogGrid onSelectionChange={setJsonSelected} viewMode={viewMode} />
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
