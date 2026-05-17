---
name: update-products
description: อัพเดท CNY product cache (JSON + XLSX) สำหรับ /broadcast — ทำเมื่อสต็อก/โปรเปลี่ยน
argument-hint: (ไม่ต้องใส่ arg)
---

# /update-products — อัพเดทโปรสินค้า (CNY product cache)

ดึงสินค้า CNY ทั้งหมด (~6,400 รายการ, ~65 pages) แบบ parallel ลง local cache เพื่อให้ `/broadcast` ใช้งานได้ทันที (instant lookup)

## เมื่อไหร่ควรรัน

- **ครั้งแรก** ก่อนใช้ `/broadcast` (cache ยังไม่มี)
- **ทุก ~24 ชั่วโมง** เมื่อราคา/สต็อก/สถานะโปรเปลี่ยน
- **ทันที** หลังพี่ทีม CNY อัพเดทโปรชุดใหม่ที่ manager
- **ทันที** ถ้า `/broadcast` เตือนว่า cache outdated

## วิธีรัน

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/refresh-cache.cjs"
```

ถ้ายังไม่ได้ติด `xlsx` (ครั้งแรก):

```bash
npm install --prefix "$CLAUDE_PLUGIN_ROOT" --silent
```

(`$CLAUDE_PLUGIN_ROOT` ใน Claude Code = path ของ plugin ปัจจุบัน. ถ้า variable ใช้ไม่ได้ ให้สั่ง absolute path: `/c/Users/Administrator/.claude/plugins/marketplaces/line-broadcast-local/line-broadcast`)

## ผลลัพธ์ (cache)

```
<plugin>/.cache/
├── cny-products.json   ← หลัก (ใช้โดย /broadcast)
└── cny-products.xlsx   ← เปิดใน Excel ดู/edit ได้
```

### Schema JSON

```jsonc
{
  "fetchedAt":   "2026-05-18T04:00:00.000Z",
  "durationMs":  23832,
  "pagesScanned": 65,
  "totalUnique": 4323,
  "summary": {
    "promotion":    142,   // is_promotion=1
    "flash_sale":   71,    // product_is_flashSale=1
    "bestseller":   141,   // is_bestseller=1 OR customer_buyed>0
    "new_arrival":  156,   // is_recommend=1 OR product_is_recommend=1
    "in_stock":     3285,
    "total_unique": 4323
  },
  "products": [{
    "sku": "0141", "productId": 4044,
    "name": "ซีฟอร์ซ-1000 1X10X6'S (ฟอยล์)",
    "nameEn": "C-FORCE 1000MG 10X6'S",
    "specName": "ASCORBIC ACID",
    "image": "https://manager.cnypharmacy.com/uploads/product_photo/0141.jpg",
    "url":   "https://www.cnypharmacy.com/product/0141",
    "basePrice": 422, "promotionPrice": null,
    "unit": "กล่อง[10แผง]", "stock": 53,
    "isPrescription": false,
    "tags": ["promotion", "bestseller"]
  }]
}
```

### XLSX sheets

| Sheet | Rows |
|---|---|
| `all_products` | ทั้งหมด |
| `promotion`    | filter `tags includes 'promotion'` |
| `flash_sale`   | filter `tags includes 'flash_sale'` |
| `bestseller`   | filter `tags includes 'bestseller'` |
| `new_arrival`  | filter `tags includes 'new_arrival'` |

## รายงานผลใน chat

หลัง refresh เสร็จ ให้ render:

```
🔄 อัพเดทโปรสินค้าเสร็จสิ้น (23.8s)
─────────────────────────────────────
📦 Total unique: 4,323 / 6,406 raw
✅ In stock:     3,285

🏷  ตามหมวด:
   • promotion:    142
   • flash_sale:   71
   • bestseller:   141
   • new_arrival:  156

📁 Cache files:
   • <plugin>/.cache/cny-products.json
   • <plugin>/.cache/cny-products.xlsx

⏰ Next refresh แนะนำ: ภายใน 24 ชั่วโมง
```

ถ้า refresh fail (timeout / network) ให้ retry 1 รอบก่อน escalate. ไม่ต้องถาม user.
