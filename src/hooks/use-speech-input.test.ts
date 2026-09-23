import { describe, expect, it } from 'vitest'
import { joinSpeech } from './use-speech-input'

describe('joinSpeech', () => {
  it('uses spoken text alone when nothing was typed', () => {
    expect(joinSpeech('', ' สวัสดีค่ะ ')).toBe('สวัสดีค่ะ')
  })

  it('appends spoken text after typed text with one space', () => {
    expect(joinSpeech('ยาพาราฯ  ', 'มีค่ะ')).toBe('ยาพาราฯ มีค่ะ')
  })

  it('keeps typed text untouched when nothing was said', () => {
    expect(joinSpeech('ขอบคุณค่ะ', '   ')).toBe('ขอบคุณค่ะ')
  })
})
