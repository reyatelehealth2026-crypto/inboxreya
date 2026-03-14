import crypto from 'node:crypto'
import sharp from 'sharp'
import prisma from '@/lib/prisma'
import { generateAiText, fetchImageAsInlineData } from '@/lib/ai'

type VerificationStatus = 'pending' | 'valid' | 'suspicious' | 'review' | 'error'

export interface ParsedSlipData {
  bankName: string | null
  amount: number | null
  transferDate: string | null
  transferTime: string | null
  referenceNo: string | null
  senderName: string | null
  receiverName: string | null
}

export interface SlipVerificationOutput {
  verificationId: number
  status: VerificationStatus
  score: number
  summary: string
  flags: string[]
  checks: Record<string, boolean | null | number | string>
  parsed: ParsedSlipData
  ocr: {
    provider: string | null
    confidence: number | null
  }
  image: {
    width: number | null
    height: number | null
    sizeBytes: number
  }
}

interface VerifySlipInput {
  messageId: number
  userId: number
  expectedAmount?: number | null
  expectedDate?: string | null
  note?: string | null
  verifiedBy?: string | null
}

interface ImageInspection {
  width: number | null
  height: number | null
  format: string | null
  sizeBytes: number
  sha256: string
  imageHash: string
}

interface DuplicateSignals {
  duplicateExactImage: boolean
  duplicateNearImage: boolean
}

const DEFAULT_PARSED_DATA: ParsedSlipData = {
  bankName: null,
  amount: null,
  transferDate: null,
  transferTime: null,
  referenceNo: null,
  senderName: null,
  receiverName: null,
}

function parseLooseJson<T>(value: string): T | null {
  const trimmed = value.trim()
  const clean = trimmed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

function toIsoDate(input?: string | null): string | null {
  if (!input) return null
  const value = input.trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const slashMatch = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

function normalizeParsedSlipData(value: unknown): ParsedSlipData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PARSED_DATA
  }

  const record = value as Record<string, unknown>
  return {
    bankName: typeof record.bankName === 'string' ? record.bankName : null,
    amount: typeof record.amount === 'number' ? record.amount : null,
    transferDate: typeof record.transferDate === 'string' ? record.transferDate : null,
    transferTime: typeof record.transferTime === 'string' ? record.transferTime : null,
    referenceNo: typeof record.referenceNo === 'string' ? record.referenceNo : null,
    senderName: typeof record.senderName === 'string' ? record.senderName : null,
    receiverName: typeof record.receiverName === 'string' ? record.receiverName : null,
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function normalizeChecks(value: unknown): Record<string, boolean | null | number | string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, boolean | null | number | string>
}

function toParsedJson(value: ParsedSlipData) {
  return {
    bankName: value.bankName,
    amount: value.amount,
    transferDate: value.transferDate,
    transferTime: value.transferTime,
    referenceNo: value.referenceNo,
    senderName: value.senderName,
    receiverName: value.receiverName,
  }
}

async function resolveMessageImageUrl(message: { content: string | null; mediaUrl: string | null }) {
  let imageUrl = message.content

  if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
    const phpBase =
      process.env.PHP_API_URL ||
      process.env.NEXT_PUBLIC_PHP_API_URL ||
      process.env.NEXT_PUBLIC_BASE_URL

    if (phpBase && message.mediaUrl) {
      imageUrl = `${phpBase.replace(/\/$/, '')}/api/line_content.php?id=${message.mediaUrl}`
    }
  }

  return imageUrl || null
}

