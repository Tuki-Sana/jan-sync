import { createEffect, createSignal, For, onMount, Show } from 'solid-js'
import bwipjs from 'bwip-js/browser'
import { type ScannedItem, loadByList, taxIn } from '../lib/db'

/** 8桁は EAN-8、13桁は EAN-13（bwip-js の bcid に明示的に対応） */
function bcidForJan(jan: string): 'ean13' | 'ean8' {
  if (jan.length === 13) return 'ean13'
  if (jan.length === 8) return 'ean8'
  throw new Error('JAN は 8 桁または 13 桁である必要があります')
}

function BarcodeCard(props: { item: ScannedItem }) {
  let canvasRef: HTMLCanvasElement | undefined

  onMount(() => {
    if (!canvasRef) return
    if (!/^\d{8}$|^\d{13}$/.test(props.item.jan)) return
    try {
      bwipjs.toCanvas(canvasRef, {
        bcid: bcidForJan(props.item.jan),
        text: props.item.jan,
        scale: 3,
        height: 18,
        includetext: true,
        textxalign: 'center',
      })
    } catch { /* 無効なJANは無視 */ }
  })

  return (
    <div class="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-md ring-1 ring-slate-900/5">
      <Show when={props.item.name}>
        <p class="text-sm font-medium text-gray-700 text-center">{props.item.name}</p>
      </Show>
      <canvas ref={canvasRef} class="max-w-full" />
      <p class="font-mono text-xs text-gray-400">{props.item.jan}</p>

      {/* 価格表示 */}
      <Show when={props.item.retailPrice !== undefined || props.item.salePrice !== undefined}>
        <div class="w-full grid grid-cols-2 gap-1 text-center text-xs pt-1 border-t border-slate-100">
          <Show when={props.item.retailPrice !== undefined}>
            <div>
              <p class="text-gray-400">定価</p>
              <p class="font-medium text-gray-700">¥{props.item.retailPrice!.toLocaleString()}</p>
              <p class="text-gray-400">税込 ¥{taxIn(props.item.retailPrice!).toLocaleString()}</p>
            </div>
          </Show>
          <Show when={props.item.salePrice !== undefined}>
            <div>
              <p class="text-gray-400">売価</p>
              <p class="font-medium text-gray-700">¥{props.item.salePrice!.toLocaleString()}</p>
              <p class="text-gray-400">税込 ¥{taxIn(props.item.salePrice!).toLocaleString()}</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

type Mode = 'db' | 'manual'

export default function Generator(props: { listId: string }) {
  let manualCanvasRef: HTMLCanvasElement | undefined

  const [mode, setMode] = createSignal<Mode>('db')
  const [dbItems, setDbItems] = createSignal<ScannedItem[]>([])
  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>())
  const [generated, setGenerated] = createSignal<ScannedItem[]>([])
  const [loading, setLoading] = createSignal(true)
  const [multiManual, setMultiManual] = createSignal(false)
  const [janCode, setJanCode] = createSignal('')
  const [manualError, setManualError] = createSignal('')
  const [multiText, setMultiText] = createSignal('')
  const [multiGenerated, setMultiGenerated] = createSignal<ScannedItem[]>([])
  const [multiErrors, setMultiErrors] = createSignal<string[]>([])

  let listLoadGen = 0
  createEffect(() => {
    const id = props.listId
    const gen = ++listLoadGen
    setLoading(true)
    setSelected(new Set<string>())
    setGenerated([])
    void loadByList(id)
      .then((data) => {
        if (gen !== listLoadGen) return
        setDbItems(data)
        setLoading(false)
      })
      .catch(() => {
        if (gen !== listLoadGen) return
        setLoading(false)
      })
  })

  function toggleSelect(id: string) {
    const next = new Set<string>(selected())
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    const ids = dbItems().map((i) => i.id)
    setSelected(selected().size === ids.length ? new Set<string>() : new Set<string>(ids))
  }

  function generateFromDB() {
    setGenerated(dbItems().filter((i) => selected().has(i.id)))
  }

  function generateManual() {
    const code = janCode().trim()
    setManualError('')
    if (!/^\d{8}$|^\d{13}$/.test(code)) {
      setManualError('8桁または13桁の数字で入力してください')
      return
    }
    try {
      bwipjs.toCanvas(manualCanvasRef!, {
        bcid: bcidForJan(code),
        text: code,
        scale: 3,
        height: 18,
        includetext: true,
        textxalign: 'center',
      })
    } catch (e) {
      setManualError('生成に失敗しました: ' + (e as Error).message)
    }
  }

  function generateMulti() {
    const lines = multiText().split('\n').map((l) => l.trim()).filter(Boolean)
    const errors: string[] = []
    const valid: ScannedItem[] = []
    lines.forEach((line) => {
      if (/^\d{8}$|^\d{13}$/.test(line)) {
        valid.push({ id: crypto.randomUUID(), listId: '', jan: line, name: '', quantity: 1, scannedAt: 0 })
      } else {
        errors.push(`「${line}」は無効なコードです`)
      }
    })
    setMultiErrors(errors)
    setMultiGenerated(valid)
  }

  const allSelected = () => dbItems().length > 0 && selected().size === dbItems().length

  return (
    <div class="flex flex-col gap-4 p-4">
      <h2 class="text-center text-xl font-bold text-slate-800 tracking-tight">JANコード生成</h2>

      {/* モード切替 */}
      <div class="flex overflow-hidden rounded-2xl border border-slate-200/80 text-sm font-semibold shadow-sm">
        <button
          type="button"
          onClick={() => setMode('db')}
          class={`flex-1 min-h-12 py-3 transition-colors touch-manipulation active:scale-[0.99] ${mode() === 'db' ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-slate-500'}`}
        >スキャン履歴から生成</button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          class={`flex-1 min-h-12 py-3 transition-colors touch-manipulation active:scale-[0.99] ${mode() === 'manual' ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-slate-500'}`}
        >手動入力</button>
      </div>

      {/* DB モード */}
      <Show when={mode() === 'db'}>
        <Show when={loading()}>
          <p class="text-center text-base text-slate-400">読み込み中...</p>
        </Show>
        <Show when={!loading() && dbItems().length === 0}>
          <p class="text-center text-base text-slate-400 leading-relaxed">
            このリストにアイテムがありません。<br />スキャンタブで読み取ってください。
          </p>
        </Show>
        <Show when={!loading() && dbItems().length > 0}>
          <div class="flex items-center justify-between gap-2 min-h-10">
            <span class="text-sm font-medium text-slate-500">{selected().size} 件選択中</span>
            <button type="button" onClick={toggleAll} class="min-h-10 px-2 text-sm font-semibold text-blue-600 active:scale-95 transition-transform touch-manipulation">
              {allSelected() ? '全解除' : '全選択'}
            </button>
          </div>

          <div class="flex flex-col gap-2">
            <For each={dbItems()}>
              {(item) => (
                <label class="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-md ring-1 ring-slate-900/5 cursor-pointer active:bg-slate-50/80 touch-manipulation">
                  <input
                    type="checkbox"
                    checked={selected().has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    class="h-5 w-5 shrink-0 accent-blue-600"
                  />
                  <div class="flex-1 min-w-0 py-1">
                    <p class="font-mono text-base font-bold text-slate-800">{item.jan}</p>
                    <Show when={item.name}>
                      <p class="text-xs text-slate-500 truncate">{item.name}</p>
                    </Show>
                    <Show when={item.retailPrice !== undefined || item.salePrice !== undefined}>
                      <p class="text-xs text-slate-400">
                        {item.retailPrice !== undefined && `定価¥${item.retailPrice.toLocaleString()}`}
                        {item.retailPrice !== undefined && item.salePrice !== undefined && '　'}
                        {item.salePrice !== undefined && `売価¥${item.salePrice.toLocaleString()}`}
                      </p>
                    </Show>
                  </div>
                </label>
              )}
            </For>
          </div>

          <button
            type="button"
            onClick={generateFromDB}
            disabled={selected().size === 0}
            class="w-full min-h-12 rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-40 active:scale-[0.98] transition-transform touch-manipulation"
          >
            選択した {selected().size} 件のバーコードを生成
          </button>

          <Show when={generated().length > 0}>
            <div class="flex flex-col gap-3 mt-2">
              <h3 class="text-sm font-semibold text-slate-500">生成結果</h3>
              <For each={generated()}>
                {(item) => <BarcodeCard item={item} />}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      {/* 手動入力モード */}
      <Show when={mode() === 'manual'}>
        <div class="flex flex-col gap-3">
          {/* 単数/複数トグル */}
          <div class="flex min-h-12 items-center justify-between gap-3">
            <span class="text-base font-medium text-slate-600">複数入力</span>
            <button
              type="button"
              onClick={() => { setMultiManual(!multiManual()); setMultiGenerated([]); setMultiErrors([]) }}
              class={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors touch-manipulation active:scale-95 ${multiManual() ? 'bg-blue-600' : 'bg-slate-200'}`}
              aria-pressed={multiManual()}
            >
              <span class={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform ${multiManual() ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* 1件モード */}
          <Show when={!multiManual()}>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-600">JANコード（8桁 or 13桁）</label>
              <input
                type="text"
                inputmode="numeric"
                value={janCode()}
                onInput={(e) => setJanCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 13))}
                onKeyDown={(e) => e.key === 'Enter' && generateManual()}
                placeholder="例: 4901234567890"
                class="w-full min-h-12 rounded-2xl border border-slate-300 px-3 font-mono text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-sm"
                maxLength={13}
              />
            </div>
            {manualError() && <p class="text-base text-red-600">{manualError()}</p>}
            <button type="button" onClick={generateManual} class="w-full min-h-12 rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md active:scale-[0.98] transition-transform touch-manipulation">
              生成
            </button>
            <div class="flex min-h-28 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-4 shadow-inner ring-1 ring-slate-900/5">
              <canvas ref={manualCanvasRef} />
            </div>
          </Show>

          {/* 複数モード */}
          <Show when={multiManual()}>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-600 flex items-baseline gap-2">
                1行に1コード入力
                <span class="text-[11px] font-normal text-slate-400">（改行で何個でも追加可能）</span>
              </label>
              <textarea
                value={multiText()}
                onInput={(e) => setMultiText(e.currentTarget.value)}
                placeholder={'4901234567890\n49012345678901\n...'}
                rows={6}
                class="w-full min-h-[8.5rem] rounded-2xl border border-slate-300 px-3 py-3 font-mono text-base leading-relaxed focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none shadow-sm"
              />
            </div>
            <Show when={multiErrors().length > 0}>
              <div class="rounded-xl bg-red-50 px-3 py-2 border border-red-100">
                <For each={multiErrors()}>
                  {(e) => <p class="text-sm text-red-600">{e}</p>}
                </For>
              </div>
            </Show>
            <button
              type="button"
              onClick={generateMulti}
              disabled={!multiText().trim()}
              class="w-full min-h-12 rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-40 active:scale-[0.98] transition-transform touch-manipulation"
            >
              まとめて生成
            </button>
            <Show when={multiGenerated().length > 0}>
              <div class="flex flex-col gap-3">
                <h3 class="text-sm font-semibold text-slate-500">生成結果 ({multiGenerated().length}件)</h3>
                <For each={multiGenerated()}>
                  {(item) => <BarcodeCard item={item} />}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  )
}
