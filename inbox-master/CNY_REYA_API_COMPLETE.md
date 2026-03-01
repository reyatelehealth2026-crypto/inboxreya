# CNY Re-Ya API Documentation
## Odoo ERP ↔ cny.re-ya.com Integration

**Version:** 2.0.0
**Last Updated:** 2026-02-03
**Module:** `cny_reya_connector`

---

## สารบัญ

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Authentication](#3-authentication)
4. [Webhooks: Odoo → Re-Ya](#4-webhooks-odoo--re-ya)
5. [API Endpoints: Re-Ya → Odoo](#5-api-endpoints-re-ya--odoo)
6. [LINE User Linking](#6-line-user-linking)
7. [Slip Upload & Payment](#7-slip-upload--payment)
8. [Data Models](#8-data-models)
9. [Error Handling](#9-error-handling)
10. [Code Examples (Node.js)](#10-code-examples-nodejs)

---

## 1. Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Communication Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐         Webhooks          ┌─────────────┐                │
│   │   Odoo ERP   │ ─────────────────────────▶│  cny.re-ya  │                │
│   │  (CNY RX)    │         (PUSH)            │   (Bot)     │                │
│   │              │                            │             │                │
│   │              │◀───────────────────────────│             │──────▶ LINE   │
│   │              │      API Requests          │             │                │
│   └─────────────┘         (PULL)             └─────────────┘                │
│                                                                              │
│   erp.cnyrxapp.com                           cny.re-ya.com                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Odoo ส่ง Webhook → cny.re-ya.com** เมื่อเกิด event (state เปลี่ยน, invoice สร้าง, ฯลฯ)
2. **cny.re-ya.com จัดการส่งไป LINE** - Odoo ไม่ส่งตรงไป LINE
3. **cny.re-ya.com เรียก API ดึงข้อมูลจาก Odoo** เมื่อต้องการข้อมูลเพิ่มเติม
4. **Slip Upload** - ลูกค้าส่งสลิปผ่าน LINE → Re-Ya ส่งต่อไป Odoo → Auto matching

### Environments

| Environment | Odoo URL | Re-Ya URL |
|-------------|----------|-----------|
| **Production** | https://erp.cnyrxapp.com | https://cny.re-ya.com |
| **Staging** | https://stg-erp.cnyrxapp.com | https://staging.cny.re-ya.com |

### API Credentials (Staging)

**⚠️ สำหรับ Development/Testing เท่านั้น - Production จะแจ้งแยก**

| Item | Value |
|------|-------|
| **Base URL** | `https://stg-erp.cnyrxapp.com` |
| **API Key** | `iUeWnsQe-SDb1qHS_v9W1-tll__5XK0Sdj35j7QgVpg` |
| **Webhook URL** | กรุณาแจ้ง URL ของ Re-Ya Staging มาที่ทีม Odoo |

---

## 2. Architecture

### API Format: JSON-RPC 2.0

**สำคัญ!** API ใช้ JSON-RPC 2.0 format:

```http
POST /reya/orders HTTP/1.1
Host: erp.cnyrxapp.com
Content-Type: application/json
X-Api-Key: your_api_key

{
  "jsonrpc": "2.0",
  "params": {
    "line_user_id": "U1234567890abcdef",
    "limit": 10
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": { ... }
  }
}
```

### API Routes

**Base URL:** `https://erp.cnyrxapp.com/reya/`

| Category | Route Prefix | Description |
|----------|--------------|-------------|
| Health | `/reya/health` | Health check |
| Orders | `/reya/orders`, `/reya/order/*` | Customer orders |
| Invoices | `/reya/invoices` | Customer invoices |
| Credit | `/reya/credit-status` | Credit status |
| Salesperson | `/reya/salesperson/*` | Salesperson dashboard |
| User Linking | `/reya/user/*` | LINE user linking |
| Slip/Payment | `/reya/slip/*`, `/reya/payment/*` | Slip upload & payment |

### Supported Models & Events

| Model | Event Types | Description |
|-------|-------------|-------------|
| `sale.order` | `order.*` | operation_state เปลี่ยน (รวม picker states) |
| `delivery.operation` | `delivery.departed`, `delivery.completed` | รถออก, ส่งสำเร็จ |
| `account.invoice` | `invoice.created`, `invoice.overdue` | สร้างใบแจ้งหนี้, เกินกำหนด |
| `cny.bill.invoice.before.delivery` | `bdo.*` | BDO state เปลี่ยน + QR Payment |
| `ineco.customer.payment` | `payment.*` | Payment state เปลี่ยน |

### Sale Order Workflow States (Complete)

| State | Thai Name | Notify Customer | Notify Salesperson | Event |
|-------|-----------|-----------------|-------------------|-------|
| `draft` | แบบร่าง | - | - | - |
| `validated` | ตรวจสอบแล้ว | ✅ | ✅ | `order.validated` |
| `picker_assign` | เตรียมจัดสินค้า | ✅ | - | `order.picker_assigned` |
| `picking` | กำลังจัดสินค้า | ✅ | - | `order.picking` |
| `picked` | จัดเสร็จแล้ว | ✅ | - | `order.picked` |
| `packing` | กำลังแพ็ค | ✅ | - | `order.packing` |
| `packed` | แพ็คเสร็จ | ✅ | - | `order.packed` |
| `reserved` | จองสินค้าแล้ว | ✅ | - | `order.reserved` |
| `awaiting_payment` | รอชำระเงิน | ✅ | ✅ | `order.awaiting_payment` |
| `paid` | ชำระแล้ว | ✅ | ✅ | `order.paid` |
| `to_delivery` | เตรียมส่ง | ✅ | ✅ | `order.to_delivery` |
| `in_delivery` | กำลังจัดส่ง | ✅ | ✅ | `order.in_delivery` |
| `delivered` | จัดส่งแล้ว | ✅ | ✅ | `order.delivered` |

---

## 3. Authentication

### Webhook Verification (Odoo → Re-Ya)

Odoo จะส่ง signature ใน header เพื่อให้ Re-Ya verify:

```http
POST /api/webhook/odoo HTTP/1.1
Host: cny.re-ya.com
Content-Type: application/json
X-Odoo-Signature: sha256=a1b2c3d4e5f6...
X-Odoo-Timestamp: 1706918400
X-Odoo-Event: order.validated
X-Odoo-Delivery-Id: wh_12345678
```

**Verify Signature (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhook(req, secret) {
  const signature = req.headers['x-odoo-signature'];
  const timestamp = req.headers['x-odoo-timestamp'];
  const body = JSON.stringify(req.body);

  // Check timestamp (prevent replay attacks - 5 min window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Verify HMAC
  const payload = `${timestamp}.${body}`;
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}
```

### API Authentication (Re-Ya → Odoo)

ใช้ API Key ใน header:

```http
POST /reya/orders HTTP/1.1
Host: erp.cnyrxapp.com
X-Api-Key: your_api_key_here
Content-Type: application/json

{"jsonrpc": "2.0", "params": {"line_user_id": "U..."}}
```

**API Keys:**

| Environment | API Key |
|-------------|---------|
| **Staging** | `iUeWnsQe-SDb1qHS_v9W1-tll__5XK0Sdj35j7QgVpg` |
| **Production** | ติดต่อผู้ดูแลระบบ Odoo (จะแจ้งเมื่อพร้อม deploy)

### Rate Limiting

- **60 requests/minute** per API key
- Response headers:
  - `X-RateLimit-Limit`: 60
  - `X-RateLimit-Remaining`: 55
  - `X-RateLimit-Reset`: 1706918460

---

## 4. Webhooks: Odoo → Re-Ya

### Webhook Endpoint (Re-Ya ต้องจัดเตรียม)

```
POST https://cny.re-ya.com/api/webhook/odoo
```

### 4.1 Order Events

#### `order.validated` - ยืนยันออเดอร์

```json
{
  "event": "order.validated",
  "timestamp": "2026-02-03T10:30:00Z",
  "data": {
    "order_id": 12345,
    "order_name": "SO/2026/00123",
    "old_state": "draft",
    "new_state": "validated",
    "old_state_display": "แบบร่าง",
    "new_state_display": "ตรวจสอบแล้ว",
    "customer": {
      "id": 100,
      "name": "คุณสมชาย ใจดี",
      "line_user_id": "U1234567890abcdef",
      "phone": "081-234-5678"
    },
    "salesperson": {
      "id": 5,
      "name": "นางสาวสมหญิง ขายเก่ง",
      "line_user_id": "U0987654321fedcba"
    },
    "picker": null,
    "amount_total": 15000.00,
    "currency": "THB",
    "order_date": "2026-02-03",
    "expected_delivery": "2026-02-05",
    "items_count": 5
  },
  "notify": {
    "customer": true,
    "salesperson": true
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} ได้รับการยืนยันแล้ว"
    },
    "salesperson": {
      "th": "ออเดอร์ {order_name} ลูกค้า {customer_name} ยืนยันแล้ว"
    }
  }
}
```

#### `order.picker_assigned` - มอบหมาย Picker

```json
{
  "event": "order.picker_assigned",
  "timestamp": "2026-02-03T10:35:00Z",
  "data": {
    "order_id": 12345,
    "order_name": "SO/2026/00123",
    "old_state": "validated",
    "new_state": "picker_assign",
    "old_state_display": "ตรวจสอบแล้ว",
    "new_state_display": "เตรียมจัดสินค้า",
    "customer": { ... },
    "picker": {
      "id": 10,
      "name": "นายสมศักดิ์ หยิบเก่ง"
    }
  },
  "notify": {
    "customer": true,
    "salesperson": false
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} กำลังเตรียมจัดสินค้า"
    }
  }
}
```

#### `order.picking` - กำลังจัดสินค้า

```json
{
  "event": "order.picking",
  "data": {
    "old_state": "picker_assign",
    "new_state": "picking",
    "new_state_display": "กำลังจัดสินค้า",
    ...
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} กำลังจัดสินค้า"
    }
  }
}
```

#### `order.picked` - จัดเสร็จแล้ว

```json
{
  "event": "order.picked",
  "data": {
    "old_state": "picking",
    "new_state": "picked",
    "new_state_display": "จัดเสร็จแล้ว",
    ...
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} จัดสินค้าเสร็จแล้ว"
    }
  }
}
```

#### `order.packing` - กำลังแพ็ค

```json
{
  "event": "order.packing",
  "data": {
    "old_state": "picked",
    "new_state": "packing",
    "new_state_display": "กำลังแพ็ค",
    ...
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} กำลังแพ็คสินค้า"
    }
  }
}
```

#### `order.packed` - แพ็คเสร็จ

```json
{
  "event": "order.packed",
  "data": {
    "old_state": "packing",
    "new_state": "packed",
    "new_state_display": "แพ็คเสร็จ",
    ...
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} แพ็คสินค้าเสร็จแล้ว รอจัดส่ง"
    }
  }
}
```

---

### 4.2 BDO Events (Bill Before Delivery)

#### `bdo.confirmed` - ยืนยันจัดส่ง (พร้อม QR Payment + Invoice)

**สำคัญ!** Event นี้มี QR Payment data และ Invoice URL

```json
{
  "event": "bdo.confirmed",
  "timestamp": "2026-02-03T14:00:00Z",
  "data": {
    "bdo_id": 123,
    "bdo_name": "BDO/2026/00123",
    "old_state": "draft",
    "new_state": "confirmed",
    "old_state_display": "แบบร่าง",
    "new_state_display": "ยืนยันจัดส่ง",
    "sale_order": {
      "id": 12345,
      "name": "SO/2026/00123"
    },
    "customer": {
      "id": 100,
      "name": "คุณสมชาย ใจดี",
      "line_user_id": "U1234567890abcdef",
      "phone": "081-234-5678"
    },
    "salesperson": {
      "id": 5,
      "name": "นางสาวสมหญิง ขายเก่ง",
      "line_user_id": "U0987654321fedcba"
    },
    "amount_total": 15000.00,
    "currency": "THB",
    "payment": {
      "method": "promptpay",
      "method_display": "พร้อมเพย์",
      "amount": 15000.00,
      "currency": "THB",
      "reference": "BDO/2026/00123",
      "promptpay": {
        "account": "0105564093141",
        "account_name": "บจก. ซี เอ็น วาย เฮลท์แคร์",
        "account_type": "TAX_ID",
        "qr_data": {
          "raw_payload": "00020101021229...(EMVCo payload)...6304XXXX",
          "account": "0105564093141",
          "account_type": "TAX_ID",
          "amount": 15000.00,
          "reference": "BDO/2026/00123"
        }
      },
      "bank_transfer": {
        "bank_name": "ธนาคารกสิกรไทย",
        "bank_code": "KBANK",
        "account_number": "066-8-24681-6",
        "account_name": "บจก. ซี เอ็น วาย เฮลท์แคร์"
      },
      "due_date": null,
      "instructions": [
        "สแกน QR Code เพื่อชำระเงิน",
        "หรือโอนเงินไปยังบัญชีธนาคาร",
        "กรุณาแนบสลิปเพื่อยืนยันการชำระเงิน"
      ]
    },
    "invoice": {
      "available": true,
      "invoice_id": 7890,
      "invoice_number": "INV/2026/00789",
      "invoice_date": "2026-02-03",
      "due_date": "2026-02-17",
      "amount_total": 15000.00,
      "amount_residual": 15000.00,
      "currency": "THB",
      "state": "open",
      "document_url": "https://erp.cnyrxapp.com/report/pdf/account.report_invoice/7890",
      "pdf_url": "https://erp.cnyrxapp.com/report/pdf/account.report_invoice/7890"
    }
  },
  "notify": {
    "customer": true,
    "salesperson": false
  },
  "message_template": {
    "customer": {
      "th": "ยืนยันจัดส่งออเดอร์ {order_name} กรุณาชำระเงิน {amount} บาท"
    }
  }
}
```

#### `bdo.done` - จัดส่งเสร็จสิ้น

```json
{
  "event": "bdo.done",
  "data": {
    "bdo_id": 123,
    "bdo_name": "BDO/2026/00123",
    "old_state": "confirmed",
    "new_state": "done",
    "new_state_display": "เสร็จสิ้น",
    ...
  },
  "message_template": {
    "customer": {
      "th": "ออเดอร์ {order_name} จัดส่งเรียบร้อยแล้ว"
    }
  }
}
```

#### `bdo.cancelled` - ยกเลิก

```json
{
  "event": "bdo.cancelled",
  "data": {
    "old_state": "confirmed",
    "new_state": "cancel",
    "new_state_display": "ยกเลิก",
    ...
  }
}
```

---

### 4.3 Delivery Events

#### `delivery.departed` - รถออกแล้ว

```json
{
  "event": "delivery.departed",
  "timestamp": "2026-02-03T08:00:00Z",
  "data": {
    "delivery_id": 456,
    "delivery_name": "DEL/2026/00456",
    "departed_at": "2026-02-03T08:00:00Z",
    "driver": {
      "id": 10,
      "name": "นายสมศักดิ์ ขับดี",
      "phone": "081-xxx-xxxx"
    },
    "vehicle": {
      "id": 5,
      "name": "กท-1234",
      "type": "truck"
    },
    "orders": [
      {
        "order_id": 12345,
        "order_name": "SO/2026/00123",
        "customer": {
          "id": 100,
          "name": "คุณสมชาย ใจดี",
          "line_user_id": "U1234567890abcdef"
        },
        "delivery_address": "123 ถนนสุขุมวิท กรุงเทพฯ 10110",
        "estimated_arrival": "2026-02-03T10:30:00Z",
        "delivery_sequence": 1
      }
    ],
    "total_orders": 1
  },
  "notify": {
    "customer": true,
    "salesperson": true
  },
  "message_template": {
    "customer": {
      "th": "รถกำลังออกส่งสินค้า คาดว่าจะถึงประมาณ {estimated_arrival}"
    }
  }
}
```

#### `delivery.completed` - ส่งสำเร็จ

```json
{
  "event": "delivery.completed",
  "timestamp": "2026-02-03T10:35:00Z",
  "data": {
    "delivery_id": 456,
    "delivery_name": "DEL/2026/00456",
    "order_id": 12345,
    "order_name": "SO/2026/00123",
    "delivered_at": "2026-02-03T10:35:00Z",
    "customer": {
      "id": 100,
      "name": "คุณสมชาย ใจดี",
      "line_user_id": "U1234567890abcdef"
    },
    "receiver": {
      "name": "คุณสมชาย ใจดี",
      "signature_url": "https://erp.cnyrxapp.com/attachments/sig_12345.png"
    }
  },
  "notify": {
    "customer": true,
    "salesperson": true
  },
  "message_template": {
    "customer": {
      "th": "ส่งสินค้าออเดอร์ {order_name} เรียบร้อยแล้ว ขอบคุณที่ใช้บริการ"
    }
  }
}
```

---

### 4.4 Payment Events

#### `payment.confirmed` - ชำระเงินเรียบร้อย

```json
{
  "event": "payment.confirmed",
  "timestamp": "2026-02-03T17:00:00Z",
  "data": {
    "payment_id": 456,
    "payment_name": "PAY/2026/00456",
    "old_state": "draft",
    "new_state": "post",
    "old_state_display": "แบบร่าง",
    "new_state_display": "ผ่านรายการ",
    "customer": {
      "id": 100,
      "name": "คุณสมชาย ใจดี",
      "line_user_id": "U1234567890abcdef"
    },
    "payment": {
      "amount": 15000.00,
      "currency": "THB",
      "method": "bank_transfer",
      "method_display": "โอนเงิน",
      "reference": "PAY/2026/00456",
      "date": "2026-02-03"
    },
    "related_orders": ["SO/2026/00123"]
  },
  "notify": {
    "customer": true,
    "salesperson": true
  },
  "message_template": {
    "customer": {
      "th": "ได้รับการชำระเงิน {amount} บาท เรียบร้อยแล้ว ขอบคุณค่ะ"
    }
  }
}
```

---

### Webhook Response

Re-Ya ต้อง respond ภายใน **5 วินาที**:

**Success:**
```json
{
  "success": true,
  "received_at": "2026-02-03T10:30:01Z"
}
```
HTTP Status: `200`

**Error:**
```json
{
  "success": false,
  "error": "Database connection failed"
}
```
HTTP Status: `500`

### Retry Mechanism

หาก webhook ส่งไม่สำเร็จ Odoo จะ retry:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5 | 1 hour |

---

## 5. API Endpoints: Re-Ya → Odoo

**Base URL:** `https://erp.cnyrxapp.com`
**Format:** JSON-RPC 2.0

