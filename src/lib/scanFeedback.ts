/**
 * スキャン成功時の触覚・短いビープ（レジ／ハンディ風）。
 * 音は「端末メディア音量を最大にしなくても聞き取れる」よう体感を寄せる（目安 50% 前後）。
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
    const dur = 0.086
    const dest = ctx.destination

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1960, t0)
    /** 基音（メディア音量を下げても埋もれにくいようやや強め） */
    const peak = 0.48
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
    const hPeak = 0.11
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
