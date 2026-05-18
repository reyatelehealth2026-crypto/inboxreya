---
name: broadcast
description: สร้าง LINE broadcast จากคำสั่งภาษาธรรมชาติ — cache-first, 2-up bubbles, chat approval
argument-hint: <intent เช่น "โปรโมชั่นวิตามินซี 12 รายการ tag=VIP พรุ่งนี้ 10:00">
---

# /broadcast — สร้าง LINE broadcast (cache-first edition)

ใช้ใน chat ได้เลย **ไม่ต้องเปิด `npm run dev`** — อ่านสินค้าจาก local cache (<1s) แทนการ fetch CNY API ทุกครั้ง

## Prerequisites (ทำครั้งเดียว)

1. **Cookie** — login `https://inbox.re-ya.com` → copy NextAuth v5 cookie → save `.auth-cookie` ที่ root project (1 บรรทัด):
   ```
   __Secure-authjs.session-token=eyJhbGc…
   ```
   > ⚠️ ใช้ `authjs` ไม่ใช่ `next-auth` (NextAuth v5/Auth.js เปลี่ยนชื่อ cookie)

2. **Cache สินค้า** — รัน `/update-products` ก่อนใช้งานครั้งแรก (~24 วินาที). หลังจากนั้น `/broadcast` อ่าน cache instant ทุกครั้ง

## Endpoints

| Step | Endpoint | Auth |
|---|---|---|
| Read products | `<plugin>/.cache/cny-products.json` | — (local cache) |
| Resolve tags | `https://inbox.re-ya.com/api/inbox/tags` (GET) | cookie |
| Estimate recipients | `https://inbox.re-ya.com/api/inbox/broadcasts/estimate` (POST `{targetTagIds:[number]}`) | cookie |
| List scheduled | `https://inbox.re-ya.com/api/inbox/broadcasts?status=scheduled&limit=50` | cookie |
| Submit | `https://inbox.re-ya.com/api/inbox/broadcasts` (POST) | cookie |
| Build Flex | `node "$CLAUDE_PLUGIN_ROOT/scripts/build-flex-2up.cjs"` | — |

## ตัวอย่าง intent

- `/broadcast โปรโมชันวิตามินซี 12 รายการ tag=VIP ศุกร์ 18:00`
- `/broadcast flash sale 8 รายการ all พรุ่งนี้ 10:00`
- `/broadcast bestseller ของลด ส่งเย็นนี้ tag=BRODDD,VDO`

## Flow (8 phases)

### Phase 0 — Cache check

```bash
CACHE="$CLAUDE_PLUGIN_ROOT/.cache/cny-products.json"
test -f "$CACHE" || { echo "MISSING — run /update-products first"; exit 1; }
node -e "const d=require('$CACHE'); const age=(Date.now()-new Date(d.fetchedAt))/3600e3; console.log('cache age:', age.toFixed(1),'h, products:', d.totalUnique)"
```

- ถ้าไม่มี cache → บอก user รัน `/update-products` ก่อน (ไม่ทำอัตโนมัติ)
- ถ้า cache > 24h → เตือนแต่ proceed ได้

### Phase 1 — Parse intent

อ่าน `$ARGUMENTS`, แยก:
- `theme`: `flash_sale | promotion | bestseller | new_arrival | product_catalog` (visual styling — color/icon/title)
  - keyword map: "โปร" → promotion, "flash"/"ลดล้าง" → flash_sale, "ขายดี" → bestseller, "ใหม่"/"new" → new_arrival
- `promoFilter`: `all | discount | giveaway | buy_pack` (filter on `promos[]`)
  - keyword map: "ลด %"/"ลดเงิน" → discount, "แถม"/"ฟรี" → giveaway, "ยกแพ็ค" → buy_pack. default `all`
- `keywords`: free-text (เช่น "วิตามินซี")
- `productCount`: N (default 6, cap 12)
- `target`: `{mode:'all'}` | `{mode:'tags', tagNames:[...]}` | `{mode:'segment', id}`
- `scheduledAt`: ISO 8601 Asia/Bangkok (+07:00)

ถ้ากำกวมตรงไหน → ถาม 1 รอบ.

> Cache ตอนนี้เป็น **promo-only** (~2,300 SKU ที่ติดโปร) — ทุกสินค้ามี `promos[]` พร้อม start/end/discount/qty/unit/isBuyPack/isGiveaway. theme ใช้แค่ visual; ของจริงที่จะกรอง = `promoFilter`.

### Phase 2 — Resolve tags + estimate (ขนาน)

