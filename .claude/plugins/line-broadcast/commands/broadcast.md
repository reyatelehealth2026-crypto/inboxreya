---
name: broadcast
description: สร้าง LINE broadcast จากคำสั่งภาษาธรรมชาติ (chat approval, ไม่ต้อง local dev server)
argument-hint: <intent เช่น "โปรโมชั่นประจำวัน 18 ส่งเย็นนี้ tag=VIP">
---

# /broadcast — สร้าง LINE broadcast ใน Claude Code chat

ใช้ผ่าน chat ปกติได้เลย **ไม่ต้องเปิด `npm run dev`** — plugin เรียก CNY public API ตรง + prod inbox.re-ya.com ตรง

## Prerequisites (ทำครั้งเดียว)
1. Login `https://inbox.re-ya.com` → copy NextAuth cookie → save ลง `.auth-cookie` ที่ root project (1 บรรทัด):
   ```
   __Secure-next-auth.session-token=eyJhbGc…
   ```
2. `npm install` (ต้องมี `tsx` ใน devDeps — มีอยู่แล้ว v4.19.2)

## Endpoints ที่ plugin ใช้

| Step | Endpoint |
|---|---|
| Fetch products | `https://www.cnypharmacy.com/api/getDataProductIsGroup?paginate_num=100&isPageGroup=` (public, no auth) |
| Estimate recipients | `https://inbox.re-ya.com/api/inbox/broadcasts/estimate` (prod, needs cookie) |
| List scheduled (conflict check) | `https://inbox.re-ya.com/api/inbox/broadcasts?status=scheduled&limit=50` |
| Submit broadcast | `https://inbox.re-ya.com/api/inbox/broadcasts` (prod, needs cookie) |
| Build Flex JSON | `npx tsx .claude/plugins/line-broadcast/scripts/build-flex.ts` (local Node) |

## ตัวอย่าง intent

- `/broadcast โปรโมชั่นประจำวันที่ 18 6 รายการ tag=VIP ศุกร์ 18:00`
- `/broadcast flash sale วิตามินซี 4 รายการ all พรุ่งนี้ 10:00`
- `/broadcast bestseller ของลด ส่งเย็นนี้`

## Flow (7 phases)

### Phase 1 — Parse intent
อ่าน `$ARGUMENTS`, แยกออกเป็น:
- `theme`: `flash_sale | promotion | bestseller | new_arrival | product_catalog`
  - default: "โปร" → promotion, "flash"/"ลดล้าง" → flash_sale, "ขายดี" → bestseller, "ใหม่"/"new" → new_arrival
- `keywords`: free-text filter (เช่น "วิตามินซี"; ปล่อยว่างได้)
- `productCount`: N (default 6, cap 12)
- `target`: `{mode:'all'}` หรือ `{mode:'tags', tagNames:[...]}` หรือ `{mode:'segment', id}`
- `scheduledAt`: ISO 8601 (Asia/Bangkok เป็น +07:00)

ถ้ากำกวมตรงไหน → ถาม user 1 รอบ.

### Phase 2 — Fetch CNY products + estimate recipients (ขนาน)

```bash
mkdir -p .tmp

# Public CNY API — ไม่ต้อง auth
curl -sS --max-time 15 \
  "https://www.cnypharmacy.com/api/getDataProductIsGroup?page=1&sort_product_name=asc&isPageGroup=&paginate_num=100&supplier=0&see_query=0&new_sort_type=0" \
  -o .tmp/cny-raw.json

# Estimate recipients ที่ prod
curl -sS --cookie "$(cat .auth-cookie)" --max-time 10 \
  -X POST -H 'Content-Type: application/json' \
  -d '{"targetTagIds":[<ids>]}' \
  https://inbox.re-ya.com/api/inbox/broadcasts/estimate \
  -o .tmp/estimate.json
```

ตรวจ:
- `cny-raw.json` ต้องมี `product[]` length > 0 (โดยปกติ ~100)
- `estimate.json.data.totalRecipients` > 0 — ถ้าเป็น 0 → reject + ขอขยาย target

### Phase 3 — **ถาม user 2 คำถามก่อน build Flex** ⚡

ใช้ `AskUserQuestion` tool ส่ง 2 questions ใน 1 call:

**Q1: "หัวข้อ Flex จะตั้งว่าอะไร?"** (header: "Title")
- options ตาม theme:
  - `promotion` → "โปรโมชันพิเศษ" / "โปรโมชั่นประจำวัน" / "ดีลพิเศษวันนี้"
  - `flash_sale` → "Flash Sale" / "ลดล้างสต็อก" / "นาทีทอง"
  - `bestseller` → "สินค้าขายดี" / "ขายดีประจำสัปดาห์"
  - `new_arrival` → "สินค้าใหม่" / "มาใหม่!"
- ผู้ใช้เลือก "Other" → พิมพ์เอง

