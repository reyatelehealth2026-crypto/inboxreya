# line-oa-mcp-ultimate v2.2.2 — ตรวจสอบรีวิว + ชุด patch ครบ 6 ข้อ

> **สรุป:** รีวิวถูกทุกข้อ — verify กับโค้ดจริงแล้ว ไม่ใช่แค่ README
> **ผลลัพธ์:** patch 6 commit, test เพิ่ม 42 เคส, ผ่าน 708/708, tsc + eslint สะอาด
> **สถานะ upstream:** ยังไม่ได้ส่งไปที่ `wasintoh/line-oa-mcp-ultimate` — repo คนอื่น ต้องให้ user ตัดสินใจก่อน

Upstream: https://github.com/wasintoh/line-oa-mcp-ultimate @ `b4b8b26` (v2.2.2, npm `line-oa-mcp-ultimate@2.2.2`)

---

## 1. Baseline — reproduce ได้ตรงตามที่รีวิวอ้าง

clone → `npm install` → รันจริง:

| ตัวชี้วัด | รีวิวอ้าง | วัดได้จริง |
|---|---|---|
| `tsc --noEmit` | ผ่านสะอาด | ✅ 0 error |
| `eslint src tests` | ผ่านสะอาด | ✅ 0 issue |
| Tests | 666 ผ่านหมด | ✅ 666 passed (33 files) |
| Coverage | 86.82% | ✅ 86.82% (8590/9893 statements) |

ตัวเลขตรงเป๊ะทุกช่อง — คนเขียนรีวิวรันจริง

---

## 2. ผลตรวจรายข้อ

| # | ประเด็นในรีวิว | ผลตรวจ | หมายเหตุ |
|---|---|---|---|
| 1 | narrowcast ไม่มี confirm gate + Quota Guardian เป็นหมัน | ✅ **ยืนยัน — critical** | รุนแรงกว่าที่เขียนไว้เล็กน้อย ดูข้างล่าง |
| 2 | `destructiveHint: false` บน tool ที่กู้คืนไม่ได้ | ✅ **ยืนยัน** | เจอเพิ่มอีก 2 tool ที่รีวิวไม่ได้ list |
| 3 | quiet-hours เป็น warn-only | ✅ **ยืนยัน** | `force` ไม่ได้ override อะไรจริง |
| 4 | JSON.parse error หลุด token | ✅ **ยืนยัน** | `registerSecret()` ยังไม่รันจริงตอนนั้น |
| 5 | `uploadRichMenuImage` / `verifyAccessToken` ไม่มี timeout | ✅ **ยืนยัน** | ทั้งคู่ bypass `request()` |
| 6 | `clearTimeout` ยิงก่อนอ่าน body | ✅ **ยืนยัน** | อ่าน body ไม่มีเพดานเลย |

เลขบรรทัดคลาดเล็กน้อย 1 จุด: ssrf-guard อยู่ที่ `src/line/ssrf-guard.ts` ไม่ใช่ `src/security/ssrf-guard.ts` — ไม่กระทบเนื้อหา

### ข้อ 1 หนักกว่าที่รีวิวเขียน

รีวิวบอกว่า narrowcast "ไม่ต้อง confirm และไม่มีการเช็ค quota" — จริง แต่ผลข้างเคียงอีกอย่างคือ **หลังส่ง broadcast สำเร็จ tool รายงาน `recipient_count_estimated: 0`** เพราะค่า 0 ตัวเดียวกันไหลไปโผล่ใน output ด้วย แปลว่า agent ที่อ่าน structured output จะเข้าใจว่า "ส่งไปแล้วไม่ถึงใครเลย" ทั้งที่เพิ่งยิงถึงทั้ง OA

### ข้อ 2 เจอเพิ่ม 2 ตัว

รีวิว list ไว้ 4 tool — ตรวจ mode enum ทุกไฟล์แล้วเจอ defect class เดียวกันอีก 2:

- `line_manage_rich_menu_alias` — มี `mode: "delete"`
- `line_manage_coupon` — มี `mode: "discontinue"` ซึ่ง **tool description ของตัวเองเขียนว่า "(irreversible)"**

patch แก้ทั้ง 6 ตัว

### ข้อ 3 มีผลข้างเคียงที่ต้องรู้ก่อนตัดสินใจ merge

เปลี่ยน quiet-hours เป็น block ทำให้ **test ที่ไม่ pin นาฬิกา กลายเป็น time-dependent** — ผ่านตอนกลางวัน พังตอนกลางคืน (เจอจริงตอนรัน: container อยู่ 23:33 BKK พอดี test พัง 9 เคสทันที) patch เลย pin นาฬิกาใน `beforeEach` ของ 2 suite ที่ยิง `send_now` ผ่าน MCP — ซึ่ง happy-path test ของ upstream ทำอยู่แล้วด้วยเหตุผลเดียวกันเป๊ะ

---

## 3. ชุด patch

6 commit เรียงตามลำดับความเร่งด่วนที่รีวิวแนะนำ (1–2 ก่อน production, 3–6 backlog) — **แต่ละ commit ผ่าน typecheck + lint + test ครบด้วยตัวเอง** (bisect-safe) เลย cherry-pick แยกได้

