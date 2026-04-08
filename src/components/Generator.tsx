import { createSignal, onMount } from 'solid-js'
import bwipjs from 'bwip-js'

export default function Generator() {
  let canvasRef: HTMLCanvasElement | undefined

  const [janCode, setJanCode] = createSignal('')
  const [error, setError] = createSignal('')

  function generateBarcode() {
    const code = janCode().trim()
    setError('')

    if (!/^\d{8}$|^\d{13}$/.test(code)) {
      setError('JANコードは8桁または13桁の数字で入力してください')
      return
    }

    try {
      bwipjs.toCanvas(canvasRef!, {
        bcid: code.length === 13 ? 'ean13' : 'ean8',
        text: code,
        scale: 3,
        height: 20,
        includetext: true,
        textxalign: 'center',
      })
    } catch (e) {
      setError('バーコード生成に失敗しました: ' + (e as Error).message)
    }
  }

  function handleInput(e: InputEvent) {
    const val = (e.currentTarget as HTMLInputElement).value
    setJanCode(val.replace(/\D/g, '').slice(0, 13))
  }

  return (
    <div class="flex flex-col items-center gap-4 p-4">
      <h2 class="text-xl font-bold">JANコード生成</h2>

      <div class="flex w-full max-w-sm flex-col gap-2">
        <label class="text-sm text-gray-600">
          JANコード（8桁 or 13桁）
        </label>
        <input
          type="text"
          inputmode="numeric"
          value={janCode()}
          onInput={handleInput}
          placeholder="例: 4901234567890"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-mono focus:border-blue-500 focus:outline-none"
          maxLength={13}
        />
      </div>

      {error() && (
        <p class="text-red-500 text-sm">{error()}</p>
      )}

      <button
        onClick={generateBarcode}
        class="rounded-lg bg-blue-600 px-6 py-2 text-white text-sm font-medium"
      >
        生成
      </button>

      <div class="flex min-h-24 items-center justify-center rounded-lg border border-gray-200 bg-white p-4">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
