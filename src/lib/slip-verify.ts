import { createHash } from 'crypto'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'
import { redisGet, redisSet } from './redis'

/**
 * Slip verification against slip-c (https://slip-c.oiio.download/#docs).
 *
 * Lives in lib rather than in the route because two callers need the exact same
 * behaviour: the admin-facing `/api/inbox/verify-slip` and the pre-scan cron
 * that verifies slips before an admin ever opens them.
 */

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
 * "ตรวจสอบไม่สำเร็จ". Measured round trips: QR 0.2–18s, OCR ~56s.
 */
const QR_TIMEOUT_MS = 20_000
/**
 * 50s, down from 60s. Production logs show successful OCR replies landing at
 * 16–53s; past that slip-c was not going to answer at all, and the rep was left
 * watching a spinner for a full minute before being told nothing was found.
 */
const OCR_TIMEOUT_MS = 50_000

/**
 * The OCR call no longer waits for the QR call to fail. QR answers in 0.2–18s
 * and OCR takes ~56s, so running them strictly in sequence made the worst case
 * ~76s. Starting OCR 3s in keeps the common case (a fast QR hit) free of an
 * extra slip-c call while capping the worst case at roughly OCR's own 56s.
 */
const OCR_HEAD_START_DELAY_MS = 3_000

/** Slips are photographed at phone resolution; QR reading never needs that. */
const MAX_IMAGE_EDGE_PX = 1400
const JPEG_QUALITY = 82

/** A verified slip describes one immutable bank transaction — safe to cache. */
const VERIFY_CACHE_TTL_SECONDS = 3600

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

export interface SlipImage {
  /** Downscaled pixels, used for QR decoding. */
  buffer: Buffer
  /** Downscaled JPEG as a data URI, which is what slip-c's OCR endpoint takes. */
  dataUri: string
}

/**
 * Download the slip image once and shrink it.
 *
 * Both slip-c calls and the QR decoder used to work on the original phone-sized
 * capture: a 1–3 MB JPEG grows another third as base64 on the way out, and Jimp
 * decoding it is CPU-bound work that blocks the Node event loop for every other
 * request on the instance. Downscaling first leaves the QR readable while making
 * the upload and the decode several times cheaper.
 */
export async function fetchSlipImage(imageUrl: string): Promise<SlipImage | null> {
  const res = await fetch(imageUrl)
  if (!res.ok) return null

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) return null

  const original = Buffer.from(await res.arrayBuffer())
  if (!original.length) return null

  const asIs = (): SlipImage => ({
    buffer: original,
    dataUri: `data:${contentType.split(';')[0]};base64,${original.toString('base64')}`,
  })

  try {
    const image = await Jimp.read(original)
    const longestEdge = Math.max(image.bitmap.width, image.bitmap.height)

    const oversized = longestEdge > MAX_IMAGE_EDGE_PX
    if (oversized) {
      image.scaleToFit({ w: MAX_IMAGE_EDGE_PX, h: MAX_IMAGE_EDGE_PX })
    }

    const jpeg = await image.getBuffer('image/jpeg', { quality: JPEG_QUALITY })

    // Re-encoding is not automatically a win. Measured on real slips: a 1074x1320
    // one shrank 302KB→222KB, while an already-tight 720x1280 GREW 61KB→95KB and
    // cost 55% more upload. So when we did not drop any pixels, keep whichever
    // buffer is actually smaller. Once the image was oversized the resized copy
    // always wins regardless of bytes — fewer pixels is the point there, since
    // jsQR and Jimp both scale with pixel count and that decode blocks the loop.
    if (!oversized && jpeg.length >= original.length) {
      return asIs()
    }

    return {
      buffer: jpeg,
      dataUri: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    }
  } catch {
    // An exotic or corrupt encoding Jimp cannot open is still worth sending to
    // slip-c as-is — its OCR may well read what we could not.
    return asIs()
  }
}