### Request Format

```http
POST /reya/{endpoint} HTTP/1.1
Host: erp.cnyrxapp.com
Content-Type: application/json
X-Api-Key: your_api_key

{
  "jsonrpc": "2.0",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": { ... },
    "meta": { ... }
  }
}
```

---

### 5.1 Health Check

#### `POST /reya/health`

ไม่ต้องใช้ API Key

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "status": "healthy",
      "module": "cny_reya_connector",
      "version": "1.0.0",
      "timestamp": "2026-02-03T10:30:00Z"
    }
  }
}
```

---

### 5.2 Orders

#### `POST /reya/orders` - List Orders

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE user ID |
| `state` | string | No | Filter by operation_state |
| `date_from` | date | No | Filter start date (YYYY-MM-DD) |
| `date_to` | date | No | Filter end date |
| `limit` | int | No | Max results (default: 20, max: 100) |
| `page` | int | No | Page number (default: 1) |

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "params": {
    "line_user_id": "U1234567890abcdef",
    "state": "in_delivery",
    "limit": 10
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "orders": [
        {
          "id": 12345,
          "name": "SO/2026/00123",
          "date": "2026-02-03",
          "state": "in_delivery",
          "state_display": "กำลังจัดส่ง",
          "amount_total": 15000.00,
          "currency": "THB",
          "expected_delivery": "2026-02-05",
          "items_count": 5
        }
      ]
    },
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "total_pages": 5
    }
  }
}
```

