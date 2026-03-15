'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProductSelector } from '@/components/inbox/ProductSelector';
import { Product } from '@/types/product-catalog';
import { Loader2, Upload, FileJson, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Sample data structure matching the JSON format
const SAMPLE_DATA = {
  "x": "c",
  "product": [
    {
      "product_data": [{
        "id": 7460,
        "productMasterID": null,
        "sku": "7705",
        "barcode": "7705",
        "name_en": "จิ่วเจิ้งปู่เซิน 6SAC [JTH] กล่องน้ำเงินทอง",
        "init_name": "",
        "spec_name": "ตังถั่งเฉ้าสกัด,ตังกุยผง,ชะเอมเทศผง,โสมสกัด ",
        "name": "จิ่วเจิ้งปู่เซินเจี๋ยวหนัง 1กล่อง 6 ซอง",
        "product_related_lists": "",
        "is_recommend": 0,
        "is_promotion": 1,
        "product_sub_type_lists": "52",
        "is_bestseller": 0
      }],
      "product_photo": [
        {"photo_path": "uploads/product_photo/1772696652_1.jpg"},
        {"photo_path": "uploads/product_photo/1772696652_4.jpeg"}
      ],
      "product_unit": [{"id": 10266, "target_id": 7460, "unit": "กล่อง[6ซอง]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77572, "price_level_id": 1, "product_unit_id": 10266, "price": "360.00", "promotion_price": "290.00", "buy_max": 0, "buy_min": 0}]}],
      "product_stock": [{"productLotId": 10266, "stock_num": "25.00", "expiry_date": null}],
      "product_wishlists": 0,
      "product_related_lists": [],
      "product_hashtag": [],
      "product_hashtag_new": [],
      "customer_buyed": 15,
      "product_is_flashSale": 1,
      "product_is_recommend": 0,
      "product_flasSale": [],
      "is_rx": 0
    },
    {
      "product_data": [{
        "id": 7459,
        "productMasterID": null,
        "sku": "7704",
        "barcode": "7704",
        "name_en": "น้ำเกลือจุกแหลม KLEAN&KARE NORMAL KARE 500ML [ANB]",
        "init_name": "",
        "spec_name": "SODIUM CHLORIDE",
        "name": "น้ำเกลือคลีนแอนด์แคร์ นอร์มอลซาไลน์ 500 มล",
        "is_recommend": 1,
        "is_promotion": 1,
        "is_bestseller": 1
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772696617_1.jpg"}],
      "product_unit": [
        {"id": 10263, "target_id": 7459, "unit": "ลัง[24ขวด]", "unit_num": "24.00", "contain": "1.00"},
        {"id": 10265, "target_id": 7459, "unit": "ขวด[500ML]", "unit_num": "1.00", "contain": "1.00"}
      ],
      "product_price": [
        {"product_price": [{"id": 77564, "price_level_id": 1, "product_unit_id": 10265, "price": "35.00", "promotion_price": "26.00", "buy_max": 0, "buy_min": 0}]}
      ],
      "product_stock": [{"productLotId": 10265, "stock_num": "150.00", "expiry_date": null}],
      "product_wishlists": 0,
      "customer_buyed": 89,
      "product_is_flashSale": 1,
      "is_rx": 0
    },
    {
      "product_data": [{
        "id": 7458,
        "productMasterID": null,
        "sku": "7702",
        "barcode": "7702",
        "name_en": "OXYNOSE SPRAY 0.05% 10ML [RXC]",
        "init_name": "",
        "spec_name": "OXYMETAZOLINE HYDROCHLORIDE",
        "name": "ออกซีโนส สเปรย์ 0.05% 10มล ",
        "is_recommend": 0,
        "is_promotion": 0,
        "is_bestseller": 0
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772696564_1.png"}],
      "product_unit": [{"id": 10262, "target_id": 7458, "unit": "ขวด[10ML]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77540, "price_level_id": 1, "product_unit_id": 10262, "price": "95.00", "promotion_price": "75.00", "buy_max": 0, "buy_min": 0}]}],
      "product_stock": [{"productLotId": 10262, "stock_num": "8.00", "expiry_date": null}],
      "customer_buyed": 45,
      "product_is_flashSale": 1,
      "is_rx": 1
    },
    {
      "product_data": [{
        "id": 7457,
        "sku": "7701",
        "barcode": "7701",
        "name_en": "BILANOSE 20MG 1X10'S [RXC]",
        "name": "ไบลาโนส 20มก 1แผง 10เม็ด",
        "is_recommend": 1,
        "is_promotion": 1,
        "is_bestseller": 1
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772696522_1.png"}],
      "product_unit": [{"id": 10261, "target_id": 7457, "unit": "กล่อง[1แผง]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77532, "price_level_id": 1, "product_unit_id": 10261, "price": "195.00", "promotion_price": "165.00", "buy_max": 0, "buy_min": 0}]}],
      "product_stock": [{"productLotId": 10261, "stock_num": "42.00", "expiry_date": null}],
      "customer_buyed": 120,
      "product_is_flashSale": 0,
      "is_rx": 1
    },
    {
      "product_data": [{
        "id": 7456,
        "sku": "7694",
        "barcode": "7694",
        "name_en": "[GF] SHARP เครื่องปั่นน้ำผลไม้ รุ่น EM-14 1L ",
        "name": "เครื่องปั่นน้ำผลไม้",
        "is_recommend": 0,
        "is_promotion": 1,
        "is_bestseller": 0
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772419991_1.png"}],
      "product_unit": [{"id": 10260, "target_id": 7456, "unit": "เครื่อง", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77520, "price_level_id": 1, "product_unit_id": 10260, "price": "1290.00", "promotion_price": "990.00", "buy_max": 0, "buy_min": 0}]}],
      "product_stock": [{"productLotId": 10260, "stock_num": "3.00", "expiry_date": null}],
      "customer_buyed": 5,
      "product_is_flashSale": 1,
      "is_rx": 0
    },
    {
      "product_data": [{
        "id": 7455,
        "sku": "7693",
        "name": "ยาดมแบล็คอินเฮเลอร์ ยาดมลูกกลิ้ง 5ซีซี",
        "is_recommend": 0,
        "is_promotion": 0,
        "is_bestseller": 1
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772186951_1.jpg"}],
      "product_unit": [
        {"id": 10258, "target_id": 7455, "unit": "หลอด[5CC]", "unit_num": "1.00", "contain": "1.00"},
        {"id": 10259, "target_id": 7455, "unit": "กล่อง[6หลอด]", "unit_num": "6.00", "contain": "1.00"}
      ],
      "product_price": [
        {"product_price": [{"id": 77504, "price_level_id": 1, "product_unit_id": 10258, "price": "71.00", "promotion_price": "55.00", "buy_max": 0, "buy_min": 0}]},
        {"product_price": [{"id": 77512, "price_level_id": 1, "product_unit_id": 10259, "price": "425.00", "promotion_price": "325.00", "buy_max": 0, "buy_min": 0}]}
      ],
      "product_stock": [],
      "customer_buyed": 234,
      "product_is_flashSale": 0,
      "is_rx": 0
    },
    {
      "product_data": [{
        "id": 7454,
        "sku": "7692",
        "name": "ยาอมสมุนไพร เซียงเพียว 24X30'S",
        "is_recommend": 1,
        "is_promotion": 1,
        "is_bestseller": 1
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772186917_1.png"}],
      "product_unit": [
        {"id": 10256, "target_id": 7454, "unit": "กล่อง[24ซอง]", "unit_num": "24.00", "contain": "1.00"},
        {"id": 10257, "target_id": 7454, "unit": "ซอง[30เม็ด]", "unit_num": "1.00", "contain": "1.00"}
      ],
      "product_price": [
        {"product_price": [{"id": 77488, "price_level_id": 1, "product_unit_id": 10256, "price": "660.00", "promotion_price": "550.00", "buy_max": 0, "buy_min": 0}]},
        {"product_price": [{"id": 77496, "price_level_id": 1, "product_unit_id": 10257, "price": "28.00", "promotion_price": "24.00", "buy_max": 0, "buy_min": 0}]}
      ],
      "customer_buyed": 567,
      "product_is_flashSale": 1,
      "is_rx": 0
    },
    {
      "product_data": [{
        "id": 7453,
        "sku": "7691",
        "name": "เทมปร้า ฟิซซ์ ชนิดเม็ดฟู่ละลายน้ำ 500 มก ",
        "is_recommend": 0,
        "is_promotion": 0,
        "is_bestseller": 0
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772186853_1.jpg"}],
      "product_unit": [{"id": 10255, "target_id": 7453, "unit": "กล่อง[12เม็ด]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77480, "price_level_id": 1, "product_unit_id": 10255, "price": "85.00", "promotion_price": "0.00", "buy_max": 0, "buy_min": 0}]}],
      "customer_buyed": 12,
      "product_is_flashSale": 0,
      "is_rx": 1
    },
    {
      "product_data": [{
        "id": 7452,
        "sku": "7690",
        "name": "น้ำตาเทียม ซิสเทน อัลตร้า 10มล ",
        "is_recommend": 1,
        "is_promotion": 1,
        "is_bestseller": 1
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772186816_1.png"}],
      "product_unit": [{"id": 10254, "target_id": 7452, "unit": "ขวด[10ML]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77472, "price_level_id": 1, "product_unit_id": 10254, "price": "589.00", "promotion_price": "499.00", "buy_max": 0, "buy_min": 0}]}],
      "product_stock": [{"productLotId": 10254, "stock_num": "18.00", "expiry_date": null}],
      "customer_buyed": 89,
      "product_is_flashSale": 1,
      "is_rx": 1
    },
    {
      "product_data": [{
        "id": 7451,
        "sku": "7689",
        "name": "ซิสเทน คอมพลีท 5มล",
        "is_recommend": 0,
        "is_promotion": 1,
        "is_bestseller": 0
      }],
      "product_photo": [
        {"photo_path": "uploads/product_photo/1772604558_1.jpg"},
        {"photo_path": "uploads/product_photo/1772604558_2.jpeg"}
      ],
      "product_unit": [{"id": 10253, "target_id": 7451, "unit": "ขวด[5ML]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77464, "price_level_id": 1, "product_unit_id": 10253, "price": "320.00", "promotion_price": "275.00", "buy_max": 0, "buy_min": 0}]}],
      "customer_buyed": 45,
      "product_is_flashSale": 1,
      "is_rx": 1
    },
    {
      "product_data": [{
        "id": 7450,
        "sku": "7688",
        "name": "ไวตาลักซ์ พลัส 30เม็ด ",
        "is_recommend": 1,
        "is_promotion": 0,
        "is_bestseller": 1
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772186775_1.jpg"}],
      "product_unit": [{"id": 10252, "target_id": 7450, "unit": "ขวด[30เม็ด]", "unit_num": "1.00", "contain": "1.00"}],
      "product_price": [{"product_price": [{"id": 77456, "price_level_id": 1, "product_unit_id": 10252, "price": "450.00", "promotion_price": "0.00", "buy_max": 0, "buy_min": 0}]}],
      "customer_buyed": 178,
      "product_is_flashSale": 0,
      "is_rx": 0
    },
    {
      "product_data": [{
        "id": 7449,
        "sku": "7687",
        "name": "ออสติโอติน ชนิดผง 1500มก 30ซอง",
        "is_recommend": 0,
        "is_promotion": 1,
        "is_bestseller": 0
      }],
      "product_photo": [{"photo_path": "uploads/product_photo/1772073401_1.jpg"}],
      "product_unit": [
        {"id": 10250, "target_id": 7449, "unit": "กล่อง[30ซอง]", "unit_num": "30.00", "contain": "1.00"},
        {"id": 10251, "target_id": 7449, "unit": "ซอง[3.95G]", "unit_num": "1.00", "contain": "1.00"}
      ],
      "product_price": [
        {"product_price": [{"id": 77440, "price_level_id": 1, "product_unit_id": 10250, "price": "890.00", "promotion_price": "750.00", "buy_max": 0, "buy_min": 0}]},
        {"product_price": [{"id": 77448, "price_level_id": 1, "product_unit_id": 10251, "price": "32.00", "promotion_price": "27.00", "buy_max": 0, "buy_min": 0}]}
      ],
      "customer_buyed": 34,
      "product_is_flashSale": 1,
      "is_rx": 1
    }
  ],
  "paginate": {
    "current_page": 1,
    "data": [{"id": 7460, "qty": "25.00"}, {"id": 7459, "qty": "150.00"}],
    "per_page": 25,
    "total": 4595
  },
  "product_type": [
    {
      "type": [{"id": 1, "type": "RXCNS-ระบบประสาทส่วนกลาง", "code": "CNS"}],
      "sub_type": [{"id": 51, "code": "CNS-01", "sub_type": "CNS-01-ระบบประสาท", "product_type_id": 1}]
    }
  ],
  "supplier": [
    {"id": 201, "code": "HER", "company": "ห้างหุ้นส่วนจำกัด เฮอร์บิเทค"},
    {"id": 208, "code": "3T", "company": "บริษัท 3ที เนเชอร์เฮิร์บ"}
  ]
};

export default function ProductCatalogPage() {
  const [jsonInput, setJsonInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);

  // Load sample data on mount
  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = () => {
    setProducts(SAMPLE_DATA.product as unknown as Product[]);
    setJsonInput(JSON.stringify(SAMPLE_DATA, null, 2));
    setError(null);
    setShowInput(false);
  };

  const handleJsonInput = (value: string) => {
    setJsonInput(value);
    setError(null);
    
    if (!value.trim()) {
      setProducts([]);
      return;
    }

    try {
      const parsed = JSON.parse(value);
      
      if (parsed.product && Array.isArray(parsed.product)) {
        setProducts(parsed.product);
      } else if (Array.isArray(parsed)) {
        setProducts(parsed);
      } else {
        setError('รูปแบบ JSON ไม่ถูกต้อง: ต้องการ property "product" ที่เป็น array');
        setProducts([]);
      }
    } catch (err) {
      setError('JSON ไม่ถูกต้อง: ' + (err as Error).message);
      setProducts([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      setJsonInput(text);
      handleJsonInput(text);
      setShowInput(false);
    } catch (err) {
      setError('ไม่สามารถอ่านไฟล์ได้: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    CNY Pharmacy Catalog
                  </h1>
                  <p className="text-xs text-gray-500">
                    ระบบเลือกสินค้าสำหรับสร้าง LINE Flex Message
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInput(!showInput)}
                className={cn(showInput && "bg-gray-100")}
              >
                <FileJson className="w-4 h-4 mr-2" />
                {showInput ? 'ซ่อน JSON' : 'แสดง JSON'}
              </Button>

              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="json-upload"
              />
              <label htmlFor="json-upload">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    อัปโหลด JSON
                  </span>
                </Button>
              </label>
              
              <Button 
                variant="outline"
                size="sm"
                onClick={loadSampleData}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                โหลดตัวอย่าง
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* JSON Input Panel */}
      {showInput && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              {error && (
                <Alert variant="destructive" className="text-sm">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Textarea
                value={jsonInput}
                onChange={(e) => handleJsonInput(e.target.value)}
                placeholder="วาง JSON ข้อมูลสินค้าที่นี่... (รองรับ structure แบบ { product: [...] } หรือ [...])"
                className="min-h-[150px] font-mono text-xs border-gray-200 focus:border-green-500 focus:ring-green-500"
              />
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  พบสินค้า: <strong className="text-green-600">{products.length}</strong> รายการ
                </span>
                {loading && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    กำลังโหลด...
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Selector */}
      {products.length > 0 ? (
        <ProductSelector products={products} />
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
              <FileJson className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">ไม่มีข้อมูลสินค้า</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              อัปโหลดไฟล์ JSON หรือวางข้อมูล JSON เพื่อแสดงแคตตาล็อคสินค้า
            </p>
            <Button 
              className="mt-4 bg-green-600 hover:bg-green-700"
              onClick={loadSampleData}
            >
              โหลดตัวอย่างข้อมูล
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
