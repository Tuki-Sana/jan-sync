import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import Scanner from './components/Scanner'
import Generator from './components/Generator'
import ItemList from './components/ItemList'
import { type JanList, loadLists, saveList, deleteList } from './lib/db'

type Tab = 'scanner' | 'generator' | 'list'

export default function App() {
  const [tab, setTab] = createSignal<Tab>('scanner')
  const [lists, setLists] = createSignal<JanList[]>([])
  const [activeListId, setActiveListId] = createSignal<string>('')
  const [showListMenu, setShowListMenu] = createSignal(false)
  const [newListName, setNewListName] = createSignal('')
  const [creating, setCreating] = createSignal(false)
  const [deleteListId, setDeleteListId] = createSignal<string | null>(null)

  onMount(async () => {
    const loaded = await loadLists()
    setLists(loaded)
    if (loaded.length > 0) setActiveListId(loaded[0].id)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteListId()) cancelDeleteList()
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  const activeList = () => lists().find((l) => l.id === activeListId())

  async function createList() {
    const name = newListName().trim()
    if (!name) return
    const list: JanList = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    await saveList(list)
    setLists([...lists(), list])
    setActiveListId(list.id)
    setNewListName('')
    setCreating(false)
    setShowListMenu(false)
  }

  function openDeleteListConfirm(id: string) {
    setDeleteListId(id)
  }

  async function confirmDeleteList() {
    const id = deleteListId()
    if (!id) return
    await deleteList(id)
    const next = lists().filter((l) => l.id !== id)
    setLists(next)
    if (activeListId() === id) setActiveListId(next[0]?.id ?? '')
    setShowListMenu(false)
    setDeleteListId(null)
  }

  function cancelDeleteList() {
    setDeleteListId(null)
  }

  const deleteListTarget = () => {
    const id = deleteListId()
    return id ? lists().find((l) => l.id === id) : undefined
  }

  return (
    <div class="min-h-dvh bg-slate-50 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      {/* ヘッダー */}
      <header class="bg-white border-b border-slate-200/80 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 shadow-sm relative">
        <h1 class="text-center text-lg font-bold tracking-tight text-slate-800">JAN Sync</h1>

        {/* リスト選択 */}
        <div class="mt-2 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => {
              const open = !showListMenu()
              setShowListMenu(open)
              if (open) setCreating(false)
            }}
            class="flex-1 flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm shadow-sm active:scale-[0.98] transition-transform touch-manipulation"
          >
            <span class="truncate font-medium text-slate-700">
              {activeList()?.name ?? 'リストを選択'}
            </span>
            <span class="ml-1 shrink-0 text-slate-400">▾</span>
          </button>
          <button
            type="button"
            onClick={() => { setCreating(true); setShowListMenu(true) }}
            class="shrink-0 min-h-12 min-w-[5.5rem] rounded-xl border border-slate-200 bg-white px-3 text-sm text-blue-600 font-semibold shadow-sm active:scale-[0.98] transition-transform touch-manipulation"
          >
            ＋ 新規
          </button>
        </div>

      </header>

      {/* リスト選択 / 新規作成 — モバイル向けボトムシート（固定オーバーレイ） */}
      <Show when={showListMenu()}>
        <div class="fixed inset-0 z-40 flex flex-col justify-end" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
            aria-label="閉じる"
            onClick={() => { setShowListMenu(false); setCreating(false) }}
          />
          <div
            class="sheet-panel relative z-50 mx-auto flex w-full max-w-lg max-h-[min(92dvh,640px)] flex-col rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/10"
            role="dialog"
            aria-modal="true"
            aria-labelledby={creating() ? 'sheet-title-create' : 'sheet-title-list'}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ドラッグハンドル（視覚的アフォーダンス） */}
            <div class="flex shrink-0 justify-center pt-3 pb-1" aria-hidden="true">
              <div class="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            <Show
              when={creating()}
              fallback={
                <div class="flex min-h-0 flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
                  <div class="flex shrink-0 items-center justify-between gap-3 pb-3 pt-1">
                    <h2 id="sheet-title-list" class="text-lg font-bold text-slate-800">
                      リストを選ぶ
                    </h2>
                    <button
                      type="button"
                      class="min-h-11 min-w-11 shrink-0 rounded-xl text-slate-400 text-xl leading-none flex items-center justify-center active:scale-95 active:bg-slate-100 touch-manipulation"
                      onClick={() => { setShowListMenu(false); setCreating(false) }}
                      aria-label="閉じる"
                    >
                      ✕
                    </button>
                  </div>

                  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain -mx-1 px-1 max-h-[min(55dvh,28rem)]">
                    <Show when={lists().length === 0}>
                      <p class="py-8 text-center text-base text-slate-400">リストがありません</p>
                    </Show>
                    <ul class="flex flex-col gap-1 pb-2">
                      <For each={lists()}>
                        {(list) => (
                          <li>
                            <div
                              class={`flex min-h-14 items-center justify-between gap-2 rounded-2xl border px-3 active:bg-slate-50 touch-manipulation cursor-pointer ${
                                list.id === activeListId()
                                  ? 'border-blue-200 bg-blue-50/80 text-blue-700 font-semibold ring-1 ring-blue-100'
                                  : 'border-slate-200/80 bg-white shadow-sm'
                              }`}
                              onClick={() => { setActiveListId(list.id); setShowListMenu(false) }}
                            >
                              <span class="min-w-0 flex-1 truncate text-base">{list.name}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openDeleteListConfirm(list.id) }}
                                class="shrink-0 min-h-11 min-w-11 flex items-center justify-center text-slate-300 text-xl leading-none rounded-xl active:scale-95 active:text-red-500 touch-manipulation"
                                aria-label={`${list.name}を削除`}
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>

                  <div class="shrink-0 border-t border-slate-100 pt-3 mt-1">
                    <button
                      type="button"
                      class="w-full min-h-12 rounded-2xl border-2 border-blue-600 bg-white text-base font-semibold text-blue-600 shadow-sm active:scale-[0.99] transition-transform touch-manipulation"
                      onClick={() => setCreating(true)}
                    >
                      ＋ 新しいリストを作成
                    </button>
                  </div>
                </div>
              }
            >
              <div class="flex flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-1">
                <div class="flex shrink-0 items-center gap-2 pb-2">
                  <Show when={lists().length > 0}>
                    <button
                      type="button"
                      class="min-h-11 min-w-11 shrink-0 rounded-xl text-slate-600 text-xl flex items-center justify-center active:scale-95 active:bg-slate-100 touch-manipulation"
                      onClick={() => setCreating(false)}
                      aria-label="リスト一覧に戻る"
                    >
                      ←
                    </button>
                  </Show>
                  <h2 id="sheet-title-create" class="flex-1 text-lg font-bold text-slate-800">
                    新しいリスト
                  </h2>
                  <button
                    type="button"
                    class="min-h-11 min-w-11 shrink-0 rounded-xl text-slate-400 text-xl leading-none flex items-center justify-center active:scale-95 active:bg-slate-100 touch-manipulation"
                    onClick={() => { setShowListMenu(false); setCreating(false) }}
                    aria-label="閉じる"
                  >
                    ✕
                  </button>
                </div>
                <p class="text-sm text-slate-500 pb-4">
                  棚や用途ごとに分けておくと、あとから探しやすくなります。
                </p>
                <label class="block">
                  <span class="mb-2 block text-sm font-semibold text-slate-700">リスト名</span>
                  <input
                    type="text"
                    placeholder="例：日用品・店舗Aフロア"
                    value={newListName()}
                    onInput={(e) => setNewListName(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createList()}
                    class="w-full min-h-[52px] rounded-2xl border-2 border-slate-200 px-4 text-base font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none shadow-sm"
                    autofocus
                  />
                </label>
                <button
                  type="button"
                  onClick={createList}
                  class="mt-5 w-full min-h-12 rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-transform touch-manipulation"
                >
                  作成する
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* リスト削除の確認（中央モーダル・シートより前面） */}
      <Show when={deleteListId()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label="閉じる"
            onClick={cancelDeleteList}
          />
          <div
            class="relative z-[61] w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-list-title"
            aria-describedby="delete-list-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-list-title" class="text-lg font-bold text-slate-800">
              リストを削除しますか？
            </h3>
            <p id="delete-list-desc" class="mt-2 text-base text-slate-600 leading-relaxed">
              「<span class="font-semibold text-slate-800">{deleteListTarget()?.name ?? ''}</span>」と、このリストに含まれるスキャン履歴がすべて削除されます。この操作は取り消せません。
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                type="button"
                class="w-full min-h-12 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm active:scale-[0.99] transition-transform touch-manipulation"
                onClick={cancelDeleteList}
              >
                キャンセル
              </button>
              <button
                type="button"
                class="w-full min-h-12 rounded-xl bg-red-600 text-base font-semibold text-white shadow-lg shadow-red-600/20 active:scale-[0.98] transition-transform touch-manipulation"
                onClick={() => void confirmDeleteList()}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* タブ */}
      <nav class="flex border-b border-slate-200/80 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setTab('scanner')}
          class={`flex-1 min-h-12 py-3 text-sm font-semibold transition-colors touch-manipulation active:scale-[0.99] ${tab() === 'scanner' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
        >
          スキャン
        </button>
        <button
          type="button"
          onClick={() => setTab('generator')}
          class={`flex-1 min-h-12 py-3 text-sm font-semibold transition-colors touch-manipulation active:scale-[0.99] ${tab() === 'generator' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
        >
          生成
        </button>
        <button
          type="button"
          onClick={() => setTab('list')}
          class={`flex-1 min-h-12 py-3 text-sm font-semibold transition-colors touch-manipulation active:scale-[0.99] ${tab() === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
        >
          一覧
        </button>
      </nav>

      {/* コンテンツ */}
      <main class="mx-auto max-w-lg">
        <Show when={tab() === 'list'}>
          <ItemList lists={lists()} />
        </Show>
        <Show when={tab() !== 'list'}>
          <Show when={!activeListId()}>
            <div class="flex flex-col items-center gap-3 p-8 text-center">
              <p class="text-slate-500 text-base">「＋ 新規」からリストを作成してください</p>
            </div>
          </Show>
          <Show when={activeListId()}>
            {tab() === 'scanner'
              ? <Scanner listId={activeListId()} />
              : <Generator listId={activeListId()} />
            }
          </Show>
        </Show>
      </main>
    </div>
  )
}
