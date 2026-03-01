# Reya Soap Landing Page - Design Specs

## 🎨 Design Direction
"Natural Luxury" — ธรรมชาติ อบอุ่น เชื่อถือได้ แต่ทันสมัย

## 🌈 Color Palette
- **Primary Green:** #2D5A3D (ธรรมชาติ เชื่อถือได้)
- **Secondary Cream:** #F5F0E8 (พื้นหลังอุ่น)
- **Accent Gold:** #C9A962 (ความหรูหราแบบธรรมชาติ)
- **Dark Text:** #2C2C2C (ตัวหนังสือหลัก)
- **Light Text:** #6B6B6B (ตัวหนังสือรอง)
- **White:** #FFFFFF (พื้นที่ว่าง)
- **Success:** #4CAF50 (แจ้งเตือนสำเร็จ)

## 🔤 Typography
- **Heading:** "Prompt" (Thai-friendly, สะอาด ทันสมัย)
- **Body:** "Sarabun" (อ่านง่าย เป็นทางการ)
- **Sizes:**
  - Hero: 48-64px
  - H2: 32-40px
  - H3: 24-28px
  - Body: 16-18px
  - Small: 14px

## 📐 Layout Structure

### Section 1: Hero
- Full width background image (nature/herbs)
- Headline: "13 ปี ที่ผิวสวยต้องมาก่อน"
- Subheadline: สบู่สมุนไพรออร์แกนิกจากธรรมชาติ
- 2 CTA buttons: "เลือกซื้อสบู่" | "สนใจผลิต OEM"

### Section 2: Trust Indicators
- Stats: 13 ปี | X ลูกค้า | X แบรนด์ OEM
- Certifications icons

### Section 3: Products
- Grid 6 สินค้า (Avocado, Charcoal, Sulfur, Camu, Gluta, Floral)
- การ์ดสินค้า: รูป + ชื่อ + benefit หลัก + ราคา

### Section 4: Why Reya
- 4 จุดขาย: สมุนไพรแท้ | ไร้สารอันตราย | 13 ปี | ราคาเข้าถึงได้

### Section 5: Testimonials
- รีวิวลูกค้า (quotes + รูปผิว before/after concept)

### Section 6: OEM CTA
- สำหรับ B2B: "อยากมีแบรนด์สบู่เป็นของตัวเอง?"
- จุดขาย OEM: MOQ ต่ำ | สูตรพร้อม | ดีไซน์ครบ

### Section 7: Footer
- Contact info
- Social links
- Quick links

## 🧩 UI Components

**Buttons:**
- Primary: พื้นหลังเขียว #2D5A3D ตัวอักษรขาว มุมโค้ง 8px
- Secondary: พื้นหลังใส ขอบเขียว ตัวอักษรเขียว
- Hover: darken 10%

**Cards:**
- พื้นหลังขาว เงาเบาๆ มุมโค้ง 12px
- Padding: 24px
- Hover: ยกขึ้นเล็กน้อย + เงาเพิ่ม

**Icons:**
- ใช้ Lucide React
- สไตล์: outlined, stroke-width 1.5-2

## 📱 Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640-1024px
- Desktop: > 1024px

## ✨ Animations
- Scroll reveal: fade-in + slide-up
- Card hover: transform translateY(-4px)
- Button hover: scale(1.02)
- ความเร็ว: 300ms ease-out
