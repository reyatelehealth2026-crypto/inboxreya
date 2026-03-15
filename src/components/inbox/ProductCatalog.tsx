'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Share2, 
  Package, 
  Image as ImageIcon,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  Box,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Types based on JSON structure
interface ProductData {
  id: number;
  sku: string;
  barcode: string;
  name_en: string;
  name: string;
  spec_name: string;
  is_recommend: number;
  is_promotion: number;
  is_bestseller: number;
  is_rx: number;
}

interface ProductPhoto {
  photo_path: string;
}

interface ProductUnit {
  id: number;
  target_id: number;
  unit: string;
  unit_num: string;
  contain: string;
}

interface ProductPrice {
  product_price: Array<{
    id: number;
    price_level_id: number;
    product_unit_id: number;
    price: string;
    promotion_price: string;
    buy_max: number;
    buy_min: number;
  }>;
}

interface ProductStock {
  productLotId: number;
  stock_num: string;
  expiry_date: string | null;
}

interface Product {
  product_data: ProductData[];
  product_photo: ProductPhoto[];
  product_unit: ProductUnit[];
  product_price: ProductPrice[];
  product_stock: ProductStock[];
  product_wishlists: number;
  product_related_lists: any[];
  product_hashtag: any[];
  product_hashtag_new: any[];
  customer_buyed: number;
  product_is_flashSale: number;
  product_is_recommend: number;
  product_flasSale: any[];
  is_rx: number;
}

interface ProductCatalogProps {
  products: Product[];
  productTypes?: any[];
  suppliers?: any[];
}

interface SelectedProduct {
  product: Product;
  quantity: number;
  selectedUnit: ProductUnit | null;
}

