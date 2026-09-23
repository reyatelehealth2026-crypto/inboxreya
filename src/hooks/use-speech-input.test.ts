import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { joinSpeech, useSpeechInput } from './use-speech-input'

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: { results: unknown }) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start() {}
  stop() {
    this.onend?.()
  }
  say(text: string) {
    this.onresult?.({ results: { length: 1, 0: { 0: { transcript: text } } } })
  }
}

describe('useSpeechInput', () => {
  afterEach(() => {
    FakeRecognition.instances = []
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  })

  it('waits through silence, then closes by itself once the user has spoken', () => {
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition
    const onText = vi.fn()
    const { result } = renderHook(() => useSpeechInput({ onText, onError: vi.fn() }))

    act(() => result.current.start('ยา'))
    // Chrome gives up after ~8s of silence: error "no-speech", then end.
    act(() => {
      FakeRecognition.instances[0].onerror?.({ error: 'no-speech' })
      FakeRecognition.instances[0].onend?.()
    })
    expect(FakeRecognition.instances).toHaveLength(2)
    expect(result.current.isListening).toBe(true)

    act(() => FakeRecognition.instances[1].say('พาราเซตามอล'))
    expect(onText).toHaveBeenLastCalledWith('ยา พาราเซตามอล')

    // User pauses → Chrome ends the utterance → mic closes, no reopen.
    act(() => FakeRecognition.instances[1].onend?.())
    expect(FakeRecognition.instances).toHaveLength(2)
    expect(result.current.isListening).toBe(false)
  })

  it('stops immediately when the user taps the mic again before speaking', () => {
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition
    const { result } = renderHook(() => useSpeechInput({ onText: vi.fn(), onError: vi.fn() }))

    act(() => result.current.start(''))
    act(() => result.current.stop())
    expect(FakeRecognition.instances).toHaveLength(1)
    expect(result.current.isListening).toBe(false)
  })
})

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
