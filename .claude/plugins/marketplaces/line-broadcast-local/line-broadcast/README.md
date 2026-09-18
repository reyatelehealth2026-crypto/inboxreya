# line-broadcast — Claude Code plugin

สร้าง LINE broadcast ใน inboxreya จากคำสั่งภาษาธรรมชาติ **ผ่าน Claude Code chat
ปกติ ไม่ต้องเปิด `npm run dev`**. agent ดึงสินค้าจริงจาก CNY public API,
สร้าง Flex, ถามหัวข้อ+CTA, แสดง preview, แล้วบันทึก scheduled broadcast ที่
prod (`inbox.re-ya.com`) ให้ cron เดิมส่งจริงเมื่อถึงเวลา

## Commands

- `/broadcast <intent>` — สร้าง broadcast + approve ใน chat → POST prod → cron ส่งจริง
- `/broadcast-auto <intent> <cron>` — auto-cycle (draft แต่ละรอบ → approve ในหน้า /inbox/broadcasts UI)
- `/broadcast-list [status]` — list drafts + scheduled

## Setup (ครั้งเดียว — เร็วมาก)

### 1. Login + save prod cookie
1. เปิด `https://inbox.re-ya.com` → login (Google)
2. DevTools → Application → Cookies → copy `__Secure-next-auth.session-token` (หรือ `next-auth.session-token`)
3. สร้างไฟล์ `.auth-cookie` ที่ root project — 1 บรรทัด:
   ```
   __Secure-next-auth.session-token=eyJhbGc…
   ```

### 2. Verify
```bash
.claude/plugins/line-broadcast/scripts/verify-tunnel.sh
```

ต้องเห็น:
```
→ Pinging CNY public API…
  ✓ CNY OK (10 products in probe page)
→ Pinging prod inbox.re-ya.com…
  ✓ Prod OK (X scheduled broadcast(s) listed)
→ Sanity-running build-flex.ts (synthetic product)…
  ✓ build-flex OK
✓ All checks passed — plugin พร้อมใช้ผ่าน Claude Code chat (ไม่ต้อง npm run dev)
```

### 3. (optional) Allowlist Bash patterns
แก้ `.claude/settings.local.json` เพิ่ม `permissions.allow` เพื่อลด permission prompts:
```json
"Bash(curl -sS https://inbox.re-ya.com/api/inbox/broadcasts *)",
"Bash(curl -X POST https://inbox.re-ya.com/api/inbox/broadcasts *)",
"Bash(curl -sS https://www.cnypharmacy.com/api/* *)",
"Bash(curl --cookie *)",
"Bash(npx tsx *)",
"Bash(.claude/plugins/line-broadcast/scripts/verify-tunnel.sh)"
```

## ใช้งานในแชต

```
/broadcast โปรโมชั่นประจำวันที่ 18 6 รายการ tag=VIP ศุกร์ 18:00
```

ระบบจะ:
1. Parse intent (theme=promotion, N=6, VIP, ศุกร์ 18:00)
2. curl CNY public + curl prod estimate (ขนาน)
3. **AskUserQuestion** ถาม 2 ข้อพร้อมกัน:
   - Q1: หัวข้อ Flex → "โปรโมชันพิเศษ" / "โปรโมชั่นประจำวัน" / "ดีลพิเศษวันนี้" / Other
   - Q2: ปุ่มกด → "ซื้อเลย" / "สั่งทันที" / "ดูรายละเอียด" / "ทักแชทเลย" / Other
4. รัน `build-flex.ts` (local tsx) → ได้ Flex JSON (cover + grid 2×3 + closing text)
5. Render preview ใน chat
6. รอ "approve"
7. POST `https://inbox.re-ya.com/api/inbox/broadcasts` → status='scheduled'
8. → โผล่ใน `https://inbox.re-ya.com/inbox/calendar` (MyCalendar) อัตโนมัติ
9. cron prod (`* * * * *`) ส่ง LINE จริงเมื่อถึงเวลา

## Architecture (no local server)

