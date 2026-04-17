/**
 * スキャン成功時の触覚・短いビープ（レジ／ハンディ風）。
 * iOS 向けに、ユーザー操作のコールスタック内で primeScanAudio を呼ぶこと。
 */

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

/** 成功時の短いビープ（soundOn が false なら何もしない） */
export function playScanBeep(soundOn: boolean): void {
  if (!soundOn) return
  try {
    primeScanAudio()
    const ctx = sharedCtx
    if (!ctx || ctx.state === 'closed') return
    if (ctx.state === 'suspended') void ctx.resume()

    const t0 = ctx.currentTime
    const dur = 0.078
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(2000, t0)

    /** レジ寄りの聞き取りやすさ優先（端末のメディア音量に依存。0.5超は歪みやすい） */
    const peak = 0.44
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.01)
  } catch {
    /* ignore */
  }
}

/** 三連の長めパルス（小型端末でも感じやすい。未対応時は長め単発） */
export function vibrateOnScanSuccess(): void {
  const v = navigator.vibrate?.bind(navigator)
  if (!v) return
  try {
    const pattern = [95, 42, 95, 42, 110] as const
    const ok = v([...pattern])
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
