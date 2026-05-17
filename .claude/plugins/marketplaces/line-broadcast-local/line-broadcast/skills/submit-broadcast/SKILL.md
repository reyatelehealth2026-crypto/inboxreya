---
name: submit-broadcast
description: POST broadcast ไปที่ prod inbox.re-ya.com (ไม่ต้อง local dev server). ใส่ scheduledAt → status='scheduled'. ไม่ใส่ → draft.
---

# submit-broadcast skill

## Endpoint (prod)

`POST https://inbox.re-ya.com/api/inbox/broadcasts`

**Auth**: NextAuth session cookie จาก prod login → save ลง `.auth-cookie`.

## Payload

```json
{
  "flexContents": [
    { "type":"flex","altText":"โปรโมชันพิเศษ","contents":{"type":"carousel","contents":[/* bubbles */]} },
    { "type":"text","text":"ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ 👇" }
  ],
  "scheduledAt": "2026-05-22T11:00:00.000Z",
  "targetTagIds": [42],
  "content": ""
}
```

### Field rules

| field | type | required | notes |
|---|---|---|---|
| `flexContents` | array (max 5) | yes | จาก `build-flex.ts` ที่ output JSON มาแล้ว |
| `scheduledAt` | ISO 8601 UTC | optional | **ใส่** → `status='scheduled'`; **ไม่ใส่** → `status='draft'` |
| `scheduledDates` | ISO array (≤31) | optional | สร้างหลาย record พร้อมกัน |
| `targetTagIds` | int array | optional | target ตาม tag |
| `targetSegmentId` | int | optional | target ตาม segment |
| `targetCustomerIds` | int array | optional | target ตาม customer ID |
| `content` | string ≤5000 | optional | (ใช้ปิดท้ายแบบ text — ปกติเราใส่ใน flexContents เป็น text message อยู่แล้ว) |

ถ้าไม่ระบุ target* → ส่งทุกคนใน account (`target.mode='all'`)

## ตัวอย่างเรียก (manual approval path)

```bash
PAYLOAD=$(node -e "
const flex=require('./.tmp/flex.json');
console.log(JSON.stringify({
  flexContents: flex,
  scheduledAt:  '2026-05-22T11:00:00.000Z',
  targetTagIds: [42]
}))")

curl -sS -X POST https://inbox.re-ya.com/api/inbox/broadcasts \
  -H 'Content-Type: application/json' \
  --cookie "$(cat .auth-cookie)" \
  --max-time 20 \
  -d "$PAYLOAD" \
  > .tmp/submit-result.json

node -e "
const r=require('./.tmp/submit-result.json');
if(!r.success){console.error('FAIL:',r.error,r.details);process.exit(1)}
console.log('Broadcast #'+r.data.id+' status='+r.data.status+' send='+r.data.scheduledAt)
"
```

## ตัวอย่างเรียก (auto-cycle draft path)

ตัด `scheduledAt` ออก → record `status='draft'`:

```bash
PAYLOAD=$(node -e "
const flex=require('./.tmp/flex.json');
console.log(JSON.stringify({
  flexContents: flex,
  targetTagIds: [42]
}))")

curl -sS -X POST https://inbox.re-ya.com/api/inbox/broadcasts \
  -H 'Content-Type: application/json' \
  --cookie "$(cat .auth-cookie)" \
  -d "$PAYLOAD"
```

แอดมินเปิด `https://inbox.re-ya.com/inbox/broadcasts` → กด **Schedule** บน draft → cron pickup.

## Response (success)

```json
{
  "success": true,
  "data": {
    "id": 1247,
    "lineAccountId": 3,
    "scheduledAt": "2026-05-22T11:00:00.000Z",
    "status": "scheduled",
    "totalRecipients": 1234,
    "createdAt": "2026-05-17T10:00:00.000Z"
  }
}
```

## Errors

| status | meaning | hint |
|---|---|---|
| 400 | Zod validation fail | แสดง `details[]` ให้ user เห็น (เช่น `flexContents.length > 5`) |
| 401 | cookie expired | re-login + update `.auth-cookie` |
| 500 | server error | retry หลัง 30s — log ใน prod (`pm2 logs inboxreya`) |

## After-submit verification

ใน prod DB (SSH):
```sql
SELECT id, status, scheduled_at, total_recipients, created_at
FROM broadcast_messages_v2
ORDER BY id DESC LIMIT 1;
```

หลังถึงเวลา (≤ 1 นาที):
```sql
SELECT status, delivered_count, total_recipients
FROM broadcast_messages_v2 WHERE id=<id>;
-- สำเร็จ: status='sent', delivered_count>0
```

Cron pickup ทุกนาทีตาม `vercel.json crons[0].schedule = '* * * * *'`.

## Hard rules

- Plugin ไม่ POST ก่อน user approve ใน chat (manual path)
- Auto-cycle ไม่ใส่ `scheduledAt` (ปล่อยให้ admin schedule ใน prod UI)
- ถ้า 400 → โชว์ `details` ทั้งหมด, อย่ากลืน error