async function fetchImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`ไม่สามารถดึงรูปสลิปได้ (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await response.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType,
  }
}

async function inspectImage(buffer: Buffer): Promise<ImageInspection> {
  const metadata = await sharp(buffer).metadata()
  const grayscale = await sharp(buffer).resize(8, 8, { fit: 'fill' }).grayscale().raw().toBuffer()
  const average = grayscale.reduce((sum, pixel) => sum + pixel, 0) / grayscale.length
  const bits = Array.from(grayscale)
    .map((pixel) => (pixel >= average ? '1' : '0'))
    .join('')
  const imageHash = BigInt(`0b${bits}`).toString(16).padStart(16, '0')

  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format ?? null,
    sizeBytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    imageHash,
  }
}

async function extractSlipDataWithGemini(imageUrl: string, buffer?: Buffer, mimeType?: string) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      provider: null,
      confidence: null,
      parsed: DEFAULT_PARSED_DATA,
      rawText: null as string | null,
      flags: ['ocr_not_configured'],
    }
  }

  const ocrFlags: string[] = []

  try {
    const inline = await fetchImageAsInlineData(imageUrl)

    // TRY EASYSLIP API FIRST IF KEY IS PROVIDED
    if (process.env.EASYSLIP_API_KEY) {
      try {
        console.log('[slip-verification] Attempting EasySlip URL verification...')
        let easySlipRes = await fetch('https://developer.easyslip.com/api/v1/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EASYSLIP_API_KEY}`,
          },
          body: JSON.stringify({ url: imageUrl }),
        })

        let esData = await easySlipRes.json()

        // IF URL VERIFICATION FAILS, FALLBACK TO FILE UPLOAD (MULTIPART/FORM-DATA)
        if ((!easySlipRes.ok || esData.status !== 200) && buffer && mimeType) {
          console.warn('[slip-verification] URL verification failed or slip not found, falling back to File Upload...', esData)
          
          const formData = new FormData()
          // Convert Node.js Buffer to Uint8Array for standard Blob compatibility
          const blob = new Blob([new Uint8Array(buffer)], { type: mimeType })
          formData.append('file', blob, 'slip.jpg')

          easySlipRes = await fetch('https://developer.easyslip.com/api/v1/verify', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.EASYSLIP_API_KEY}`,
            },
            body: formData,
          })
          esData = await easySlipRes.json()
        }

        if (easySlipRes.ok && esData.status === 200 && esData.data) {
          const data = esData.data
          const parsedEs: ParsedSlipData = {
            bankName: data.sender?.bank?.name || data.sender?.bank?.short || null,
            amount: data.amount?.amount || null,
            transferDate: data.date ? data.date.split('T')[0] : null,
            transferTime: data.date ? data.date.split('T')[1]?.substring(0, 5) : null,
            referenceNo: data.transRef || null,
            senderName: data.sender?.account?.name?.th || data.sender?.account?.name?.en || null,
            receiverName: data.receiver?.account?.name?.th || data.receiver?.account?.name?.en || null,
          }

          return {
            provider: 'easyslip',
            confidence: 1.0,
            parsed: parsedEs,
            rawText: JSON.stringify(esData, null, 2),
            flags: ['bank_verified'],
          }
        } else {
          console.error('[slip-verification] EasySlip API failed (both URL and Base64):', esData)
          ocrFlags.push('bank_verification_not_found')
        }
      } catch (err) {
        console.error('[slip-verification] EasySlip error:', err)
        ocrFlags.push('bank_api_error')
      }
    }

    const prompt = `
อ่านข้อความจากภาพสลิปการโอนเงินภาษาไทย/อังกฤษ และตอบเป็น JSON เท่านั้น ห้ามมี markdown
รูปแบบ:
{
  "bankName": string | null,
  "amount": number | null,
  "transferDate": "YYYY-MM-DD" | null,
  "transferTime": "HH:mm" | null,
  "referenceNo": string | null,
  "senderName": string | null,
  "receiverName": string | null,
  "confidence": number | null,
  "rawText": string | null
}

กฎ:
- ถ้าไม่มั่นใจให้ใส่ null
- amount เป็นตัวเลขเท่านั้น
- transferDate ใช้ ค.ศ. YYYY-MM-DD ถ้าแปลงได้
- confidence เป็น 0 ถึง 1
`

    const text = await generateAiText({
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: inline.mimeType,
            data: inline.data,
          },
        },
      ],
      temperature: 0.1,
      maxTokens: 700,
    })

    const parsedJson = parseLooseJson<ParsedSlipData & { confidence?: number | null; rawText?: string | null }>(text)

    return {
      provider: 'gemini',
      confidence: parsedJson?.confidence ?? null,
      parsed: {
        bankName: parsedJson?.bankName ?? null,
        amount: typeof parsedJson?.amount === 'number' ? parsedJson.amount : null,
        transferDate: toIsoDate(parsedJson?.transferDate ?? null),
        transferTime: parsedJson?.transferTime ?? null,
        referenceNo: parsedJson?.referenceNo ?? null,
        senderName: parsedJson?.senderName ?? null,
        receiverName: parsedJson?.receiverName ?? null,
      } satisfies ParsedSlipData,
      rawText: parsedJson?.rawText ?? text,
      flags: ocrFlags,
    }
  } catch (error) {
    console.error('[slip-verification] Gemini OCR failed:', error)
    return {
      provider: 'gemini',
      confidence: null,
      parsed: DEFAULT_PARSED_DATA,
      rawText: null as string | null,
      flags: [...ocrFlags, 'ocr_failed'],
    }
  }
}

function buildResultSummary(status: VerificationStatus, flags: string[]) {
  if (flags.includes('bank_verified')) return '✅ ตรวจสอบแล้ว: สลิปนี้มาจากธนาคารจริงและถูกต้อง (EasySlip)'
  if (flags.includes('bank_verification_not_found')) return '❌ ธนาคารไม่พบรายการโอนนี้: สลิปอาจจะยังไม่เข้าระบบหรือมีความผิดปกติ (EasySlip 404)'
  if (status === 'valid') return 'ผ่านการตรวจเบื้องต้น สามารถใช้เป็นข้อมูลประกอบการบันทึกสลิปได้'
  if (status === 'suspicious') return `พบความน่าสงสัย ${flags.length ? flags.join(', ') : 'ควรตรวจเพิ่ม'}`
  if (status === 'review') return 'อ่านข้อมูลได้บางส่วน แต่ยังควรตรวจสอบเพิ่มเติมก่อนยืนยัน'
  if (status === 'error') return 'ตรวจสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  return 'กำลังตรวจสลิป'
}

function scoreVerification(params: {
  inspection: ImageInspection
  duplicates: DuplicateSignals
  parsed: ParsedSlipData
  expectedAmount?: number | null
  expectedDate?: string | null
  ocrConfidence?: number | null
  ocrFlags?: string[]
}) {
  const { inspection, duplicates, parsed, expectedAmount, expectedDate, ocrConfidence, ocrFlags = [] } = params
  const normalizedOcrConfidence = ocrConfidence ?? null
  const flags = new Set<string>(ocrFlags)
  let score = 50

  const isBankVerified = flags.has('bank_verified')

  if (isBankVerified) {
    score = 100
  } else {
    if ((inspection.width ?? 0) < 640 || (inspection.height ?? 0) < 640) {
      flags.add('low_resolution')
      score -= 15
    } else {
      score += 10
    }

    if ((inspection.sizeBytes ?? 0) < 80_000) {
      flags.add('small_file_size')
      score -= 5
    }

    if ((inspection.width ?? 0) > 0 && (inspection.height ?? 0) > 0) {
      const ratio = Math.max(inspection.width || 0, inspection.height || 0) / Math.max(1, Math.min(inspection.width || 1, inspection.height || 1))
      if (ratio > 3) {
        flags.add('extreme_aspect_ratio')
        score -= 10
      }
    }
  }

  if (duplicates.duplicateExactImage) {
    flags.add('duplicate_exact_image')
    score -= 35
  }

  if (duplicates.duplicateNearImage) {
    flags.add('duplicate_near_image')
    score -= 15
  }

  if (parsed.bankName) {
    if (!isBankVerified) score += 10
  } else flags.add('bank_not_detected')

  if (typeof parsed.amount === 'number') {
    if (!isBankVerified) score += 10
  } else flags.add('amount_not_detected')

  if (parsed.transferDate) {
    if (!isBankVerified) score += 8
  } else flags.add('date_not_detected')

  if (parsed.referenceNo) {
    if (!isBankVerified) score += 7
  } else flags.add('reference_not_detected')

  if (normalizedOcrConfidence !== null && !isBankVerified) {
    if (normalizedOcrConfidence >= 0.8) score += 8
    else if (normalizedOcrConfidence >= 0.6) score += 4
    else {
      flags.add('low_ocr_confidence')
      score -= 8
    }
  }

  const normalizedExpectedDate = toIsoDate(expectedDate ?? null)
  const normalizedParsedDate = toIsoDate(parsed.transferDate)

  const amountMatched =
    typeof expectedAmount === 'number' && typeof parsed.amount === 'number'
      ? Math.abs(parsed.amount - expectedAmount) < 0.01
      : null

  const dateMatched =
    normalizedExpectedDate && normalizedParsedDate
      ? normalizedExpectedDate === normalizedParsedDate
      : null

  if (amountMatched === true) score += 10
  if (amountMatched === false) {
    flags.add('amount_mismatch')
    score -= 20
  }

  if (dateMatched === true) score += 8
  if (dateMatched === false) {
    flags.add('date_mismatch')
    score -= 10
  }

  score = Math.max(0, Math.min(100, score))

  let status: VerificationStatus = 'review'
  if (duplicates.duplicateExactImage || flags.has('amount_mismatch') || flags.has('bank_verification_not_found')) {
    status = 'suspicious'
  } else if (score >= 80) {
    status = 'valid'
  } else if (score < 60) {
    status = 'suspicious'
  }

  const checks: Record<string, boolean | null | number | string> = {
    imageReadable: (inspection.width ?? 0) >= 640 && (inspection.height ?? 0) >= 640,
    duplicateExactImage: duplicates.duplicateExactImage,
    duplicateNearImage: duplicates.duplicateNearImage,
    amountMatched,
    dateMatched,
    ocrConfidence: normalizedOcrConfidence,
  }

  return {
    status,
    score,
    flags: Array.from(flags),
    checks,
    summary: buildResultSummary(status, Array.from(flags)),
  }
}

export async function verifySlipMessage({
  messageId,
  userId,
  expectedAmount,
  expectedDate,
  note,
  verifiedBy,
}: VerifySlipInput): Promise<SlipVerificationOutput> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      userId: true,
      messageType: true,
      content: true,
      mediaUrl: true,
    },
  })

  if (!message) {
    throw new Error('ไม่พบข้อความที่ต้องการตรวจสลิป')
  }

  if (message.messageType !== 'image') {
    throw new Error('ข้อความนี้ไม่ใช่รูปภาพ จึงไม่สามารถตรวจสลิปได้')
  }

  const imageUrl = await resolveMessageImageUrl(message)
  if (!imageUrl) {
    throw new Error('ไม่พบ URL ของรูปภาพสลิป')
  }

  const { buffer, mimeType } = await fetchImageBuffer(imageUrl)
  const inspection = await inspectImage(buffer)

  const existingDuplicate = await prisma.slipVerification.findFirst({
    where: {
      NOT: { messageId },
      OR: [{ sha256: inspection.sha256 }, { imageHash: inspection.imageHash }],
    },
    select: { id: true, sha256: true, imageHash: true },
  })

  const duplicates: DuplicateSignals = {
    duplicateExactImage: existingDuplicate?.sha256 === inspection.sha256,
    duplicateNearImage: Boolean(existingDuplicate && existingDuplicate.imageHash === inspection.imageHash),
  }

  const ocr = await extractSlipDataWithGemini(imageUrl, buffer, mimeType)
  const evaluation = scoreVerification({
    inspection,
    duplicates,
    parsed: ocr.parsed,
    expectedAmount,
    expectedDate,
    ocrConfidence: ocr.confidence,
    ocrFlags: ocr.flags,
  })

  const record = await prisma.slipVerification.upsert({
    where: { messageId },
    create: {
      messageId,
      userId,
      imageUrl,
      expectedAmount: typeof expectedAmount === 'number' ? expectedAmount : undefined,
      expectedDate: expectedDate ? new Date(expectedDate) : undefined,
      adminNote: note || undefined,
      status: evaluation.status,
      score: evaluation.score,
      summary: evaluation.summary,
      flags: evaluation.flags,
      checks: evaluation.checks,
      parsed: toParsedJson(ocr.parsed),
      ocrProvider: ocr.provider,
      ocrConfidence: ocr.confidence,
      ocrRawText: ocr.rawText,
      sha256: inspection.sha256,
      imageHash: inspection.imageHash,
      width: inspection.width,
      height: inspection.height,
      fileSize: inspection.sizeBytes,
      verifiedBy: verifiedBy || undefined,
      verifiedAt: new Date(),
    },
    update: {
      userId,
      imageUrl,
      expectedAmount: typeof expectedAmount === 'number' ? expectedAmount : null,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      adminNote: note || null,
      status: evaluation.status,
      score: evaluation.score,
      summary: evaluation.summary,
      flags: evaluation.flags,
      checks: evaluation.checks,
      parsed: toParsedJson(ocr.parsed),
      ocrProvider: ocr.provider,
      ocrConfidence: ocr.confidence,
      ocrRawText: ocr.rawText,
      sha256: inspection.sha256,
      imageHash: inspection.imageHash,
      width: inspection.width,
      height: inspection.height,
      fileSize: inspection.sizeBytes,
      verifiedBy: verifiedBy || null,
      verifiedAt: new Date(),
    },
  })

  return {
    verificationId: record.id,
    status: evaluation.status,
    score: evaluation.score,
    summary: evaluation.summary,
    flags: evaluation.flags,
    checks: evaluation.checks,
    parsed: ocr.parsed,
    ocr: {
      provider: ocr.provider,
      confidence: ocr.confidence,
    },
    image: {
      width: inspection.width,
      height: inspection.height,
      sizeBytes: inspection.sizeBytes,
    },
  }
}

export async function getSlipVerificationByMessageId(messageId: number): Promise<SlipVerificationOutput | null> {
  const record = await prisma.slipVerification.findUnique({
    where: { messageId },
    select: {
      id: true,
      status: true,
      score: true,
      summary: true,
      flags: true,
      checks: true,
      parsed: true,
      ocrProvider: true,
      ocrConfidence: true,
      width: true,
      height: true,
      fileSize: true,
    },
  })

  if (!record) return null

  const status = record.status as VerificationStatus

  return {
    verificationId: record.id,
    status,
    score: record.score ?? 0,
    summary: record.summary || buildResultSummary(status || 'review', []),
    flags: normalizeStringArray(record.flags),
    checks: normalizeChecks(record.checks),
    parsed: normalizeParsedSlipData(record.parsed),
    ocr: {
      provider: record.ocrProvider,
      confidence: record.ocrConfidence,
    },
    image: {
      width: record.width,
      height: record.height,
      sizeBytes: record.fileSize ?? 0,
    },
  }
}
