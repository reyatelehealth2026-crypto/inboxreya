import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'

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

/** BOT 3-digit bank codes → Thai bank names (slip-c returns the code, not the name). */
const BANK_NAMES: Record<string, string> = {
  '002': 'ธนาคารกรุงเทพ',
  '004': 'ธนาคารกสิกรไทย',
  '006': 'ธนาคารกรุงไทย',
  '011': 'ธนาคารทหารไทยธนชาต',
  '014': 'ธนาคารไทยพาณิชย์',
  '017': 'ธนาคารซิตี้แบงก์',
  '018': 'ธนาคารซูมิโตโม มิตซุย ทรัสต์',
  '020': 'ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย)',
  '022': 'ธนาคารซีไอเอ็มบี ไทย',
  '024': 'ธนาคารยูโอบี',
  '025': 'ธนาคารกรุงศรีอยุธยา',
  '026': 'ธนาคารเมกะ สากลพาณิชย์',
  '027': 'ธนาคารแห่งอเมริกา',
  '030': 'ธนาคารออมสิน',
  '031': 'ธนาคารฮ่องกงและเซี่ยงไฮ้',
  '032': 'ธนาคารดอยซ์แบงก์',
  '033': 'ธนาคารอาคารสงเคราะห์',
  '034': 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
  '035': 'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย',
  '039': 'ธนาคารมิซูโฮ',
  '045': 'ธนาคารบีเอ็นพี พารีบาส์',
  '052': 'ธนาคารแห่งประเทศจีน (ไทย)',
  '066': 'ธนาคารอิสลามแห่งประเทศไทย',
  '067': 'ธนาคารทิสโก้',
  '069': 'ธนาคารเกียรตินาคินภัทร',
  '070': 'ธนาคารไอซีบีซี (ไทย)',
  '071': 'ธนาคารไทยเครดิต',
  '073': 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
  '098': 'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย',
}

/**
 * slip-c sometimes cannot identify the bank: it then sends a placeholder code
 * (e.g. "000") with `*_bank_details: null`. Prefer the Thai name, fall back to
 * slip-c's own English name, and finally say so — the UI prints this label
 * directly, so a bare "000" or an empty string would look broken.
 */
function bankName(code: string, details?: { name?: string; nice_name?: string } | null) {
  return (
    BANK_NAMES[String(code || '').padStart(3, '0')] ||
    details?.name ||
    details?.nice_name ||
    'ไม่ระบุ'
  )
}

/** slug → ข้อความภาษาไทยที่แอดมินอ่านรู้เรื่อง (error codes: https://slip-c.oiio.download/#docs) */
const ERROR_MESSAGES: Record<string, string> = {
  'bad-request': 'ข้อมูลที่ส่งไปตรวจสอบไม่ถูกต้อง',
  'terms-not-accepted': 'ระบบตรวจสลิปไม่รับเงื่อนไขการใช้งาน',
  'invalid-image': 'ไฟล์รูปสลิปไม่ถูกต้อง',
  'qr-not-found': 'อ่าน QR จากสลิปไม่สำเร็จ กรุณาส่งรูปสลิปที่ชัดและเห็น QR เต็ม',
  'invalid-qr': 'QR ในสลิปไม่ถูกต้อง อาจไม่ใช่สลิปโอนเงิน',
  'amount-not-found': 'อ่านยอดเงินจากสลิปไม่ได้ กรุณาส่งรูปที่ชัดขึ้น',
  'amount-not-verified': 'ยอดเงินในสลิปตรวจสอบกับธนาคารไม่ผ่าน',
  'invalid-slip-data': 'ข้อมูลสลิปไม่สมบูรณ์',
  'slip-not-found': 'ไม่พบรายการนี้ในระบบธนาคาร (สลิปที่เพิ่งโอนอาจต้องรอ 1–3 นาที แล้วลองใหม่)',
}

/**
 * Per-call timeouts, deliberately NOT one shared budget. A single shared pot let
 * whichever call ran first consume all of it, so a slow QR lookup starved the OCR
 * fallback down to its 1s floor and the admin waited 100s only to be told
 * "ตรวจสอบไม่สำเร็จ". Measured round trips: QR 0.2–18s, OCR ~56s. Worst case is
 * now 80s, still inside the 120s `proxy_read_timeout` on the production nginx.
 */
const QR_TIMEOUT_MS = 20_000
const OCR_TIMEOUT_MS = 60_000