```
admin in Claude Code: /broadcast …
        │
        ▼
Parse intent (Claude main thread)
        │
        ├─► curl https://www.cnypharmacy.com/api/getDataProductIsGroup?…
        │       (public, no auth — returns ~100 products)
        │
        ├─► curl --cookie prod-cookie POST https://inbox.re-ya.com/.../estimate
        │       (recipient count)
        │
        ▼
AskUserQuestion: title + CTA
        │
        ▼
npx tsx build-flex.ts < payload (raw CNY + theme + title + CTA + …)
        │  filter+map+build_flex ภายในขั้นเดียว
        ▼
Preview ใน chat
        │
        ▼ "approve"
        ▼
curl --cookie prod-cookie POST https://inbox.re-ya.com/api/inbox/broadcasts
        │  + flexContents + scheduledAt + targetTagIds
        ▼
prod DB: broadcast_messages_v2 (status='scheduled')
        ▼
prod cron (* * * * *) → LINE OA
```

## Layout

```
.claude/plugins/line-broadcast/
├─ plugin.json
├─ commands/{broadcast,broadcast-auto,broadcast-list}.md
├─ agents/broadcast-builder.md
├─ skills/{cny-products,flex-compose,send-time-heuristics,submit-broadcast}/SKILL.md
└─ scripts/
   ├─ verify-tunnel.sh    # CNY + prod + tsx sanity-check
   └─ build-flex.ts       # raw CNY → filtered products → Flex JSON (local)
```

## Theme + promo filter (v2 — promo-only cache)

`theme` = visual styling (color/icon/cover title). `promoFilter` = filter on `promos[]` ที่อยู่ในแต่ละ product.

| theme | color | icon | cover title |
|---|---|---|---|
| `promotion`       | `#E53E3E` | 🔥 | "โปรโมชันพิเศษ" |
| `flash_sale`      | `#D69E2E` | ⚡ | "Flash Sale" |
| `bestseller`      | `#15803D` | 🏆 | "สินค้าขายดี" |
| `new_arrival`     | `#805AD5` | ✨ | "สินค้าใหม่" |
| `product_catalog` | `#4299E1` | 🛍️ | "แคตตาล็อคสินค้า" |

| promoFilter | match condition |
|---|---|
| `all`      | (default) ทุก product ที่อยู่ใน cache (cache เป็น promo-only อยู่แล้ว) |
| `discount` | `promos.some(x=>x.campaignGroup==='discount')` |
| `giveaway` | `promos.some(x=>x.campaignGroup==='giveaway')` |
| `buy_pack` | `promos.some(x=>x.isBuyPack)` |

ถ้า primary set ได้น้อยกว่า limit → top-up จาก keyword-matched promo cache (preserve primary order).

## Changelog

- **2026-05-18**: cache เป็น promo-only — ดึงผ่าน `data_promotion_only` (83 campaigns / 2,453 SKUs) → enrich catalog detail. แต่ละ product มี `promos[]` (start/end/discount/qty/unit/isBuyPack/isGiveaway). Template flex ใหม่ตามการ์ดสินค้า cnypharmacy.com (SPECIAL OFFER box + red-bordered promo terms + 1 product/bubble).
- **2026-05-17**: ใช้ผ่าน chat ปกติได้เลย — เรียก CNY public + prod inbox.re-ya.com ตรง,
  ไม่ต้อง `npm run dev`. `build-flex.ts` รวม filter+map+build ในขั้นเดียว.
- **2026-05-17**: เปลี่ยน product source จาก MySQL/SSH-tunnel → public CNY HTTP API.
- **2026-05-17**: เริ่มสร้าง plugin.

## Out of scope (v1)

- AI-generated hero images
- A/B testing variants
- Click-through dashboards
- Editing draft Flex JSON ใน chat (ใช้ FlexBuilderWorkspace ที่ /inbox/broadcasts)
- Pagination ของ CNY API (ตอนนี้ดึงหน้าแรก 100 ตัวพอ)