| ไฟล์ patch | แก้ข้อ | tests |
|---|---|---|
| `0001-fix-send-require-confirm-for-every-uncountable-fan-o.patch` | 1 | 666 → 679 |
| `0002-fix-annotations-mark-the-irreversible-tools-destruct.patch` | 2 | 679 → 694 |
| `0003-fix-send-quiet-hours-refuse-a-send_now-instead-of-wa.patch` | 3 | 694 → 697 |
| `0004-fix-config-never-echo-the-config-file-back-in-a-JSON.patch` | 4 | 697 → 700 |
| `0005-fix-client-put-every-LINE-fetch-under-a-deadline-tha.patch` | 5 + 6 | 700 → 708 |
| `0006-docs-bring-the-guardrail-descriptions-in-line-with-t.patch` | เอกสาร | 708 |
| `all-fixes-combined.diff` | ทั้งหมด | — |

### วิธี apply

```bash
git clone https://github.com/wasintoh/line-oa-mcp-ultimate.git
cd line-oa-mcp-ultimate
git checkout b4b8b26 -b fix/review-2026-08

# ทั้งชุด
git am /path/to/patches/0*.patch

# หรือเฉพาะ 2 ข้อที่ block production
git am /path/to/patches/0001-*.patch /path/to/patches/0002-*.patch

npm install && npm run typecheck && npm run lint && npm test
```

---

## 4. แก้อะไรไปบ้าง

### ข้อ 1 — แก้ที่ราก ไม่ใช่ต่อ if

รีวิวเสนอ 2 ทาง; patch เลือกทางที่รีวิวบอกว่าดีกว่า (`checkQuota` รับ `"unknown"`) **แล้วทำทั้งสองทาง**:

- `estimateRecipients()` คืน `number | "unknown"` แทน 0
- `checkQuota()` รับ `ProjectedMessages = number | "unknown"` — `"unknown"` ต้อง confirm เสมอ และเช็ค **ก่อน** shortcut ของ plan unlimited เพราะ gate นี้มีไว้กัน "ยกเลิกไม่ได้" ไม่ใช่กัน quota
- tool-level gate ยิงก่อน quota round-trip → ถูกบล็อกแล้วไม่เสีย API call เพิ่มเลย (ตรงตามที่รีวิวแนะนำ) และ**อ่านจาก transport ไม่ใช่ list ชื่อ key ของ target** → target shape ใหม่ในอนาคตได้ gate อัตโนมัติ
- `checkQuota` ยังบังคับกฎเดิมไว้เป็น backstop — คนแก้โค้ดทีหลังลืม gate ก็ยังปลอดภัย แค่เสีย roundtrip เพิ่ม 1 ครั้ง
- output เลิกแต่งตัวเลข: ตัด `recipient_count_estimated` ทิ้งแล้วใส่ flag `recipients_unknown: true` แทน
- `dry_run` บอกเรื่อง confirm ตั้งแต่ตอนซ้อม — จุดที่มันฟรี

### ข้อ 3 — soft-block ปลดด้วย force

`send_now` ในช่วง 22:00–08:00 BKK → `isError` + บอกวิธีไปต่อ; `dry_run` / `draft` ไม่โดนบล็อก (ไม่ได้ส่งอะไรจริง) — ตรงตามที่รีวิวเสนอ และใช้ `now` ตัวเดียวกันทั้งการตัดสินและข้อความ เพื่อไม่ให้ส่งตอน 22:00:00 พอดีแล้วรายงานคนละชั่วโมง

### ข้อ 4 — ไม่ส่ง `err.message` ต่อ

คงรูปแบบ `Failed to read config at ${path}: ...` ไว้ (test เดิมของ upstream match regex นี้อยู่) แล้วแทนที่ตัว message ด้วยประเภทความผิดพลาด — JSON พัง vs เปิดไฟล์ไม่ได้

### ข้อ 5 + 6 — deadline ครอบถึง body

`request()` ย้าย `clearTimeout` ไปหลัง `response.text()` และห่อ AbortError ให้กลายเป็น `LineApiError` เหมือน network error อื่น; `uploadRichMenuImage` (60s เพราะ body ถึง 1MB) กับ `verifyAccessToken` (30s) ได้ deadline ของตัวเอง; ย้ายเลข timeout ไปเป็น constant

---

## 5. Test ที่เพิ่ม (42 เคส)