**Q2: "ปุ่มกดบน Flex ใช้คำว่าอะไร?"** (header: "CTA")
- options: "ซื้อเลย" / "สั่งทันที" / "ดูรายละเอียด" / "ทักแชทเลย"
- ผู้ใช้เลือก "Other" → พิมพ์เอง

### Phase 4 — Build Flex JSON (local, ไม่ต้อง localhost)

```bash
node -e "
const fs=require('fs');
const cny=JSON.parse(fs.readFileSync('.tmp/cny-raw.json','utf8'));
const payload={
  cny,
  theme:       '<theme>',
  keywords:    '<keywords>',        // omit ถ้าไม่มี
  limit:       <N>,
  template:    '<theme>',
  title:       '<Q1-answer>',
  intro:       '<theme-default-intro>',
  footerText:  'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย',
  ctaLabel:    '<Q2-answer>',
  themeColor:  'rose',              // ตาม template (promotion=rose, flash_sale=amber, ...)
  actionUrl:   'https://www.cnypharmacy.com',
  closingText: 'ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ 👇',
  productsPerBubble: 6,
  bubbleSize:  'giga'
};
fs.writeFileSync('.tmp/flex-payload.json', JSON.stringify(payload));"

cat .tmp/flex-payload.json \
  | npx tsx .claude/plugins/line-broadcast/scripts/build-flex.ts \
  > .tmp/flex.json
```

ถ้า script exit non-zero → แสดง stderr + abort + ขอ user แก้.

### Phase 5 — Render preview ใน chat

```
📣 Broadcast preview — <theme>
─────────────────────────────────────
🎯 Target:    <tagNames> (<recipientCount> คน)
⏰ Send at:   <scheduledAtDisplay> (Asia/Bangkok)
🧾 Flex msgs: <messages.length> (1 cover + <gridCount> grid + 1 closing text)
📦 Products (<N>):
   1. [SKU 4092] เม็ดอมตรีผลา — ฿138 (จาก ฿146) ▼6%
   2. [SKU 0823] ACCU-CHEK PERFORMA — ฿593 (จาก ฿595)
   …
🎨 Theme: <theme> | Title: "<title>" | CTA: "<ctaLabel>"
📝 Closing: ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ 👇

⏳ ตอบ "approve" เพื่อบันทึก scheduled broadcast, "แก้ <…>" เพื่อแก้, "cancel" เพื่อยกเลิก
```

### Phase 6 — รอ approve
- `approve`/`ตกลง`/`ส่งเลย` → ไป Phase 7
- `แก้ title` / `แก้ ปุ่ม` → กลับ Phase 3 ถามใหม่
- `แก้ <สินค้า>` → กลับ Phase 2 พร้อม keywords ใหม่
- `cancel`/`ยกเลิก` → จบ

### Phase 7 — POST submit ที่ prod

```bash
PAYLOAD=$(node -e "
const flex=require('./.tmp/flex.json');
console.log(JSON.stringify({
  flexContents: flex,
  scheduledAt:  '<iso>',
  targetTagIds: [<ids>],
  content:      ''
}))")

curl -sS -X POST https://inbox.re-ya.com/api/inbox/broadcasts \
  -H 'Content-Type: application/json' \
  --cookie "$(cat .auth-cookie)" \
  --max-time 20 \
  -d "$PAYLOAD" \
  > .tmp/submit-result.json

node -e "const r=require('./.tmp/submit-result.json'); if(!r.success){console.error('FAIL:',r.error,r.details);process.exit(1)} console.log('OK id='+r.data.id+' status='+r.data.status)"
```

ตรวจ exit code 0 แล้วสรุป:

```
✅ Broadcast #<id> created — status=scheduled, send <scheduledAtDisplay>
   📅 ดูใน MyCalendar:  https://inbox.re-ya.com/inbox/calendar
   📋 ดูใน Broadcasts:  https://inbox.re-ya.com/inbox/broadcasts

⏱  cron `/api/cron/process-scheduled-broadcasts` (ทุกนาที) จะ pick up + ส่งจริงเมื่อถึงเวลา
```

## Hard rules

- ห้าม POST ก่อนได้ approve ที่ชัดเจน (ระวัง "ดี"/"น่าสนใจ" ไม่ถือเป็น approve)
- ห้าม curl ไป LINE API ตรง — ระบบส่งผ่าน cron pipeline เดิม
- `flexContents.length` ≤ 5 (LINE quota — `build-flex` reject ให้แล้ว)
- `scheduledAt` >= now + 2h (เว้นแต่ user ระบุชัดว่าต้องการเร็วกว่านั้น — confirm ก่อน)
- Cookie expired → 401 → ขอ user re-login + update `.auth-cookie`

## Arguments
`$ARGUMENTS` = natural-language intent (ไทย/อังกฤษผสมได้). ถ้าว่าง:
*"อยากส่ง broadcast หัวข้ออะไร, สินค้ากลุ่มไหน, ส่งให้ใคร, เมื่อไหร่?"*
