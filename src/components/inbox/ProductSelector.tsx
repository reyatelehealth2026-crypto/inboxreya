'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  Share2, 
  Package,
  Check,
  Zap,
  Tag,
  Sparkles,
  TrendingUp,
  X,
  Copy,
  Download,
  Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  generateFlexCarousel,
  generateFlexMessageByTemplate,
  selectedProductToPreviewProduct,
  type Product,
  type ProductUnit,
  type SelectedProduct,
  type FlexMessageTemplate,
} from '@/types/product-catalog';
import { SendCatalogDialog } from './SendCatalogDialog';

interface ProductSelectorProps {
  products: Product[];
  className?: string;
}

type FilterType = 'all' | 'flashsale' | 'promotion' | 'new' | 'bestseller';
type ViewMode = 'grid' | 'compact';

const FILTERS: { key: FilterType; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { key: 'all', label: 'ทั้งหมด', icon: Package, color: 'text-gray-700', bgColor: 'bg-gray-100' },
  { key: 'flashsale', label: 'Flash Sale', icon: Zap, color: 'text-red-600', bgColor: 'bg-red-50' },
  { key: 'promotion', label: 'โปรโมชั่น', icon: Tag, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { key: 'new', label: 'สินค้าใหม่', icon: Sparkles, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { key: 'bestseller', label: 'ขายดี', icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-50' },
];

export function ProductSelector({ products, className }: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedItems, setSelectedItems] = useState<Map<number, SelectedProduct>>(new Map());
  const [showFlexDialog, setShowFlexDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const data = product.product_data?.[0];
      if (!data) return false;

      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (data.name?.toLowerCase().includes(searchLower) ||
        data.name_en?.toLowerCase().includes(searchLower) ||
        data.sku?.toLowerCase().includes(searchLower) ||
        data.barcode?.toLowerCase().includes(searchLower));

      // Category filter
      let matchesFilter = true;
      switch (activeFilter) {
        case 'flashsale':
          matchesFilter = product.product_is_flashSale === 1 || data.is_promotion === 1;
          break;
        case 'promotion':
          matchesFilter = data.is_promotion === 1;
          break;
        case 'new':
          matchesFilter = product.product_is_recommend === 1 || product.product_is_flashSale === 1;
          break;
        case 'bestseller':
          matchesFilter = data.is_bestseller === 1 || product.customer_buyed > 0;
          break;
      }

      return matchesSearch && matchesFilter;
    });
  }, [products, searchQuery, activeFilter]);

  // Toggle selection
  const toggleSelection = useCallback((product: Product) => {
    const data = product.product_data?.[0];
    if (!data) return;
    
    const newSelected = new Map(selectedItems);
    
    if (newSelected.has(data.id)) {
      newSelected.delete(data.id);
    } else {
      newSelected.set(data.id, {
        product,
        quantity: 1,
        selectedUnit: product.product_unit?.[0] || null
      });
    }
    setSelectedItems(newSelected);
  }, [selectedItems]);

  // Update quantity
  const updateQuantity = useCallback((productId: number, delta: number) => {
    const newSelected = new Map(selectedItems);
    const item = newSelected.get(productId);
    if (item) {
      const newQty = Math.max(1, Math.min(99, item.quantity + delta));
      item.quantity = newQty;
      newSelected.set(productId, item);
      setSelectedItems(newSelected);
    }
  }, [selectedItems]);

  // Change unit
  const changeUnit = useCallback((productId: number, unit: ProductUnit) => {
    const newSelected = new Map(selectedItems);
    const item = newSelected.get(productId);
    if (item) {
      item.selectedUnit = unit;
      newSelected.set(productId, item);
      setSelectedItems(newSelected);
    }
  }, [selectedItems]);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedItems(new Map());
  }, []);

  // Generate Flex Message
  const generateFlexMessage = useCallback(() => {
    const selectedProducts = Array.from(selectedItems.values());

    const templateMap: Record<FilterType, FlexMessageTemplate> = {
      all: 'product_catalog',
      flashsale: 'flash_sale',
      promotion: 'promotion',
      new: 'new_arrival',
      bestseller: 'bestseller',
    };

    const titleMap: Record<FilterType, string> = {
      all: 'แคตตาล็อคสินค้า',
      flashsale: 'Flash Sale',
      promotion: 'โปรโมชันพิเศษ',
      new: 'สินค้าใหม่',
      bestseller: 'สินค้าขายดี',
    };

    const subtitleMap: Record<FilterType, string> = {
      all: 'รวมสินค้าที่เลือกไว้สำหรับส่งต่อผ่าน LINE',
      flashsale: 'สินค้าจำนวนจำกัด รีบสั่งก่อนหมด',
      promotion: 'รวมสินค้าราคาพิเศษ คัดมาให้พร้อมโปรเด่น',
      new: 'อัปเดตรายการสินค้ามาใหม่ล่าสุด',
      bestseller: 'รวมสินค้ายอดนิยมจากลูกค้า',
    };

    const colorMap: Record<FilterType, string> = {
      all: '#15803D',
      flashsale: '#D69E2E',
      promotion: '#EA580C',
      new: '#7C3AED',
      bestseller: '#15803D',
    };

    const template = templateMap[activeFilter];
    const flexMessage =
      template === 'product_catalog'
        ? generateFlexCarousel(selectedProducts)
        : generateFlexMessageByTemplate(selectedProducts, template, {
            title: titleMap[activeFilter],
            subtitle: subtitleMap[activeFilter],
            headerColor: colorMap[activeFilter],
          });

    return JSON.stringify(flexMessage, null, 2);
  }, [selectedItems, activeFilter]);

  // Copy to clipboard
  const copyToClipboard = async () => {
    const json = generateFlexMessage();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download JSON
  const downloadJSON = () => {
    const json = generateFlexMessage();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flex-message-${activeFilter}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedCount = selectedItems.size;
  const isSelected = (productId: number) => selectedItems.has(productId);

  // Convert selected items to ExportPreviewProduct[] for the send dialog
  const selectedPreviewProducts = useMemo(() => {
    return Array.from(selectedItems.values()).map((item) =>
      selectedProductToPreviewProduct(item.product, item.quantity, item.selectedUnit)
    );
  }, [selectedItems]);

  // Calculate sold percentage for progress bar
  const getSoldPercent = (stock: string) => {
    const num = parseFloat(stock);
    if (isNaN(num) || num <= 0) return 100;
    if (num > 50) return 20;
    if (num > 20) return 50;
    if (num > 10) return 75;
    return 90;
  };

  return (
    <div className={cn("bg-gray-50", className)}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="🔍 ค้นหาสินค้า (ชื่อ, SKU, Barcode...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-gray-200 focus:border-green-500 focus:ring-green-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
              {FILTERS.map(({ key, label, icon: Icon, color, bgColor }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                    activeFilter === key
                      ? cn(color, bgColor, "ring-2 ring-offset-1 ring-current")
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            พบ <span className="font-semibold text-gray-900">{filteredProducts.length}</span> รายการ
            {selectedCount > 0 && (
              <span className="ml-2 text-green-600">
                | เลือกแล้ว <span className="font-semibold">{selectedCount}</span> รายการ
              </span>
            )}
          </div>
          {selectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelections}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" />
              ล้างการเลือก
            </Button>
          )}
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredProducts.map((product) => {
              const data = product.product_data?.[0];
              if (!data) return null;
              
              const price = product.product_price?.[0]?.product_price?.[0];
              const photo = product.product_photo?.[0];
              const stock = product.product_stock?.[0];
              const selected = isSelected(data.id);
              const selectedData = selectedItems.get(data.id);

              const displayPrice = price?.promotion_price !== '0.00' 
                ? parseFloat(price.promotion_price) 
                : parseFloat(price?.price || '0');
              const originalPrice = parseFloat(price?.price || '0');
              const hasDiscount = displayPrice < originalPrice && originalPrice > 0;
              const soldPercent = getSoldPercent(stock?.stock_num || '0');

              // Determine badge
              let badge = null;
              if (product.product_is_flashSale === 1 || (hasDiscount && displayPrice > 0)) {
                badge = { text: 'FlashSale', color: 'bg-red-500', textColor: 'text-white' };
              } else if (data.is_promotion === 1) {
                badge = { text: 'โปรโมชั่น', color: 'bg-orange-500', textColor: 'text-white' };
              } else if (data.is_bestseller === 1) {
                badge = { text: 'ขายดี', color: 'bg-green-500', textColor: 'text-white' };
              } else if (product.product_is_recommend === 1) {
                badge = { text: 'แนะนำ', color: 'bg-purple-500', textColor: 'text-white' };
              }

              return (
                <Card
                  key={data.id}
                  className={cn(
                    "group relative overflow-hidden cursor-pointer transition-all duration-200",
                    "hover:shadow-lg hover:-translate-y-1",
                    selected 
                      ? "ring-2 ring-green-500 ring-offset-2 bg-green-50/50" 
                      : "border-gray-200 hover:border-green-300"
                  )}
                  onClick={() => toggleSelection(product)}
                >
                  {/* Badge */}
                  {badge && (
                    <div className={cn(
                      "absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-xs font-bold",
                      badge.color, badge.textColor
                    )}>
                      {badge.text}
                    </div>
                  )}

                  {/* RX Badge */}
                  {data.is_rx === 1 && (
                    <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                      ยาตามใบสั่ง
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {selected && (
                    <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
                      <Check className="w-4 h-4" />
                    </div>
                  )}

                  {/* Image */}
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {photo ? (
                      <img
                        src={`https://www.cnypharmacy.com/${photo.photo_path}`}
                        alt={data.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHN2ZyB4PSI1MCUiIHk9IjUwJSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiM5Y2EzYjgiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0xMiwgLTEyKSI+PHBhdGggZD0iTTE5IDNINWMtMS4xIDAtMiAuOS0yIDJ2MTRjMCAxLjEuOSAyIDIgMmgxNGMxLjEgMCAyLS45IDItMlY1YzAtMS4xLS45LTItMi0yem0wIDE2SDVWN2gxNHYxMnpNMTAgMTJsLTMuNSA0LjVoMTFMMTQgMTBsNC41IDZIMjBWN0g0djEwaDZsMi0yeiIvPjwvc3ZnPjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Package className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <CardContent className="p-2.5 space-y-1.5">
                    {/* Name */}
                    <h3 className="font-medium text-xs text-gray-900 line-clamp-2 min-h-[2rem] leading-tight">
                      {data.name}
                    </h3>

                    {/* Price */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-red-600">
                          ฿{displayPrice.toLocaleString()}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-gray-400 line-through">
                            ฿{originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Flash Sale style) */}
                    {badge?.text === 'FlashSale' && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all"
                            style={{ width: `${soldPercent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500">
                          ขายแล้ว {soldPercent}%
                        </p>
                      </div>
                    )}

                    {/* Stock Info */}
                    {badge?.text !== 'FlashSale' && stock && (
                      <p className={cn(
                        "text-[10px]",
                        parseFloat(stock.stock_num) <= 10 ? "text-red-500 font-medium" : "text-gray-500"
                      )}>
                        {parseFloat(stock.stock_num) <= 10 ? '⚠️ เหลือน้อย ' : 'คงเหลือ '}
                        {parseFloat(stock.stock_num).toLocaleString()} {selectedData?.selectedUnit?.unit || 'ชิ้น'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">ไม่พบสินค้า</h3>
            <p className="text-sm text-gray-500 mt-1">
              ลองค้นหาด้วยคำค้นอื่น หรือเปลี่ยนตัวกรอง
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
          {/* Selected Count Card */}
          <div className="bg-white rounded-full shadow-lg border px-4 py-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
              {selectedCount}
            </div>
            <span className="text-sm font-medium text-gray-700">รายการที่เลือก</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full hover:bg-red-50 hover:text-red-600"
              onClick={clearSelections}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Generate Flex Button */}
          <Button
            size="lg"
            variant="outline"
            className="shadow-lg rounded-full px-6 bg-white"
            onClick={() => setShowFlexDialog(true)}
          >
            <Share2 className="w-5 h-5 mr-2" />
            ดู JSON
          </Button>

          {/* Send to LINE Button */}
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

      {/* Send to LINE Dialog */}
      <SendCatalogDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        products={selectedPreviewProducts}
        defaultConfig={{
          template: activeFilter === 'all'
            ? 'product_catalog'
            : activeFilter === 'flashsale'
            ? 'flash_sale'
            : activeFilter === 'new'
            ? 'new_arrival'
            : (activeFilter as FlexMessageTemplate),
        }}
      />

      {/* Flex Message Dialog */}
      <Dialog open={showFlexDialog} onOpenChange={setShowFlexDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-gray-50">
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Zap className="w-5 h-5 text-yellow-500" />
              LINE Flex Message Preview
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Selected Items Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">สินค้าที่เลือก ({selectedCount} รายการ)</h4>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {Array.from(selectedItems.values()).map((item, idx) => {
                    const data = item.product.product_data?.[0];
                    if (!data) return null;
                    
                    const price = item.product.product_price?.[0]?.product_price?.[0];
                    const displayPrice = price?.promotion_price !== '0.00' 
                      ? parseFloat(price.promotion_price) 
                      : parseFloat(price?.price || '0');
                    
                    return (
                      <div key={data.id} className="flex items-center justify-between text-sm bg-white p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[200px]">{data.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">x{item.quantity}</span>
                          <span className="font-medium text-red-600">฿{displayPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* JSON Output */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">JSON Output</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyToClipboard}
                    className={cn(
                      "transition-colors",
                      copied && "bg-green-50 text-green-600 border-green-200"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        คัดลอก
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadJSON}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    ดาวน์โหลด
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="h-64 bg-gray-900 rounded-lg">
                <pre className="p-4 text-xs font-mono text-green-400 whitespace-pre-wrap">
                  {generateFlexMessage()}
                </pre>
              </ScrollArea>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <strong>💡 วิธีใช้:</strong> คัดลอก JSON ด้านบน แล้วนำไปใช้ใน LINE Messaging API 
              หรือ Broadcast System ของคุณ
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProductSelector;
