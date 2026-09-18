#!/usr/bin/env node
/**
 * Simple test for GhostX slip verification API.
 *
 * Usage:
 *   node test-apislip-simple.js <image_url|qrData>
 *
 * Pass either an image URL (QR is decoded locally) or a raw QR string.
 */

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '.env.local')
let BASE_URL = 'https://externalauth.ghostxapi.xyz'
try {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const baseUrlMatch = envContent.match(/GHOSTX_API_BASE_URL="?([^"\r\n]+)"?/)
  if (baseUrlMatch?.[1]) BASE_URL = baseUrlMatch[1]
} catch {
  // .env.local is optional; fall back to the default base URL.
}
BASE_URL = BASE_URL.replace(/\/$/, '')

async function decodeQr(input) {
  // If it doesn't look like a URL, treat it as raw QR data.
  if (!/^https?:\/\//i.test(input)) return input

  const { Jimp } = require('jimp')
  const jsQR = require('jsqr')
  const res = await fetch(input)
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
    console.log('Skipped (no image URL or qrData provided)')
    console.log('   Usage: node test-apislip-simple.js <image_url|qrData>')
    return
  }

  console.log(`Base URL: ${BASE_URL}`)
  let qrData
  try {
    qrData = await decodeQr(input)
    console.log(`QR data: ${qrData.substring(0, 48)}${qrData.length > 48 ? '…' : ''}`)
  } catch (err) {
    console.error('QR decode failed:', err.message)
    return
  }

  try {
    const res = await fetch(`${BASE_URL}/qr/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrData }),
    })
    const data = await res.json()
    const t = data?.slipVerification?.transfer

    if (res.ok && data?.type === 'SLIP' && t?.transactionRef) {
      console.log('Verification Success!')
      console.log(`   Amount: ${t.amount?.amount} ${t.amount?.currency?.code || 'THB'}`)
      console.log(`   Ref: ${t.transactionRef}`)
      console.log(`   Date: ${t.transactionDateTime}`)
      console.log(`   Sender: ${t.fromAccountName || '-'} (${t.fromBankName || '-'}) ${t.fromAccountNo || ''}`)
      console.log(`   Receiver: ${t.toAccountName || '-'} (${t.toBankName || '-'}) ${t.toAccountNo || ''}`)
    } else {
      console.log('Verification failed')
      console.log(`   Code: ${data?.code || '-'}`)
      console.log(`   Message: ${data?.message || data?.title || '-'}`)
    }
  } catch (err) {
    console.error('Failed:', err.message)
  }
}

testVerifySlip()
