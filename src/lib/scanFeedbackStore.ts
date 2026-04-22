import { createSignal } from 'solid-js'
import type { SoundLevel, VibrateLevel } from './scanFeedback'

const LS_SOUND = 'jan-sync-scan-sound-level'
const LS_VIBRATE = 'jan-sync-vibrate-level'
const LS_SOUND_LEGACY = 'jan-sync-scan-sound'

function isSoundLevel(v: string | null): v is SoundLevel {
  return v === 'off' || v === 'low' || v === 'med' || v === 'high'
}

function isVibrateLevel(v: string | null): v is VibrateLevel {
  return v === 'off' || v === 'low' || v === 'med' || v === 'high'
}

/**
 * 新キーが無い／壊れている場合はレガシーまたは既定で解決し、新キーへ書き戻す。
 * 新キーが有効ならレガシーキーだけ残っていれば削除する。
 */
function readInitialSoundLevel(): SoundLevel {
  try {
    const v = localStorage.getItem(LS_SOUND)
    if (isSoundLevel(v)) {
      try {
        if (localStorage.getItem(LS_SOUND_LEGACY) !== null) {
          localStorage.removeItem(LS_SOUND_LEGACY)
        }
      } catch { /* ignore */ }
      return v
    }
    const level = localStorage.getItem(LS_SOUND_LEGACY) === '0' ? 'off' : 'med'
    try {
      localStorage.setItem(LS_SOUND, level)
      if (localStorage.getItem(LS_SOUND_LEGACY) !== null) {
        localStorage.removeItem(LS_SOUND_LEGACY)
      }
    } catch { /* ignore */ }
    return level
  } catch {
    return 'med'
  }
}

function readVibrateLevel(): VibrateLevel {
  try {
    const v = localStorage.getItem(LS_VIBRATE)
    if (isVibrateLevel(v)) return v
    return 'med'
  } catch {
    return 'med'
  }
}

const [soundLevel, _setSoundLevel] = createSignal<SoundLevel>(readInitialSoundLevel())
const [vibrateLevel, _setVibrateLevel] = createSignal<VibrateLevel>(readVibrateLevel())

export { soundLevel, vibrateLevel }

export function setSoundLevel(level: SoundLevel): void {
  _setSoundLevel(level)
  try { localStorage.setItem(LS_SOUND, level) } catch { /* ignore */ }
}

export function setVibrateLevel(level: VibrateLevel): void {
  _setVibrateLevel(level)
  try { localStorage.setItem(LS_VIBRATE, level) } catch { /* ignore */ }
}
