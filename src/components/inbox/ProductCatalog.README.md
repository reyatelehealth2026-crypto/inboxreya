# Product Catalog Component

ระบบแคตตาล็อคสินค้าสำหรับ CNY Pharmacy พร้อมฟีเจอร์สร้าง LINE Flex Message

## 📁 Files Structure

```
/src
├── components/inbox/
│   └── ProductCatalog.tsx          # Main catalog component
├── types/
│   └── product-catalog.ts          # Type definitions & helpers
├── app/inbox/catalog/
│   └── page.tsx                    # Demo page with JSON input
└── app/api/inbox/catalog/
    └── flex-message/route.ts       # API for generating Flex Message
```

## 🚀 Features

1. **แสดงสินค้าแบบ Grid/Card**
   - รูปภาพสินค้า (Lazy loading)
   - ชื่อสินค้า, SKU, Barcode
   - ราคา (รองรับราคาปกติและโปรโมชั่น)
   - สต็อกสินค้า (พร้อมสีบ่งบอกสถานะ)
   - Badge: ยาตามใบสั่ง (RX), โปรโมชั่น, ขายดี

2. **ค้นหา/กรองสินค้า**
   - ค้นหาด้วยชื่อ, SKU, Barcode
   - กรองตาม: ทั้งหมด, ยาตามใบสั่ง, ยาทั่วไป, โปรโมชั่น, ขายดี

3. **เลือกสินค้า**
   - คลิกเลือกสินค้าที่ต้องการ
   - เลือกหน่วยสินค้า (ถ้ามีหลายหน่วย)
   - กำหนดจำนวน
   - แสดงจำนวนสินค้าที่เลือกแบบ real-time

4. **สร้าง LINE Flex Message**
   - Template: Product Catalog, Promotion, Flash Sale, New Arrival, Bestseller
   - Copy JSON ไปใช้งานได้ทันที
   - Preview สินค้าที่เลือก

## 📖 Usage

### Basic Usage

```tsx
import { ProductCatalog } from '@/components/inbox/ProductCatalog';
import type { Product } from '@/types/product-catalog';

// Your product data
const products: Product[] = [...];

export default function MyPage() {
  return (
    <ProductCatalog 
      products={products}
      productTypes={productTypes}
      suppliers={suppliers}
    />
  );
}
```

### Data Format

```typescript
interface Product {
  product_data: [{
    id: number;
    sku: string;
    barcode: string;
    name: string;
    name_en: string;
    spec_name: string;
    is_recommend: number;
    is_promotion: number;
    is_bestseller: number;
    is_rx: number;
  }];
  product_photo: [{ photo_path: string }];
  product_unit: [{
    id: number;
    unit: string;
    unit_num: string;
    contain: string;
  }];
  product_price: [{
    product_price: [{
      price: string;
      promotion_price: string;
    }]
  }];
  product_stock: [{
    productLotId: number;
    stock_num: string;
    expiry_date: string | null;
  }];
}
```

### API: Generate Flex Message

```typescript
// POST /api/inbox/catalog/flex-message
const response = await fetch('/api/inbox/catalog/flex-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    products: selectedProducts,
    template: 'promotion', // 'product_catalog' | 'promotion' | 'flash_sale' | 'new_arrival' | 'bestseller'
    options: {
      title: '🔥 โปรโมชั่นพิเศษ',
      subtitle: 'จำกัดเวลา!',
      headerColor: '#EA580C'
    }
  })
});

const { flexMessage } = await response.json();
```

### Helper Functions

```typescript
import { 
  generateFlexCarousel,
  generateFlexMessageByTemplate,
  formatPrice,
  formatStock,
  getStockStatus,
  validateProductData
} from '@/types/product-catalog';

// Generate simple carousel
const carousel = generateFlexCarousel(selectedProducts);

// Generate with template
const flexMessage = generateFlexMessageByTemplate(
  selectedProducts,
  'flash_sale',
  { title: 'Flash Sale', headerColor: '#DC2626' }
);

// Format helpers
const price = formatPrice('360.00'); // "฿360.00"
const stock = formatStock('25.00');  // "25"
const status = getStockStatus('5.00'); // { status: 'low_stock', label: 'ใกล้หมด', color: '#D97706' }

// Validation
const { valid, errors } = validateProductData(product);
```