#### `POST /reya/order/detail` - Order Detail

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | int | Yes | Order ID |
| `line_user_id` | string | Yes | LINE user ID (for ownership check) |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "id": 12345,
      "name": "SO/2026/00123",
      "date": "2026-02-03",
      "state": "in_delivery",
      "state_display": "กำลังจัดส่ง",
      "customer": {
        "id": 100,
        "name": "คุณสมชาย ใจดี"
      },
      "salesperson": {
        "id": 5,
        "name": "นางสาวสมหญิง ขายเก่ง",
        "phone": "082-xxx-xxxx"
      },
      "shipping_address": {
        "street": "123 ถนนสุขุมวิท",
        "city": "กรุงเทพฯ",
        "zip": "10110"
      },
      "lines": [
        {
          "id": 1001,
          "product": {
            "id": 101,
            "name": "ยาพาราเซตามอล 500mg",
            "default_code": "PARA500"
          },
          "quantity": 10,
          "unit": "กล่อง",
          "unit_price": 50.00,
          "subtotal": 500.00
        }
      ],
      "amount_untaxed": 14018.69,
      "amount_tax": 981.31,
      "amount_total": 15000.00,
      "payment_status": "unpaid",
      "payment_status_display": "ยังไม่ชำระ"
    }
  }
}
```

#### `POST /reya/order/tracking` - Order Tracking

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | int | Yes | Order ID |
| `line_user_id` | string | Yes | LINE user ID |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "order_id": 12345,
      "order_name": "SO/2026/00123",
      "current_state": "in_delivery",
      "current_state_display": "กำลังจัดส่ง",
      "timeline": [
        {
          "state": "draft",
          "state_display": "แบบร่าง",
          "timestamp": null,
          "completed": true,
          "is_current": false
        },
        {
          "state": "validated",
          "state_display": "ตรวจสอบแล้ว",
          "timestamp": null,
          "completed": true,
          "is_current": false
        },
        {
          "state": "picker_assign",
          "state_display": "เตรียมจัดสินค้า",
          "timestamp": null,
          "completed": true,
          "is_current": false
        },
        {
          "state": "in_delivery",
          "state_display": "กำลังจัดส่ง",
          "timestamp": null,
          "completed": true,
          "is_current": true
        },
        {
          "state": "delivered",
          "state_display": "จัดส่งแล้ว",
          "timestamp": null,
          "completed": false,
          "is_current": false
        }
      ],
      "delivery_tracking": {
        "driver": {
          "name": "นายสมศักดิ์ ขับดี",
          "phone": "081-xxx-xxxx"
        },
        "vehicle": "กท-1234"
      }
    }
  }
}
```