```bash
mkdir -p .tmp
COOKIE=$(tr -d '\r\n' < .auth-cookie)

# Resolve tag names → numeric IDs
curl -sS -H "Cookie: $COOKIE" --max-time 10 \
  https://inbox.re-ya.com/api/inbox/tags -o .tmp/tags.json

# Match tagNames → tagIds (NUMBERS), then estimate
curl -sS -H "Cookie: $COOKIE" -H 'Content-Type: application/json' --max-time 10 \
  -X POST -d '{"targetTagIds":[36,31]}' \
  https://inbox.re-ya.com/api/inbox/broadcasts/estimate \
  -o .tmp/estimate.json
```

ตรวจ:
- ถ้า estimate `totalRecipients = 0` → reject + ขอขยาย target
- ถ้า < 10 → เตือนแต่ proceed

### Phase 3 — Pick products from cache

```bash
node -e "
const fs=require('fs');
const cache=JSON.parse(fs.readFileSync(process.env.CLAUDE_PLUGIN_ROOT+'/.cache/cny-products.json','utf8'));
const KW='วิตามินซี';          // จาก intent (free-text)
const THEME='promotion';      // visual theme — promotion|flash_sale|bestseller|new_arrival|product_catalog
const PROMO_FILTER='all';     // all | discount | giveaway | buy_pack
const N=12;
const kw=KW.toLowerCase();
const filtered = cache.products.filter(p => {
  if (p.basePrice <= 0) return false;
  if (kw && !(p.name+p.nameEn+p.specName).toLowerCase().includes(kw)) return false;
  return true;
});
const promoMatch = {
  all:      () => true,
  discount: ps => ps.some(x => x.campaignGroup === 'discount'),
  giveaway: ps => ps.some(x => x.campaignGroup === 'giveaway'),
  buy_pack: ps => ps.some(x => x.isBuyPack),
}[PROMO_FILTER] || (() => true);
const primary = filtered.filter(p => promoMatch(p.promos || []));
const pickIds = new Set(primary.map(p=>p.productId));
const pick = primary.length >= N ? primary.slice(0,N)
  : [...primary, ...filtered.filter(p => !pickIds.has(p.productId))].slice(0,N);
// Re-shape to cny.product[] for build-flex-2up.cjs (carries promos[] through)
const cnyShape = pick.map(p => ({
  product_data: [{ id:p.productId, sku:p.sku, name:p.name, name_en:p.nameEn, spec_name:p.specName }],
  product_photo: [{ photo_path: p.image.replace('https://manager.cnypharmacy.com/','') }],
  product_price: [{ product_price:[{ price:p.basePrice, promotion_price:p.promotionPrice||p.basePrice }] }],
  product_unit:  [{ unit: p.unit }],
  product_stock: [{ stock_num: p.stock }],
  is_rx: p.isPrescription ? 1 : 0,
  promos: p.promos || [],
}));
fs.writeFileSync('.tmp/flex-payload.json', JSON.stringify({
  cny: { product: cnyShape },
  theme: THEME, limit: N,
  title:'<Q1>', intro:'<theme-intro>',
  ctaLabel:'<Q2>', badgeText:'SPECIAL OFFER',
  actionUrl:'https://www.cnypharmacy.com',
  footerText:'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย',
  closingText:'ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ 👇'
}));
console.log('picked', pick.length, 'products');
"
```

### Phase 4 — ถาม user 2 คำถาม (Title + CTA)

ส่ง 2 questions ใน 1 `AskUserQuestion`:
- **Q1 "Title"** ตาม theme:
  - promotion → "โปรโมชันพิเศษ" / "โปรโมชั่นประจำวัน" / "ดีลพิเศษวันนี้"
  - flash_sale → "Flash Sale" / "ลดล้างสต็อก" / "นาทีทอง"
  - bestseller → "สินค้าขายดี" / "ขายดีประจำสัปดาห์"
  - new_arrival → "สินค้าใหม่" / "มาใหม่!"
- **Q2 "CTA"**: "ซื้อเลย" / "สั่งทันที" / "ดูรายละเอียด" / "ทักแชทเลย"

อัพเดท `.tmp/flex-payload.json` ด้วย Q1/Q2 answers ก่อนไป Phase 5.