/**
 * Asia/Bangkok is a fixed UTC+7 offset (no DST), so shifting the instant by +7h
 * and reading the UTC parts gives the Thai local date/time.
 * slip-c returns the transfer time in UTC ("...Z"); without this shift a
 * late-evening transfer would be reported on the wrong calendar day.
 */
function toBangkokParts(iso: string) {
  const parsed = new Date(iso)
  if (!iso || isNaN(parsed.getTime())) return null

  const shifted = new Date(parsed.getTime() + 7 * 60 * 60 * 1000).toISOString()
  return {
    dateCompact: shifted.slice(0, 10).replace(/-/g, ''), // YYYYMMDD
    time: shifted.slice(11, 19), // HH:mm:ss
    dateTime: shifted.replace(/\.\d+Z$/, '+07:00'),
  }
}

/** Download the slip image once: raw bytes for the QR reader, data URI for slip-c. */
async function fetchImage(imageUrl: string): Promise<{ buffer: Buffer; dataUri: string } | null> {
  const res = await fetch(imageUrl)
  if (!res.ok) return null

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) return null

  const buffer = Buffer.from(await res.arrayBuffer())
  if (!buffer.length) return null

  return {
    buffer,
    dataUri: `data:${contentType.split(';')[0]};base64,${buffer.toString('base64')}`,
  }
}

/** Read the bank-transfer QR printed on the slip. */
async function decodeQr(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer)
  const { data, width, height } = image.bitmap
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  return jsQR(pixels, width, height)?.data ?? null
}

const TERMS = { tos: true, privacy: true, eula: true }

async function callSlipC(url: string, payload: Record<string, unknown>, timeoutMs: number) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...payload, ...TERMS }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  return { res, data: await readJsonResponse(res) }
}

/**
 * Same call, but it says how long it took and what came back. Without this the
 * only trace a failed verification left was a bare TimeoutError with no way to
 * tell which of the two slip-c calls actually hung.
 */
