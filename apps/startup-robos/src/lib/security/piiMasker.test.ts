import { describe, it, expect } from 'vitest'
import { maskPII } from './piiMasker'

describe('maskPII', () => {
  it('空文字列は空文字列を返す', () => {
    expect(maskPII('')).toBe('')
  })

  it('日本の携帯電話（090-xxxx-xxxx）をマスクする', () => {
    expect(maskPII('連絡先: 090-1234-5678 まで')).toBe('連絡先: [PHONE] まで')
  })

  it('日本の携帯電話（ハイフンなし: 09012345678）をマスクする', () => {
    expect(maskPII('TEL: 09012345678')).toBe('TEL: [PHONE]')
  })

  it('日本の固定電話（03-xxxx-xxxx）をマスクする', () => {
    expect(maskPII('事務所: 03-1234-5678')).toBe('事務所: [PHONE]')
  })

  it('国際番号（+81-90-1234-5678）をマスクする', () => {
    expect(maskPII('+81-90-1234-5678 に電話して')).toBe('[PHONE] に電話して')
  })

  it('メールアドレスをマスクする', () => {
    expect(maskPII('send to user@example.com please')).toBe('send to [EMAIL] please')
  })

  it('ドット付きメールをマスクする', () => {
    expect(maskPII('first.last@sub.example.co.jp')).toBe('[EMAIL]')
  })

  it('クレジットカード番号をマスクする', () => {
    expect(maskPII('card: 4111 1111 1111 1111')).toBe('card: [CARD_NUMBER]')
  })

  it('ハイフンなしのクレジットカード番号をマスクする（ID_NUMBER に食われない）', () => {
    expect(maskPII('card: 4111111111111111')).toBe('card: [CARD_NUMBER]')
  })

  it('PII を含まないテキストは変換しない', () => {
    const clean = 'StartupRobos はエージェント型スタートアップ基盤です。'
    expect(maskPII(clean)).toBe(clean)
  })
})