## 🎨 Design System

จากการวิเคราะห์ UI/UX Pro Max สำหรับ Pharmacy/E-commerce:

- **Primary Color:** `#15803D` (Green - สื่อถึงความน่าเชื่อถือด้านสุขภาพ)
- **Secondary Color:** `#22C55E` (Light Green)
- **CTA Color:** `#0369A1` (Blue - สื่อถึงความเป็นมืออาชีพ)
- **Background:** `#F0FDF4` (Very light green)
- **Typography:** Rubik (heading), Nunito Sans (body)

### Accessibility
- WCAG AAA compliant
- Focus states ชัดเจน
- Touch target 44x44px ขึ้นไป
- Support keyboard navigation

## 📱 Responsive Breakpoints

- **Mobile:** 1 column (full width)
- **Tablet (md):** 2 columns
- **Desktop (lg):** 3 columns
- **Large (xl):** 4 columns

## 🔄 Integration with Broadcast

สามารถนำ JSON ที่สร้างได้ไปใช้กับ Broadcast System:

```typescript
// ใน Broadcast Dialog
const handleCreateBroadcast = async () => {
  // 1. Get selected products from catalog
  const selectedProducts = catalogRef.current.getSelectedProducts();
  
  // 2. Generate Flex Message
  const { flexMessage } = await fetch('/api/inbox/catalog/flex-message', {
    method: 'POST',
    body: JSON.stringify({ products: selectedProducts })
  }).then(r => r.json());
  
  // 3. Use in broadcast
  await createBroadcast({
    message: flexMessage,
    targetAudience: selectedAudience,
    schedule: scheduledTime
  });
};
```

## 📝 Example JSON Input

```json
{
  "product": [
    {
      "product_data": [{
        "id": 7460,
        "sku": "7705",
        "barcode": "7705",
        "name": "จิ่วเจิ้งปู่เซินเจี๋ยวหนัง 1กล่อง 6 ซอง",
        "name_en": "จิ่วเจิ้งปู่เซิน 6SAC [JTH]",
        "spec_name": "ตังถั่งเฉ้าสกัด,ตังกุยผง",
        "is_recommend": 0,
        "is_promotion": 0,
        "is_bestseller": 0,
        "is_rx": 0
      }],
      "product_photo": [
        { "photo_path": "uploads/product_photo/1772696652_1.jpg" }
      ],
      "product_unit": [
        { "id": 10266, "target_id": 7460, "unit": "กล่อง[6ซอง]", "unit_num": "1.00", "contain": "1.00" }
      ],
      "product_price": [
        {
          "product_price": [{
            "id": 77572,
            "price_level_id": 1,
            "product_unit_id": 10266,
            "price": "360.00",
            "promotion_price": "360.00",
            "buy_max": 0,
            "buy_min": 0
          }]
        }
      ],
      "product_stock": [
        { "productLotId": 10266, "stock_num": "25.00", "expiry_date": null }
      ],
      "product_wishlists": 0,
      "product_related_lists": [],
      "product_hashtag": [],
      "product_hashtag_new": [],
      "customer_buyed": 0,
      "product_is_flashSale": 0,
      "product_is_recommend": 0,
      "product_flasSale": [],
      "is_rx": 0
    }
  ],
  "product_type": [...],
  "supplier": [...]
}
```

## 🔧 Development

### Install Dependencies
```bash
npm install lucide-react
```

### Required shadcn/ui Components
```bash
npx shadcn add card button input badge checkbox dialog scroll-area separator tooltip textarea alert
```

## 📄 License

Internal use for CNY Pharmacy
