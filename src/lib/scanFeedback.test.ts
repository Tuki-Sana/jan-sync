import { describe, test, expect, vi, afterEach } from 'vitest'
import { vibrateOnScanSuccess, playScanBeep, disposeScanAudio } from './scanFeedback'

afterEach(() => {
  disposeScanAudio()
  vi.restoreAllMocks()
})

describe('vibrateOnScanSuccess', () => {
  test('med: navigator.vibrate があれば呼ぶ', () => {
    const fn = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: fn, writable: true, configurable: true })
    vibrateOnScanSuccess('med')
    expect(fn).toHaveBeenCalled()
  })

  test('off: vibrate を呼ばない', () => {
    const fn = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: fn, writable: true, configurable: true })
    vibrateOnScanSuccess('off')
    expect(fn).not.toHaveBeenCalled()
  })

  test('low: navigator.vibrate があれば呼ぶ', () => {
    const fn = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: fn, writable: true, configurable: true })
    vibrateOnScanSuccess('low')
    expect(fn).toHaveBeenCalledWith([55])
  })

  test('high: 長めのパターンで呼ぶ', () => {
    const fn = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: fn, writable: true, configurable: true })
    vibrateOnScanSuccess('high')
    expect(fn).toHaveBeenCalledWith([130, 35, 130, 35, 160])
  })

  test('vibrate が無ければ落ちない', () => {
    const orig = navigator.vibrate
    try {
      Object.defineProperty(navigator, 'vibrate', { value: undefined, writable: true, configurable: true })
      expect(() => vibrateOnScanSuccess('med')).not.toThrow()
    } finally {
      Object.defineProperty(navigator, 'vibrate', { value: orig, writable: true, configurable: true })
    }
  })
})

describe('playScanBeep', () => {
  test('off のときは落ちない', () => {
    expect(() => playScanBeep('off')).not.toThrow()
  })

  test('low のときは落ちない', () => {
    expect(() => playScanBeep('low')).not.toThrow()
  })

  test('med のときは落ちない', () => {
    expect(() => playScanBeep('med')).not.toThrow()
  })

  test('high のときは落ちない', () => {
    expect(() => playScanBeep('high')).not.toThrow()
  })
})
