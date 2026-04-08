import { createSignal, onCleanup, onMount } from 'solid-js'
import { readBarcodesFromImageFile, type ReadResult } from 'zxing-wasm/reader'

export default function Scanner() {
  let videoRef: HTMLVideoElement | undefined
  let canvasRef: HTMLCanvasElement | undefined
  let animFrameId: number | undefined

  const [result, setResult] = createSignal<string>('')
  const [error, setError] = createSignal<string>('')
  const [scanning, setScanning] = createSignal(false)

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      if (videoRef) {
        videoRef.srcObject = stream
        await videoRef.play()
        setScanning(true)
        scheduleFrame()
      }
    } catch (e) {
      setError('カメラへのアクセスに失敗しました: ' + (e as Error).message)
    }
  }

  function stopCamera() {
    if (animFrameId !== undefined) cancelAnimationFrame(animFrameId)
    if (videoRef?.srcObject) {
      const stream = videoRef.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      videoRef.srcObject = null
    }
    setScanning(false)
  }

  function scheduleFrame() {
    animFrameId = requestAnimationFrame(scanFrame)
  }

  async function scanFrame() {
    if (!videoRef || !canvasRef || videoRef.readyState < 2) {
      scheduleFrame()
      return
    }
    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    canvasRef.width = videoRef.videoWidth
    canvasRef.height = videoRef.videoHeight
    ctx.drawImage(videoRef, 0, 0)

    canvasRef.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], 'frame.png', { type: 'image/png' })
      let results: ReadResult[] = []
      try {
        results = await readBarcodesFromImageFile(file, {
          formats: ['EAN13', 'EAN8'],
        })
      } catch {
        // wasmロード前は無視
      }
      if (results.length > 0) {
        setResult(results[0].text)
        stopCamera()
        return
      }
      scheduleFrame()
    }, 'image/png')
  }

  onMount(() => {})
  onCleanup(() => stopCamera())

  return (
    <div class="flex flex-col items-center gap-4 p-4">
      <h2 class="text-xl font-bold">JANコードスキャナー</h2>

      <div class="relative w-full max-w-sm overflow-hidden rounded-lg border border-gray-300 bg-black">
        <video ref={videoRef} class="w-full" muted playsinline />
        <canvas ref={canvasRef} class="hidden" />
        {!scanning() && (
          <div class="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
            カメラが停止中
          </div>
        )}
      </div>

      {error() && (
        <p class="text-red-500 text-sm">{error()}</p>
      )}

      {result() ? (
        <div class="rounded-lg bg-green-50 border border-green-300 px-4 py-3 text-center">
          <p class="text-sm text-gray-500">スキャン結果</p>
          <p class="text-lg font-mono font-bold text-green-700">{result()}</p>
        </div>
      ) : null}

      <div class="flex gap-2">
        <button
          onClick={startCamera}
          disabled={scanning()}
          class="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
        >
          スキャン開始
        </button>
        <button
          onClick={stopCamera}
          disabled={!scanning()}
          class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 text-sm font-medium disabled:opacity-50"
        >
          停止
        </button>
        {result() && (
          <button
            onClick={() => setResult('')}
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
          >
            リセット
          </button>
        )}
      </div>
    </div>
  )
}
