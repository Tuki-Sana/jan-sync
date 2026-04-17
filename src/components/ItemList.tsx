import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { type ScannedItem, type JanList, loadAllItems, removeItem, removeItems, saveItem, taxIn } from '../lib/db'
import { type CsvDelimiter, type CsvPreset, triggerExportDownload } from '../lib/csvExport'
import { formatDate, isValidJan, parsePriceInput } from '../lib/utils'

type ExportMenuId = 'preset' | 'delimiter'

const EXPORT_PRESET_OPTIONS: { value: CsvPreset; label: string }[] = [
  { value: 'full', label: 'すべて（JAN・名前・個数・価格・リスト・日時）' },
  { value: 'jan_name', label: 'JAN と名前のみ' },
  { value: 'jan_only', label: 'JAN のみ' },
]

const EXPORT_DELIMITER_OPTIONS: { value: CsvDelimiter; label: string }[] = [
  { value: 'comma', label: 'カンマ（.csv）' },
  { value: 'tab', label: 'タブ（.tsv・Excel / WPS 向け）' },
]

interface ExportDropdownProps {
  menuId: ExportMenuId
  openMenu: () => ExportMenuId | null
  setOpenMenu: (v: ExportMenuId | null) => void
  fieldLabel: string
  /** 現在値（親の signal から渡す） */
  value: string
  options: readonly { value: string; label: string }[]
  onSelect: (value: string) => void
}

