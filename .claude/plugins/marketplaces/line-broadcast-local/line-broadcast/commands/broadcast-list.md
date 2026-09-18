---
name: broadcast-list
description: แสดง broadcast drafts + scheduled ใน chat (สำหรับเช็คสถานะ)
argument-hint: [status เช่น "draft,scheduled" หรือ "all"]
---

# /broadcast-list — แสดง broadcast pending review/scheduled

## วิธีทำงาน

1. **Parse `$ARGUMENTS`** — ถ้าว่าง default = `draft,scheduled`. ถ้าเป็น `all` =
   `draft,scheduled,sending,sent,failed,cancelled`.

2. **Fetch** จาก existing API:
   ```bash
   curl -sS \
     --cookie "$(cat .auth-cookie)" \
     "https://inbox.re-ya.com/api/inbox/broadcasts/campaigns?status=<status>&limit=20"
   ```

3. **Render เป็น markdown table**:
   ```
   📡 Broadcasts — status: draft,scheduled

   | #   | title                  | type | target | recipients | scheduled_at      | status    |
   |-----|------------------------|------|--------|-----------:|-------------------|-----------|
   | 123 | Flash Sale วิตามินซี    | flex | VIP    |     1,234  | 2026-05-22 18:00 | scheduled |
   | 122 | สินค้าใหม่ ขายดี       | flex | all    |     8,901  | (draft)          | draft     |
   ```

4. **ไม่มีการสร้าง/แก้ broadcast** ในคำสั่งนี้ — read-only.

## Arguments

`$ARGUMENTS` — comma-separated status filter (optional). Default `draft,scheduled`.
