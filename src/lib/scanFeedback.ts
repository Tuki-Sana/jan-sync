/**
 * スキャン成功時の触覚・短いビープ（レジ／ハンディ風）。
 * 音は「端末メディア音量を中付近でも聞き取れる」よう体感を寄せる（目安 55〜65% 前後）。
 * iOS 向けに、ユーザー操作のコールスタック内で primeScanAudio を呼ぶこと。
 */

export type SoundLevel = 'off' | 'low' | 'med' | 'high'
export type VibrateLevel = 'off' | 'low' | 'med' | 'high'

let sharedCtx: AudioContext | null = null

function getAudioContextClass(): (typeof AudioContext) | null {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** スキャン開始タップなど、ユーザー操作の同期処理内で呼ぶ */
export function primeScanAudio(): void {
  try {
    const Ctor = getAudioContextClass()
    if (!Ctor) return
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctor()
    }
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume()
    }
  } catch {
    /* 非対応・ブロック時は無視 */
  }
}

/** 基音と2倍音のゲインピーク [基音, 倍音] — レベル別 */
const SOUND_PEAKS: Record<Exclude<SoundLevel, 'off'>, [number, number]> = {
  low:  [0.22, 0.05],
  med:  [0.64, 0.15],
  high: [0.95, 0.23],
}

/** 成功時の短いビープ（off なら何もしない） */
export function playScanBeep(level: SoundLevel): void {
  if (level === 'off') return
  try {
    primeScanAudio()
    const ctx = sharedCtx
    if (!ctx || ctx.state === 'closed') return
    if (ctx.state === 'suspended') void ctx.resume()

    const t0 = ctx.currentTime
    const dur = 0.086
    const dest = ctx.destination
    const [peak, hPeak] = SOUND_PEAKS[level]

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1960, t0)
    /** 基音（メディア音量を下げても埋もれにくいようやや強め） */
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.007)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(dest)

    /** 2倍音を薄く足して帯域を広げ、小音量時の聞こえを補う */
    const oscH = ctx.createOscillator()
    const gainH = ctx.createGain()
    oscH.type = 'sine'
    oscH.frequency.setValueAtTime(3920, t0)
    gainH.gain.setValueAtTime(0.0001, t0)
    gainH.gain.exponentialRampToValueAtTime(hPeak, t0 + 0.005)
    gainH.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.88)
    oscH.connect(gainH)
    gainH.connect(dest)

    osc.start(t0)
    oscH.start(t0)
    osc.stop(t0 + dur + 0.012)
    oscH.stop(t0 + dur + 0.012)
  } catch {
    /* ignore */
  }
}

/** バイブパターン [パルス長, 間隔, ...] — レベル別 */
const VIBRATE_PATTERNS: Record<Exclude<VibrateLevel, 'off'>, number[]> = {
  low:  [55],
  med:  [95, 42, 95, 42, 110],
  high: [130, 35, 130, 35, 160],
}

/** バイブ（off なら何もしない。未対応時は長め単発にフォールバック） */
export function vibrateOnScanSuccess(level: VibrateLevel): void {
  if (level === 'off') return
  const v = navigator.vibrate?.bind(navigator)
  if (!v) return
  try {
    const ok = v(VIBRATE_PATTERNS[level])
    if (!ok) v(220)
  } catch {
    try {
      navigator.vibrate?.(220)
    } catch { /* ignore */ }
  }
}

export function disposeScanAudio(): void {
  if (!sharedCtx || sharedCtx.state === 'closed') return
  try {
    void sharedCtx.close()
  } catch { /* ignore */ }
  sharedCtx = null
}
