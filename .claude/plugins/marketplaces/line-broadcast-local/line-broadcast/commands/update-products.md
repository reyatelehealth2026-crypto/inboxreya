---
name: update-products
description: อัพเดท CNY product cache (JSON + XLSX) สำหรับ /broadcast — ทำเมื่อสต็อก/โปรเปลี่ยน
argument-hint: (ไม่ต้องใส่ arg)
---

# /update-products — อัพเดทโปรสินค้า (CNY product cache)

ดึง **เฉพาะสินค้าที่ติดโปรจริง** (~2,300 SKU จาก 83 campaigns ใน `data_promotion_only`) → enrich ด้วย product detail (image/price/stock) จาก catalog crawl → ลง local cache เพื่อให้ `/broadcast` ใช้งานได้ทันที (instant lookup). ใช้เวลา ~40s

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
  "durationMs":  38500,
  "pagesScanned": 65,
  "rawCount": 6406,
  "campaignsCount": 83,
  "totalUnique": 2369,
  "summary": {
    "discount":     2301,   // promos[].campaignGroup='discount'
    "giveaway":     86,     // promos[].campaignGroup='giveaway'
    "buy_pack":     2288,   // promos[].isBuyPack=true (ซื้อยกแพ็ค)
    "in_stock":     1790,
    "total_unique": 2369,
    "promo_skus_total":     2453,
    "missing_from_catalog": 84
  },
  "missingSkus": ["6669","7105", "..."],
  "products": [{
    "sku": "2288", "productId": ...,
    "name": "3M NEXCARE TRANSPORE 1/2นิ้วx5หลาx12ม้วน [BJC]",
    "nameEn": "...",
    "specName": "...",
    "image": "https://manager.cnypharmacy.com/uploads/product_photo/2288.jpg",
    "url":   "https://www.cnypharmacy.com/product/2288",
    "basePrice": 198, "promotionPrice": null,
    "unit": "กล่อง[12ม้วน]", "stock": 12,
    "isPrescription": false,
    "promos": [{
      "campaignId":   952,
      "campaignType": "discount",
      "campaignGroup":"discount",      // 'discount' | 'giveaway'
      "campaignName": "CNY-BOOM4",
      "startPro":     "2026-04-01 00:00:01",
      "endPro":       "2026-05-31 00:00:01",
      "discount":     5.76,
      "discountUnit": "percent",       // 'percent' | 'baht'
      "qty":          3,
      "unit":         "กล่อง[12ม้วน]",
      "isGiveaway":   false,
      "isBuyPack":    true
    }]
  }]
}
```

### XLSX sheets

| Sheet | Rows |
|---|---|
| `all_promos` | ทั้งหมด |
| `discount`   | filter `promos.some(x=>x.campaignGroup==='discount')` |
| `giveaway`   | filter `promos.some(x=>x.campaignGroup==='giveaway')` |

## รายงานผลใน chat

หลัง refresh เสร็จ ให้ render:

```
🔄 อัพเดทโปรสินค้าเสร็จสิ้น (38.5s) — โหมด: เฉพาะโปรจริง
─────────────────────────────────────
📦 Promo SKUs: 2,369 (จาก 83 campaigns / 2,453 ใน manifest)
✅ In stock:   1,790
❓ Missing from catalog: 84 (อยู่ใน manifest แต่ไม่อยู่ใน catalog)

🏷  ตามประเภทโปร:
   • discount:   2,301
   • giveaway:   86
   • buy_pack:   2,288

📁 Cache files:
   • <plugin>/.cache/cny-products.json
   • <plugin>/.cache/cny-products.xlsx (sheets: all_promos/discount/giveaway)

⏰ Next refresh แนะนำ: ภายใน 24 ชั่วโมง
```

ถ้า refresh fail (timeout / network) ให้ retry 1 รอบก่อน escalate. ไม่ต้องถาม user.
