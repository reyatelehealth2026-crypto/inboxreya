---
name: flex-compose
description: เรียก helper `scripts/build-flex.ts` เพื่อสร้าง LINE Flex messages จาก raw CNY response หรือ ExportPreviewProduct[]. ใช้ template substitution ตรงตามเทมเพลตของ admin (mega bubbles + SPECIAL OFFER badge + promo box + price + date range).
---

# flex-compose skill

## ใช้ยังไง

```bash
echo '<payload>' \
  | npx tsx .claude/plugins/line-broadcast/scripts/build-flex.ts \
  > .tmp/flex.json
```

stdin payload (เลือก source อย่างใดอย่างหนึ่ง):

### Mode A — pre-mapped products
```json
{
  "products": [
    {
      "productId": 4092,
      "sku": "4092",
      "name": "เม็ดอมผสมสารสกัดตรีผลา …",
      "imageUrl": "https://manager.cnypharmacy.com/uploads/product_photo/1675321410_1.jpg",
      "basePrice": 146,
      "promotionPrice": 138,
      "unitLabel": "กล่อง[10ซอง]",
      "productUrl": "https://www.cnypharmacy.com/product/4092",
      "promoLine1": "ซื้อยกแพ็ค 3 กล่อง[10ซอง]",
      "promoLine2": "ลดเพิ่มแพ็คละ 24 บาท",
      "offerStart": "2026-03-01",
      "offerEnd":   "2026-03-31"
    }
  ],
  "theme":      "promotion",
  "title":      "โปรโมชันพิเศษ",     // user-selected Q1
  "ctaLabel":   "ซื้อเลย",            // user-selected Q2
  "closingText": "ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ"
}
```

### Mode B — raw CNY response (script filters + maps อัตโนมัติ)
```json
{
  "cny":        <raw response จาก https://www.cnypharmacy.com/api/getDataProductIsGroup>,
  "theme":      "promotion",
  "keywords":   "วิตามินซี",
  "limit":      6,
  "title":      "โปรโมชันพิเศษ",
  "ctaLabel":   "ซื้อเลย",
  "closingText": "ด่วน! …"
}
```

Mode B จะ filter + top-up + map ภายใน script → ไม่ต้องเขียน Node glue.

## Optional fields (default ตาม theme ทั้งหมด)

| field | default (theme = promotion) |
|---|---|
| `title` | "โปรโมชันพิเศษ" |
| `intro` | "รวมสินค้าราคาพิเศษ คัดมาให้พร้อมโปรเด่น" |
| `countLabel` | "รายการสินค้าพร้อมรายละเอียด" |
| `footerText` | "สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย" |
| `ctaLabel` | "ซื้อเลย" |
| `actionUrl` | "https://www.cnypharmacy.com" |
| `badgeText` | "SPECIAL OFFER" |

Cover bg / icon / title default แปรไปตาม `theme`:
| theme | bg | icon | default title |
|---|---|---|---|
| `promotion` | `#E53E3E` | 🔥 | "โปรโมชันพิเศษ" |
| `flash_sale` | `#D69E2E` | ⚡ | "Flash Sale" |
| `bestseller` | `#15803D` | 🏆 | "สินค้าขายดี" |
| `new_arrival` | `#805AD5` | ✨ | "สินค้าใหม่" |
| `product_catalog` | `#4299E1` | 🛍️ | "แคตตาล็อคสินค้า" |

## ผลลัพธ์ (ตรงตามเทมเพลตของ admin)

```
[
  {                     // Carousel 1
    "type":"flex",
    "altText":"<title>",
    "contents":{
      "type":"carousel",
      "contents":[
        {Cover bubble - mega, themed bg, icon, title, count card, CTA},
        {Product bubble - mega, hero 4:3, SPECIAL OFFER badge, SKU, name,
                          [promo box if promoLines],
                          [price + strike-through if discount],
                          [date range if offerStart/End],
                          per-bubble CTA → product url},
        …up to 11 products in first carousel
      ]
    }
  },
  …more carousels if > 11 products (12 per carousel after first),
  {                     // Closing
    "type":"text",
    "text":"<closingText>"
  }
]
```

**Conditional rendering** per product:
- ถ้า `promotionPrice < basePrice` → strike-through line ใต้ราคา
- ถ้า `promoLine1` หรือ `promoLine2` ตั้งค่า → promo box สีส้ม (`#FFF7ED`)
- ถ้า `offerStart` + `offerEnd` ตั้งค่า → date range row

## Capacity

- 12 bubbles/carousel × 5 carousels = 60 bubbles max
- Carousel 1 reserves 1 slot ให้ cover → 11 products
- Reserve 1 message slot ให้ `closingText` ถ้ามี → max 4 carousels
- **47 products max** (ถ้ามี closingText) หรือ **59** (ไม่มี)

Script reject ถ้า:
- `messages.length === 0` → exit 1
- `messages.length > 5` → exit 1 (LINE quota)

## ตัวอย่างเต็ม (Mode B — agent ทำขั้นเดียว)

```bash
mkdir -p .tmp

# 1. curl CNY public
curl -sS --max-time 15 \
  "https://www.cnypharmacy.com/api/getDataProductIsGroup?page=1&sort_product_name=asc&isPageGroup=&paginate_num=100&supplier=0&see_query=0&new_sort_type=0" \
  -o .tmp/cny-raw.json

# 2. รวม CNY + admin choices → payload
node -e "
const fs=require('fs');
const cny=JSON.parse(fs.readFileSync('.tmp/cny-raw.json','utf8'));
fs.writeFileSync('.tmp/payload.json',JSON.stringify({
  cny,
  theme:'promotion',
  keywords:'',
  limit:6,
  title:'โปรโมชันประจำวันที่ 18',   // user Q1
  ctaLabel:'ซื้อเลย',                // user Q2
  closingText:'ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ'
}));"

# 3. Build Flex
cat .tmp/payload.json \
  | npx tsx .claude/plugins/line-broadcast/scripts/build-flex.ts \
  > .tmp/flex.json

# 4. ตรวจ output
node -e "console.log('messages:',JSON.parse(require('fs').readFileSync('.tmp/flex.json','utf8')).length)"
```

## Note ถ้า image ไม่ขึ้น

รูปต้อง https + accessible. ใช้ `manager.cnypharmacy.com/uploads/product_photo/…`
(CNY product photos อยู่ subdomain `manager`). placeholder URL ใน script ใช้
`https://manager.cnypharmacy.com/uploads/product_photo/placeholder.jpg`

## Note: promoLine1/promoLine2 จาก CNY raw

ตอนนี้ Mode B ไม่ extract promoLines จาก CNY response (CNY response ไม่มี field
"ซื้อยกแพ็ค X ลดเพิ่ม Y" แบบสำเร็จรูป). ถ้าต้องการ promo box แสดง:
- Mode A: ส่ง `products` ที่มี `promoLine1`/`promoLine2` ตั้งเองไว้
- Mode B: ผลที่ได้ = ไม่มี promo box (แค่ price + strike-through ถ้ามี discount)

ในอนาคตอยากดึงจาก CNY direct ให้ extend `mapItemToPreviewProduct` ใน build-flex.ts.
