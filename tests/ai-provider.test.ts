import { execFile } from 'node:child_process'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const execFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  default: { execFile: execFileMock },
  execFile: execFileMock,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockedExecFile = vi.mocked(execFile)

describe('AI provider selection', () => {
  beforeEach(() => {
    mockedExecFile.mockReset()
    delete process.env.AI_PROVIDER
    delete process.env.CLAUDE_CODE_BIN
    delete process.env.AI_CLAUDE_CODE_TIMEOUT_MS
  })

  test('uses Claude Code print mode when AI_PROVIDER is claude-code', async () => {
    process.env.AI_PROVIDER = 'claude-code'
    process.env.CLAUDE_CODE_BIN = 'claude-test'
    mockedExecFile.mockImplementation(((_bin, _args, _options, callback) => {
      callback(null, JSON.stringify({ result: '{"ok":true}' }), '')
      return {} as ReturnType<typeof execFile>
    }) as typeof execFile)

    const { generateAiText } = await import('@/lib/ai')
    const output = await generateAiText({
      systemPrompt: 'Return JSON only',
      parts: [{ text: 'hello' }],
    })

    expect(output).toBe('{"ok":true}')
    expect(mockedExecFile).toHaveBeenCalledWith(
      'claude-test',
      expect.arrayContaining(['-p', '--output-format', 'json']),
      expect.objectContaining({ windowsHide: true }),
      expect.any(Function)
    )
  })

  test('rejects inline images for Claude Code provider', async () => {
    process.env.AI_PROVIDER = 'claude-code'

    const { generateAiText } = await import('@/lib/ai')

    await expect(generateAiText({
      parts: [{ inline_data: { mime_type: 'image/png', data: 'abc' } }],
    })).rejects.toThrow('inline image')
    expect(mockedExecFile).not.toHaveBeenCalled()
  })

  test('treats Claude Code JSON errors as provider failures', async () => {
    process.env.AI_PROVIDER = 'claude-code'
    mockedExecFile.mockImplementation(((_bin, _args, _options, callback) => {
      callback(null, JSON.stringify({ is_error: true, result: 'Not logged in' }), '')
      return {} as ReturnType<typeof execFile>
    }) as typeof execFile)

    const { generateAiText } = await import('@/lib/ai')

    await expect(generateAiText({
      parts: [{ text: 'hello' }],
    })).rejects.toThrow('Not logged in')
  })

  test('streams Claude Code output as a single text chunk', async () => {
    process.env.AI_PROVIDER = 'claude-code'
    mockedExecFile.mockImplementation(((_bin, _args, _options, callback) => {
      callback(null, JSON.stringify({ result: 'draft reply' }), '')
      return {} as ReturnType<typeof execFile>
    }) as typeof execFile)

    const { streamAiText } = await import('@/lib/ai')
    const onFinish = vi.fn()
    const stream = await streamAiText({
      parts: [{ text: 'write reply' }],
      onFinish,
    })
    const reader = stream.getReader()
    const first = await reader.read()
    const second = await reader.read()

    expect(new TextDecoder().decode(first.value)).toBe('draft reply')
    expect(second.done).toBe(true)
    expect(onFinish).toHaveBeenCalledWith('draft reply', {
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    })
  })
})