async function timedSlipC(label: string, url: string, payload: Record<string, unknown>, timeoutMs: number) {
  const startedAt = Date.now()
  try {
    const out = await callSlipC(url, payload, timeoutMs)
    console.log(
      `[verify-slip] ${label} ${Date.now() - startedAt}ms status=${out.res.status}${out.data?.slug ? ` slug=${out.data.slug}` : ''}`
    )
    return out
  } catch (error) {
    console.error(`[verify-slip] ${label} failed after ${Date.now() - startedAt}ms:`, (error as { name?: string })?.name || error)
    throw error
  }
}

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip image via the slip-c API (https://slip-c.oiio.download/#docs),
 * mapping the result back to the existing frontend contract. Proxied server-side.
 *
 * Two paths, because slip-c's OCR step is expensive (measured 56s vs 18s):
 *   - `amount` known → read the slip's QR and post it to `/api/slip/:amount/no_slip`
 *   - otherwise, or if that misses → post the image to `/api/slip` and let it OCR
 *
 * Body (JSON):
 *   imageUrl  – public URL of the slip image (required)
 *   amount    – expected transfer amount (optional; only skips OCR when it matches
 *               the slip to the satang, so a mismatch simply falls back)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { imageUrl, amount } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    const expectedAmount = Number(amount)
    const hasExpectedAmount = Number.isFinite(expectedAmount) && expectedAmount > 0

    // 1) Fetch the slip image once (slip-c takes base64, not a URL).
    let image: Awaited<ReturnType<typeof fetchImage>> = null
    try {
      image = await fetchImage(imageUrl)
    } catch {
      image = null
    }

    if (!image) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: 'โหลดรูปสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        },
        { status: 200 }
      )
    }

    // 2) Verify via slip-c.
    const apiBaseUrl = (process.env.SLIP_C_API_BASE_URL || 'https://slip-c.oiio.download').replace(/\/$/, '')

    let slipRes: Response | undefined
    let slipData: any

    // Fast path: the QR carries the transaction, so slip-c can skip OCR entirely.
    // It only accepts an exact amount, so treat any miss as "try the slow path".
    if (hasExpectedAmount) {
      try {
        const qrStartedAt = Date.now()
        const qrData = await decodeQr(image.buffer).catch(() => null)
        console.log(`[verify-slip] qr-decode ${Date.now() - qrStartedAt}ms found=${!!qrData}`)

        if (qrData) {
          ;({ res: slipRes, data: slipData } = await timedSlipC(
            'qr',
            `${apiBaseUrl}/api/slip/${expectedAmount}/no_slip`,
            { qrcode_data: qrData },
            QR_TIMEOUT_MS
          ))
        }
      } catch {
        // A slow or dead QR lookup must not end the verification — the OCR
        // fallback below reads the same slip without needing the QR at all.
        // Before this, a QR-call timeout aborted the whole request.
        slipRes = undefined
        slipData = undefined
      }
    }

    // Slow path: let slip-c read the amount off the image itself.
    if (!slipRes?.ok) {
      try {
        ;({ res: slipRes, data: slipData } = await timedSlipC(
          'ocr',
          `${apiBaseUrl}/api/slip`,
          { img: image.dataUri },
          OCR_TIMEOUT_MS
        ))
      } catch (error) {
        // A timeout or a dead connection is a normal outcome here, not a bug in
        // this route — answer 200 so the admin sees a readable message.
        const name = (error as { name?: string })?.name
        const timedOut = name === 'TimeoutError' || name === 'AbortError'

        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: timedOut
              ? 'ระบบตรวจสลิปใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'
              : 'เชื่อมต่อระบบตรวจสลิปไม่ได้ กรุณาลองใหม่อีกครั้ง',
          },
          { status: 200 }
        )
      }
    }

    const tx = slipData?.data

    // slip-c also carries a `verified` flag inside `data`; never report a slip as
    // genuine when it says otherwise.
    if (!slipRes?.ok || !tx || tx.verified === false) {
      // slip-c returned an error (bad QR, slip not in the bank system yet, OCR failed…).
      // Keep 200 so the frontend can handle it gracefully.
      const slug = slipData?.slug
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error:
            (slug && ERROR_MESSAGES[slug]) ||
            slipData?.error ||
            slipData?.message ||
            `slip-c API error (${slipRes?.status})`,
          status: slug,
          statusCode: slipRes?.status,
        },
        { status: 200 }
      )
    }

    // 3) Map slip-c → the existing frontend contract (unchanged shape).
    const bangkok = toBangkokParts(tx.date || '')

    // Validate receiver account / name against the company account.
    const EXPECTED_RECEIVER_ACCOUNT = process.env.EXPECTED_RECEIVER_ACCOUNT || '068-3-84622-8'
    const EXPECTED_RECEIVER_NAME = process.env.EXPECTED_RECEIVER_NAME || 'บริษัท ซี เอ็น วาย เฮลท์แคร์ จำกัด'

    const warnings: Array<{ type: string; message: string }> = []

    const receiverAccount = tx.receiver_id || ''
    const receiverName = tx.receiver_name || ''
    const receiverAccountMatches = isReceiverAccountMatch(receiverAccount, EXPECTED_RECEIVER_ACCOUNT)
    const receiverNameMatches = isReceiverNameMatch(receiverName, EXPECTED_RECEIVER_NAME)

    if (receiverAccount && !receiverAccountMatches) {
      warnings.push({
        type: 'receiver_account_mismatch',
        message: `⚠️ บัญชีผู้รับอาจไม่ตรงกับบริษัท\nพบ: ${receiverAccount}\nคาดหวัง: ${EXPECTED_RECEIVER_ACCOUNT}`,
      })
    }

    if (receiverName && !receiverNameMatches) {
      warnings.push({
        type: 'receiver_name_mismatch',
        message: `⚠️ ชื่อผู้รับอาจไม่ตรงกับบริษัท\nพบ: ${receiverName}\nคาดหวัง: ${EXPECTED_RECEIVER_NAME}`,
      })
    }

    return NextResponse.json({
      success: true,
      verified: true,
      warnings, // คำเตือนถ้ามี
      data: {
        // Core fields (used by frontend)
        amount: tx.amount,
        transRef: tx.ref || '',
        transDate: bangkok?.dateCompact || '', // YYYYMMDD
        transTime: bangkok?.time || '',
        transDateTime: bangkok?.dateTime || tx.date || '',
        date: bangkok?.dateTime || tx.date || '',

        // Sender info
        sender: {
          name: tx.sender_name || '',
          displayName: tx.sender_name || '',
          account: {
            value: tx.sender_id || '',
          },
        },
        sendingBank: tx.sender_bank || '',
        sendingBankName: bankName(tx.sender_bank, tx.sender_bank_details),

        // Receiver info
        receiver: {
          name: tx.receiver_name || '',
          displayName: tx.receiver_name || '',
          account: {
            value: tx.receiver_id || '',
          },
        },
        receivingBank: tx.receiver_bank || '',
        receivingBankName: bankName(tx.receiver_bank, tx.receiver_bank_details),

        // Additional fields
        transFeeAmount: 0,
        currency: 'THB',

        // Keep raw data for debugging
        _raw: slipData,
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
