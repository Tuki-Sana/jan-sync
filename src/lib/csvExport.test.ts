import { describe, test, expect } from 'vitest'
import { buildExportRows, buildExportText, exportHeaders } from './csvExport'
import type { ScannedItem } from './db'

const listMap = { L1: 'テストリスト' }

const baseItem = (over: Partial<ScannedItem> = {}): ScannedItem => ({
  id: '1',
  listId: 'L1',
  jan: '4901234567890',
  name: '商品A',
  quantity: 2,
  retailPrice: 100,
  salePrice: 90,
  scannedAt: 1_700_000_000_000,
  ...over,
})

describe('exportHeaders', () => {
  test('full', () => {
    expect(exportHeaders('full')[0]).toBe('JAN')
    expect(exportHeaders('full').length).toBeGreaterThan(3)
  })
  test('jan_only', () => {
    expect(exportHeaders('jan_only')).toEqual(['JAN'])
  })
  test('jan_name', () => {
    expect(exportHeaders('jan_name')).toEqual(['JAN', '名前'])
  })
})

describe('buildExportRows', () => {
  test('jan_only は1商品1行', () => {
    const rows = buildExportRows([baseItem({ quantity: 5 })], listMap, {
      preset: 'jan_only',
      expandQuantity: false,
      delimiter: 'comma',
    })
    expect(rows).toEqual([['4901234567890']])
  })

  test('jan_only + 縦展開は個数ぶん同じJAN', () => {
    const rows = buildExportRows([baseItem({ quantity: 3 })], listMap, {
      preset: 'jan_only',
      expandQuantity: true,
      delimiter: 'comma',
    })
    expect(rows).toEqual([['4901234567890'], ['4901234567890'], ['4901234567890']])
  })

  test('full + 縦展開は各行個数が1', () => {
    const rows = buildExportRows([baseItem({ quantity: 2 })], listMap, {
      preset: 'full',
      expandQuantity: true,
      delimiter: 'comma',
    })
    expect(rows.length).toBe(2)
    expect(rows[0]![0]).toBe('4901234567890')
    expect(rows[0]![2]).toBe(1)
    expect(rows[1]![2]).toBe(1)
  })
})

describe('buildExportText', () => {
  test('タブ区切りにタブが含まれる', () => {
    const text = buildExportText([baseItem({ name: 'x' })], listMap, {
      preset: 'jan_name',
      expandQuantity: false,
      delimiter: 'tab',
    })
    expect(text.includes('\t')).toBe(true)
    expect(text.startsWith('\uFEFF')).toBe(false) // BOM は trigger 側
  })
})
