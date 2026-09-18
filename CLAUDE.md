# inboxreya — Claude memory

## LINE broadcast — weekly delivery-route schedule

หาก user สั่ง `/broadcast วัน[ชื่อวัน] [สินค้า] [เวลา]` (หรือพูดทำนอง "บรอดแคสวันจันทร์ ครีม 10 รายการ 11:00") ให้ใช้ **target tags** และ **title** ตามตารางนี้โดยอัตโนมัติ — ไม่ต้องถามซ้ำ:

### Title มาตรฐาน (ทุกวัน)

```
วันนี้มีรอบรับออเดอร์นะคะ ปิดรับออเดอร์ เวลา 14.00
```

### Target tags ตามวัน

| วัน | สายส่ง | Tag IDs | ~ผู้รับ |
|---|---|---|---|
| จันทร์ | สุพรรณบุรี, นครปฐม-นนทบุรี | `[3, 6]` | ~123 |
| อังคาร | ชัยนาท-อุทัยธานี, นครสวรรค์, อยุธยา, ขนส่งเอกชน | `[2, 8, 9, 10]` | ~512 |
| พุธ | ลพบุรี, สิงห์บุรี | `[4, 5]` | ~135 |
| พฤหัสบดี | สุพรรณบุรี, นครปฐม-นนทบุรี, ขนส่งเอกชน | `[3, 6, 10]` | ~481 |
| ศุกร์ | ชัยนาท-อุทัยธานี, นครสวรรค์, อยุธยา | `[2, 8, 9]` | ~149 |
| เสาร์ | ลพบุรี, สิงห์บุรี | `[4, 5]` | ~135 |

> ขนส่งเอกชน (tag id=10) ส่งเฉพาะวัน **อังคาร / พฤหัสบดี** → cover broadcast 2 วันนี้ join purple box "📦 ขนส่งเอกชน ตัดรอบ 15:00".

### Tag reference (จาก `/api/inbox/tags`)

| id | name |
|---|---|
| 2 | สายส่งชัยนาท - อุทัยธานี |
| 3 | สายส่งสุพรรณบุรี |
| 4 | สายส่งลพบุรี |
| 5 | สายส่งสิงห์บุรี |
| 6 | สายส่งนครปฐม - นนทบุรี |
| 8 | สายส่งนครสวรรค์ |
| 9 | สายส่งอยุธยา |
| 10 | ขนส่งเอกชน |
| 17 | ทดสอบบรอดแคสต์ (4 คน — ใช้สำหรับ test) |

### ลำดับขั้นที่ user มักจะข้าม

User มักไม่ระบุ Target / Title / CTA เมื่อสั่ง broadcast ตามวัน. ใช้ defaults:
- **Target**: ตามตาราง schedule รายวัน
- **Title**: ตามที่ระบุข้างต้น
- **CTA**: `ทักแชทสั่งซื้อ` (default) เว้นแต่ user สั่งอื่น

