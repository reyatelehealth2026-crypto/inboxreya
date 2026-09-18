import { Info } from 'lucide-react'

/**
 * Shown above the verify button in both slip-checking screens.
 * Every line reflects measured behaviour of the slip-c verification API:
 * the QR path needs an exact amount, the OCR fallback is ~3x slower, and banks
 * publish a transfer to the verification system a minute or two after the slip
 * image exists.
 */
const TIPS = [
  'ใส่ยอดเงินก่อนกดตรวจ จะเร็วขึ้นราว 3 เท่า (ไม่ใส่ก็ได้ ระบบจะอ่านยอดจากรูปเอง แต่ช้ากว่า)',
  'ยอดต้องตรงถึงสตางค์ ถ้าลูกค้าโอนไม่ตรงยอด ระบบจะสลับไปอ่านจากรูปให้เอง ไม่ต้องแก้อะไร',
  'รูปสลิปต้องเห็น QR ครบทั้งอันและชัด ไม่มีนิ้วหรือขอบบัง',
  'กดตรวจครั้งเดียว รอได้ถึง 1 นาที ถ้าขึ้นว่าไม่พบสลิป ให้รอ 1–3 นาทีแล้วลองใหม่ (ธนาคารส่งข้อมูลช้ากว่ารูปสลิป)',
]

export function SlipCheckTips() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span className="text-xs font-semibold text-amber-800">ข้อควรทำก่อนตรวจสลิป</span>
      </div>
      <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber-900">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  )
}
