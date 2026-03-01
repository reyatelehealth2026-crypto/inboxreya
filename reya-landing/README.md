# Reya Soap Landing Page

## 🚀 วิธีรันดูในเครื่องคุณ

### 1. ดาวน์โหลดโค้ด
```bash
# ถ้าใช้ git
git clone [repo-url]
cd reya-landing

# หรือ copy ไฟล์ทั้งหมดใน folder reya-landing
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. รัน Development Server
```bash
npm run dev
```

### 4. เปิดดูที่
```
http://localhost:3000
```

---

## 📁 โครงสร้างไฟล์

```
reya-landing/
├── app/
│   ├── sections/
│   │   ├── HeroSection.tsx      ← หน้าแรก
│   │   ├── StatsSection.tsx     ← ตัวเลขสถิติ
│   │   ├── ProductsSection.tsx  ← สินค้า 6 ตัว
│   │   ├── WhySection.tsx       ← ทำไมต้องเรยา
│   │   ├── Testimonials.tsx     ← รีวิวลูกค้า
│   │   ├── OemSection.tsx       ← สำหรับ B2B
│   │   └── Footer.tsx           ← ท้ายเว็บ
│   ├── page.tsx                 ← หน้าหลัก
│   ├── layout.tsx               ← Layout ทั้งเว็บ
│   └── globals.css              ← สไตล์ทั้งหมด
├── design-specs.md              ← Design System
└── copywriting.md               ← Copy ทั้งหมด
```

---

## 🎨 Design System

- **Primary:** #2D5A3D (เขียวธรรมชาติ)
- **Cream:** #F5F0E8 (พื้นหลังอุ่น)
- **Gold:** #C9A962 (ไฮไลท์หรูหรา)

---

## 📝 ข้อมูลที่ต้องอัปเดตก่อนใช้จริง

1. **เบอร์โทร** - ใน Footer.tsx
2. **Social Links** - Facebook, IG, TikTok, LINE
3. **รูปสินค้า** - แทน placeholder icons
4. **ราคาจริง** - ใน ProductsSection.tsx
5. **รีวิวจริง** - ใน Testimonials.tsx

