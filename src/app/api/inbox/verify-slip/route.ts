import { NextRequest, NextResponse } from 'next/server'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'
import { auth } from '@/lib/auth'

// QR decoding needs the Node.js runtime (Buffer / jimp), not the edge runtime.
export const runtime = 'nodejs'

function normalizeAccountDigits(value: string) {
  return (value || '').replace(/\D/g, '')
}

function isReceiverAccountMatch(actualAccount: string, expectedAccount: string) {
  if (!actualAccount || !expectedAccount) return actualAccount === expectedAccount

  const actualDigits = normalizeAccountDigits(actualAccount)
  const expectedDigits = normalizeAccountDigits(expectedAccount)

  if (!actualDigits || !expectedDigits) return actualAccount === expectedAccount
  if (actualDigits === expectedDigits) return true

  const looksMasked = /[xX*]/.test(actualAccount)
  if (looksMasked && actualDigits.length >= 4) {
    return expectedDigits.includes(actualDigits)
  }

  return false
}

function canonicalizeCompanyName(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[()\[\]{}.,:/\\\-]+/g, ' ')
    .replace(/&/g, ' และ ')
    .replace(/\bco\b/g, ' ')
    .replace(/\bltd\b/g, ' ')
    .replace(/\blimited\b/g, ' ')
    .replace(/\bcompany\b/g, ' ')
    .replace(/บริษัท/g, ' ')
    .replace(/บจก/g, ' ')
    .replace(/บมจ/g, ' ')
    .replace(/หจก/g, ' ')
    .replace(/จำกัด/g, ' ')
    .replace(/จํากัด/g, ' ')
    .replace(/มหาชน/g, ' ')
    .replace(/health\s*care/g, ' healthcare ')
    .replace(/เฮลท์\s*แคร์/g, ' healthcare ')
    .replace(/ซี\s*เอ็น\s*วาย/g, ' cny ')
    .replace(/ซี\s*เอน\s*วาย/g, ' cny ')
    .replace(/c\s*n\s*y/g, ' cny ')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isReceiverNameMatch(actualName: string, expectedName: string) {
  if (!actualName || !expectedName) return actualName === expectedName

  const actualCanonical = canonicalizeCompanyName(actualName)
  const expectedCanonical = canonicalizeCompanyName(expectedName)

  if (!actualCanonical || !expectedCanonical) return actualCanonical === expectedCanonical
  if (actualCanonical === expectedCanonical) return true

  const actualJoined = actualCanonical.replace(/\s+/g, '')
  const expectedJoined = expectedCanonical.replace(/\s+/g, '')
  if (actualJoined === expectedJoined) return true
  if (actualJoined.includes(expectedJoined) || expectedJoined.includes(actualJoined)) return true

  const actualTokens = actualCanonical.split(' ').filter(Boolean)
  const expectedTokens = expectedCanonical.split(' ').filter(Boolean)
  const expectedTokenSet = new Set(expectedTokens)
  const actualTokenSet = new Set(actualTokens)

  const receiverIsMeaningfulSubset = actualTokens.length > 0 && actualTokens.every((token) => expectedTokenSet.has(token))
  const expectedIsMeaningfulSubset = expectedTokens.length > 0 && expectedTokens.every((token) => actualTokenSet.has(token))

  if (receiverIsMeaningfulSubset || expectedIsMeaningfulSubset) return true

  return false
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

// Map common Thai bank short names returned by GhostX to the numeric codes the
// frontend BANK_MAP is keyed on. Falls back to the original value if unknown.
const BANK_NAME_TO_CODE: Record<string, string> = {
  SCB: '014',
  KBANK: '004',
  KBNK: '004',
  BBL: '002',
  KTB: '006',
  BAY: '025',
  KRUNGSRI: '025',
  TTB: '011',
  TMB: '011',
  KKP: '069',
  CIMB: '022',
  TISCO: '067',
  UOB: '024',
  ICBC: '071',
  LHFG: '073',
  LHBANK: '073',
  GSB: '030',
  BAAC: '034',
  GHB: '035',
}

function resolveBankCode(bankName: string) {
  if (!bankName) return ''
  const key = bankName.trim().toUpperCase()
  return BANK_NAME_TO_CODE[key] || ''
}

/**
 * Decode the PromptPay/slip QR string from a slip image URL.
 * Downloads the image server-side (avoids browser CORS/canvas-taint issues with
 * chat-hosted images) and runs jsQR over the raw pixels.
 */
async function decodeQrFromImageUrl(imageUrl: string): Promise<string | null> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; inboxreya/1.0; +https://inbox.re-ya.com)',
    },
  })
  if (!res.ok) {
    throw new Error(`ไม่สามารถดาวน์โหลดรูปสลิปได้ (${res.status})`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const image = await Jimp.read(buffer)

  const tryDecode = (img: typeof image): string | null => {
    const { data, width, height } = img.bitmap
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)
    const code = jsQR(pixels, width, height)
    return code?.data || null
  }

  // First pass: original image.
  let qr = tryDecode(image)

  // Second pass: upscale small images + boost contrast to help noisy slips.
  if (!qr) {
    const enhanced = image.clone()
    if (enhanced.bitmap.width < 1000) {
      const scale = 1000 / enhanced.bitmap.width
      enhanced.resize({ w: 1000, h: Math.round(enhanced.bitmap.height * scale) })
    }
    enhanced.greyscale().contrast(0.3)
    qr = tryDecode(enhanced)
  }

  return qr
}