export function ProductCatalog({ products, productTypes = [], suppliers = [] }: ProductCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<Map<number, SelectedProduct>>(new Map());
  const [showFlexPreview, setShowFlexPreview] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const data = product.product_data[0];
      if (!data) return false;

      const matchesSearch = 
        data.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.barcode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || 
        (selectedCategory === 'rx' && data.is_rx === 1) ||
        (selectedCategory === 'otc' && data.is_rx === 0) ||
        (selectedCategory === 'promotion' && data.is_promotion === 1) ||
        (selectedCategory === 'bestseller' && data.is_bestseller === 1);

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Toggle product selection
  const toggleProductSelection = (product: Product) => {
    const newSelected = new Map(selectedProducts);
    const productId = product.product_data[0]?.id;
    
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.set(productId, {
        product,
        quantity: 1,
        selectedUnit: product.product_unit[0] || null
      });
    }
    setSelectedProducts(newSelected);
  };

  // Update selected unit
  const updateSelectedUnit = (productId: number, unit: ProductUnit) => {
    const newSelected = new Map(selectedProducts);
    const selected = newSelected.get(productId);
    if (selected) {
      selected.selectedUnit = unit;
      newSelected.set(productId, selected);
      setSelectedProducts(newSelected);
    }
  };

  // Update quantity
  const updateQuantity = (productId: number, delta: number) => {
    const newSelected = new Map(selectedProducts);
    const selected = newSelected.get(productId);
    if (selected) {
      const newQty = Math.max(1, selected.quantity + delta);
      selected.quantity = newQty;
      newSelected.set(productId, selected);
      setSelectedProducts(newSelected);
    }
  };

  // Generate LINE Flex Message
  const generateFlexMessage = (): string => {
    const items = Array.from(selectedProducts.values()).map(selected => {
      const data = selected.product.product_data[0];
      const unit = selected.selectedUnit;
      const price = selected.product.product_price[0]?.product_price[0]?.price || '0';
      const photo = selected.product.product_photo[0]?.photo_path;
      
      return {
        type: 'bubble',
        size: 'micro',
        hero: photo ? {
          type: 'image',
          url: `https://www.cnypharmacy.com/${photo}`,
          size: 'full',
          aspectRatio: '1:1',
          aspectMode: 'cover'
        } : undefined,
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: data.name.substring(0, 30) + (data.name.length > 30 ? '...' : ''),
              weight: 'bold',
              size: 'sm',
              wrap: true
            },
            {
              type: 'text',
              text: `SKU: ${data.sku}`,
              size: 'xs',
              color: '#666666',
              margin: 'sm'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: unit ? `${selected.quantity} ${unit.unit}` : `${selected.quantity} ชิ้น`,
                  size: 'sm',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `฿${parseFloat(price).toLocaleString()}`,
                  weight: 'bold',
                  size: 'sm',
                  color: '#15803D',
                  align: 'end'
                }
              ]
            }
          ]
        }
      };
    });

    const flexMessage = {
      type: 'carousel',
      contents: items
    };

    return JSON.stringify(flexMessage, null, 2);
  };

  // Toggle expand product details
  const toggleExpand = (productId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const isProductSelected = (productId: number) => selectedProducts.has(productId);
  const selectedCount = selectedProducts.size;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#14532D] font-['Rubik']">
            แคตตาล็อคสินค้า
          </h1>
          <p className="text-sm text-gray-600 mt-1 font-['Nunito_Sans']">
            เลือกสินค้าเพื่อสร้าง LINE Flex Message สำหรับ Broadcast
          </p>
        </div>
        
        {/* Selected Count Badge */}
        {selectedCount > 0 && (
          <Badge className="bg-[#15803D] text-white px-4 py-2 text-base">
            <ShoppingCart className="w-4 h-4 mr-2" />
            เลือก {selectedCount} รายการ
          </Badge>
        )}
      </div>

      {/* Search and Filter Bar */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหาสินค้า (ชื่อ, SKU, Barcode...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-gray-300 focus:border-[#15803D] focus:ring-[#15803D]"
              />
            </div>
            
            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'ทั้งหมด', icon: Package },
                { key: 'rx', label: 'ยาตามใบสั่งแพทย์', icon: AlertCircle },
                { key: 'otc', label: 'ยาทั่วไป', icon: Box },
                { key: 'promotion', label: 'โปรโมชั่น', icon: Tag },
                { key: 'bestseller', label: 'ขายดี', icon: ShoppingCart },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={selectedCategory === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(key)}
                  className={selectedCategory === key 
                    ? 'bg-[#15803D] hover:bg-[#14532D] text-white' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product, index) => {
          const data = product.product_data[0];
          const price = product.product_price[0]?.product_price[0];
          const stock = product.product_stock[0];
          const photo = product.product_photo[0];
          const isSelected = isProductSelected(data.id);
          const isExpanded = expandedProducts.has(data.id);
          const selectedData = selectedProducts.get(data.id);

          return (
            <Card 
              key={data.id} 
              className={`group border-2 transition-all duration-200 hover:shadow-lg ${
                isSelected 
                  ? 'border-[#15803D] bg-[#F0FDF4]' 
                  : 'border-gray-200 hover:border-[#22C55E]'
              }`}
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-gray-100 overflow-hidden">
                {photo ? (
                  <img
                    src={`https://www.cnypharmacy.com/${photo.photo_path}`}
                    alt={data.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-product.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {data.is_rx === 1 && (
                    <Badge className="bg-red-500 text-white text-xs">
                      ยาตามใบสั่ง
                    </Badge>
                  )}
                  {data.is_promotion === 1 && (
                    <Badge className="bg-orange-500 text-white text-xs">
                      โปรโมชั่น
                    </Badge>
                  )}
                  {data.is_bestseller === 1 && (
                    <Badge className="bg-yellow-500 text-white text-xs">
                      ขายดี
                    </Badge>
                  )}
                </div>

                {/* Selection Checkbox */}
                <div className="absolute top-2 right-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={isSelected ? 'default' : 'secondary'}
                          className={`rounded-full w-8 h-8 p-0 ${
                            isSelected 
                              ? 'bg-[#15803D] hover:bg-[#14532D]' 
                              : 'bg-white/90 hover:bg-white'
                          }`}
                          onClick={() => toggleProductSelection(product)}
                        >
                          {isSelected ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <ShoppingCart className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isSelected ? 'นำออกจากรายการ' : 'เพิ่มในรายการ'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <CardContent className="p-4 space-y-2">
                {/* Product Name */}
                <h3 className="font-semibold text-sm text-[#14532D] line-clamp-2 min-h-[2.5rem] font-['Rubik']">
                  {data.name}
                </h3>
                
                {/* SKU */}
                <p className="text-xs text-gray-500">
                  SKU: {data.sku} | Barcode: {data.barcode}
                </p>

                {/* Price */}
                <div className="flex items-center justify-between">
                  <div>
                    {price && parseFloat(price.promotion_price) < parseFloat(price.price) ? (
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-400 line-through">
                          ฿{parseFloat(price.price).toLocaleString()}
                        </span>
                        <span className="text-lg font-bold text-[#15803D]">
                          ฿{parseFloat(price.promotion_price).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-[#15803D]">
                        ฿{price ? parseFloat(price.price).toLocaleString() : '-'}
                      </span>
                    )}
                  </div>
                  
                  {/* Stock */}
                  {stock && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        parseFloat(stock.stock_num) > 10 
                          ? 'border-green-500 text-green-600' 
                          : parseFloat(stock.stock_num) > 0 
                            ? 'border-yellow-500 text-yellow-600'
                            : 'border-red-500 text-red-600'
                      }`}
                    >
                      คงเหลือ: {parseFloat(stock.stock_num).toLocaleString()}
                    </Badge>
                  )}
                </div>

                {/* Expand Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-gray-500 hover:text-[#15803D]"
                  onClick={() => toggleExpand(data.id)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      ซ่อนรายละเอียด
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      ดูรายละเอียด
                    </>
                  )}
                </Button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    {/* Units */}
                    {product.product_unit.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-600">หน่วยสินค้า:</p>
                        <div className="flex flex-wrap gap-1">
                          {product.product_unit.map((unit) => (
                            <Badge
                              key={unit.id}
                              variant={selectedData?.selectedUnit?.id === unit.id ? 'default' : 'outline'}
                              className={`text-xs cursor-pointer ${
                                selectedData?.selectedUnit?.id === unit.id
                                  ? 'bg-[#0369A1] hover:bg-[#0369A1]/90'
                                  : 'hover:bg-gray-100'
                              }`}
                              onClick={() => isSelected && updateSelectedUnit(data.id, unit)}
                            >
                              {unit.unit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spec */}
                    {data.spec_name && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">ส่วนประกอบ:</span> {data.spec_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Quantity Selector (when selected) */}
                {isSelected && selectedData && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">จำนวน:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-8 h-8 p-0"
                        onClick={() => updateQuantity(data.id, -1)}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">
                        {selectedData.quantity}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-8 h-8 p-0"
                        onClick={() => updateQuantity(data.id, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600">ไม่พบสินค้า</h3>
          <p className="text-sm text-gray-500 mt-1">
            ลองค้นหาด้วยคำค้นอื่น หรือเปลี่ยนตัวกรอง
          </p>
        </div>
      )}

      {/* Floating Action Button - Generate Flex Message */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Dialog open={showFlexPreview} onOpenChange={setShowFlexPreview}>
            <DialogTrigger asChild>
              <Button 
                size="lg"
                className="bg-[#0369A1] hover:bg-[#0369A1]/90 text-white shadow-lg rounded-full px-6"
              >
                <Share2 className="w-5 h-5 mr-2" />
                สร้าง Flex Message ({selectedCount})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="text-[#14532D] font-['Rubik']">
                  LINE Flex Message Preview
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Selected Items Summary */}
                <ScrollArea className="h-48 border rounded-lg p-4">
                  <h4 className="font-medium text-sm text-gray-600 mb-2">สินค้าที่เลือก:</h4>
                  <div className="space-y-2">
                    {Array.from(selectedProducts.values()).map((selected) => {
                      const data = selected.product.product_data[0];
                      return (
                        <div key={data.id} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{data.name}</span>
                          <span className="text-gray-500 ml-2">
                            x{selected.quantity} {selected.selectedUnit?.unit || 'ชิ้น'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* JSON Output */}
                <div className="relative">
                  <h4 className="font-medium text-sm text-gray-600 mb-2">JSON Output:</h4>
                  <ScrollArea className="h-64 bg-gray-900 rounded-lg p-4">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {generateFlexMessage()}
                    </pre>
                  </ScrollArea>
                  
                  <Button
                    size="sm"
                    className="absolute top-8 right-2 bg-[#15803D] hover:bg-[#14532D]"
                    onClick={() => {
                      navigator.clipboard.writeText(generateFlexMessage());
                    }}
                  >
                    Copy JSON
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

export default ProductCatalog;
