---
name: send-time-heuristics
description: แนะนำเวลาส่ง LINE broadcast ที่เหมาะสมตาม theme/วันในสัปดาห์ + ตรวจชนกับ scheduled broadcasts อื่น ±1h
---

# send-time-heuristics skill

## Peak windows (Asia/Bangkok)

| day type | peak slots (เรียงตามผลดี) |
|---|---|
| weekday (Mon-Fri) | 11:30, 18:00, 20:30, 09:00 |
| weekend (Sat-Sun) | 10:00, 14:00, 19:00, 21:00 |
| weekday + flash_sale | 17:00, 20:00 (สร้าง urgency หลังเลิกงาน) |
| weekend + flash_sale | 11:00, 20:00 |
| holiday (วันหยุดราชการ) | 10:00, 14:00 |

## Rules

1. **Minimum lead time**: 2 ชั่วโมงนับจาก now. ห้ามแนะนำเวลาที่เร็วกว่า now+2h.
2. **No-broadcast window**: 22:30 - 08:00 (เคารพเวลาพักของผู้รับ).
3. **Conflict zone**: ±1 ชั่วโมงรอบ scheduled broadcasts ที่มีอยู่ของ account
   เดียวกัน — ห้ามชน.
4. **Resolution**: ถ้า slot ที่ดีที่สุดติด conflict → ลอง slot ถัดไป.
   ถ้าหมด slot ของวัน → ขยับเป็น slot แรกของวันถัดไป.
5. **Default if intent ระบุเวลา**: ถ้าผู้ใช้ระบุ "ศุกร์ 18:00" → ใช้เวลานั้นตรง
   ๆ. heuristic ใช้เฉพาะตอนผู้ใช้บอก "เร็วที่สุด" / "เย็นนี้" / ไม่ระบุ.

## Conflict check

ดึง scheduled broadcasts:
```bash
curl -sS --cookie "$(cat .auth-cookie)" \
  "https://inbox.re-ya.com/api/inbox/broadcasts?status=scheduled&limit=50" \
  | jq '.data.broadcasts[] | .scheduledAt' \
  | sort
```

Pseudocode:
```
function suggest(theme, now, targetMode, scheduledTimes):
    candidates = peak_slots(theme, dayOfWeek(now+2h)) shifted to next 7 days
    for slot in candidates:
        if slot < now + 2h: continue
        if slot.hour < 8 or slot.hour > 22: continue
        if any |existing - slot| <= 1h for existing in scheduledTimes:
            continue
        return slot
    return null  # request user to specify manually
```

## Output

```json
{
  "scheduledAt": "2026-05-22T11:00:00.000Z",
  "scheduledAtDisplay": "ศุกร์ 22 พ.ค. 18:00 น. (Asia/Bangkok)",
  "rationale": "Flash sale + ศุกร์เย็น = peak conversion. ไม่มี broadcast อื่นใน ±1h.",
  "conflictsAvoided": []
}
```

ถ้าหาเวลาว่างไม่ได้ใน 7 วัน: return `{ "error": "no_slot", "hint": "ขอเวลาเฉพาะเจาะจง" }`.

## Timezone

ทุก ISO ใน DB / API เป็น UTC. Display string ใช้ Asia/Bangkok (+07:00).
แปลงด้วย:
```js
new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
```