interface GhostXTransfer {
  transactionRef?: string
  transactionDateTime?: string
  fromBankName?: string
  fromAccountNo?: string
  fromAccountName?: string | null
  toBankName?: string
  toAccountNo?: string
  toAccountName?: string | null
  amount?: {
    amount?: number
    currency?: { code?: string; symbol?: string }
  }
}

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip via the GhostX Verify-Slip API.
 * The slip's QR code is decoded server-side and the raw QR data is sent to
 * GhostX (https://externalauth.ghostxapi.xyz/qr/scan), which returns the
 * underlying bank transfer record.
 *
 * Body (JSON), one of:
 *   imageUrl  – public URL of the slip image (QR decoded server-side)
 *   qrData    – raw QR string already decoded by the caller
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { imageUrl } = body
    let { qrData } = body as { qrData?: string }

    if (!qrData && !imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl or qrData is required' },
        { status: 400 }
      )
    }

    // Resolve the QR string. Prefer caller-supplied qrData, otherwise decode
    // it from the slip image.
    if (!qrData && imageUrl) {
      try {
        qrData = (await decodeQrFromImageUrl(imageUrl)) || undefined
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: err instanceof Error ? err.message : 'อ่านรูปสลิปไม่สำเร็จ',
          },
          { status: 200 }
        )
      }

      if (!qrData) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: 'ไม่พบ QR Code ในรูปสลิป กรุณาใช้รูปที่ชัดเจนและเห็น QR ครบ',
          },
          { status: 200 }
        )
      }
    }

    const apiBaseUrl = (process.env.GHOSTX_API_BASE_URL || 'https://externalauth.ghostxapi.xyz').replace(/\/$/, '')
    const ghostRes = await fetch(`${apiBaseUrl}/qr/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; inboxreya/1.0; +https://inbox.re-ya.com)',
      },
      body: JSON.stringify({ qrData }),
    })

    const ghostData = await readJsonResponse(ghostRes)
    const transfer: GhostXTransfer = ghostData?.slipVerification?.transfer || {}

    // A valid slip verification has a transfer block with a reference number.
    const isVerified = ghostRes.ok && ghostData?.type === 'SLIP' && !!transfer?.transactionRef

    if (!isVerified) {
      // GhostX errors look like: { code, title, message, description }
      const errorMessage =
        ghostData?.message ||
        ghostData?.title ||
        ghostData?.error ||
        `ตรวจสอบสลิปไม่สำเร็จ (${ghostRes.status})`

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: errorMessage,
          status: ghostData?.code,
          statusCode: ghostRes.status,
          isAuthentic: false,
          data: ghostData,
        },
        { status: 200 }
      )
    }

    const transDate = transfer.transactionDateTime || ''
    const transTime = transDate ? transDate.split('T')[1]?.replace(/[+\-]\d{2}:\d{2}$/, '').replace(/\.\d+Z?$/, '') || '' : ''
    const amount = transfer.amount?.amount ?? 0
    const currency = transfer.amount?.currency?.code || 'THB'

    // Validate receiver against the company account.
    const EXPECTED_RECEIVER_ACCOUNT = process.env.EXPECTED_RECEIVER_ACCOUNT || '068-3-84622-8'
    const EXPECTED_RECEIVER_NAME = process.env.EXPECTED_RECEIVER_NAME || 'บริษัท ซี เอ็น วาย เฮลท์แคร์ จำกัด'

    const warnings: Array<{ type: string; message: string }> = []

    const receiverAccount = transfer.toAccountNo || ''
    const receiverName = transfer.toAccountName || ''

    if (receiverAccount && !isReceiverAccountMatch(receiverAccount, EXPECTED_RECEIVER_ACCOUNT)) {
      warnings.push({
        type: 'receiver_account_mismatch',
        message: `⚠️ บัญชีผู้รับอาจไม่ตรงกับบริษัท\nพบ: ${receiverAccount}\nคาดหวัง: ${EXPECTED_RECEIVER_ACCOUNT}`,
      })
    }

    if (receiverName && !isReceiverNameMatch(receiverName, EXPECTED_RECEIVER_NAME)) {
      warnings.push({
        type: 'receiver_name_mismatch',
        message: `⚠️ ชื่อผู้รับอาจไม่ตรงกับบริษัท\nพบ: ${receiverName}\nคาดหวัง: ${EXPECTED_RECEIVER_NAME}`,
      })
    }

    return NextResponse.json({
      success: true,
      verified: true,
      warnings,
      data: {
        // Core fields (used by frontend)
        amount,
        transRef: transfer.transactionRef || '',
        transDate: transDate.split('T')[0]?.replace(/-/g, '') || transDate.split('T')[0] || '',
        transTime,
        transDateTime: transDate,
        date: transDate,

        // Sender info
        sender: {
          name: transfer.fromAccountName || '',
          displayName: transfer.fromAccountName || '',
          account: {
            value: transfer.fromAccountNo || '',
          },
        },
        sendingBank: resolveBankCode(transfer.fromBankName || '') || transfer.fromBankName || '',
        sendingBankName: transfer.fromBankName || '',

        // Receiver info
        receiver: {
          name: transfer.toAccountName || '',
          displayName: transfer.toAccountName || '',
          account: {
            value: transfer.toAccountNo || '',
          },
        },
        receivingBank: resolveBankCode(transfer.toBankName || '') || transfer.toBankName || '',
        receivingBankName: transfer.toBankName || '',

        // Additional fields
        transFeeAmount: 0,
        currency,

        // Keep raw data for debugging
        _raw: ghostData,
      },
    })
  } catch (error) {
    console.error('[verify-slip] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
