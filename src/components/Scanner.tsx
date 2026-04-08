import { createSignal, For, onCleanup } from 'solid-js'
import { readBarcodesFromImageFile } from 'zxing-wasm/reader'

interface ScannedItem {
  id: string
  jan: string
  name: string
}

export default function Scanner() {
  let videoRef: HTMLVideoElement | undefined
  let canvasRef: HTMLCanvasElement | undefined
  let animFrameId: number | undefined

  const [scanning, setScanning] = createSignal(false)
  const [error, setError] = createSignal('')
  const [items, setItems] = createSignal<ScannedItem[]>([])
  const [copiedId, setCopiedId] = createSignal('')

  async function startCamera() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
      if (!blob) { scheduleFrame(); return }
      const file = new File([blob], 'frame.png', { type: 'image/png' })
      try {
        const results = await readBarcodesFromImageFile(file, {
          formats: ['EAN13', 'EAN8'],
          tryHarder: true,
          tryRotate: true,
          tryInvert: true,
          tryDownscale: true,
        })
        if (results.length > 0) {
          navigator.vibrate?.(80)
          addItem(results[0].text)
          stopCamera()
          return
        }
      } catch {
        // wasmロード前は無視
      }
      scheduleFrame()
    }, 'image/png')
  }

  function addItem(jan: string) {
    // 直前と同じコードは追加しない
    if (items()[0]?.jan === jan) {
      startCamera()
      return
    }
    setItems([{ id: crypto.randomUUID(), jan, name: '' }, ...items()])
  }

  async function copyJan(item: ScannedItem) {
    await navigator.clipboard.writeText(item.jan)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  function updateName(id: string, name: string) {
    setItems(items().map((item) => (item.id === id ? { ...item, name } : item)))
  }

  function removeItem(id: string) {
    setItems(items().filter((item) => item.id !== id))
  }

  onCleanup(() => stopCamera())

  return (
    <div class="flex flex-col gap-4 p-4">
      <h2 class="text-center text-xl font-bold">JANコードスキャナー</h2>

      {/* カメラビュー */}
      <div class="relative w-full overflow-hidden rounded-xl border border-gray-300 bg-black" style="aspect-ratio: 4/3">
        <video ref={videoRef} class="w-full h-full object-cover" muted playsinline />
        <canvas ref={canvasRef} class="hidden" />
        {!scanning() && (
          <div class="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
            カメラが停止中
          </div>
        )}
        {scanning() && (
          <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 rounded" />
        )}
      </div>

      {error() && <p class="text-center text-sm text-red-500">{error()}</p>}

      {/* 操作ボタン */}
      <div class="flex justify-center gap-3">
        <button
          onClick={startCamera}
          disabled={scanning()}
          class="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          スキャン開始
        </button>
        <button
          onClick={stopCamera}
          disabled={!scanning()}
          class="rounded-xl bg-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40"
        >
          停止
        </button>
      </div>

      {/* スキャン履歴 */}
      {items().length > 0 && (
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-500">スキャン履歴</h3>
            <button
              onClick={() => setItems([])}
              class="text-xs text-gray-400"
            >
              全件削除
            </button>
          </div>

          <For each={items()}>
            {(item) => (
              <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm flex flex-col gap-2">
                {/* JANコード行 */}
                <div class="flex items-center gap-2">
                  <button
                    onClick={() => copyJan(item)}
                    class="flex-1 text-left font-mono text-base font-bold text-blue-700"
                  >
                    {item.jan}
                  </button>
                  <span class="shrink-0 text-xs text-gray-400">
                    {copiedId() === item.id ? 'コピー済み✓' : 'タップでコピー'}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    class="shrink-0 text-gray-300 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* 名前メモ */}
                <input
                  type="text"
                  placeholder="名前を追加..."
                  value={item.name}
                  onInput={(e) => updateName(item.id, e.currentTarget.value)}
                  class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                />

                {/* 検索ボタン */}
                <div class="flex gap-2">
                  <a
                    href={`https://www.google.com/search?q=${item.jan}+${encodeURIComponent(item.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex-1 rounded-lg bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-700"
                  >
                    Google
                  </a>
                  <a
                    href={`https://search.yahoo.co.jp/search?p=${item.jan}+${encodeURIComponent(item.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex-1 rounded-lg bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-700"
                  >
                    Yahoo!
                  </a>
                </div>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  )
}
