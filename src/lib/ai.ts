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
