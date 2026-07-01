import { describe, it, expect } from 'vitest'
import { escapeHtml, markdownToHtml } from './notify'

describe('escapeHtml', () => {
  it('< をエスケープする', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('& をエスケープする', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B')
  })

  it('クリーンなテキストは変換しない', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('markdownToHtml', () => {
  it('## 見出しを h2 に変換し、内容を HTML エスケープする', () => {
    expect(markdownToHtml('## <bad> heading')).toContain('<h2>&lt;bad&gt; heading</h2>')
  })

  it('- リストを li に変換する', () => {
    expect(markdownToHtml('- item one')).toContain('<li>item one</li>')
  })

  it('**bold** を strong に変換する', () => {
    expect(markdownToHtml('**hello**')).toContain('<strong>hello</strong>')
  })
})
