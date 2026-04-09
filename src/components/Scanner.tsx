import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { formatDate, isValidJan, parsePriceInput } from '../lib/utils'

import { readBarcodes } from 'zxing-wasm/reader'
import { type ScannedItem, loadByList, saveItem, removeItem, clearByList, taxIn } from '../lib/db'
import { IconPencil, IconTrash, IconCopy } from './icons'

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
  const [showClearConfirm, setShowClearConfirm] = createSignal(false)
  const [pendingDeleteItemId, setPendingDeleteItemId] = createSignal<string | null>(null)

  /** listId が変わったらカメラ停止・編集解除・履歴を差し替え */
  let listLoadGen = 0
  createEffect(() => {
    const listId = props.listId
    const gen = ++listLoadGen
    stopCamera()
    setEditingId('')
    setEditJan('')
    void loadByList(listId).then((data) => {
      if (gen === listLoadGen) setItems(data)
    }).catch(() => {})
  })

  // ── カメラ制御 ──────────────────────────────────────────

  async function startCamera() {
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

  let decodeLock = false

  async function scanFrame() {
    if (!videoRef || !canvasRef || videoRef.readyState < 2) { scheduleFrame(); return }
    const ctx = canvasRef.getContext('2d')
    if (!ctx) return
    canvasRef.width = videoRef.videoWidth
    canvasRef.height = videoRef.videoHeight
    ctx.drawImage(videoRef, 0, 0)
    canvasRef.toBlob((blob) => {
      if (!blob) { scheduleFrame(); return }
      if (decodeLock) { scheduleFrame(); return }
      decodeLock = true
      void (async () => {
        try {
          const results = await readBarcodes(
            blob,
            { formats: ['EAN13', 'EAN8'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true },
          )
          if (results.length > 0) {
            navigator.vibrate?.(200)
            const added = await addItem(results[0].text)
            if (added) {
              stopCamera()
              return
            }
          }
        } catch { /* wasmロード前は無視 */ } finally {
          decodeLock = false
        }
        scheduleFrame()
      })()
    }, 'image/png')
  }

  // ── データ操作 ──────────────────────────────────────────

  /** 保存して停止する場合 true。無効 JAN・先頭と重複のときは false（スキャン継続） */
  async function addItem(jan: string): Promise<boolean> {
    if (!isValidJan(jan)) return false
    if (items()[0]?.jan === jan) return false
    const item: ScannedItem = {
      id: crypto.randomUUID(),
      listId: props.listId,
      jan,
      name: '',
      quantity: 1,
      scannedAt: Date.now(),
    }
    await saveItem(item)
    setItems([item, ...items()])
    return true
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

  function pendingDeleteItem() {
    const id = pendingDeleteItemId()
    return id ? items().find((i) => i.id === id) : undefined
  }

  async function executeDeleteOne() {
    const id = pendingDeleteItemId()
    if (!id) return
    await deleteItem(id)
    setPendingDeleteItemId(null)
  }

  function cancelDeleteOne() {
    setPendingDeleteItemId(null)
  }

  async function executeClearAll() {
    await clearByList(props.listId)
    setItems([])
    setShowClearConfirm(false)
  }

  function cancelClearAll() {
    setShowClearConfirm(false)
  }

  // ── JAN編集 ─────────────────────────────────────────────

  function startEditJan(item: ScannedItem) {
    setEditingId(item.id)
    setEditJan(item.jan)
  }

  async function commitEditJan(id: string) {
    const jan = editJan().trim()
    if (!isValidJan(jan)) return
    await updateField(id, { jan })
    setEditingId('')
  }

  // ── コピー ───────────────────────────────────────────────

  async function copyJan(item: ScannedItem) {
    try {
      await navigator.clipboard.writeText(item.jan)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      setError('コピーに失敗しました（HTTPS で開いているか確認してください）')
      setTimeout(() => setError(''), 5000)
    }
  }

  onCleanup(() => stopCamera())

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pendingDeleteItemId()) cancelDeleteOne()
      else if (showClearConfirm()) cancelClearAll()
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  return (
    <div class="flex flex-col gap-4 p-4">
      <h2 class="text-center text-xl font-bold text-slate-800 tracking-tight">JANコードスキャナー</h2>

      {/* カメラビュー */}
      <div class="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-black shadow-lg ring-1 ring-black/5" style="aspect-ratio: 4/3">
        <video ref={videoRef} class="w-full h-full object-cover" muted playsinline />
        <canvas ref={canvasRef} class="hidden" />
        {!scanning() && (
          <div class="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-base">カメラが停止中</div>
        )}
        {scanning() && (
          <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/90 rounded shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        )}
      </div>

      {error() && <p class="text-center text-base text-red-600">{error()}</p>}

      {/* 操作ボタン（開始／停止を1ボタンでトグル） */}
      <button
        type="button"
        onClick={() => (scanning() ? stopCamera() : void startCamera())}
        class={`w-full min-h-14 rounded-2xl px-4 text-base font-semibold shadow-lg active:scale-[0.98] transition-transform touch-manipulation ${
          scanning()
            ? 'bg-slate-800 text-white shadow-slate-800/25'
            : 'bg-blue-600 text-white shadow-blue-600/20'
        }`}
        aria-pressed={scanning()}
      >
        {scanning() ? 'スキャン停止' : 'スキャン開始'}
      </button>

      {/* 履歴 */}
      <Show when={items().length > 0}>
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-slate-600">スキャン履歴（{items().length}件）</h3>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 text-sm font-semibold text-rose-800 shadow-sm active:scale-[0.98] active:bg-rose-100/90 transition-transform touch-manipulation"
            >
              <IconTrash class="h-4 w-4 text-rose-600" />
              全件削除
            </button>
          </div>

          <For each={items()}>
            {(item) => (
              <div class="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-md ring-1 ring-slate-900/5 flex flex-col gap-3">

                {/* JAN行 */}
                <Show when={editingId() === item.id} fallback={
                  <div class="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => startEditJan(item)}
                      class="mt-0.5 shrink-0 flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-blue-200/90 bg-gradient-to-b from-white to-blue-50/90 text-blue-700 shadow-[0_1px_2px_rgba(30,58,138,0.06)] ring-1 ring-blue-100/80 active:scale-[0.97] active:bg-blue-50/95 touch-manipulation"
                      aria-label="JANコードを編集"
                    >
                      <IconPencil class="h-5 w-5 shrink-0 opacity-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyJan(item)}
                      title={item.jan}
                      class="flex min-w-0 flex-1 flex-col items-stretch gap-1 rounded-xl border border-transparent px-2 py-1 text-left -mx-1 active:border-blue-100/80 active:bg-blue-50/80 active:scale-[0.99] transition-[transform,background-color,border-color] touch-manipulation"
                      aria-label={copiedId() === item.id ? 'コピー済み' : 'JANコードをコピー'}
                    >
                      <p class="truncate font-mono text-base font-bold leading-tight text-blue-700">{item.jan}</p>
                      <span class="text-xs text-slate-400">{formatDate(item.scannedAt)}</span>
                      <span class="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <IconCopy class="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {copiedId() === item.id ? 'コピー済み✓' : 'タップでコピー'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteItemId(item.id)}
                      class="mt-0.5 shrink-0 flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/90 text-rose-600 shadow-sm active:scale-95 active:bg-rose-100/90 touch-manipulation"
                      aria-label="この履歴を削除"
                    >
                      <IconTrash class="h-5 w-5" />
                    </button>
                  </div>
                }>
                  <div class="flex flex-col gap-2">
                    <input
                      type="text"
                      inputmode="numeric"
                      value={editJan()}
                      onInput={(e) => setEditJan(e.currentTarget.value.replace(/\D/g, '').slice(0, 13))}
                      onKeyDown={(e) => e.key === 'Enter' && commitEditJan(item.id)}
                      class="w-full min-h-12 rounded-xl border-2 border-blue-400 px-3 font-mono text-base font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      autofocus
                    />
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId('')}
                        class="min-h-12 w-full rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm active:scale-[0.99] transition-transform touch-manipulation"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => commitEditJan(item.id)}
                        class="min-h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white shadow-md shadow-blue-600/20 active:scale-[0.99] transition-transform touch-manipulation"
                      >
                        確定
                      </button>
                    </div>
                  </div>
                </Show>

                {/* 名前 */}
                <input
                  type="text"
                  placeholder="名前を追加..."
                  value={item.name}
                  onBlur={(e) => updateField(item.id, { name: e.currentTarget.value })}
                  class="w-full min-h-12 rounded-xl border border-slate-200 px-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />

                {/* 個数（ラベル位置・高さ・枠線を価格フィールドに合わせる） */}
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-medium text-slate-500">個数</span>
                  <div class="grid min-h-12 w-full grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                    <button
                      type="button"
                      onClick={() => updateField(item.id, { quantity: Math.max(1, (item.quantity ?? 1) - 1) })}
                      class="min-h-12 min-w-0 flex items-center justify-center text-xl font-bold text-slate-700 active:bg-slate-100 touch-manipulation"
                      aria-label="個数を減らす"
                    >
                      －
                    </button>
                    <input
                      type="text"
                      inputmode="numeric"
                      value={item.quantity ?? 1}
                      onBlur={(e) => {
                        const v = parseInt(e.currentTarget.value, 10)
                        updateField(item.id, { quantity: isNaN(v) || v < 1 ? 1 : v })
                      }}
                      class="min-h-12 min-w-0 w-full bg-transparent px-1 text-center text-base font-semibold text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateField(item.id, { quantity: (item.quantity ?? 1) + 1 })}
                      class="min-h-12 min-w-0 flex items-center justify-center text-xl font-bold text-slate-700 active:bg-slate-100 touch-manipulation"
                      aria-label="個数を増やす"
                    >
                      ＋
                    </button>
                  </div>
                </div>

                {/* 価格 */}
                <div class="grid grid-cols-2 gap-3">
                  {/* 定価 */}
                  <div class="flex flex-col gap-1">
                    <span class="text-xs font-medium text-slate-500">定価（税抜）</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      placeholder="¥0"
                      value={item.retailPrice ?? ''}
                      onBlur={(e) => updateField(item.id, { retailPrice: parsePriceInput(e.currentTarget.value) })}
                      class="w-full min-h-12 rounded-xl border border-slate-200 px-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                    <Show when={item.retailPrice !== undefined}>
                      <span class="text-xs text-slate-400">税込 ¥{taxIn(item.retailPrice!).toLocaleString()}</span>
                    </Show>
                  </div>
                  {/* 売価 */}
                  <div class="flex flex-col gap-1">
                    <span class="text-xs font-medium text-slate-500">売価（税抜）</span>
                    <input
                      type="text"
                      inputmode="numeric"
                      placeholder="¥0"
                      value={item.salePrice ?? ''}
                      onBlur={(e) => updateField(item.id, { salePrice: parsePriceInput(e.currentTarget.value) })}
                      class="w-full min-h-12 rounded-xl border border-slate-200 px-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                    <Show when={item.salePrice !== undefined}>
                      <span class="text-xs text-slate-400">税込 ¥{taxIn(item.salePrice!).toLocaleString()}</span>
                    </Show>
                  </div>
                </div>

                {/* 検索 */}
                <div class="flex w-full gap-2">
                  <a
                    href={`https://www.google.com/search?q=${item.jan}+${encodeURIComponent(item.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    class="flex-1 flex min-h-12 items-center justify-center rounded-2xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm active:scale-95 active:bg-slate-50 transition-transform select-none touch-manipulation"
                  >Google</a>
                  <a
                    href={`https://search.yahoo.co.jp/search?p=${item.jan}+${encodeURIComponent(item.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    class="flex-1 flex min-h-12 items-center justify-center rounded-2xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm active:scale-95 active:bg-slate-50 transition-transform select-none touch-manipulation"
                  >Yahoo!</a>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* 1件削除の確認（中央モーダル） */}
      <Show when={pendingDeleteItemId()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="閉じる"
            onClick={cancelDeleteOne}
          />
          <div
            class="relative z-[61] w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-one-title"
            aria-describedby="delete-one-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-one-title" class="text-lg font-bold text-slate-800">
              この履歴を削除しますか？
            </h3>
            <p id="delete-one-desc" class="mt-2 text-base text-slate-600 leading-relaxed">
              <span class="font-mono font-semibold text-slate-800">{pendingDeleteItem()?.jan}</span>
              を削除します。名前・価格などの入力内容も失われます。
              <Show when={!!pendingDeleteItem()?.name?.trim()}>
                <span class="mt-2 block text-slate-500">
                  （{pendingDeleteItem()?.name}）
                </span>
              </Show>
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                type="button"
                class="w-full min-h-12 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm active:scale-[0.99] transition-transform touch-manipulation"
                onClick={cancelDeleteOne}
              >
                キャンセル
              </button>
              <button
                type="button"
                class="w-full min-h-12 rounded-xl bg-red-600 text-base font-semibold text-white shadow-lg shadow-red-600/20 active:scale-[0.98] transition-transform touch-manipulation"
                onClick={() => void executeDeleteOne()}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* 全件削除の確認（中央モーダル） */}
      <Show when={showClearConfirm()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="閉じる"
            onClick={cancelClearAll}
          />
          <div
            class="relative z-[61] w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-all-title"
            aria-describedby="clear-all-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="clear-all-title" class="text-lg font-bold text-slate-800">
              履歴をすべて削除しますか？
            </h3>
            <p id="clear-all-desc" class="mt-2 text-base text-slate-600 leading-relaxed">
              このリストに紐づくスキャン履歴がすべて削除されます。取り消すことはできません。
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                type="button"
                class="w-full min-h-12 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm active:scale-[0.99] transition-transform touch-manipulation"
                onClick={cancelClearAll}
              >
                キャンセル
              </button>
              <button
                type="button"
                class="w-full min-h-12 rounded-xl bg-red-600 text-base font-semibold text-white shadow-lg shadow-red-600/20 active:scale-[0.98] transition-transform touch-manipulation"
                onClick={() => void executeClearAll()}
              >
                すべて削除する
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
