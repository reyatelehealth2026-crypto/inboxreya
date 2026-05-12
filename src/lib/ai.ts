import { logger } from './logger'

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }

interface GeminiRequestOptions {
  parts: GeminiPart[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
}

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

/**
 * Gemini v1beta generateContent call.
 */
async function callGemini({
  parts,
  systemPrompt,
  temperature,
  maxTokens,
  model,
}: {
  parts: GeminiPart[]
  systemPrompt?: string
  temperature: number
  maxTokens: number
  model: string
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('AI service not configured: Missing GEMINI_API_KEY')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
        ...(systemPrompt
          ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
          : {}),
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    logger.error('Gemini API error', {
      scope: 'ai:gemini',
      status: response.status,
      statusText: response.statusText,
      body: errorText.slice(0, 500),
    })
    throw new Error(`AI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  if (data?.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Content blocked by safety filters')
  }
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('') || ''

  if (!text.trim()) {
    logger.error('Empty response from Gemini', { scope: 'ai:gemini', data })
    throw new Error('AI response was empty')
  }

  return text.trim()
}

export async function generateAiText({
  parts,
  systemPrompt,
  temperature = 0.4,
  maxTokens = 512,
  model,
}: GeminiRequestOptions) {
  const resolvedModel = model || DEFAULT_GEMINI_MODEL

  logger.info('AI request', {
    scope: 'ai:gemini',
    provider: 'gemini',
    model: resolvedModel,
    partsCount: parts.length,
    hasSystemPrompt: !!systemPrompt,
    maxTokens,
  })

  try {
    return await callGemini({
      parts,
      systemPrompt,
      temperature,
      maxTokens,
      model: resolvedModel,
    })
  } catch (error) {
    logger.error(error, { scope: 'ai:gemini', model: resolvedModel })
    throw error
  }
}

export interface GeminiStreamUsage {
  promptTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * Stream tokens from Gemini's `streamGenerateContent` SSE endpoint.
 *
 * Returns a `ReadableStream<Uint8Array>` that the caller pipes back to the
 * client. Plain-text chunks (no SSE framing) so a basic `fetch` reader on the
 * UI side can append straight into a textarea.
 *
 * `onFinish` runs once after the upstream stream closes, with the full text
 * and usage metadata (from Gemini's `usageMetadata` field). Use it to log
 * cost/latency into `ai_usage_logs`.
 */
export async function streamAiText({
  parts,
  systemPrompt,
  temperature = 0.4,
  maxTokens = 512,
  model,
  onFinish,
}: GeminiRequestOptions & {
  onFinish?: (full: string, usage: GeminiStreamUsage) => void | Promise<void>
}): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('AI service not configured: Missing GEMINI_API_KEY')
  }
  const resolvedModel = model || DEFAULT_GEMINI_MODEL

  logger.info('AI stream request', {
    scope: 'ai:gemini-stream',
    model: resolvedModel,
    partsCount: parts.length,
    hasSystemPrompt: !!systemPrompt,
    maxTokens,
  })

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
        ...(systemPrompt
          ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
          : {}),
      }),
    }
  )

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => upstream.statusText)
    logger.error('Gemini stream API error', {
      scope: 'ai:gemini-stream',
      status: upstream.status,
      body: errorText.slice(0, 500),
    })
    throw new Error(`AI stream error (${upstream.status}): ${errorText}`)
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const upstreamReader = upstream.body.getReader()

  let fullText = ''
  let usage: GeminiStreamUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 }
  let buffer = ''

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read()
        if (done) {
          if (onFinish) await onFinish(fullText, usage)
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })

        // SSE frame separator is "\n\n"; each data line is `data: {json}`
        let sepIdx: number
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sepIdx)
          buffer = buffer.slice(sepIdx + 2)
          const dataLine = frame
            .split('\n')
            .find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          const json = dataLine.slice(6).trim()
          if (!json) continue
          try {
            const parsed = JSON.parse(json)
            const chunkText: string =
              parsed?.candidates?.[0]?.content?.parts
                ?.map((p: { text?: string }) => p.text || '')
                .join('') || ''
            if (chunkText) {
              fullText += chunkText
              controller.enqueue(encoder.encode(chunkText))
            }
            const um = parsed?.usageMetadata
            if (um) {
              usage = {
                promptTokens: um.promptTokenCount ?? usage.promptTokens,
                outputTokens: um.candidatesTokenCount ?? usage.outputTokens,
                totalTokens: um.totalTokenCount ?? usage.totalTokens,
              }
            }
          } catch {
            // Ignore malformed frame; upstream will close eventually
          }
        }
      } catch (err) {
        logger.error(err, { scope: 'ai:gemini-stream' })
        controller.error(err)
      }
    },
    cancel() {
      upstreamReader.cancel().catch(() => undefined)
    },
  })
}

export async function fetchImageAsInlineData(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error('Failed to fetch image')
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return {
    mimeType: contentType,
    data: base64,
  }
}
