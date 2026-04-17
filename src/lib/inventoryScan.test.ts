import { describe, test, expect } from 'vitest'
import {
  clampInventoryCooldownMs,
  parseInventoryCooldownMs,
  INV_COOLDOWN_DEFAULT_MS,
  INV_COOLDOWN_MIN_MS,
  INV_COOLDOWN_MAX_MS,
} from './inventoryScan'

describe('clampInventoryCooldownMs', () => {
  test('50刻みに丸める', () => {
    expect(clampInventoryCooldownMs(73)).toBe(50)
    expect(clampInventoryCooldownMs(88)).toBe(100)
  })
  test('範囲外はクランプ', () => {
    expect(clampInventoryCooldownMs(0)).toBe(INV_COOLDOWN_MIN_MS)
    expect(clampInventoryCooldownMs(9999)).toBe(INV_COOLDOWN_MAX_MS)
  })
})

describe('parseInventoryCooldownMs', () => {
  test('無効はデフォルト', () => {
    expect(parseInventoryCooldownMs(null)).toBe(INV_COOLDOWN_DEFAULT_MS)
    expect(parseInventoryCooldownMs('')).toBe(INV_COOLDOWN_DEFAULT_MS)
    expect(parseInventoryCooldownMs('abc')).toBe(INV_COOLDOWN_DEFAULT_MS)
  })
  test('数値文字列を解釈', () => {
    expect(parseInventoryCooldownMs('200')).toBe(200)
  })
})