#### `POST /reya/orders/search` - Search Orders

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE user ID |
| `q` | string | Yes | Search query (order name) |

---

### 5.3 Invoices

#### `POST /reya/invoices` - List Invoices

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE user ID |
| `state` | string | No | Filter: `open`, `paid`, `overdue` |
| `limit` | int | No | Max results |
| `page` | int | No | Page number |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "invoices": [
        {
          "id": 7890,
          "number": "INV/2026/00789",
          "date": "2026-02-03",
          "due_date": "2026-02-17",
          "state": "open",
          "state_display": "ค้างชำระ",
          "amount_total": 15000.00,
          "amount_residual": 15000.00,
          "currency": "THB",
          "days_until_due": 14,
          "is_overdue": false,
          "order_name": "SO/2026/00123"
        }
      ],
      "summary": {
        "total_open": 3,
        "total_amount_due": 45000.00,
        "overdue_count": 1,
        "overdue_amount": 10000.00
      }
    },
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 10
    }
  }
}
```

---

### 5.4 Credit Status

#### `POST /reya/credit-status`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE user ID |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "customer": {
        "id": 100,
        "name": "คุณสมชาย ใจดี"
      },
      "credit_limit": 100000.00,
      "credit_used": 45000.00,
      "credit_available": 55000.00,
      "currency": "THB",
      "overdue_amount": 10000.00,
      "payment_term": "30 วัน"
    }
  }
}
```

