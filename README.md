# LINE OA Manager

ระบบจัดการ LINE Official Account แบบครบวงจร รองรับหลายบัญชี LINE OA และหลายผู้ใช้

![LINE OA Manager](https://img.shields.io/badge/version-2.5-green) ![PHP](https://img.shields.io/badge/PHP-%3E%3D7.4-blue) ![License](https://img.shields.io/badge/license-MIT-orange)

## ✨ Features

### สำหรับ Admin
- 🔐 จัดการหลายบัญชี LINE OA ในระบบเดียว
- 👥 จัดการผู้ใช้ระบบ (Admin/User)
- 📊 Dashboard รวมสถิติทุกบัญชี
- 💬 ดูและตอบข้อความลูกค้า
- 📢 Broadcast ข้อความ
- 🤖 ตั้งค่า Auto-Reply
- 🛒 ระบบร้านค้าออนไลน์
- 📈 Analytics และรายงาน

### สำหรับ User (ผู้ใช้ทั่วไป)
- 🔗 เชื่อมต่อ LINE OA ของตัวเองได้
- 💬 จัดการข้อความลูกค้า
- 📢 ส่ง Broadcast
- 🤖 ตั้งค่าตอบกลับอัตโนมัติ
- 🛍️ จัดการสินค้าและคำสั่งซื้อ
- 👋 ตั้งค่าข้อความต้อนรับ
- 📊 ดูสถิติการใช้งาน

## 📋 Requirements

- PHP >= 7.4
- MySQL >= 5.7 หรือ MariaDB >= 10.2
- Extensions: PDO, PDO_MySQL, cURL, JSON, Mbstring
- Web Server: Apache หรือ Nginx
- SSL Certificate (HTTPS) - จำเป็นสำหรับ LINE Webhook

## 🚀 Installation

### วิธีที่ 1: ใช้ Installation Wizard (แนะนำ)

1. **อัพโหลดไฟล์ไปยัง Web Server**
   ```bash
   # Clone หรือ Download แล้ว Upload ไปยัง public_html หรือ www
   ```

2. **เปิดเบราว์เซอร์ไปที่**
   ```
   https://yourdomain.com/install/
   ```

3. **ทำตามขั้นตอนใน Installation Wizard**
   - ตรวจสอบ Requirements
   - กรอกข้อมูลฐานข้อมูล
   - ตั้งค่าระบบ
   - สร้างบัญชี Admin
   - ติดตั้ง

4. **ลบโฟลเดอร์ `install`** หลังติดตั้งเสร็จ

### วิธีที่ 2: ติดตั้งแบบ Manual

1. **สร้างฐานข้อมูล**
   ```sql
   CREATE DATABASE line_oa_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Import Schema**
   ```bash
   mysql -u username -p line_oa_manager < database/schema.sql
   mysql -u username -p line_oa_manager < database/migration_admin_users.sql
   ```

3. **แก้ไขไฟล์ config/config.php**
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'line_oa_manager');
   define('DB_USER', 'your_username');
   define('DB_PASS', 'your_password');
   
   define('APP_NAME', 'LINE OA Manager');
   define('APP_URL', 'https://yourdomain.com');
   define('BASE_URL', 'https://yourdomain.com');
   ```

4. **ตั้งค่า Permissions**
   ```bash
   chmod 755 config/
   chmod 755 uploads/
   chmod -R 755 uploads/products/
   chmod -R 755 uploads/slips/
   ```

5. **สร้างบัญชี Admin** (รหัสผ่าน: admin123)
   ```sql
   INSERT INTO admin_users (username, email, password, display_name, role) 
   VALUES ('admin', 'admin@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrator', 'admin');
   ```

## 🔧 Configuration

### ตั้งค่า LINE Messaging API

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider และ Channel (Messaging API)
3. คัดลอก **Channel ID**, **Channel Secret**
4. สร้าง **Channel Access Token**
5. ตั้งค่า **Webhook URL**:
   ```
   https://yourdomain.com/webhook.php?account=YOUR_ACCOUNT_ID
   ```
6. เปิด **Use webhook** และปิด **Auto-reply messages**

### ตั้งค่า Webhook (สำคัญ!)

ใน LINE Developers Console > Messaging API:
- Webhook URL: `https://yourdomain.com/webhook.php?account=1`
- Use webhook: **Enabled**
- Auto-reply messages: **Disabled**
- Greeting messages: **Disabled**

## 📁 Directory Structure

```
line-oa-manager/
├── api/                    # API endpoints
├── auth/                   # Authentication pages
│   ├── login.php
│   ├── register.php
│   ├── logout.php
│   └── setup-account.php
├── classes/                # PHP Classes
│   ├── LineAPI.php
│   ├── LineAccountManager.php
│   └── ...
├── config/                 # Configuration files
│   ├── config.php
│   └── database.php
├── cron/                   # Cron jobs
├── database/               # SQL migrations
├── includes/               # Header, Footer, Auth
├── install/                # Installation wizard
├── shop/                   # Shop management (Admin)
├── uploads/                # Uploaded files
├── user/                   # User panel pages
├── index.php               # Admin Dashboard
├── webhook.php             # LINE Webhook handler
└── README.md
```

## 👤 User Roles

| Role | Description |
|------|-------------|
| **Admin** | จัดการทุกอย่าง, เข้าถึงทุกบัญชี LINE |
| **User** | ใช้งานได้ 1 บัญชี LINE, เชื่อมต่อ LINE OA ของตัวเอง |

## 🔐 Default Login

หลังติดตั้งผ่าน Wizard จะใช้ข้อมูลที่กรอกไว้

หากติดตั้งแบบ Manual:
- **Username:** admin
- **Password:** admin123

⚠️ **กรุณาเปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบ!**

## 📱 URLs

| URL | Description |
|-----|-------------|
| `/auth/login.php` | หน้าเข้าสู่ระบบ |
| `/auth/register.php` | หน้าสมัครสมาชิก |
| `/index.php` | Admin Dashboard |
| `/user/dashboard.php` | User Dashboard |
| `/admin-users.php` | จัดการผู้ใช้ระบบ |
| `/line-accounts.php` | จัดการบัญชี LINE |

## 📱 PWA (Progressive Web App)

ระบบรองรับการติดตั้งเป็นแอปบนมือถือ (PWA)

### วิธีติดตั้งบนมือถือ

**Android (Chrome):**
1. เปิดเว็บไซต์ใน Chrome
2. กดเมนู (⋮) > "Add to Home screen" หรือ "Install app"
3. กด "Install"

**iOS (Safari):**
1. เปิดเว็บไซต์ใน Safari
2. กดปุ่ม Share (□↑)
3. เลื่อนลงแล้วกด "Add to Home Screen"
4. กด "Add"

### สร้าง Icons

```bash
# ไปที่โฟลเดอร์ icons
cd assets/icons

# รัน script สร้าง placeholder icons
php create_placeholder.php

# หรือใช้ PWA Builder (แนะนำ)
# https://www.pwabuilder.com/imageGenerator
```

### Features ของ PWA
- ✅ ติดตั้งลงหน้าจอหลักได้
- ✅ ทำงานแบบ Offline (บางส่วน)
- ✅ Push Notifications (ต้องตั้งค่าเพิ่ม)
- ✅ รองรับ iOS และ Android

## 🛠️ Troubleshooting

### Webhook ไม่ทำงาน
1. ตรวจสอบว่า URL เป็น HTTPS
2. ตรวจสอบ Channel Secret ถูกต้อง
3. ดู error log ใน `webhook.php`

### ไม่สามารถส่งข้อความได้
1. ตรวจสอบ Channel Access Token
2. ตรวจสอบว่า Token ยังไม่หมดอายุ
3. ทดสอบการเชื่อมต่อในหน้า LINE Accounts

### Upload รูปไม่ได้
1. ตรวจสอบ permission ของโฟลเดอร์ `uploads/`
2. ตรวจสอบ `upload_max_filesize` ใน php.ini

## 📄 License

MIT License - ใช้งานได้ฟรี ทั้งส่วนตัวและเชิงพาณิชย์

## 🤝 Support

หากพบปัญหาหรือต้องการความช่วยเหลือ สามารถเปิด Issue ได้

---

Made with ❤️ for LINE Official Account Management
# LINE CRM Pharmacy Inbox System

ระบบ Inbox แบบ Real-time สำหรับ LINE CRM Pharmacy พัฒนาด้วย Next.js 15, Prisma, และ NextAuth.js

> **หมายเหตุ**: ระบบนี้ออกแบบมาเพื่อทำงาน**ร่วมกับระบบ PHP เดิม** โดยใช้ database เดียวกัน
> และรันแยกต่างหากบน port 3000 ผ่าน Nginx reverse proxy

## ✨ Features

- 💬 **Real-time Chat** - ระบบแชทแบบ real-time ด้วย Server-Sent Events (SSE)
- 🔐 **Authentication** - ระบบ login ปลอดภัยด้วย NextAuth.js v5
- 👥 **Customer Management** - จัดการข้อมูลลูกค้าและประวัติการสนทนา
- 🏷️ **Auto-tagging** - ระบบแท็กอัตโนมัติตามเงื่อนไข
- 📱 **Responsive Design** - รองรับทั้ง Desktop และ Mobile
- ⚡ **Performance** - Optimized ด้วย TanStack Query และ Virtual Scrolling
- 🎨 **Modern UI** - ใช้ shadcn/ui และ Tailwind CSS

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: MySQL + Prisma ORM
- **Authentication**: NextAuth.js v5
- **State Management**: Zustand + TanStack Query
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Real-time**: Server-Sent Events (SSE)

## 📋 Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- npm หรือ yarn

## 🛠️ Installation

> 🎯 **สำหรับ cny.re-ya.com:** อ่าน **[INSTALL_CNY.md](./INSTALL_CNY.md)** ⭐  
> 🎯 **ไม่เคยติดตั้ง Node.js มาก่อน?** เริ่มที่ **[START_HERE.md](./START_HERE.md)**

### Development

```bash
# Clone repository
git clone <repo-url>
cd inbox-nextjs

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# แก้ไข .env ตามต้องการ

# Generate Prisma Client
npm run db:generate

# Push database schema
npm run db:push

# Seed database
npm run db:seed

# Run development server
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

**Login credentials**:
- Username: `admin`
- Password: `password123`

### Production (ติดตั้งร่วมกับระบบ PHP)

**🧙‍♂️ สำหรับผู้ที่ไม่เคยติดตั้ง Node.js มาก่อน:**
- ⭐ **[INSTALLATION_WIZARD.md](./INSTALLATION_WIZARD.md)** - คู่มือติดตั้งแบบละเอียดทีละขั้นตอน (แนะนำ!)
- 🤖 **`./install.sh`** - Installation Script อัตโนมัติ (รันคำสั่งเดียวเสร็จ)

**คู่มือเพิ่มเติม:**
- 🚀 **[QUICK_START.md](./QUICK_START.md)** - คู่มือเริ่มต้นแบบย่อ
- 📖 **[HYBRID_DEPLOYMENT.md](./HYBRID_DEPLOYMENT.md)** - คู่มือติดตั้งแบบละเอียด
- 🔗 **[INTEGRATION.md](./INTEGRATION.md)** - วิธีเชื่อมต่อกับ PHP
- 📋 **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - คำสั่งที่ใช้บ่อย
- 🐳 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - คู่มือ deploy แบบ standalone

## 📁 Project Structure

```
inbox-nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   ├── auth/              # Authentication pages
│   │   └── inbox/             # Inbox pages
│   ├── components/            # React Components
│   │   ├── inbox/            # Inbox-specific components
│   │   └── ui/               # Reusable UI components
│   ├── hooks/                # Custom React Hooks
│   ├── lib/                  # Utilities & Services
│   │   └── services/         # Business logic services
│   ├── stores/               # Zustand stores
│   └── types/                # TypeScript types
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed data
├── scripts/                  # Utility scripts
│   ├── migrate-from-php.ts  # Migration script
│   └── test-auth.ts         # Auth testing
└── public/                   # Static files
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npm run db:generate     # Generate Prisma Client
npm run db:push         # Push schema to database
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio

# Migration
npx tsx scripts/migrate-from-php.ts  # Migrate from PHP system
```

## 🔐 Environment Variables

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/pharmacy_inbox"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# LINE API
LINE_CHANNEL_ACCESS_TOKEN="your-token"
LINE_CHANNEL_SECRET="your-secret"

# Redis (optional)
REDIS_URL="redis://localhost:6379"
```

## 📱 Features Overview

### 1. Conversation List
- แสดงรายการการสนทนาทั้งหมด
- Virtual scrolling สำหรับประสิทธิภาพ
- กรองตาม status, tags, assigned user
- ค้นหาด้วยชื่อหรือเบอร์โทร
- แสดงจำนวนข้อความที่ยังไม่ได้อ่าน

### 2. Chat Panel
- แสดงประวัติการสนทนา
- รองรับข้อความหลายประเภท (text, image, sticker, etc.)
- Typing indicators
- Reply to message
- Real-time updates

### 3. Customer Profile
- แสดงข้อมูลลูกค้า
- ประวัติการซื้อ
- จัดการ tags
- Membership level และ points

### 4. Auto-tagging System
- สร้างกฎการแท็กอัตโนมัติ
- รองรับหลาย trigger types
- Condition-based tagging
- Priority system

## 🧪 Testing

```bash
# Test authentication
npx tsx scripts/test-auth.ts

# Test database connection
npx prisma studio
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/callback/credentials` - Login
- `GET /api/auth/session` - Get session
- `POST /api/auth/signout` - Logout

### Inbox
- `GET /api/inbox/conversations` - Get conversations
- `GET /api/inbox/messages` - Get messages
- `POST /api/inbox/messages` - Send message
- `GET /api/inbox/tags` - Get tags
- `POST /api/inbox/tags` - Create tag
- `GET /api/inbox/realtime` - SSE endpoint

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

- Development Team - LINE CRM Pharmacy

## 🙏 Acknowledgments

- Next.js team
- Prisma team
- shadcn/ui
- All contributors

## 📞 Support

สำหรับคำถามหรือปัญหา กรุณาติดต่อ:
- Email: support@pharmacy.com
- LINE: @pharmacy-support

# inboxreya
