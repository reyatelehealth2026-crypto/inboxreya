# ลด Vercel cost + ลอง deploy บน Netlify / Cloudflare Pages

เอกสารนี้สรุปสิ่งที่ทำใน PR นี้ และวิธีลอง deploy ไปที่ Netlify หรือ Cloudflare Pages

---

## 1) Cost breakdown ของบิลปัจจุบัน

| รายการ | ใช้ไป | $ | สาเหตุหลัก |
|---|---|---|---|
| Fast Origin Transfer | 100.77 GB | **$27.17** | รูป + ไฟล์ใน `/uploads/*` ถูก proxy ผ่าน Next.js function ทุกครั้ง + ไม่มี Cache-Control |
| Fluid Provisioned Memory | 783 GB-Hrs | **$10.36** | route `/api/inbox/realtime` (SSE) เปิดค้าง 4 นาที/connection × maxDuration 300s |
| Fluid Active CPU | 1d 48m | $3.96 | ส่วนใหญ่ตามข้อ 2 |
| Function Invocations | 1.07M | $1.20 | cron ทุก 1 นาที + middleware รันบน asset เกือบทุก request |
| Build Minutes | 8h 43m | $0.17 | deploy บ่อย / build cache ไม่ hit |

**รวมประมาณเดือนละ ~$42**

สามรายการแรกคิดเป็น >95% ของบิล ดังนั้นโฟกัสที่:
1. ลด egress (Fast Origin Transfer) → ใส่ Cache-Control ยาว ๆ ให้ asset และ image
2. ลดเวลา function รันค้าง (SSE) → ลด maxDuration และ self-close เร็วขึ้น
3. ลดความถี่ของ cron + middleware

---

## 2) สิ่งที่ PR นี้แก้ (ใช้ได้ทันทีบน Vercel ปัจจุบัน)

### `vercel.json`
- Cron `* * * * *` (ทุกนาที, 43,200/เดือน) → `*/5 * * * *` (ทุก 5 นาที, 8,640/เดือน) — **-80% invocations**
- `api/inbox/realtime` `maxDuration` 300s → 60s — ลดเวลา function ค้าง
- เพิ่ม `Cache-Control` ยาว ๆ บน:
  - `/_next/static/*` → 1 ปี immutable
  - `/_next/image*` → 30 วัน + SWR
  - `/icons/*` → 1 ปี immutable
  - `/uploads/*` → 1 วัน + SWR (รูป LINE profile แทบไม่เปลี่ยน)
  - `/api/*` → `no-store`
- Security headers: เพิ่ม `Referrer-Policy`

### `next.config.js`
- `compress: true`, `poweredByHeader: false`, `productionBrowserSourceMaps: false` — ลด bundle/egress
- `experimental.optimizePackageImports` สำหรับ `lucide-react`, `date-fns`, `recharts`, `@radix-ui/*` — ลด JS bundle ฝั่ง client → ลด egress
- `images.minimumCacheTTL = 86400` — รูปที่ผ่าน optimizer cache 1 วัน
- `output: 'standalone'` ตอนนี้ skip ทั้ง Vercel/Netlify/CF Pages (ใช้เฉพาะ self-hosted)

### `middleware.ts`
Matcher เดิมเรียก `auth()` (เข้า DB) บน asset และ public API หลายตัว แก้ให้ skip:
- `_next/data`, `manifest.json`, `robots.txt`, `sitemap.xml`
- `api/auth`, `api/webhook`, `api/health`, `api/cron`
- `icons/*`, `uploads/*`
- ไฟล์ `.css .js .map .woff .woff2 .ttf .eot .otf .mp4 .webm` (เพิ่มจากเดิมที่มีแค่รูป)

→ middleware รันน้อยลงเยอะ = ลด `Function Invocations` + ลด DB query