---

### 5.5 Salesperson Endpoints

#### `POST /reya/salesperson/orders`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | Salesperson's LINE user ID |
| `state` | string | No | Filter by state |
| `date_from` | date | No | Start date |
| `date_to` | date | No | End date |
| `limit` | int | No | Max results |
| `page` | int | No | Page number |

#### `POST /reya/salesperson/dashboard`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | Salesperson's LINE user ID |
| `period` | string | No | `today`, `week`, `month` (default: today) |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "salesperson": {
        "id": 5,
        "name": "นางสาวสมหญิง ขายเก่ง"
      },
      "period": "today",
      "period_display": "วันนี้",
      "summary": {
        "total_orders": 15,
        "total_amount": 250000.00,
        "awaiting_payment": 5,
        "awaiting_payment_amount": 75000.00,
        "in_delivery": 3,
        "delivered": 7
      },
      "orders_by_state": {
        "validated": 2,
        "picker_assign": 1,
        "in_delivery": 3,
        "delivered": 7
      },
      "overdue_invoices": {
        "count": 2,
        "amount": 30000.00
      }
    }
  }
}
```

---

## 6. LINE User Linking

### 6.1 Link LINE User

#### `POST /reya/user/link`

ผูก LINE user กับ Odoo partner โดยค้นหาจาก phone, customer_code, หรือ email

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE User ID |
| `phone` | string | No* | เบอร์โทรศัพท์ |
| `customer_code` | string | No* | รหัสลูกค้า (ref) |
| `email` | string | No* | อีเมล |

*ต้องระบุอย่างน้อย 1 ตัว

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "params": {
    "line_user_id": "U1234567890abcdef",
    "phone": "081-234-5678"
  }
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "partner_id": 100,
      "partner_name": "คุณสมชาย ใจดี",
      "customer_code": "CUST-001",
      "phone": "081-234-5678",
      "email": "somchai@email.com",
      "line_notification_enabled": true,
      "linked_via": "phone"
    }
  }
}
```

**Already Linked Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": false,
    "error": {
      "code": "ALREADY_LINKED",
      "message": "LINE user already linked to account: คุณสมชาย ใจดี"
    },
    "data": {
      "partner_id": 100,
      "partner_name": "คุณสมชาย ใจดี"
    }
  }
}
```

---

### 6.2 Unlink LINE User

#### `POST /reya/user/unlink`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE User ID |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "message": "LINE account unlinked from คุณสมชาย ใจดี"
    }
  }
}
```

---

### 6.3 Get User Profile

#### `POST /reya/user/profile`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE User ID |

**Linked Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "linked": true,
      "partner": {
        "id": 100,
        "name": "คุณสมชาย ใจดี",
        "customer_code": "CUST-001",
        "phone": "081-234-5678",
        "email": "somchai@email.com",
        "credit_limit": 100000.00
      },
      "line_notification_enabled": true,
      "line_linked_date": "2026-02-01 10:30:00"
    }
  }
}
```

**Not Linked Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "linked": false,
      "message": "LINE user not linked to any account"
    }
  }
}
```

---

### 6.4 Update Notification Setting

#### `POST /reya/user/notification`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE User ID |
| `enabled` | bool | Yes | true = เปิด, false = ปิด |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "line_notification_enabled": true,
      "message": "เปิดการแจ้งเตือน"
    }
  }
}
```

---

## 7. Slip Upload & Payment

### Workflow

```
ลูกค้าส่งสลิป (LINE)
        │
        ▼