| ไฟล์ | เพิ่ม | คลุมอะไร |
|---|---|---|
| `tests/send-message.e2e.test.ts` | +11 | narrowcast ทั้ง 2 shape (`{audience}`, `{filter}`) ถูกปฏิเสธเมื่อไม่มี confirm พร้อมพิสูจน์ว่า **ไม่มี traffic ไป `/narrowcast` และไม่มีไป `/quota` เลย**, ส่งได้เมื่อ confirm, plan unlimited ก็ยังโดน gate, `dry_run` / `draft`, multicast ไม่ได้รับผลกระทบ, quiet-hours block + boundary 21:59:59 / 22:00:00 |
| `tests/guardrails/quota-guardian.test.ts` | +5 | `"unknown"` ทั้งมี/ไม่มี confirm, บน plan unlimited, ไม่ระบุ transport, และ regression guard ว่า `0` ยังแปลว่า "ศูนย์ข้อความ" ไม่ใช่ "ไม่รู้" |
| `tests/guardrails/tool-annotations.test.ts` | **ใหม่** +15 | อ่าน annotation กลับผ่าน MCP client จริง (สิ่งที่ host ได้รับจริง ไม่ใช่ literal ในซอร์ส) — pin `destructiveHint` ของทุก tool ที่กู้คืนไม่ได้ + ไม่มี tool ไหนปล่อย flag เป็น undefined |
| `tests/security/client-deadlines.test.ts` | **ใหม่** +8 | fake timer + promise ที่ settle ผ่าน AbortSignal เท่านั้น — พิสูจน์ว่า stall ถูกตัดตรง deadline, error ที่ได้เป็น `LineApiError`, LINE error status ยังรายงาน status ตัวเอง, และไม่มี timer ค้าง |
| `tests/guardrails/multi-oa.test.ts` | +3 | config ที่ token อยู่ตรงจุด parse พัง — assert ว่า token, 10 ตัวแรกของ token, ชื่อ key รอบๆ และวลี `is not valid JSON` ของ V8 **ไม่โผล่ใน error** แต่ path และเหตุผลยังอยู่ |

### Mutation test — พิสูจน์ว่า test จับได้จริง

revert แต่ละ fix กลับเป็นพฤติกรรม v2.2.2 แล้วรัน test ใหม่ ทุกตัวแดงหมด (ไม่มีเคสไหน pass ลอยๆ):

| ย้อน fix กลับเป็น v2.2.2 | ผล |
|---|---|
| `estimateRecipients` คืน 0 | 8 failed |
| quiet hours เป็น warn-only | 2 failed |
| `destructiveHint: false` | 1 failed |
| `checkQuota` ตัด branch `"unknown"` | 4 failed |
| `readJson` ส่ง `err.message` ต่อ | 1 failed |
| `clearTimeout` ก่อนอ่าน body | 1 failed |
| `uploadRichMenuImage` ไม่มี signal | 2 failed |

---

## 6. ผลรวม

| | ก่อน | หลัง |
|---|---|---|
| Tests | 666 | **708** (+42) |
| Coverage | 86.82% | **86.94%** |
| `tsc --noEmit` | 0 error | 0 error |
| `eslint src tests` | 0 issue | 0 issue |
| Files changed | — | 18 (+921 / −103) |

---

## 7. ข้อสังเกตเพิ่มเติมสำหรับ CNY (verify แล้วเช่นกัน)

### PDPA — `line_list_followers` คืน user ID ดิบเข้า context จริง

ยืนยัน: `renderMd()` ตัดโชว์แค่ 50 รายการ **แต่ `structuredContent.user_ids` คือ array เต็มทั้งหน้า (สูงสุด 1,000/หน้า)** ซึ่งเข้า transcript ของ host เต็มๆ patch ชุดนี้ไม่ได้แตะเพราะเป็น design decision ไม่ใช่ bug — ถ้าจะใช้ที่ CNY ควรมี ROPA รองรับ หรือขอ upstream เพิ่ม option คืนแค่ count + continuation token

### HTTP mode — active OA เป็น process-wide state

ยืนยันจาก `src/config/multi-oa.ts`: `_activeOaId` เป็น module-level variable ที่ `useOa()` เขียนทับ ไม่ผูกกับ session ตรงกับ known limitation #4 ของ SECURITY.md

**คำแนะนำเดิมของรีวิวยังใช้ได้:** ที่ CNY ให้รัน **stdio** หรือ 1 instance ต่อ 1 agent และ**ส่ง `oa` explicit ทุกครั้ง** อย่าพึ่ง active OA

### SECURITY.md ยังไม่ทันโค้ด

รีวิวสังเกตถูกว่า SECURITY.md ไม่ได้ list ช่องโหว่ narrowcast — และมันเขียนว่า Quota Guardian เป็น "blast-radius limiter" โดยไม่บอกว่า limiter นั้นคำนวณจากตัวเลขที่ broadcast/narrowcast ไม่เคยส่งให้ commit `0006` แก้ SECURITY.md + README + คู่มือไทย 3 ไฟล์ ให้ตรงกับโค้ดหลัง patch

---

## 8. ขั้นต่อไป — รอ user ตัดสินใจ

repo เป็นของ `wasintoh` ไม่ใช่ของ CNY เลยยังไม่ได้ push ไปไหน เลือกได้:

1. **เปิด PR ที่ upstream** — fork แล้วส่ง PR (ต้อง auth GitHub ของ CNY กับ repo นั้นก่อน)
2. **vendor ไว้ใช้เอง** — apply patch กับ copy ของ CNY แล้ว pin version
3. **ส่ง patch ให้เจ้าของตรงๆ** — ไฟล์ใน `patches/` เป็น `git am` format ใช้ได้เลย
