import { execFile } from 'node:child_process'
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

type AiProvider = 'gemini' | 'claude-code'

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

function resolveAiProvider(): AiProvider {
  const configured = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim()
  if (configured === 'claude-code' || configured === 'claude_code' || configured === 'claude') {
    return 'claude-code'
  }
  return 'gemini'
}

function partsToText(parts: GeminiPart[]) {
  const unsupported = parts.filter((part) => 'inline_data' in part).length
  const text = parts
    .map((part) => ('text' in part ? part.text : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim()

  return { text, unsupported }
}

function parseClaudeCodeOutput(stdout: string): string {
  const raw = stdout.trim()
  if (!raw) throw new Error('Claude Code response was empty')

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw
  }

  if (parsed?.is_error) {
    throw new Error(typeof parsed.result === 'string' ? parsed.result : 'Claude Code returned an error')
  }
  if (typeof parsed === 'string') return parsed.trim()
  if (typeof parsed?.result === 'string') return parsed.result.trim()
  if (typeof parsed?.content === 'string') return parsed.content.trim()
  if (Array.isArray(parsed?.content)) {
    const text = parsed.content
      .map((part: { text?: string }) => part?.text || '')
      .join('')
      .trim()
    if (text) return text
  }
  const messageContent = parsed?.message?.content
  if (typeof messageContent === 'string') return messageContent.trim()
  if (Array.isArray(messageContent)) {
    const text = messageContent
      .map((part: { text?: string }) => part?.text || '')
      .join('')
      .trim()
    if (text) return text
  }

  throw new Error('Claude Code response did not contain text')
}

async function callClaudeCode({
  parts,
  systemPrompt,
  maxTokens,
}: {
  parts: GeminiPart[]
  systemPrompt?: string
  maxTokens: number
}): Promise<string> {
  const { text, unsupported } = partsToText(parts)
  if (unsupported > 0) {
    throw new Error('Claude Code provider does not support inline image input in this integration')
  }
  if (!text) {
    throw new Error('Claude Code request has no text input')
  }

  const bin = process.env.CLAUDE_CODE_BIN || 'claude'
  const timeoutMs = Number(process.env.AI_CLAUDE_CODE_TIMEOUT_MS || 90_000)
  const prompt = [
    systemPrompt ? `<system>\n${systemPrompt}\n</system>` : '',
    text,
    '',
    `Output budget: keep the response within about ${maxTokens} tokens.`,
  ].filter(Boolean).join('\n\n')

  try {
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = execFile(
        bin,
        ['-p', prompt, '--output-format', 'json'],
        {
          timeout: Number.isFinite(timeoutMs) ? timeoutMs : 90_000,
          maxBuffer: 1024 * 1024 * 4,
          windowsHide: true,
          env: {
            ...process.env,
            CLAUDE_CODE_SKIP_PROMPT_HISTORY: process.env.CLAUDE_CODE_SKIP_PROMPT_HISTORY || '1',
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error)
            return
          }
          resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
        }
      )
      child.stdin?.end()
    })

    if (stderr?.trim()) {
      logger.warn('Claude Code stderr', {
        scope: 'ai:claude-code',
        stderr: stderr.slice(0, 500),
      })
    }

    const output = parseClaudeCodeOutput(stdout)
    if (!output) throw new Error('Claude Code response was empty')
    return output
  } catch (error) {
    logger.error(error, { scope: 'ai:claude-code' })
    throw error
  }
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
          thinkingConfig: { thinkingBudget: 0 },
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
  const finishReason = data?.candidates?.[0]?.finishReason
  if (finishReason === 'SAFETY') {
    throw new Error('Content blocked by safety filters')
  }
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('AI response was truncated by the output token limit')
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
  const provider = resolveAiProvider()
  if (provider === 'claude-code') {
    logger.info('AI request', {
      scope: 'ai:claude-code',
      provider,
      partsCount: parts.length,
      hasSystemPrompt: !!systemPrompt,
      maxTokens,
    })
    return callClaudeCode({ parts, systemPrompt, maxTokens })
  }

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
    if (
      error instanceof Error &&
      error.message === 'AI response was truncated by the output token limit' &&
      maxTokens < 2048
    ) {
      const retryMaxTokens = Math.min(maxTokens * 2, 2048)
      logger.warn('AI response hit output token limit; retrying once', {
        scope: 'ai:gemini',
        model: resolvedModel,
        previousMaxTokens: maxTokens,
        retryMaxTokens,
      })
      return callGemini({
        parts,
        systemPrompt,
        temperature,
        maxTokens: retryMaxTokens,
        model: resolvedModel,
      })
    }
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
  if (resolveAiProvider() === 'claude-code') {
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const text = await callClaudeCode({ parts, systemPrompt, maxTokens })
          controller.enqueue(encoder.encode(text))
          if (onFinish) {
            await onFinish(text, { promptTokens: 0, outputTokens: 0, totalTokens: 0 })
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })
  }

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
          thinkingConfig: { thinkingBudget: 0 },
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
  let truncatedByMaxTokens = false

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read()
        if (done) {
          if (truncatedByMaxTokens) {
            controller.error(new Error('AI response was truncated by the output token limit'))
            return
          }
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
            if (parsed?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
              truncatedByMaxTokens = true
            }
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
