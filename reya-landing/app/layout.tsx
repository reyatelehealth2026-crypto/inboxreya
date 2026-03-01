import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reya Soap - สบู่สมุนไพรออร์แกนิก | 13 ปี ที่ผิวสวยต้องมาก่อน',
  description: 'สบู่สมุนไพรออร์แกนิกคุณภาพสูง สูตรพิสูจน์แล้วจากลูกค้านับหมื่น ผิวสวยที่ยั่งยืนเริ่มต้นที่นี่',
  keywords: 'สบู่สมุนไพร, สบู่ออร์แกนิก, สบู่ลดสิว, สบู่ผิวขาว, Reya Soap, รับผลิตสบู่ OEM',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
