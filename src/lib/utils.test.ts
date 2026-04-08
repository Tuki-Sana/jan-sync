import { describe, test, expect } from 'vitest'
import { taxIn, isValidJan, parsePriceInput, formatDate } from './utils'

describe('taxIn', () => {
  test('1000円の税込は1100円', () => {
    expect(taxIn(1000)).toBe(1100)
  })
  test('100円の税込は110円', () => {
    expect(taxIn(100)).toBe(110)
  })
  test('端数は四捨五入される', () => {
    expect(taxIn(333)).toBe(366)  // 333 * 1.1 = 366.3 → 366
    expect(taxIn(455)).toBe(501)  // 455 * 1.1 = 500.5 → 501
  })
  test('0円は0円', () => {
    expect(taxIn(0)).toBe(0)
  })
})

describe('isValidJan', () => {
  test('13桁の数字は有効', () => {
    expect(isValidJan('4901234567890')).toBe(true)
  })
  test('8桁の数字は有効', () => {
    expect(isValidJan('49012345')).toBe(true)
  })
  test('12桁は無効', () => {
    expect(isValidJan('490123456789')).toBe(false)
  })
  test('文字を含む場合は無効', () => {
    expect(isValidJan('490123456789X')).toBe(false)
  })
  test('空文字は無効', () => {
    expect(isValidJan('')).toBe(false)
  })
})

describe('parsePriceInput', () => {
  test('数字文字列をパースする', () => {
    expect(parsePriceInput('1000')).toBe(1000)
  })
  test('¥記号を含む文字列をパースする', () => {
    expect(parsePriceInput('¥1,000')).toBe(1000)
  })
  test('空文字はundefinedを返す', () => {
    expect(parsePriceInput('')).toBeUndefined()
  })
  test('数字以外のみの文字列はundefinedを返す', () => {
    expect(parsePriceInput('abc')).toBeUndefined()
  })
  test('0は0を返す', () => {
    expect(parsePriceInput('0')).toBe(0)
  })
})

describe('formatDate', () => {
  test('タイムスタンプを日本語形式に変換する', () => {
    // 2026-04-09 14:32:00 JST
    const ts = new Date('2026-04-09T14:32:00+09:00').getTime()
    const result = formatDate(ts)
    expect(result).toContain('4')   // 月
    expect(result).toContain('9')   // 日
    expect(result).toContain('14')  // 時
    expect(result).toContain('32')  // 分
  })
})