cny.re-ya.com รับภาพ
        │
        ▼
POST /reya/slip/upload
        │
        ▼
┌───────┴───────┐
│  Auto Match?  │
└───────┬───────┘
        │
   ┌────┴────┐
   │         │
  YES       NO
   │         │
   ▼         ▼
Payment   Manual Match
Created   Required
   │         │
   ▼         ▼
Webhook:  POST /reya/slip/match
payment.  (เมื่อ staff match)
confirmed
```

---

### 7.1 Upload Slip

#### `POST /reya/slip/upload`

ลูกค้าส่งสลิปผ่าน LINE → Re-Ya ส่งต่อมา Odoo

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE User ID |
| `slip_image` | string | Yes | Base64 encoded image |
| `bdo_id` | int | No* | BDO ID |
| `invoice_id` | int | No* | Invoice ID |
| `order_id` | int | No* | Sale Order ID |
| `amount` | float | No | Transfer amount (for matching) |
| `transfer_date` | date | No | Transfer date (YYYY-MM-DD) |

*อย่างน้อยต้องระบุ 1 ตัว (bdo_id, invoice_id, หรือ order_id)

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "params": {
    "line_user_id": "U1234567890abcdef",
    "bdo_id": 123,
    "slip_image": "/9j/4AAQSkZJRg...(base64)...",
    "amount": 15000.00,
    "transfer_date": "2026-02-03"
  }
}
```

**Auto Match Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "slip": {
        "id": 999,
        "name": "slip_100_20260203_143000.jpg",
        "partner_id": 100,
        "partner_name": "คุณสมชาย ใจดี",
        "amount": 15000.00,
        "transfer_date": "2026-02-03",
        "bdo_id": 123,
        "invoice_id": 7890,
        "order_id": 12345,
        "status": "matched",
        "payment_id": 456,
        "created_at": "2026-02-03T14:30:00Z"
      },
      "match_result": {
        "matched": true,
        "payment_id": 456,
        "payment_name": "PAY/2026/00456",
        "reason": "Payment created automatically"
      }
    }
  }
}
```

**Pending Match Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "slip": {
        "id": 999,
        "status": "pending",
        ...
      },
      "match_result": {
        "matched": false,
        "reason": "Amount mismatch: slip=14000.00, invoice=15000.00"
      }
    }
  }
}
```

---

### 7.2 Manual Match Slip

#### `POST /reya/slip/match`

ใช้เมื่อ auto-match ไม่สำเร็จ และต้องการ match manual

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slip_id` | int | Yes | Slip attachment ID |
| `invoice_id` | int | Yes | Invoice ID to match |
| `amount` | float | No | Amount (default: invoice residual) |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "match_result": {
        "matched": true,
        "payment_id": 456,
        "payment_name": "PAY/2026/00456",
        "reason": "Payment created automatically"
      }
    }
  }
}
```

---

### 7.3 Get Payment Status

#### `POST /reya/payment/status`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_user_id` | string | Yes | LINE User ID |
| `order_id` | int | No* | Sale Order ID |
| `bdo_id` | int | No* | BDO ID |
| `invoice_id` | int | No* | Invoice ID |

*ต้องระบุอย่างน้อย 1 ตัว

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": true,
    "data": {
      "status": "paid",
      "status_display": "ชำระเงินเรียบร้อยแล้ว",
      "amount_total": 15000.00,
      "amount_paid": 15000.00,
      "amount_residual": 0.00,
      "currency": "THB",
      "invoices": [
        {
          "id": 7890,
          "number": "INV/2026/00789",
          "state": "paid",
          "amount_total": 15000.00,
          "amount_residual": 0.00
        }
      ]
    }
  }
}
```

**Payment Status Values:**

| Status | Display | Description |
|--------|---------|-------------|
| `paid` | ชำระเงินเรียบร้อยแล้ว | ชำระครบแล้ว |
| `partial` | ชำระบางส่วน | ชำระบางส่วน |
| `unpaid` | รอชำระเงิน | ยังไม่ชำระ |

---

## 8. Data Models

### Customer Object

```json
{
  "id": 100,
  "name": "คุณสมชาย ใจดี",
  "line_user_id": "U1234567890abcdef",
  "phone": "081-xxx-xxxx",
  "email": "somchai@email.com",
  "address": "123 ถนนสุขุมวิท กรุงเทพฯ 10110"
}
```

### Salesperson Object

```json
{
  "id": 5,
  "name": "นางสาวสมหญิง ขายเก่ง",
  "line_user_id": "U0987654321fedcba",
  "phone": "082-xxx-xxxx",
  "email": "somying@cnyrx.com"
}
```

### Payment Object

```json
{
  "amount": 15000.00,
  "currency": "THB",
  "method": "bank_transfer",
  "method_display": "โอนเงิน",
  "reference": "PAY/2026/00456",
  "date": "2026-02-03"
}
```

**Payment Methods:**
| Code | Display |
|------|---------|
| `cash` | เงินสด |
| `bank_transfer` | โอนเงิน |
| `promptpay` | พร้อมเพย์ |
| `cheque` | เช็ค |
| `credit_card` | บัตรเครดิต |

### PromptPay QR Data Object

```json
{
  "raw_payload": "00020101021229...(EMVCo format)...6304XXXX",
  "account": "0105564093141",
  "account_type": "TAX_ID",
  "amount": 15000.00,
  "reference": "BDO/2026/00123"
}
```

**Account Types:**
| Type | Description |
|------|-------------|
| `TAX_ID` | เลขประจำตัวผู้เสียภาษี (13 หลัก) |
| `PHONE` | เบอร์โทรศัพท์ (10 หลัก) |
| `NATIONAL_ID` | เลขบัตรประชาชน (13 หลัก) |

---

## 9. Error Handling

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "success": false,
    "error": {
      "code": "INVALID_API_KEY",
      "message": "API key is invalid or expired"
    }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `MISSING_API_KEY` | ไม่มี API key ใน header |
| `INVALID_API_KEY` | API key ไม่ถูกต้อง |
| `MISSING_PARAMETER` | ขาด parameter ที่จำเป็น |
| `LINE_USER_NOT_LINKED` | LINE user ยังไม่ได้ผูกกับ account |
| `PARTNER_NOT_FOUND` | ไม่พบ partner/customer |
| `ORDER_NOT_FOUND` | ไม่พบ order |
| `INVOICE_NOT_FOUND` | ไม่พบ invoice |
| `BDO_NOT_FOUND` | ไม่พบ BDO |
| `SLIP_NOT_FOUND` | ไม่พบ slip attachment |
| `CUSTOMER_MISMATCH` | Order ไม่ใช่ของ customer นี้ |
| `ALREADY_LINKED` | LINE user ผูกกับ account แล้ว |
| `NOT_LINKED` | LINE user ยังไม่ได้ผูกกับ account |
| `INVALID_IMAGE` | Base64 image ไม่ถูกต้อง |

---

## 10. Code Examples (Node.js)

### API Client Class

```javascript
const axios = require('axios');

