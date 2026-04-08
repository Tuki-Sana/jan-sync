import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { readBarcodesFromImageFile } from 'zxing-wasm/reader'
import { type ScannedItem, loadByList, saveItem, removeItem, clearByList, taxIn } from '../lib/db'

export default function Scanner(props: { listId: string }) {
  let videoRef: HTMLVideoElement | undefined
  let canvasRef: HTMLCanvasElement | undefined
  let animFrameId: number | undefined

  const [scanning, setScanning] = createSignal(false)
  const [error, setError] = createSignal('')
  const [items, setItems] = createSignal<ScannedItem[]>([])
  const [copiedId, setCopiedId] = createSignal('')
  const [editingId, setEditingId] = createSignal('')
  const [editJan, setEditJan] = createSignal('')

  onMount(async () => {
    setItems(await loadByList(props.listId))
  })

  // リスト切り替え時に再ロード
  let prevListId = props.listId
  const reloadIfNeeded = async () => {
    if (props.listId !== prevListId) {
      prevListId = props.listId
      stopCamera()
      setItems(await loadByList(props.listId))
    }
  }

  // ── カメラ制御 ──────────────────────────────────────────

  async function startCamera() {
    await reloadIfNeeded()
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
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
    if (!videoRef || !canvasRef || videoRef.readyState < 2) { scheduleFrame(); return }
    const ctx = canvasRef.getContext('2d')
    if (!ctx) return
    canvasRef.width = videoRef.videoWidth
    canvasRef.height = videoRef.videoHeight
    ctx.drawImage(videoRef, 0, 0)
    canvasRef.toBlob(async (blob) => {
      if (!blob) { scheduleFrame(); return }
      try {
        const results = await readBarcodesFromImageFile(
          new File([blob], 'frame.png', { type: 'image/png' }),
          { formats: ['EAN13', 'EAN8'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true },
        )
        if (results.length > 0) {
          navigator.vibrate?.(80)
          await addItem(results[0].text)
          stopCamera()
          return
        }
      } catch { /* wasmロード前は無視 */ }
      scheduleFrame()
    }, 'image/png')
  }

  // ── データ操作 ──────────────────────────────────────────

  async function addItem(jan: string) {
    await reloadIfNeeded()
    if (items()[0]?.jan === jan) { startCamera(); return }
    const item: ScannedItem = {
      id: crypto.randomUUID(),
      listId: props.listId,
      jan,
      name: '',
      scannedAt: Date.now(),
    }
    await saveItem(item)
    setItems([item, ...items()])
  }

  async function updateField(id: string, patch: Partial<ScannedItem>) {
    const updated = items().map((item) => item.id === id ? { ...item, ...patch } : item)
    setItems(updated)
    const target = updated.find((i) => i.id === id)
    if (target) await saveItem(target)
  }

  async function deleteItem(id: string) {
    await removeItem(id)
    setItems(items().filter((i) => i.id !== id))
  }

  async function deleteAll() {
    await clearByList(props.listId)
    setItems([])
  }

  // ── JAN編集 ─────────────────────────────────────────────

  function startEditJan(item: ScannedItem) {
    setEditingId(item.id)
    setEditJan(item.jan)
  }

  async function commitEditJan(id: string) {
    const jan = editJan().trim()
    if (/^\d{8}$|^\d{13}$/.test(jan)) await updateField(id, { jan })
    setEditingId('')
  }

  // ── コピー ───────────────────────────────────────────────

  async function copyJan(item: ScannedItem) {
    await navigator.clipboard.writeText(item.jan)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  function parsePriceInput(val: string) {
    const n = parseInt(val.replace(/[^\d]/g, ''), 10)
    return isNaN(n) ? undefined : n
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
          <div class="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">カメラが停止中</div>
        )}
        {scanning() && (
          <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 rounded" />
        )}
      </div>

      {error() && <p class="text-center text-sm text-red-500">{error()}</p>}

      {/* 操作ボタン */}
      <div class="flex justify-center gap-3">
        <button onClick={startCamera} disabled={scanning()} class="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40">
          スキャン開始
        </button>
        <button onClick={stopCamera} disabled={!scanning()} class="rounded-xl bg-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40">
          停止
        </button>
      </div>

      {/* 履歴 */}
      <Show when={items().length > 0}>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-500">スキャン履歴 ({items().length}件)</h3>
            <button onClick={deleteAll} class="text-xs text-gray-400">全件削除</button>
          </div>

          <For each={items()}>
            {(item) => (
              <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm flex flex-col gap-2">

                {/* JAN行 */}
                <Show when={editingId() === item.id} fallback={
                  <div class="flex items-center gap-2">
                    <button onClick={() => copyJan(item)} class="flex-1 text-left font-mono text-base font-bold text-blue-700">
                      {item.jan}
                    </button>
                    <span class="shrink-0 text-xs text-gray-400">
                      {copiedId() === item.id ? 'コピー済み✓' : 'タップでコピー'}
                    </span>
                    <button onClick={() => startEditJan(item)} class="shrink-0 text-gray-400 text-sm px-1">✏️</button>
                    <button onClick={() => deleteItem(item.id)} class="shrink-0 text-gray-300 text-lg leading-none">×</button>
                  </div>
                }>
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      inputmode="numeric"
                      value={editJan()}
                      onInput={(e) => setEditJan(e.currentTarget.value.replace(/\D/g, '').slice(0, 13))}
                      onKeyDown={(e) => e.key === 'Enter' && commitEditJan(item.id)}
                      class="flex-1 rounded-lg border border-blue-400 px-2.5 py-1 font-mono text-base font-bold text-blue-700 focus:outline-none"
                      autofocus
                    />
                    <button onClick={() => commitEditJan(item.id)} class="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs text-white">確定</button>
                    <button onClick={() => setEditingId('')} class="shrink-0 text-gray-400 text-sm">✕</button>
                  </div>
                </Show>

                {/* 名前 */}
                <input
                  type="text"
                  placeholder="名前を追加..."
                  value={item.name}
                  onBlur={(e) => updateField(item.id, { name: e.currentTarget.value })}
                  class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                />

                {/* 価格 */}
                <div class="grid grid-cols-2 gap-2">
                  {/* 定価 */}
                  <div class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">定価（税抜）</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      placeholder="¥0"
                      value={item.retailPrice ?? ''}
                      onBlur={(e) => updateField(item.id, { retailPrice: parsePriceInput(e.currentTarget.value) })}
                      class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                    <Show when={item.retailPrice !== undefined}>
                      <span class="text-xs text-gray-400">税込 ¥{taxIn(item.retailPrice!).toLocaleString()}</span>
                    </Show>
                  </div>
                  {/* 売価 */}
                  <div class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">売価（税抜）</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      placeholder="¥0"
                      value={item.salePrice ?? ''}
                      onBlur={(e) => updateField(item.id, { salePrice: parsePriceInput(e.currentTarget.value) })}
                      class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                    <Show when={item.salePrice !== undefined}>
                      <span class="text-xs text-gray-400">税込 ¥{taxIn(item.salePrice!).toLocaleString()}</span>
                    </Show>
                  </div>
                </div>

                {/* 検索 */}
                <div class="flex gap-2">
                  <a
                    href={`https://www.google.com/search?q=${item.jan}+${encodeURIComponent(item.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    class="flex-1 rounded-lg bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-700"
                  >Google</a>
                  <a
                    href={`https://search.yahoo.co.jp/search?p=${item.jan}+${encodeURIComponent(item.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    class="flex-1 rounded-lg bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-700"
                  >Yahoo!</a>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
