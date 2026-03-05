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

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

export async function generateAiText({
  parts,
  systemPrompt,
  temperature = 0.4,
  maxTokens = 512,
  model = DEFAULT_MODEL,
}: GeminiRequestOptions) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[AI Error] Missing GEMINI_API_KEY environment variable')
    throw new Error('AI service not configured: Missing GEMINI_API_KEY')
  }

  // Log request for debugging (remove in production)
  console.log('[AI Request]', {
    model,
    partsCount: parts.length,
    hasSystemPrompt: !!systemPrompt,
    maxTokens,
  })

  try {
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
            ? {
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
            }
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
    
    // Check for blocked content or other issues
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