class ReyaOdooClient {
  constructor(apiKey, baseUrl = 'https://erp.cnyrxapp.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async call(endpoint, params = {}) {
    const response = await axios.post(`${this.baseUrl}${endpoint}`, {
      jsonrpc: '2.0',
      params: params
    }, {
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
    return response.data.result;
  }

  // Health
  async health() {
    return this.call('/reya/health');
  }

  // User Linking
  async linkUser(lineUserId, { phone, customerCode, email }) {
    return this.call('/reya/user/link', {
      line_user_id: lineUserId,
      phone,
      customer_code: customerCode,
      email
    });
  }

  async unlinkUser(lineUserId) {
    return this.call('/reya/user/unlink', { line_user_id: lineUserId });
  }

  async getUserProfile(lineUserId) {
    return this.call('/reya/user/profile', { line_user_id: lineUserId });
  }

  // Orders
  async getOrders(lineUserId, options = {}) {
    return this.call('/reya/orders', {
      line_user_id: lineUserId,
      ...options
    });
  }

  async getOrderDetail(orderId, lineUserId) {
    return this.call('/reya/order/detail', {
      order_id: orderId,
      line_user_id: lineUserId
    });
  }

  async getOrderTracking(orderId, lineUserId) {
    return this.call('/reya/order/tracking', {
      order_id: orderId,
      line_user_id: lineUserId
    });
  }

  // Invoices
  async getInvoices(lineUserId, options = {}) {
    return this.call('/reya/invoices', {
      line_user_id: lineUserId,
      ...options
    });
  }

  // Credit
  async getCreditStatus(lineUserId) {
    return this.call('/reya/credit-status', { line_user_id: lineUserId });
  }

  // Slip Upload
  async uploadSlip(lineUserId, slipImageBase64, options = {}) {
    return this.call('/reya/slip/upload', {
      line_user_id: lineUserId,
      slip_image: slipImageBase64,
      ...options
    });
  }

  async matchSlip(slipId, invoiceId, amount = null) {
    return this.call('/reya/slip/match', {
      slip_id: slipId,
      invoice_id: invoiceId,
      amount
    });
  }

  async getPaymentStatus(lineUserId, { orderId, bdoId, invoiceId }) {
    return this.call('/reya/payment/status', {
      line_user_id: lineUserId,
      order_id: orderId,
      bdo_id: bdoId,
      invoice_id: invoiceId
    });
  }

  // Salesperson
  async getSalespersonDashboard(lineUserId, period = 'today') {
    return this.call('/reya/salesperson/dashboard', {
      line_user_id: lineUserId,
      period
    });
  }
}

// Usage
const api = new ReyaOdooClient('your_api_key');

// Link LINE user
const linkResult = await api.linkUser('U123...', { phone: '081-234-5678' });

// Get orders
const orders = await api.getOrders('U123...', { limit: 10 });

// Upload slip
const fs = require('fs');
const slipImage = fs.readFileSync('slip.jpg').toString('base64');
const uploadResult = await api.uploadSlip('U123...', slipImage, {
  bdo_id: 123,
  amount: 15000.00
});
```

### Webhook Handler

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.ODOO_WEBHOOK_SECRET;

// Verify webhook signature
function verifySignature(req) {
  const signature = req.headers['x-odoo-signature'];
  const timestamp = req.headers['x-odoo-timestamp'];
  const body = JSON.stringify(req.body);

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const payload = `${timestamp}.${body}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expected)
  );
}

