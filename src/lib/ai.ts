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

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const DEFAULT_GLM_MODEL = process.env.GLM_MODEL || 'glm-4-flash'
const DEFAULT_GLM_BASE_URL =
  process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'

// AI_PROVIDER switches primary provider. Supported: 'gemini' (default) | 'glm'
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase()

function hasInlineData(parts: GeminiPart[]) {
  return parts.some((p) => 'inline_data' in p)
}

function flattenPartsToText(parts: GeminiPart[]): string {
  return parts
    .map((p) => ('text' in p ? p.text : ''))
    .filter(Boolean)
    .join('\n\n')
}

/**
 * OpenAI-compatible Chat Completions call.
 * Used for GLM (Zhipu AI / z.ai) and any other OpenAI-compatible provider.
 */
async function callOpenAiCompat({
  baseUrl,
  apiKey,
  model,
  prompt,
  systemPrompt,
  temperature,
  maxTokens,
  providerLabel,
}: {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  systemPrompt?: string
  temperature: number
  maxTokens: number
  providerLabel: string
}): Promise<string> {
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[AI Error] ${providerLabel} API error:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    })
    throw new Error(`AI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.delta?.content ||
    ''

  if (!text.trim()) {
    console.error(`[AI Error] Empty response from ${providerLabel}:`, data)
    throw new Error('AI response was empty')
  }

  return text.trim()
}

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
    console.error('[AI Error] Gemini API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
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
    console.error('[AI Error] Empty response from Gemini:', data)
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
  const partsHasImage = hasInlineData(parts)

  // GLM path: only when AI_PROVIDER=glm AND request is text-only.
  // Image prompts always fall through to Gemini because the z.ai coding endpoint
  // does not accept vision inputs.
  const useGlm =
    AI_PROVIDER === 'glm' && !partsHasImage && !!process.env.GLM_API_KEY

  const resolvedModel =
    model || (useGlm ? DEFAULT_GLM_MODEL : DEFAULT_GEMINI_MODEL)

  console.log('[AI Request]', {
    provider: useGlm ? 'glm' : 'gemini',
    model: resolvedModel,
    partsCount: parts.length,
    hasSystemPrompt: !!systemPrompt,
    maxTokens,
  })

  try {
    if (useGlm) {
      return await callOpenAiCompat({
        baseUrl: DEFAULT_GLM_BASE_URL,
        apiKey: process.env.GLM_API_KEY!,
        model: resolvedModel,
        prompt: flattenPartsToText(parts),
        systemPrompt,
        temperature,
        maxTokens,
        providerLabel: 'GLM',
      })
    }

    return await callGemini({
      parts,
      systemPrompt,
      temperature,
      maxTokens,
      model: resolvedModel,
    })
  } catch (error) {
    console.error('[AI Error] Failed to generate text:', error)
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
