/** 税抜価格から税込価格を計算（10%、四捨五入） */
export function taxIn(price: number): number {
  return Math.round(price * 1.1)
}

/** JANコードのバリデーション（8桁または13桁の数字） */
export function isValidJan(jan: string): boolean {
  return /^\d{8}$|^\d{13}$/.test(jan)
}

/** 価格入力文字列をパース（数字以外を除去、NaNはundefined） */
export function parsePriceInput(val: string): number | undefined {
  const n = parseInt(val.replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? undefined : n
}

/** タイムスタンプを日本語ローカル日時文字列に変換 */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