### `src/app/api/inbox/realtime/route.ts`
- self-close 240s → 50s ให้สอดคล้องกับ cap 60s ใหม่
- เพิ่มคอมเมนต์อธิบายว่า Pusher ทำงานเดียวกันอยู่แล้ว ระยะยาวควรปิด SSE ทิ้ง

**ประมาณการ saving (อนุรักษ์นิยม)**
- Cron + middleware: -$0.80/เดือน
- SSE memory hours: -$5–7/เดือน (ขึ้นกับจำนวน connection)
- Egress (cache headers): -$10–18/เดือน (asset/image hit edge cache แทน origin)
- **รวม ~ -$15–25/เดือน** จากบิล $42 → คาดว่าลดเหลือประมาณ $17–27

ขั้นตอนถัดไป (ยังไม่ทำใน PR นี้ แนะนำให้ทดลองทีละขั้น):
1. ปิด SSE ทิ้งไปเลย ใช้ Pusher อย่างเดียว → ตัด Provisioned Memory ทิ้งเกือบหมด
2. ย้ายรูปใน `/uploads/*` ไปอยู่บน R2 / S3 + CDN → ตัด Fast Origin Transfer ส่วนใหญ่
3. รวม cron 5 นาที → 15 นาที ถ้า business ยอมรับ delay ได้

---

## 3) Deploy บน Netlify (drop-in ที่สุด)

### ไฟล์ที่ต้องมี
- `netlify.toml` (มีแล้วใน PR นี้)
- `netlify/functions/cron-broadcasts.mts` (มีแล้ว — ทำหน้าที่แทน Vercel Cron)
- `public/_headers` (มีแล้ว — cache headers สำหรับ static)

### ขั้นตอน
```bash
# 1) ติดตั้ง CLI
npm i -g netlify-cli

# 2) login + link repo
netlify login
netlify link

# 3) ตั้ง env vars (ครั้งแรก)
netlify env:set DATABASE_URL "mysql://..."
netlify env:set DIRECT_DATABASE_URL "mysql://..."
netlify env:set NEXTAUTH_SECRET "$(openssl rand -hex 32)"
netlify env:set NEXTAUTH_URL "https://<your-site>.netlify.app"
netlify env:set INTERNAL_API_SECRET "..."
netlify env:set LINE_CHANNEL_ACCESS_TOKEN "..."
netlify env:set LINE_CHANNEL_SECRET "..."
netlify env:set PUSHER_APP_ID "..."
netlify env:set PUSHER_KEY "..."
netlify env:set PUSHER_SECRET "..."
netlify env:set PUSHER_CLUSTER "ap1"
netlify env:set NEXT_PUBLIC_PUSHER_KEY "..."
netlify env:set NEXT_PUBLIC_PUSHER_CLUSTER "ap1"
netlify env:set CRON_SECRET "$(openssl rand -hex 32)"
netlify env:set REDIS_URL "..."
netlify env:set SLIPMATE_API_KEY "..."

# 4) deploy ทดสอบ
netlify deploy --build

# 5) deploy production
netlify deploy --build --prod
```

### ข้อระวัง
- **SSE realtime route**: Netlify จำกัด timeout 26 วินาที (Pro plan ได้ถึง 5 นาที) — `netlify.toml` ตั้งไว้ที่ 26s แล้ว แต่ถ้าจะใช้จริง แนะนำให้ **ปิด SSE ทิ้งและใช้ Pusher อย่างเดียว** จะ stable กว่ามาก
- **Prisma**: ใส่ `external_node_modules = ["@prisma/client", ...]` ใน `netlify.toml` แล้ว — ถ้า build แล้วฟ้อง `Cannot find module '.prisma/client'` ให้รัน `prisma generate` ใน build command (`postinstall` ใน package.json ทำอยู่แล้ว)
- **Pricing**: Netlify free tier มี 100 GB bandwidth + 125k function invocations + 100 build min/เดือน Pro อยู่ที่ $19/site/เดือน ถ้าใช้แค่นี้ Netlify free จะคุ้มกว่า Vercel เยอะ
- **Cron**: `netlify/functions/cron-broadcasts.mts` ทำงานทุก 5 นาทีอัตโนมัติ — ไม่ต้องเปิด external scheduler