// Webhook endpoint
app.post('/api/webhook/odoo', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  const { event, data, notify, message_template } = req.body;

  try {
    switch (event) {
      // Order events
      case 'order.validated':
      case 'order.picker_assigned':
      case 'order.picking':
      case 'order.picked':
      case 'order.packing':
      case 'order.packed':
      case 'order.reserved':
      case 'order.awaiting_payment':
      case 'order.paid':
      case 'order.to_delivery':
      case 'order.in_delivery':
      case 'order.delivered':
        await handleOrderEvent(event, data, notify, message_template);
        break;

      // BDO events (with QR Payment)
      case 'bdo.confirmed':
        await handleBdoConfirmed(data, notify, message_template);
        break;
      case 'bdo.done':
      case 'bdo.cancelled':
        await handleBdoEvent(event, data, notify);
        break;

      // Delivery events
      case 'delivery.departed':
      case 'delivery.completed':
        await handleDeliveryEvent(event, data, notify, message_template);
        break;

      // Payment events
      case 'payment.confirmed':
      case 'payment.done':
        await handlePaymentEvent(event, data, notify, message_template);
        break;

      default:
        console.log(`Unknown event: ${event}`);
    }

    res.json({ success: true, received_at: new Date().toISOString() });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle BDO confirmed with QR Payment
async function handleBdoConfirmed(data, notify, template) {
  const { customer, payment, invoice } = data;

  if (!notify.customer || !customer?.line_user_id) return;

  // Build LINE Flex Message with QR Payment
  const flexMessage = {
    type: 'flex',
    altText: `กรุณาชำระเงิน ${payment.amount} บาท`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ยืนยันจัดส่ง',
            weight: 'bold',
            size: 'xl'
          },
          {
            type: 'text',
            text: `ออเดอร์: ${data.sale_order?.name}`,
            size: 'md',
            margin: 'md'
          },
          {
            type: 'text',
            text: `ยอดชำระ: ${payment.amount.toLocaleString()} บาท`,
            size: 'lg',
            weight: 'bold',
            color: '#1DB446',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: 'สแกน QR Code เพื่อชำระเงิน',
            size: 'sm',
            margin: 'lg',
            align: 'center'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูใบแจ้งหนี้',
              uri: invoice.pdf_url
            },
            style: 'primary'
          }
        ]
      }
    }
  };

  // Generate QR image from payment.promptpay.qr_data.raw_payload
  // and send with LINE message

  await sendLineMessage(customer.line_user_id, flexMessage);
}

app.listen(3000, () => {
  console.log('Re-Ya Bot listening on port 3000');
});
```

---

## Event Summary Table

| Event | Model | Trigger | Recipients |
|-------|-------|---------|------------|
| `order.validated` | sale.order | ยืนยันออเดอร์ | Customer, Salesperson |
| `order.picker_assigned` | sale.order | มอบหมาย Picker | Customer |
| `order.picking` | sale.order | กำลังจัดสินค้า | Customer |
| `order.picked` | sale.order | จัดเสร็จ | Customer |
| `order.packing` | sale.order | กำลังแพ็ค | Customer |
| `order.packed` | sale.order | แพ็คเสร็จ | Customer |
| `order.reserved` | sale.order | จองสินค้า | Customer |
| `order.awaiting_payment` | sale.order | รอชำระเงิน | Customer, Salesperson |
| `order.paid` | sale.order | ชำระแล้ว | Customer, Salesperson |
| `order.to_delivery` | sale.order | เตรียมส่ง | Customer, Salesperson |
| `order.in_delivery` | sale.order | กำลังจัดส่ง | Customer, Salesperson |
| `order.delivered` | sale.order | จัดส่งแล้ว | Customer, Salesperson |
| `bdo.confirmed` | cny.bill.invoice.before.delivery | ยืนยัน BDO (+ QR Payment) | Customer |
| `bdo.done` | cny.bill.invoice.before.delivery | BDO เสร็จ | Customer |
| `bdo.cancelled` | cny.bill.invoice.before.delivery | ยกเลิก BDO | Customer |
| `delivery.departed` | delivery.operation | รถออก | All customers in delivery |
| `delivery.completed` | delivery.operation | ส่งสำเร็จ | Customer, Salesperson |
| `invoice.created` | account.invoice | สร้างใบแจ้งหนี้ | Customer |
| `invoice.overdue` | account.invoice | เกินกำหนด (Cron) | Customer, Salesperson |
| `payment.confirmed` | ineco.customer.payment | ผ่านรายการ | Customer, Salesperson |
| `payment.done` | ineco.customer.payment | Payment เสร็จ | Customer, Salesperson |

---

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/reya/health` | POST | Health check |
| `/reya/orders` | POST | List customer orders |
| `/reya/order/detail` | POST | Order detail |
| `/reya/order/tracking` | POST | Order tracking timeline |
| `/reya/orders/search` | POST | Search orders |
| `/reya/invoices` | POST | List customer invoices |
| `/reya/credit-status` | POST | Customer credit status |
| `/reya/salesperson/orders` | POST | Salesperson's orders |
| `/reya/salesperson/dashboard` | POST | Salesperson dashboard |
| `/reya/user/link` | POST | Link LINE user to partner |
| `/reya/user/unlink` | POST | Unlink LINE user |
| `/reya/user/profile` | POST | Get user profile |
| `/reya/user/notification` | POST | Update notification setting |
| `/reya/slip/upload` | POST | Upload payment slip |
| `/reya/slip/match` | POST | Manual match slip |
| `/reya/payment/status` | POST | Get payment status |

---

## Contact & Support

- **Technical Issues:** it@cnyrx.com
- **API Access:** ติดต่อผู้ดูแลระบบ Odoo
- **Documentation:** [GitHub/CNY-DEV2023](https://github.com/...)

---

**Version History:**

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-02-03 | Complete rewrite: JSON-RPC format, /reya/ routes, LINE user linking, Slip upload, QR Payment |
| 1.0.0 | 2026-02-03 | Initial release |
