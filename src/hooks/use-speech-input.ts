'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal Web Speech API shapes — not every TS lib.dom ships them.
interface SpeechResultList {
  length: number
  [index: number]: { 0: { transcript: string } }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Append spoken text to whatever was already typed before the mic started. */
export function joinSpeech(base: string, spoken: string): string {
  const said = spoken.trim()
  if (!said) return base
  const head = base.trimEnd()
  return head ? `${head} ${said}` : said
}

interface UseSpeechInputOptions {
  onText: (text: string) => void
  onError: (message: string) => void
  lang?: string
}

// ponytail: browser Web Speech API (Chrome/Edge only, audio goes to Google).
// Swap for Soniox streaming if accuracy on drug names isn't good enough.
export function useSpeechInput({ onText, onError, lang = 'th-TH' }: UseSpeechInputOptions) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const callbacksRef = useRef({ onText, onError })
  callbacksRef.current = { onText, onError }

  // Detect after mount so SSR and first client render match.
  useEffect(() => setIsSupported(getRecognitionCtor() !== null), [])

  // Tap → speak → mic closes by itself when the user pauses (continuous=false).
  // Chrome also gives up after ~8s of silence ("no-speech"); until something
  // has been heard we reopen, so a slow start doesn't kill the mic.
  const wantListeningRef = useRef(false)
  const heardRef = useRef(false)

  const listen = useCallback(
    (base: string) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) return

      const recognition = new Ctor()
      recognition.lang = lang
      recognition.continuous = false
      recognition.interimResults = true
      recognition.onresult = (event) => {
        let spoken = ''
        for (let i = 0; i < event.results.length; i++) {
          spoken += event.results[i][0].transcript
        }
        if (spoken.trim()) heardRef.current = true
        callbacksRef.current.onText(joinSpeech(base, spoken))
      }
      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return
        wantListeningRef.current = false
        callbacksRef.current.onError(
          event.error === 'not-allowed' || event.error === 'service-not-allowed'
            ? 'ไม่ได้รับสิทธิ์ใช้ไมโครโฟน — อนุญาตไมค์ที่แถบที่อยู่ของเบราว์เซอร์'
            : `แปลงเสียงไม่สำเร็จ (${event.error})`
        )
      }
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return
        if (wantListeningRef.current && !heardRef.current) {
          listen(base)
          return
        }
        wantListeningRef.current = false
        recognitionRef.current = null
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    },
    [lang]
  )

  const start = useCallback(
    (base: string) => {
      if (!getRecognitionCtor()) return
      recognitionRef.current?.stop()
      wantListeningRef.current = true
      heardRef.current = false
      listen(base)
      setIsListening(true)
    },
    [listen]
  )

  const stop = useCallback(() => {
    wantListeningRef.current = false
    recognitionRef.current?.stop()
  }, [])

  // Stop and drop any late result — used on send so text doesn't reappear.
  const cancel = useCallback(() => {
    wantListeningRef.current = false
    const recognition = recognitionRef.current
    if (!recognition) return
    recognition.onresult = null
    recognition.stop()
  }, [])

  useEffect(
    () => () => {
      wantListeningRef.current = false
      recognitionRef.current?.stop()
    },
    []
  )

  return { isSupported, isListening, start, stop, cancel }
}