/**
 * Read the bank-transfer QR printed on the slip.
 *
 * Doubles as a free "is this even a slip?" test: ordinary chat photos carry no
 * QR, so callers that scan unattended images can skip the paid slip-c call
 * whenever this returns null.
 */
export async function decodeSlipQr(buffer: Buffer): Promise<string | null> {
  try {
    const image = await Jimp.read(buffer)
    const { data, width, height } = image.bitmap
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
    return jsQR(pixels, width, height)?.data ?? null
  } catch {
    return null
  }
}

const TERMS = { tos: true, privacy: true, eula: true }

export interface SlipCCall {
  res: Response
  data: any
}

async function callSlipC(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<SlipCCall> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const abortFromOutside = () => controller.abort()
  externalSignal?.addEventListener('abort', abortFromOutside, { once: true })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...payload, ...TERMS }),
      signal: controller.signal,
    })

    return { res, data: await readJsonResponse(res) }
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', abortFromOutside)
  }
}

/**
 * Same call, but it says how long it took and what came back. Without this the
 * only trace a failed verification left was a bare TimeoutError with no way to
 * tell which of the two slip-c calls actually hung.
 */
async function timedSlipC(
  label: string,
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<SlipCCall> {
  const startedAt = Date.now()
  try {
    const out = await callSlipC(url, payload, timeoutMs, externalSignal)
    console.log(
      `[verify-slip] ${label} ${Date.now() - startedAt}ms status=${out.res.status}${out.data?.slug ? ` slug=${out.data.slug}` : ''}`
    )
    return out
  } catch (error) {
    console.error(
      `[verify-slip] ${label} failed after ${Date.now() - startedAt}ms:`,
      (error as { name?: string })?.name || error
    )
    throw error
  }
}

/**
 * Resolve with the first call whose response is ok, and fall back to a failed
 * one only once every task has settled. `Promise.race` cannot express this — it
 * would hand back the QR call's 404 while the OCR call was still reading the
 * slip correctly.
 */
export function firstOkCall(tasks: Array<Promise<SlipCCall | null>>): Promise<SlipCCall | null> {
  return new Promise((resolve) => {
    let pending = tasks.length
    let fallback: SlipCCall | null = null

    const settle = (call: SlipCCall | null) => {
      if (call?.res.ok) {
        resolve(call)
        return
      }
      fallback = fallback ?? call
      pending -= 1
      if (pending === 0) resolve(fallback)
    }

    for (const task of tasks) {
      task.then(settle).catch(() => settle(null))
    }
  })
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

export interface SlipVerifyWarning {
  type: string
  message: string
}

export interface SlipVerifyResult {
  success: boolean
  verified: boolean
  warnings?: SlipVerifyWarning[]
  data?: Record<string, any>
  error?: string
  status?: string
  statusCode?: number
  /** True when this answer came straight from Redis. */
  cached?: boolean
}

function cacheKey(imageUrl: string) {
  return `slip:verify:${createHash('sha256').update(imageUrl).digest('hex')}`
}

/**
 * Verify one slip image.
 *
 * `amount` only picks the cheap path: slip-c's QR endpoint matches to the
 * satang, so a mismatch simply loses the race to OCR rather than failing the
 * verification.
 */
export async function verifySlip({
  imageUrl,
  amount,
  image: providedImage,
  useCache = true,
}: {
  imageUrl: string
  amount?: number | string | null
  /** Pass an already-downloaded image to skip the fetch (the cron pre-scan does). */
  image?: SlipImage | null
  useCache?: boolean
}): Promise<SlipVerifyResult> {
  const expectedAmount = Number(amount)
  const hasExpectedAmount = Number.isFinite(expectedAmount) && expectedAmount > 0

  // A verified slip describes one immutable bank transaction, so the answer does
  // not depend on which amount the admin happened to type — cache on the image.
  if (useCache) {
    const hit = await redisGet(cacheKey(imageUrl))
    if (hit) {
      try {
        return { ...(JSON.parse(hit) as SlipVerifyResult), cached: true }
      } catch {
        // Corrupt entry: fall through and verify for real.
      }
    }
  }

  let image = providedImage ?? null
  if (!image) {
    try {
      image = await fetchSlipImage(imageUrl)
    } catch {
      image = null
    }
  }

  if (!image) {
    return {
      success: false,
      verified: false,
      error: 'โหลดรูปสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    }
  }

  const apiBaseUrl = (process.env.SLIP_C_API_BASE_URL || 'https://slip-c.oiio.download').replace(/\/$/, '')

  const qrStartedAt = Date.now()
  const qrData = hasExpectedAmount ? await decodeSlipQr(image.buffer) : null
  if (hasExpectedAmount) {
    console.log(`[verify-slip] qr-decode ${Date.now() - qrStartedAt}ms found=${!!qrData}`)
  }

  const losers = new AbortController()
  const tasks: Array<Promise<SlipCCall | null>> = []

  if (qrData) {
    tasks.push(
      timedSlipC(
        'qr',
        `${apiBaseUrl}/api/slip/${expectedAmount}/no_slip`,
        { qrcode_data: qrData },
        QR_TIMEOUT_MS,
        losers.signal
      ).catch(() => null)
    )
  }

  const hasQrTask = tasks.length > 0
  const slipImage = image
  const ocrCall = async (): Promise<SlipCCall | null> => {
    // Give the QR call a head start only when there is one to wait for.
    if (hasQrTask) {
      await sleep(OCR_HEAD_START_DELAY_MS, losers.signal)
      if (losers.signal.aborted) return null
    }
    return timedSlipC(
      'ocr',
      `${apiBaseUrl}/api/slip`,
      { img: slipImage.dataUri },
      OCR_TIMEOUT_MS,
      losers.signal
    ).catch(() => null)
  }
  tasks.push(ocrCall())

  const winner = await firstOkCall(tasks)
  losers.abort() // stop whichever call is still in flight

  const slipRes = winner?.res
  const slipData = winner?.data
  const tx = slipData?.data

  // slip-c also carries a `verified` flag inside `data`; never report a slip as
  // genuine when it says otherwise.
  if (!slipRes?.ok || !tx || tx.verified === false) {
    const slug = slipData?.slug
    return {
      success: false,
      verified: false,
      error: !winner
        ? 'ระบบตรวจสลิปใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'
        : (slug && ERROR_MESSAGES[slug]) ||
          slipData?.error ||
          slipData?.message ||
          `slip-c API error (${slipRes?.status})`,
      status: slug,
      statusCode: slipRes?.status,
    }
  }

  const bangkok = toBangkokParts(tx.date || '')

  const EXPECTED_RECEIVER_ACCOUNT = process.env.EXPECTED_RECEIVER_ACCOUNT || '068-3-84622-8'
  const EXPECTED_RECEIVER_NAME = process.env.EXPECTED_RECEIVER_NAME || 'บริษัท ซี เอ็น วาย เฮลท์แคร์ จำกัด'

  const warnings: SlipVerifyWarning[] = []

  const receiverAccount = tx.receiver_id || ''
  const receiverName = tx.receiver_name || ''

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

  const result: SlipVerifyResult = {
    success: true,
    verified: true,
    warnings,
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
        account: { value: tx.sender_id || '' },
      },
      sendingBank: tx.sender_bank || '',
      sendingBankName: bankName(tx.sender_bank, tx.sender_bank_details),

      // Receiver info
      receiver: {
        name: tx.receiver_name || '',
        displayName: tx.receiver_name || '',
        account: { value: tx.receiver_id || '' },
      },
      receivingBank: tx.receiver_bank || '',
      receivingBankName: bankName(tx.receiver_bank, tx.receiver_bank_details),

      // Additional fields
      transFeeAmount: 0,
      currency: 'THB',

      // Keep raw data for debugging
      _raw: slipData,
    },
  }

  if (useCache) {
    await redisSet(cacheKey(imageUrl), JSON.stringify(result), VERIFY_CACHE_TTL_SECONDS)
  }

  return result
}
