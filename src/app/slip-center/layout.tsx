import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Slip Center — CNY ERP',
  description: 'จัดการสลิปการชำระเงินและจับคู่กับ BDO',
}

export default function SlipCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
