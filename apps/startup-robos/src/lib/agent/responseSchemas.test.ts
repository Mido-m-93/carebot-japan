import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { extractText } from './responseSchemas'

type Msg = Pick<Anthropic.Messages.Message, 'content'>

describe('extractText', () => {
  it('extracts text from a normal text block', () => {
    const response = { content: [{ type: 'text' as const, text: 'Hello world', citations: null }] } satisfies Msg
    expect(extractText(response)).toBe('Hello world')
  })

  it('returns empty string for empty content array', () => {
    const response = { content: [] } as Msg
    expect(extractText(response)).toBe('')
  })

  it('returns empty string for non-text block (e.g. tool_use)', () => {
    const response = { content: [{ type: 'tool_use', id: 'x', name: 'f', input: {} }] } as unknown as Msg
    expect(extractText(response)).toBe('')
  })

  it('returns empty string when text is undefined', () => {
    const response = { content: [{ type: 'text', citations: null }] } as unknown as Msg
    expect(extractText(response)).toBe('')
  })

  it('only reads the first content block', () => {
    const response = {
      content: [
        { type: 'text' as const, text: 'first', citations: null },
        { type: 'text' as const, text: 'second', citations: null },
      ],
    } satisfies Msg
    expect(extractText(response)).toBe('first')
  })
})
