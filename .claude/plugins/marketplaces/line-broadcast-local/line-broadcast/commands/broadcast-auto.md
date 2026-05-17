---
name: broadcast-auto
description: ลงทะเบียน auto-cycle broadcast ที่ระบบจะสร้าง draft ตามรอบ
argument-hint: <intent> <cron expr เช่น "0 17 * * 5">
---

# /broadcast-auto — auto-cycle broadcast (รอบโปรอัตโนมัติ)

ลงทะเบียน task ที่ระบบจะรันเองตามรอบ. แต่ละรอบ agent จะสร้าง broadcast แบบ
**draft** (ยังไม่ scheduled) — แอดมินเปิดหน้า `/inbox/broadcasts` เพื่อตรวจ Flex
แล้วกด Schedule ใน UI ที่มีอยู่.

## วิธีทำงาน

1. **Parse arguments** — แยก intent กับ cron expr จาก `$ARGUMENTS`. รูปแบบที่รับ:
   - `/broadcast-auto promotion ครีมกันแดด 8 รายการ "0 17 * * 5"` (cron quoted)
   - `/broadcast-auto flash sale วิตามินซี 6 รายการ ทุกศุกร์ 17:00` (NL time → agent แปลงเป็น cron)

   ถ้าไม่มี cron expr ที่ชัด ให้ถามผู้ใช้.

2. **Dry-run validate** — delegate ไปที่ `broadcast-builder` agent โดยส่ง intent
   พร้อม flag `dry_run: true`. ต้องการให้ agent คืน preview ครั้งเดียวเพื่อ:
   - ยืนยันว่า theme + products + target ถูกต้อง
   - แสดงให้ผู้ใช้เห็นว่า "รอบหน้าจะหน้าตาประมาณนี้"
   ห้าม POST อะไรในขั้นนี้.

3. **รอ confirm** — ผู้ใช้ตอบ approve → ไปข้อ 4.

4. **ลงทะเบียน CronCreate** ด้วย schedule ที่ parse ได้ + initial prompt:
   ```
   ARGUMENTS=<intent>
   <invoke /broadcast headlessly with auto_draft=true>
   ```
   ใช้ ToolSearch โหลด `CronCreate` ถ้ายังไม่ได้โหลด.

5. **แต่ละ tick (ทำงานเงียบ ๆ)** — agent ทำงานเหมือน `/broadcast` แต่:
   - POST `/api/inbox/broadcasts` **ไม่ใส่** `scheduledAt` → status `draft`
   - แทนที่จะรอ approve ใน chat → จบเลย, ไม่ render preview
   - log ลง stdout: `[broadcast-auto] tick <ts>: created draft #<id>`

6. **แอดมินตรวจ** — เปิด `https://inbox.re-ya.com/inbox/broadcasts` → เห็น draft
   ใหม่ในรายการ → คลิกตรวจ Flex → กด Schedule (UI ที่มีอยู่).

7. **สรุปกลับให้ผู้ใช้**:
   ```
   ✅ Auto-cycle registered:
      - cron:   0 17 * * 5  (ทุกศุกร์ 17:00 Asia/Bangkok)
      - intent: <full intent>
      - mode:   creates DRAFT each tick (approve in inbox UI)
      - first run: <next fire time>
   ```

## ข้อควรระวัง

- ห้ามลงทะเบียน cron ที่รัน < ทุกชั่วโมง (ป้องกัน spam drafts).
- ถ้า dry-run พบ recipientCount=0 → ปฏิเสธการลงทะเบียน.
- ถ้า keyword ใน intent กว้างเกิน (>20 sku match) → เตือนผู้ใช้.
- Auto-cycle ห้ามใส่ `scheduledAt` ตอน POST — ฝั่ง admin ตัดสินเวลาผ่าน UI.

## Arguments

`$ARGUMENTS` — `<intent> <cron expr>` หรือ `<intent> ทุก<เวลา>`. ถ้าไม่ครบ ถามต่อ.