/** 一覧のエクスポート用カスタムドロップダウン（ネイティブ select 不使用） */
function ExportDropdown(props: ExportDropdownProps) {
  let root: HTMLDivElement | undefined

  const isOpen = () => props.openMenu() === props.menuId
  const currentLabel = () =>
    props.options.find((o) => o.value === props.value)?.label ?? props.value

  onMount(() => {
    const onDocDown = (e: MouseEvent) => {
      if (props.openMenu() !== props.menuId) return
      const t = e.target as Node
      if (root && !root.contains(t)) props.setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDocDown, true)
    onCleanup(() => document.removeEventListener('mousedown', onDocDown, true))
  })

  return (
    <div ref={(el) => { root = el }} class="relative flex flex-col gap-1">
      <span class="text-xs text-slate-500" id={`export-label-${props.menuId}`}>
        {props.fieldLabel}
      </span>
      <button
        type="button"
        class="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-left text-sm font-medium text-slate-800 shadow-sm ring-slate-900/5 touch-manipulation active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        aria-labelledby={`export-label-${props.menuId}`}
        aria-controls={`export-listbox-${props.menuId}`}
        onClick={() => props.setOpenMenu(isOpen() ? null : props.menuId)}
      >
        <span class="min-w-0 flex-1 truncate">{currentLabel()}</span>
        <span class="shrink-0 text-slate-400" aria-hidden="true">
          {isOpen() ? '▴' : '▾'}
        </span>
      </button>
      <Show when={isOpen()}>
        <div
          id={`export-listbox-${props.menuId}`}
          role="listbox"
          class="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/10"
        >
          <For each={[...props.options]}>
            {(opt) => (
              <button
                type="button"
                role="option"
                aria-selected={opt.value === props.value}
                class={`w-full px-3 py-2.5 text-left text-sm touch-manipulation active:bg-slate-100/90 ${
                  opt.value === props.value
                    ? 'bg-blue-50/95 font-semibold text-blue-900'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
                onClick={() => {
                  props.onSelect(opt.value)
                  props.setOpenMenu(null)
                }}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

export default function ItemList(props: { lists: JanList[] }) {
  const [items, setItems] = createSignal<ScannedItem[]>([])
  const [query, setQuery] = createSignal('')
  const [loading, setLoading] = createSignal(true)
  const [expandedId, setExpandedId] = createSignal<string | null>(null)
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set())
  const [pendingDeleteOneId, setPendingDeleteOneId] = createSignal<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = createSignal(false)
  const [janDraft, setJanDraft] = createSignal('')
  const [exportPreset, setExportPreset] = createSignal<CsvPreset>('full')
  const [exportExpandQty, setExportExpandQty] = createSignal(false)
  const [exportDelimiter, setExportDelimiter] = createSignal<CsvDelimiter>('comma')
  const [openExportMenu, setOpenExportMenu] = createSignal<ExportMenuId | null>(null)

  function runExport() {
    triggerExportDownload(filtered(), listMap(), {
      preset: exportPreset(),
      expandQuantity: exportExpandQty(),
      delimiter: exportDelimiter(),
    })
  }

  /** 展開行が変わったときだけ JAN 下書きを同期（入力中に items の他フィールド更新で潰さない） */
  let prevExpandedId: string | null | undefined
  createEffect(() => {
    const id = expandedId()
    if (id === prevExpandedId) return
    prevExpandedId = id
    if (id) {
      const row = items().find((i) => i.id === id)
      setJanDraft(row?.jan ?? '')
    } else {
      setJanDraft('')
    }
  })

  onMount(async () => {
    setItems(await loadAllItems())
    setLoading(false)
  })

  const listMap = createMemo(() =>
    Object.fromEntries(props.lists.map((l) => [l.id, l.name]))
  )

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return items()
    return items().filter(
      (i) => i.jan.includes(q) || i.name.toLowerCase().includes(q)
    )
  })

  const grouped = createMemo(() => {
    const map = new Map<string, ScannedItem[]>()
    for (const item of filtered()) {
      const list = map.get(item.listId) ?? []
      list.push(item)
      map.set(item.listId, list)
    }
    return props.lists
      .map((l) => ({ list: l, items: map.get(l.id) ?? [] }))
      .filter((g) => g.items.length > 0)
  })

  /** 検索結果が変わったら、表示にいない ID は選択から外す（A案） */
  createEffect(() => {
    const visible = new Set(filtered().map((i) => i.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)))
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev
      return next
    })
  })

  const selectedInFilteredCount = createMemo(() =>
    filtered().filter((i) => selectedIds().has(i.id)).length,
  )

  const allFilteredSelected = createMemo(() => {
    const f = filtered()
    return f.length > 0 && f.every((i) => selectedIds().has(i.id))
  })

  async function deleteOne(id: string) {
    await removeItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (expandedId() === id) setExpandedId(null)
  }

  const pendingDeleteOneItem = createMemo(() => {
    const id = pendingDeleteOneId()
    return id ? items().find((i) => i.id === id) : undefined
  })

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered().map((i) => i.id)))
  }

  function clearFilteredSelection() {
    const visible = new Set(filtered().map((i) => i.id))
    setSelectedIds((prev) => new Set([...prev].filter((id) => !visible.has(id))))
  }

  async function executeDeleteOne() {
    const id = pendingDeleteOneId()
    if (!id) return
    await deleteOne(id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setPendingDeleteOneId(null)
  }

  async function executeBulkDelete() {
    const ids = Array.from(selectedIds())
    if (ids.length === 0) return
    try {
      await removeItems(ids)
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)))
    } catch {
      try {
        setItems(await loadAllItems())
      } catch {
        /* ignore */
      }
    }
    setSelectedIds(new Set<string>())
    setBulkDeleteOpen(false)
    const ex = expandedId()
    if (ex && ids.includes(ex)) setExpandedId(null)
  }

  async function updateField(id: string, patch: Partial<ScannedItem>) {
    const updated = items().map((i) => i.id === id ? { ...i, ...patch } : i)
    setItems(updated)
    const target = updated.find((i) => i.id === id)
    if (target) await saveItem(target)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => prev === id ? null : id)
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (openExportMenu()) setOpenExportMenu(null)
      else if (bulkDeleteOpen()) setBulkDeleteOpen(false)
      else if (pendingDeleteOneId()) setPendingDeleteOneId(null)
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  return (
    <div class="flex flex-col gap-4 p-4">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="text-xl font-bold tracking-tight text-slate-800">一覧</h2>
        <span class="text-sm text-slate-400">全{items().length}件</span>
      </div>

      <div class="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
        <span class="text-xs font-semibold text-slate-500">表計算へ出力</span>
        <ExportDropdown
          menuId="preset"
          openMenu={openExportMenu}
          setOpenMenu={setOpenExportMenu}
          fieldLabel="列のセット"
          value={exportPreset()}
          options={EXPORT_PRESET_OPTIONS}
          onSelect={(v) => setExportPreset(v as CsvPreset)}
        />
        <div class="flex flex-col gap-1.5">
          <label class="flex cursor-pointer items-start gap-2 text-sm text-slate-700 touch-manipulation">
            <input
              type="checkbox"
              checked={exportExpandQty()}
              onChange={(e) => setExportExpandQty(e.currentTarget.checked)}
              class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
            />
            <span>個数ぶん行を縦に展開（1行＝1個単位）</span>
          </label>
          <Show when={exportPreset() === 'jan_only' || exportPreset() === 'jan_name'}>
            <p class="text-xs leading-relaxed text-slate-400 pl-6">
              縦展開ON時、同じ行を個数ぶん繰り返します（個数列なし）。
            </p>
          </Show>
        </div>
        <ExportDropdown
          menuId="delimiter"
          openMenu={openExportMenu}
          setOpenMenu={setOpenExportMenu}
          fieldLabel="区切り文字"
          value={exportDelimiter()}
          options={EXPORT_DELIMITER_OPTIONS}
          onSelect={(v) => setExportDelimiter(v as CsvDelimiter)}
        />
        <button
          type="button"
          onClick={runExport}
          disabled={filtered().length === 0}
          class="min-h-11 w-full rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 active:scale-[0.99] disabled:opacity-40 touch-manipulation"
        >
          ダウンロード
        </button>
        <span class="text-xs leading-relaxed text-slate-400">
          UTF-8（BOM付き）。Google スプレッドシートはインポートで指定可能です。
        </span>
      </div>

      <input
        type="search"
        placeholder="JANコード・名前で検索"
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      <Show when={!loading() && filtered().length > 0}>
        <div class="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 shadow-sm ring-1 ring-slate-900/5">
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span class="min-w-0 shrink-0 text-sm text-slate-600">
              表示中 <strong class="text-slate-800">{filtered().length}</strong> 件
            </span>
            <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <Show when={!allFilteredSelected()}>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  class="min-h-10 shrink-0 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 shadow-sm active:scale-[0.99] touch-manipulation"
                >
                  表示中の{filtered().length}件をすべて選択
                </button>
              </Show>
              <Show when={selectedInFilteredCount() > 0}>
                <button
                  type="button"
                  onClick={clearFilteredSelection}
                  class="min-h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm active:scale-[0.99] touch-manipulation"
                >
                  表示中の選択を解除
                </button>
              </Show>
            </div>
          </div>
          <Show when={selectedInFilteredCount() > 0}>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              class="w-full min-h-11 rounded-xl border border-rose-200 bg-rose-50/90 py-2 text-sm font-semibold text-rose-800 shadow-sm active:scale-[0.99] touch-manipulation"
            >
              選択した {selectedInFilteredCount()} 件を削除
            </button>
          </Show>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="text-center text-base text-slate-400">読み込み中...</p>
      </Show>

      <Show when={!loading() && items().length === 0}>
        <p class="py-8 text-center text-base text-slate-400">
          まだデータがありません。<br />スキャンタブで読み取ってください。
        </p>
      </Show>

      <Show when={!loading() && items().length > 0 && filtered().length === 0}>
        <p class="py-8 text-center text-base text-slate-400">
          「{query()}」に一致するアイテムはありません。
        </p>
      </Show>

      <For each={grouped()}>
        {(group) => (
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {listMap()[group.list.id] ?? group.list.id}
              </span>
              <span class="text-xs text-slate-300">{group.items.length}件</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <For each={group.items}>
                {(item) => (
                  <div class="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
                    {/* 折りたたみ行 */}
                    <div
                      class="flex min-h-14 items-center gap-3 px-3 py-2 cursor-pointer active:bg-slate-50 touch-manipulation"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds().has(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelect(item.id)
                        }}
                        class="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600 touch-manipulation"
                        aria-label={`${item.jan}を選択`}
                      />
                      <div class="flex-1 min-w-0">
                        <p class="font-mono text-sm font-bold text-slate-800">{item.jan}</p>
                        <div class="flex items-center gap-2">
                          <Show when={item.name}>
                            <p class="truncate text-xs text-slate-500">{item.name}</p>
                          </Show>
                          <p class="shrink-0 text-xs text-slate-300">{formatDate(item.scannedAt)}</p>
                        </div>
                      </div>

                      <Show when={item.retailPrice !== undefined || item.salePrice !== undefined}>
                        <div class="shrink-0 text-right text-xs text-slate-500">
                          <Show when={item.retailPrice !== undefined}>
                            <p>定価 ¥{item.retailPrice!.toLocaleString()}</p>
                          </Show>
                          <Show when={item.salePrice !== undefined}>
                            <p>売価 ¥{item.salePrice!.toLocaleString()}</p>
                          </Show>
                        </div>
                      </Show>

                      <span class="shrink-0 text-xs text-slate-300">
                        {expandedId() === item.id ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* 展開編集エリア */}
                    <Show when={expandedId() === item.id}>
                      <div class="border-t border-slate-100 px-3 py-3 flex flex-col gap-2">
                        {/* JAN */}
                        <div class="flex flex-col gap-1">
                          <span class="text-xs text-slate-500">JANコード</span>
                          <input
                            type="text"
                            inputmode="numeric"
                            value={janDraft()}
                            onInput={(e) =>
                              setJanDraft(e.currentTarget.value.replace(/\D/g, '').slice(0, 13))
                            }
                            onBlur={() => {
                              const v = janDraft().trim()
                              if (isValidJan(v)) void updateField(item.id, { jan: v })
                              else {
                                const row = items().find((i) => i.id === item.id)
                                setJanDraft(row?.jan ?? '')
                              }
                            }}
                            class="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm font-bold focus:border-blue-400 focus:outline-none"
                            maxLength={13}
                          />
                        </div>

                        {/* 名前 */}
                        <div class="flex flex-col gap-1">
                          <span class="text-xs text-slate-500">名前</span>
                          <input
                            type="text"
                            value={item.name}
                            onBlur={(e) => updateField(item.id, { name: e.currentTarget.value })}
                            placeholder="名前を入力..."
                            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                          />
                        </div>

                        {/* 個数（スキャン履歴と同じ三等分グリッド） */}
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
                        <div class="grid grid-cols-2 gap-2">
                          <div class="flex flex-col gap-1">
                            <span class="text-xs text-slate-500">定価（税抜）</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              value={item.retailPrice ?? ''}
                              onBlur={(e) => updateField(item.id, { retailPrice: parsePriceInput(e.currentTarget.value) })}
                              placeholder="¥0"
                              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                            <Show when={item.retailPrice !== undefined}>
                              <span class="text-xs text-slate-400">税込 ¥{taxIn(item.retailPrice!).toLocaleString()}</span>
                            </Show>
                          </div>
                          <div class="flex flex-col gap-1">
                            <span class="text-xs text-slate-500">売価（税抜）</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              value={item.salePrice ?? ''}
                              onBlur={(e) => updateField(item.id, { salePrice: parsePriceInput(e.currentTarget.value) })}
                              placeholder="¥0"
                              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                            />
                            <Show when={item.salePrice !== undefined}>
                              <span class="text-xs text-slate-400">税込 ¥{taxIn(item.salePrice!).toLocaleString()}</span>
                            </Show>
                          </div>
                        </div>

                        {/* 削除 */}
                        <button
                          type="button"
                          onClick={() => setPendingDeleteOneId(item.id)}
                          class="w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-medium text-rose-600 active:bg-rose-100 touch-manipulation"
                        >
                          削除
                        </button>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>

      {/* 1件削除の確認 */}
      <Show when={pendingDeleteOneId()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="閉じる"
            onClick={() => setPendingDeleteOneId(null)}
          />
          <div
            class="relative z-[61] w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="itemlist-delete-one-title"
            aria-describedby="itemlist-delete-one-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="itemlist-delete-one-title" class="text-lg font-bold text-slate-800">
              この履歴を削除しますか？
            </h3>
            <p id="itemlist-delete-one-desc" class="mt-2 text-base text-slate-600 leading-relaxed">
              <span class="font-mono font-semibold text-slate-800">{pendingDeleteOneItem()?.jan}</span>
              を削除します。一覧・スキャン履歴の両方から消えます。
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                type="button"
                class="w-full min-h-12 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm active:scale-[0.99] touch-manipulation"
                onClick={() => setPendingDeleteOneId(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                class="w-full min-h-12 rounded-xl bg-red-600 text-base font-semibold text-white shadow-lg shadow-red-600/20 active:scale-[0.98] touch-manipulation"
                onClick={() => void executeDeleteOne()}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* 選択一括削除の確認 */}
      <Show when={bulkDeleteOpen()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="閉じる"
            onClick={() => setBulkDeleteOpen(false)}
          />
          <div
            class="relative z-[61] w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="itemlist-bulk-title"
            aria-describedby="itemlist-bulk-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="itemlist-bulk-title" class="text-lg font-bold text-slate-800">
              選択した履歴を削除しますか？
            </h3>
            <p id="itemlist-bulk-desc" class="mt-2 text-base text-slate-600 leading-relaxed">
              <strong class="text-slate-800">{selectedInFilteredCount()}</strong> 件を削除します。取り消せません。
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                type="button"
                class="w-full min-h-12 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm active:scale-[0.99] touch-manipulation"
                onClick={() => setBulkDeleteOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                class="w-full min-h-12 rounded-xl bg-red-600 text-base font-semibold text-white shadow-lg shadow-red-600/20 active:scale-[0.98] touch-manipulation"
                onClick={() => void executeBulkDelete()}
              >
                {selectedInFilteredCount()} 件を削除する
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
