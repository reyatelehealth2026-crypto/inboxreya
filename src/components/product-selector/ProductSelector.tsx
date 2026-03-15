'use client';

import { useState, useMemo } from 'react';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProductCard } from './ProductCard';
import { FlexExportPanel } from './FlexExportPanel';
import { useCsvProducts } from './hooks/useCsvProducts';

export function ProductSelector() {
  const { products, loading, error } = useCsvProducts();
  const [search, setSearch] = useState('');
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const term = search.toLowerCase();
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
    );
  }, [products, search]);

  const selectedProducts = useMemo(() => {
    return products.filter((p) => selectedSkus.has(p.sku));
  }, [products, selectedSkus]);

  const toggleProduct = (sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">กำลังโหลดสินค้า...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold">เลือกสินค้า</h2>
          <span className="text-sm text-slate-500">({selectedProducts.length} รายการ)</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="ค้นหาสินค้าหรือรหัส SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.sku}
              product={product}
              selected={selectedSkus.has(product.sku)}
              onToggle={() => toggleProduct(product.sku)}
            />
          ))}
        </div>

        {/* Export Panel */}
        <div className="space-y-4">
          {selectedProducts.length > 0 ? (
            <FlexExportPanel selectedProducts={selectedProducts} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-500">เลือกสินค้าเพื่อสร้าง Flex Message</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
