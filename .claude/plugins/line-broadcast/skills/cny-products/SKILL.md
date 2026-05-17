---
name: cny-products
description: ดึงสินค้า CNY ตาม theme/keywords จาก Next.js endpoint /api/inbox/broadcasts/cny-products (proxy ไปยัง public CNY HTTP API). Returns ExportPreviewProduct[] ที่กินตรงเข้า flex-builder.ts ได้ทันที.
---

# cny-products skill

## Endpoint (ของ plugin)

`GET https://inbox.re-ya.com/api/inbox/broadcasts/cny-products`

ภายในจะ fetch ไปยัง upstream **public** API ของ CNY:

```
https://www.cnypharmacy.com/api/getDataProductIsGroup
  ?page=1
  &sort_product_name=asc
  &sort_product_sku=
  &isPageGroup=            ← ว่าง = ดึงทุก group (production default)
  &paginate_num=100        ← 100 ตัว/หน้า (เพิ่มจาก 25 ที่เป็น default URL ของ admin)
  &search_barcode=
  &product_sub_type=
  &supplier=0
  &see_query=0
  &new_sort_type=0
```

**ไม่ต้อง auth, ไม่ต้อง SSH tunnel** — เป็น public endpoint. response กลับมา ~100 ตัว/page.

> **Tip**: ถ้าเปิด URL นี้บน browser แทน `isPageGroup=` ด้วย `isPageGroup=9` จะได้แค่ 3 ตัว (group เล็ก) — เป็น default URL ที่ admin เปิดบน manager UI

## Query params ของ plugin endpoint

| key | type | default | notes |
|---|---|---|---|
| `theme` | enum | `promotion` | `flash_sale\|promotion\|bestseller\|new_arrival\|product_catalog` |
| `keywords` | string | — | matches `name`, `name_en`, `barcode`, `sku`, `spec_name` (case-insensitive) |
| `skus` | csv | — | ระบุ SKU เฉพาะ เช่น `2570,2569` |
| `limit` | int 1-48 | 12 | จำนวนสินค้าที่ต้องการ (cap) |
| `paginate` | int 1-200 | 100 | จำนวนที่ดึงจาก CNY ต่อ 1 request (upstream) |
| `group` | string | `` (all) | override `isPageGroup` ถ้าจะเจาะกลุ่ม |

## Theme filter logic (ตรงกับ production)

| theme | match condition |
|---|---|
| `flash_sale` | `product_is_flashSale === 1 \|\| data.is_promotion === 1` **AND** `promotion_price < price` |
| `promotion` | `data.is_promotion === 1` |
| `bestseller` | `data.is_bestseller === 1 \|\| customer_buyed > 0` |
| `new_arrival` | `product_is_recommend === 1 \|\| data.is_recommend === 1` |
| `product_catalog` | all |

## Top-up logic

ถ้า theme filter ได้น้อยกว่า `cap`:
1. เริ่มจาก primary matches (theme + keyword + sku)
2. Top-up จาก text-matched catalog ที่ **มี stock** (`product_stock[].stock_num > 0` หรือไม่มี stock data)
3. ตัดที่ `cap` ตัว

ลำดับ: primary มาก่อน top-up เสมอ (preserve relevance ranking)

## Response (success)

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "productId": 2511,
        "sku": "2570",
        "name": "มัยโซเวน แกรนูล 200มก. 60ซอง",
        "imageUrl": "https://www.cnypharmacy.com/uploads/product_photo/2570.jpg",
        "basePrice": 397,
        "promotionPrice": null,
        "unitLabel": "กล่อง[60]",
        "quantity": 1,
        "productUrl": "https://www.cnypharmacy.com/product/2570",
        "isPrescription": false,
        "ribbonText": ""
      }
    ],
    "sourceUrl": "https://www.cnypharmacy.com/api/getDataProductIsGroup?...",
    "fetchedAt": "2026-05-17T20:30:00.000Z"
  }
}
```

Shape ของ `products[i]` ตรงกับ `ExportPreviewProduct` ใน `src/lib/flex-builder.ts` → ส่งต่อ `buildPromoMessages` / `buildDetailMessages` ได้เลย.

## Error responses

| status | meaning | hint |
|---|---|---|
| 401 | not logged in | login → save cookie ลง `.auth-cookie` |
| 400 | invalid query | ตรวจ enum values |
| 500 | CNY API down / network | retry หลัง 30s |

## Caching

ใช้ Redis (`cacheQuery`) TTL 5 นาที (`CACHE_TTL.ANALYTICS`). Cache key รวม theme + keywords + skus + limit + paginate + group.

## Example agent usage

```bash
# Flash sale 6 ตัว — keyword="วิตามินซี"
curl -sS --cookie "$(cat .auth-cookie 2>/dev/null)" \
  "https://inbox.re-ya.com/api/inbox/broadcasts/cny-products?theme=flash_sale&keywords=$(printf %s 'วิตามินซี' | jq -sRr @uri)&limit=6" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log('count:',d.data?.products?.length);console.log(JSON.stringify(d.data?.products?.[0],null,2))"
```

## Upstream response fields (CNY API)

ดูจาก `https://www.cnypharmacy.com/api/getDataProductIsGroup`:

```
product: [{
  product_data: [{id, sku, name, name_en, spec_name, barcode,
                  is_recommend, is_promotion, is_bestseller}],
  product_photo: [{photo_path}],          // relative — prepend CNY_BASE
  product_unit:  [{unit, unit_num}],
  product_price: [{ product_price: [{price, promotion_price, buy_min, buy_max}] }],
  product_stock: [{stock_num}],
  product_is_flashSale: 0|1,
  product_is_recommend: 0|1,
  customer_buyed:       int,
  is_rx:                0|1,
}]
```

Mapping: ดู `mapItemToPreviewProduct()` ใน `src/app/api/inbox/broadcasts/cny-products/route.ts`.
