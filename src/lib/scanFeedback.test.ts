import { describe, test, expect, vi, afterEach } from 'vitest'
import { vibrateOnScanSuccess, playScanBeep, disposeScanAudio } from './scanFeedback'

afterEach(() => {
  disposeScanAudio()
  vi.restoreAllMocks()
})

describe('vibrateOnScanSuccess', () => {
  test('navigator.vibrate があれば呼ぶ', () => {
    const fn = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: fn, writable: true, configurable: true })
    vibrateOnScanSuccess()
    expect(fn).toHaveBeenCalled()
  })

  test('vibrate が無ければ落ちない', () => {
    const orig = navigator.vibrate
    try {
      Object.defineProperty(navigator, 'vibrate', { value: undefined, writable: true, configurable: true })
      expect(() => vibrateOnScanSuccess()).not.toThrow()
    } finally {
      Object.defineProperty(navigator, 'vibrate', { value: orig, writable: true, configurable: true })
    }
  })
})

describe('playScanBeep', () => {
  test('soundOff のときは落ちない', () => {
    expect(() => playScanBeep(false)).not.toThrow()
  })
})
