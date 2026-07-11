#!/usr/bin/env node
/**
 * Test script for GhostX slip verification integration.
 *
 * GhostX verifies a slip from its QR data (no API key required):
 *   POST https://externalauth.ghostxapi.xyz/qr/scan  { "qrData": "..." }
 *
 * Usage:
 *   node test-apislip.js <image_url|qrData>
 *
 * Pass an image URL (the QR is decoded locally with jimp + jsqr) or a raw QR
 * string directly.
 */

const fs = require('fs')
const path = require('path')

let BASE_URL = 'https://externalauth.ghostxapi.xyz'
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8')
  envContent.split('\n').forEach((line) => {
    if (line.includes('=') && !line.trim().startsWith('#')) {
      const [key, ...valueParts] = line.split('=')
      if (key.trim() === 'GHOSTX_API_BASE_URL') {
        BASE_URL = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  })
} catch {
  // .env.local is optional; fall back to the default base URL.
}
BASE_URL = BASE_URL.replace(/\/$/, '')

async function decodeQrFromImage(imageUrl) {
  const { Jimp } = require('jimp')
  const jsQR = require('jsqr')

  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`download failed (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  const img = await Jimp.read(buf)
  const { data, width, height } = img.bitmap
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height)
  if (!code) throw new Error('no QR code found in image')
  return code.data
}

async function testVerifySlip() {
  const input = process.argv[2]

  if (!input) {
    console.log('Testing /qr/scan skipped: pass a slip image URL or raw QR data as the first argument.')
    console.log('   Usage: node test-apislip.js <image_url|qrData>')
    console.log('')
    return
  }

  let qrData = input
  if (/^https?:\/\//i.test(input)) {
    console.log('Decoding QR from image...')
    console.log(`   Image URL: ${input}`)
    try {
      qrData = await decodeQrFromImage(input)
    } catch (err) {
      console.error('   QR decode failed:', err.message)
      return
    }
  }
  console.log(`   QR data: ${qrData.substring(0, 48)}${qrData.length > 48 ? '…' : ''}`)
  console.log('')

  console.log('Testing /qr/scan...')
  try {
    const res = await fetch(`${BASE_URL}/qr/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrData }),
    })

    const data = await res.json()
    const t = data?.slipVerification?.transfer

    if (res.ok && data?.type === 'SLIP' && t?.transactionRef) {
      console.log('Verification Result:')
      console.log(`   Amount: ${t.amount?.amount} ${t.amount?.currency?.code || 'THB'}`)
      console.log(`   Ref: ${t.transactionRef}`)
      console.log(`   Date: ${t.transactionDateTime || 'N/A'}`)
      console.log(`   Sender: ${t.fromAccountName || 'N/A'} (${t.fromBankName || '-'}) ${t.fromAccountNo || ''}`)
      console.log(`   Receiver: ${t.toAccountName || 'N/A'} (${t.toBankName || '-'}) ${t.toAccountNo || ''}`)
    } else {
      console.log('Verification failed:', data)
    }
  } catch (err) {
    console.error('Request failed:', err.message)
  }
  console.log('')
}

async function testVerifyEndpoint() {
  const localEndpoint = 'http://localhost:3000/api/inbox/verify-slip'
  console.log('Local Next.js endpoint:')
  console.log(`   Endpoint: ${localEndpoint}`)
  console.log('   Body: { "imageUrl": "<slip_image_url>" }  (QR decoded server-side)')
  console.log('   Note: requires Next.js dev server and an authenticated session.')
  console.log('')
}

;(async () => {
  await testVerifySlip()
  await testVerifyEndpoint()
  console.log('Test complete.')
})()