ยังต้องขอ explicit approve ก่อน POST submit (plugin hard rule #8).

## LINE broadcast — runtime command shortcuts

User มักสั่งงานสั้นๆ เหล่านี้. ทำตามทันทีโดยไม่ต้องถามซ้ำ (ยังขอ explicit approve ก่อน POST จริง):

| User สั่ง | Claude ทำ |
|---|---|
| `อัพเดตราคา broadcast ทุกรอบ` | refresh CNY cache (~60s) → cancel scheduled broadcasts ทั้งหมด → re-submit ทุกอันด้วยสินค้า/ราคาชุดใหม่ |
| `อัพเดตราคา [ช่วงวัน]` (เช่น "อัพเดตราคา 1-7 มิ.ย.") | refresh + re-submit เฉพาะช่วงวันที่ระบุ |
| `refresh ราคาสินค้า` | `node $PLUGIN/scripts/refresh-cache.cjs` อย่างเดียว ไม่ touch broadcasts |
| `ยกเลิก broadcast ทั้งหมด` | DELETE scheduled broadcasts ทั้งหมด ไม่ re-submit |
| `เช็คสถานะ broadcast` | list scheduled broadcasts ที่เหลือ + ที่ sent วันนี้ (จาก `/api/inbox/broadcasts?status=...`) |

### Snapshot behavior — สำคัญ

Broadcast flex content (รวม ราคา/สต็อก/โปร/ชื่อ) ถูก **snapshot ใน DB ตอน POST** — ระบบ**ไม่ re-fetch CNY API ตอนยิงจริง**. ดังนั้นถ้าราคาสินค้าเปลี่ยนหลัง schedule, ลูกค้าจะเห็นราคาเก่า เว้นแต่ user สั่ง refresh+re-submit. ผมต้องเตือน user เรื่องนี้เป็นระยะ (ทุก ~3-5 วัน) สำหรับ broadcasts ที่ schedule ไกล.

### Custom cover bubble (CNY Healthcare design)

ใช้ `.tmp/build-custom-broadcast.cjs` แทน `build-flex-2up.cjs` default cover. Layout:
1. Green header — "วันนี้ เปิดรับออเดอร์นะคะ"
2. Orange/blue side-by-side — ตัดรอบ 14.00 / บริการจัดส่ง ตามรอบสายส่ง
3. Purple box (conditional, dow=2/4) — "📦 ขนส่งเอกชน ตัดรอบ 15.00 น. (ออเดอร์ก่อนล่วงหน้า 1 วัน)"
4. Center teaser + body text + green CTA "สอบถามโปรโมชั่นสัปดาห์นี้"

Conditional logic: `payload.showPrivateLogistics === true` → render purple box. ตั้งใน batch-submit.cjs ตาม `dow === 2 || dow === 4`.

### Batch scripts (.tmp/, gitignored)

- `.tmp/build-custom-broadcast.cjs` — generate flex JSON with conditional purple box
- `.tmp/batch-submit.cjs start=YYYY-MM-DD end=YYYY-MM-DD` — bulk-create broadcasts for delivery-day range (skip Sundays, 11:00 BKK, 10 random promo SKUs each)
- ใช้ Bangkok-correct dates via `toLocaleString('sv-SE', {timeZone:'Asia/Bangkok'})` — `Date.toISOString().slice(0,10)` คืน UTC date ผิด

## LINE broadcast — price-change announcement template

ถ้า user สั่งทำนอง `แจ้งปรับราคาสินค้า [กลุ่ม X] [+/-N%] [มีผล วันที่]` (เช่น "แจ้งปรับราคา ANB ขึ้น 20% มีผล 1 มิ.ย.") ให้ใช้ template นี้:

### Script: `.tmp/build-price-change-flex.cjs`

```
node .tmp/build-price-change-flex.cjs <payload.json> > flex.json
```

**Payload:**
```jsonc
{
  "brandName": "ANB",
  "pricePctIncrease": 20,
  "effectiveDate": "1 มิถุนายน 2569",
  "title": "แจ้งปรับราคา ANB +20%",
  "ctaLabel": "สอบถามเพิ่มเติม",
  "actionUrl": "https://www.cnypharmacy.com",
  "closingText": "📢 ปรับราคาสินค้ากลุ่ม ANB +20% มีผล 1 มิถุนายน 2569 — ทักแชทสอบถามได้เลยค่ะ 👇",
  "products": [{ "sku": "...", "name": "...", "image": "https://...", "oldPrice": 1136, "unit": "ชิ้น", "stock": 12 }]
}
```

### Design ที่ user approve แล้ว

**Cover bubble:**
1. 🔴 Red header — "📢 แจ้งปรับราคา / สินค้ากลุ่ม {BRAND}"
2. 🟡 Yellow box — "ปรับราคา / **+N%** / ทุกรายการในกลุ่ม {BRAND}"
3. 🟠 Orange pill — "🗓 มีผลตั้งแต่ / {DATE}"
4. Body note — "รายการสินค้าและราคาก่อนปรับ ▼"
5. 🟢 CTA "{ctaLabel}"

**Product bubble (1 ต่อ 1 สินค้า):**
1. Hero 4:3
2. รหัส (เทาเล็ก)
3. ชื่อสินค้า (bold)
4. **ราคาปัจจุบัน** (ใหญ่ bold) `฿X / unit` — **ไม่ใส่ราคาใหม่**
5. 🔴 Red note box (border แดง, bg #FEF2F2) — "📢 หมายเหตุ / ปรับขึ้น +N% มีผล {DATE}"
6. 🟢 CTA

### Filter pattern หาสินค้าตามกลุ่ม

ค้นใน `name + nameEn + specName` (uppercase) แล้วเช็คว่ามี keyword หรือ `[KEYWORD]` (CNY ใส่ supplier tag ใน bracket ที่ท้ายชื่อ เช่น `[ANB]`, `[BJC]`, `[PAC]`):

```js
const matched = cache.products.filter(p => {
  const t = (p.name + ' ' + (p.nameEn||'') + ' ' + (p.specName||'')).toUpperCase();
  return (t.includes('ANB') || t.includes('[ANB]')) && p.stock > 0 && p.basePrice > 0 && p.image;
});
```

### Preview ก่อน submit

ใช้ `.tmp/render-preview-anb.cjs` (playwright + chromium ที่ `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) render HTML mockup ของ cover + sample product bubble เป็น PNG ส่งให้ user ดูก่อน. **อย่า submit จริงจนกว่า user approve.**

## LINE broadcast — post-submit deliverable

**ทุกครั้งหลัง POST submit สำเร็จ ส่งไฟล์ flex JSON ที่ใช้กลับให้ user เลย** ผ่าน `SendUserFile`. ใช้ pretty-printed (`JSON.stringify(..., null, 2)`) เพื่อให้อ่านง่าย. ถ้า user ต้องการ paste ใน LINE Flex Simulator, ให้แยกเป็น 2 ไฟล์เพิ่ม:
- `simulator-bubble.json` — `flex.contents.contents[0]` (cover bubble เดี่ยว, ใช้ Bubble template)
- `simulator-carousel.json` — `flex.contents` (full carousel, ใช้ Carousel template)

ไม่ต้องถามว่าจะส่งไหม — ทำเป็น default หลัง submit ทุกครั้ง