---

## 4) Deploy บน Cloudflare Pages

Cloudflare Pages เร็วและถูกที่สุด (free tier ใจป้ำมาก) แต่รันบน **Workers runtime** ไม่ใช่ Node.js เต็ม ๆ — ดังนั้นมีงานต้องเตรียมก่อนเอา prod ขึ้น

### ไฟล์ที่ต้องมี
- `wrangler.toml` (มีแล้วใน PR นี้)
- `public/_headers` (มีแล้ว — รูปแบบเดียวกับ Netlify)
- `@cloudflare/next-on-pages` (มีใน `devDependencies` อยู่แล้ว)

### ขั้นตอน
```bash
# 1) ติดตั้ง wrangler
npm i -g wrangler

# 2) login
wrangler login

# 3) ตั้ง secrets (ทีละตัว)
wrangler pages secret put DATABASE_URL
wrangler pages secret put NEXTAUTH_SECRET
# ... (ทุก env var เหมือน Netlify)

# 4) build แบบ next-on-pages
npx @cloudflare/next-on-pages

# 5) deploy
wrangler pages deploy .vercel/output/static --project-name=inboxreya
```

หรือ connect GitHub repo บน dashboard.cloudflare.com → Pages → ตั้ง:
- Build command: `npx @cloudflare/next-on-pages`
- Build output directory: `.vercel/output/static`
- Compatibility flags: `nodejs_compat`

### ข้อจำกัด (สำคัญ — อ่านก่อนตัดสินใจ)

| ส่วน | ปัญหา | วิธีแก้ |
|---|---|---|
| Prisma + MySQL | Workers ไม่มี TCP socket → connect MySQL ปกติไม่ได้ | ใช้ **Prisma Accelerate** (`prisma://...`) หรือ MySQL HTTP driver (PlanetScale, TiDB Cloud serverless) |
| `ioredis` | ใช้ TCP — ไม่รันบน Workers | ใช้ Upstash Redis (REST API) แทน |
| Pusher server SDK | ใช้ Node TLS lib | Pusher REST API ก็ใช้ผ่าน `fetch()` ตรง ๆ ได้ ปรับ wrapper เล็กน้อย |
| SSE realtime | Workers stream ได้ แต่ memory จำกัด + ไม่มี `setInterval` แบบ Node | แนะนำใช้ Pusher อย่างเดียวบน CF Pages |
| Playwright | รันใน Workers ไม่ได้แน่นอน | หากใช้แค่ใน build/test ก็ไม่กระทบ — ตอนนี้อยู่ใน `dependencies` ลองย้ายไป `devDependencies` |

**สรุป**: Cloudflare Pages เหมาะใช้เป็น **staging / preview** ก่อน หรือใช้กับ subset ของ feature ที่ไม่ต้อง Prisma/Redis/SSE หาก commit ที่จะย้ายเต็มตัว ต้องวาง refactor 1-2 วัน

---

## 5) สรุปคำแนะนำ

1. **Merge PR นี้** — ลดบิล Vercel ทันที ~$15–25/เดือน โดยไม่กระทบ behavior
2. **ทดลอง Netlify** ที่ subdomain (เช่น `staging.re-ya.net`) ก่อน — เปลี่ยน DNS เมื่อพร้อม Netlify free tier น่าจะคุ้ม
3. **Cloudflare Pages** ไว้ทีหลัง — ต้องวาง refactor Prisma/Redis ก่อน
4. **ปิด SSE realtime route** เป็นขั้นถัดไป (ใช้ Pusher อย่างเดียว) — saving สูงสุดอีกประมาณ $5–10/เดือน และทำให้ portable ทุก platform
