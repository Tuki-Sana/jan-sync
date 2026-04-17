import type { ScannedItem } from './db'
import { taxIn } from './db'
import { formatDate } from './utils'

/** Excel 等での数式解釈を避ける（先頭が = + - @ のときタブを前置） */
export function csvCell(cell: string | number): string {
  let s = String(cell)
  if (/^[=+\-@]/.test(s)) s = `\t${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * JAN 列専用。数字のみのコードは先頭にタブを付けてからクォートし、
 * Excel / Calc / スプレッドシートの数値化で先頭 0 が落ちにくくする。
 */
export function csvCellJan(jan: string): string {
  const t = String(jan).trim()
  if (/^\d+$/.test(t)) {
    return csvCell(`\t${t}`)
  }
  return csvCell(t)
}

export type CsvPreset = 'full' | 'jan_only' | 'jan_name'

export type CsvDelimiter = 'comma' | 'tab'

export interface CsvExportOptions {
  preset: CsvPreset
  /** true のとき、個数 N の商品を N 行に展開（各行列は項目ごとに分割） */
  expandQuantity: boolean
  delimiter: CsvDelimiter
}

function fullRow(i: ScannedItem, listMap: Record<string, string>): (string | number)[] {
  return [
    i.jan,
    i.name,
    i.quantity ?? 1,
    listMap[i.listId] ?? '',
    i.retailPrice ?? '',
    i.retailPrice !== undefined ? taxIn(i.retailPrice) : '',
    i.salePrice ?? '',
    i.salePrice !== undefined ? taxIn(i.salePrice) : '',
    formatDate(i.scannedAt),
  ]
}

/** 論理1件あたりのデータ行（ヘッダ除く）を生成。expandQuantity は呼び出し側で行複製 */
export function exportHeaders(preset: CsvPreset): string[] {
  switch (preset) {
    case 'jan_only':
      return ['JAN']
    case 'jan_name':
      return ['JAN', '名前']
    default:
      return ['JAN', '名前', '個数', 'リスト', '定価(税抜)', '定価(税込)', '売価(税抜)', '売価(税込)', 'スキャン日時']
  }
}

function rowForItem(
  preset: CsvPreset,
  i: ScannedItem,
  listMap: Record<string, string>,
): (string | number)[] {
  switch (preset) {
    case 'jan_only':
      return [i.jan]
    case 'jan_name':
      return [i.jan, i.name]
    default:
      return fullRow(i, listMap)
  }
}

/** 個数展開時、full プリセットの各行は個数欄を 1 にそろえる */
function fullRowQtyOne(i: ScannedItem, listMap: Record<string, string>): (string | number)[] {
  return [
    i.jan,
    i.name,
    1,
    listMap[i.listId] ?? '',
    i.retailPrice ?? '',
    i.retailPrice !== undefined ? taxIn(i.retailPrice) : '',
    i.salePrice ?? '',
    i.salePrice !== undefined ? taxIn(i.salePrice) : '',
    formatDate(i.scannedAt),
  ]
}

function expandedRows(
  preset: CsvPreset,
  i: ScannedItem,
  listMap: Record<string, string>,
): (string | number)[][] {
  const n = Math.max(1, Math.floor(i.quantity ?? 1))
  if (preset === 'full') {
    return Array.from({ length: n }, () => fullRowQtyOne(i, listMap))
  }
  const base = rowForItem(preset, i, listMap)
  return Array.from({ length: n }, () => [...base])
}

export function buildExportRows(
  items: ScannedItem[],
  listMap: Record<string, string>,
  options: CsvExportOptions,
): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const i of items) {
    if (options.expandQuantity) {
      rows.push(...expandedRows(options.preset, i, listMap))
    } else {
      rows.push(rowForItem(options.preset, i, listMap))
    }
  }
  return rows
}

export function buildExportText(
  items: ScannedItem[],
  listMap: Record<string, string>,
  options: CsvExportOptions,
): string {
  const sep = options.delimiter === 'tab' ? '\t' : ','
  const headers = exportHeaders(options.preset)
  const data = buildExportRows(items, listMap, options)
  const formatCell = (cell: string | number, colIdx: number) => {
    if (headers[colIdx] === 'JAN' && typeof cell === 'string') {
      return csvCellJan(cell)
    }
    return csvCell(cell)
  }
  const lines = [headers, ...data].map((row) => row.map(formatCell).join(sep))
  return lines.join('\n')
}

export function triggerExportDownload(
  items: ScannedItem[],
  listMap: Record<string, string>,
  options: CsvExportOptions,
): void {
  const text = buildExportText(items, listMap, options)
  const ext = options.delimiter === 'tab' ? 'tsv' : 'csv'
  const mime =
    options.delimiter === 'tab'
      ? 'text/tab-separated-values;charset=utf-8;'
      : 'text/csv;charset=utf-8;'
  const blob = new Blob(['\uFEFF' + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jan-sync-${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
