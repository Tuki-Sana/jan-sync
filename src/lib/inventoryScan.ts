/** 棚卸しスキャン: 加算対象の範囲 */
export type InventoryTarget = 'top' | 'list'

export const INV_COOLDOWN_MIN_MS = 50
export const INV_COOLDOWN_MAX_MS = 500
export const INV_COOLDOWN_DEFAULT_MS = 200
export const INV_COOLDOWN_STEP_MS = 50

export function clampInventoryCooldownMs(ms: number): number {
  const stepped = Math.round(ms / INV_COOLDOWN_STEP_MS) * INV_COOLDOWN_STEP_MS
  return Math.min(INV_COOLDOWN_MAX_MS, Math.max(INV_COOLDOWN_MIN_MS, stepped))
}

export function parseInventoryCooldownMs(raw: string | null): number {
  const n = parseInt(raw ?? '', 10)
  if (Number.isNaN(n)) return INV_COOLDOWN_DEFAULT_MS
  return clampInventoryCooldownMs(n)
}
