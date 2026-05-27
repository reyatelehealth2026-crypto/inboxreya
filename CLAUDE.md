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