### Phase 5 — Build Flex (2-up bubbles)

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/build-flex-2up.cjs" .tmp/flex-payload.json > .tmp/flex.json
```

- 1 cover bubble + N product bubbles (1 สินค้า/bubble — รวม SPECIAL OFFER box, promo terms, price, CTA)
- 12 products → 13 bubbles → 2 carousels (12 + 1) — แต่ละ carousel เต็มที่ 12 bubble
- + closing text = 3 LINE messages (within quota 5)
- การ์ดแต่ละใบมี: hero 4:3 → SPECIAL OFFER box (red border + start/end date) → SKU → name → sub-text → promo terms box (red border) → price → CTA

### Phase 6 — Render preview

```
📣 Broadcast preview — <theme> (<keyword>)
─────────────────────────────────────
🎯 Target:    <tagNames> → <recipients> คน
⏰ Send at:   <display> Asia/Bangkok (อีก ~<delta>)
🧾 Flex msgs: <n> (<carousels> carousel × <bubbles> bubbles + 1 closing text)

📐 Layout: 1 bubble = 1 สินค้า (mega, SPECIAL OFFER + promo terms + price)

📦 Bubbles (<N>):
   B1: [SKU] name — โปร: "<promo line>" — ฿X / unit
   ...

🎨 Theme: <theme> | Title: "<title>" | CTA: "<cta>"
📝 Closing: <closingText>
─────────────────────────────────────
⏳ "approve" → submit | "แก้ <…>" → ปรับ | "cancel" → ยกเลิก
```

### Phase 7 — รอ approve
- `approve`/`ตกลง`/`ส่งเลย` → ไป Phase 8
- `แก้ title <ใหม่>` / `แก้ ปุ่ม <ใหม่>` → กลับ Phase 4
- `แก้ สินค้า <kw>` → กลับ Phase 3 ด้วย keyword ใหม่
- `cancel`/`ยกเลิก` → จบ

### Phase 8 — POST submit ที่ prod

```bash
COOKIE=$(tr -d '\r\n' < .auth-cookie)
node -e "
const fs=require('fs');
const all=JSON.parse(fs.readFileSync('.tmp/flex.json','utf8'));
const flex=all.filter(m=>m.type==='flex');
const text=(all.find(m=>m.type==='text')||{}).text||'';
const iso=new Date('<scheduledAt-Bangkok-iso>').toISOString();   // → UTC Z
fs.writeFileSync('.tmp/submit-body.json', JSON.stringify({
  flexContents: flex,                  // ONLY flex msgs (no text)
  scheduledAt:  iso,                   // MUST be UTC with Z suffix
  targetTagIds: [/* numeric ids */],   // MUST be numbers
  content:      text                   // closing text goes here, not in flexContents
}));"

curl -sS -X POST https://inbox.re-ya.com/api/inbox/broadcasts \
  -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  --max-time 25 --data-binary @.tmp/submit-body.json \
  -o .tmp/submit-result.json

node -e "const r=require('./.tmp/submit-result.json'); if(!r.success){console.error('FAIL:',r.error,r.details);process.exit(1)} console.log('OK id='+r.data.id+' status='+r.data.status+' send='+r.data.scheduledAt)"
```

สรุป:

```
✅ Broadcast #<id> created — status=scheduled
   📅 ส่ง:        <Bangkok display>
   👥 Recipients: <n> คน
   🔗 Calendar:   https://inbox.re-ya.com/inbox/calendar
   🔗 Broadcasts: https://inbox.re-ya.com/inbox/broadcasts
```

## Hard rules (lessons learned)

1. **Cookie name** = `__Secure-authjs.session-token` (NextAuth v5). อย่าใช้ `next-auth.session-token`
2. **Cookie via header** = `-H "Cookie: $(tr -d '\r\n' < .auth-cookie)"` (Windows curl อาจมี trailing `\r\n`)
3. **scheduledAt** ต้องเป็น `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC + Z). ใช้ `new Date(bangkokStr).toISOString()`
4. **targetTagIds** ต้องเป็น **number[]** ไม่ใช่ `string[]` (Zod validation)
5. **flexContents** รับเฉพาะ flex messages — text closing ต้องอยู่ใน `content` field
6. **flexContents.length** ≤ 5 (LINE quota)
7. **scheduledAt** >= now + 2h (เว้นแต่ user confirm ชัด)
8. **ห้าม POST ก่อน approve ชัดเจน** — "ดี"/"น่าสนใจ" ไม่นับ
9. **ห้าม curl LINE API ตรง** — submit ผ่าน inbox.re-ya.com แล้ว cron pipeline ส่งเอง
10. Cache > 24h → เตือน + แนะนำ `/update-products` (ไม่ refresh อัตโนมัติ)

## Arguments
`$ARGUMENTS` = natural-language intent (ไทย/อังกฤษผสมได้). ถ้าว่าง:
*"อยากส่ง broadcast หัวข้ออะไร, สินค้ากลุ่มไหน, ส่งให้ใคร, เมื่อไหร่?"*
